-- Confirmación de contraseña para acciones sensibles ("modo sudo").
-- Aunque la sesión del administrador esté abierta, cambiar la contraseña/correo del perfil, generar códigos de
-- recuperación o tocar cuentas de administrador exige volver a escribir la contraseña. La confirmación dura
-- 10 minutos y vale SOLO para la sesión en la que se escribió (si alguien copia el token, no la hereda).

create table public.sudo_sessions (
  personal_id uuid not null references public.personal(id) on delete cascade,
  session_id  text not null default '',
  until_at    timestamptz not null,
  primary key (personal_id, session_id)
);
alter table public.sudo_sessions enable row level security;
revoke all on public.sudo_sessions from anon, authenticated;   -- solo funciones SECURITY DEFINER

-- Identificador de la sesión de Supabase Auth (claim session_id del JWT)
create or replace function public.app_sid() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id', '')
$$;
grant execute on function public.app_sid() to authenticated;

create or replace function public._require_sudo() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.sudo_sessions
                  where personal_id = public.app_pid() and session_id = public.app_sid() and until_at > clock_timestamp()) then
    raise exception 'SUDO_REQUIRED' using errcode = 'P0001';
  end if;
end $$;
revoke all on function public._require_sudo() from public, anon, authenticated;

-- Confirmar la contraseña del administrador que tiene la sesión. true = confirmada (10 min), false = incorrecta.
-- Se DEVUELVE false (no se lanza error) para que el intento fallido quede registrado y cuente para el bloqueo.
create or replace function public.verify_sudo(p_password text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare v_p public.personal; v_key text; v_fails int;
begin
  perform public._require_admin();
  select * into v_p from public.personal where id = public.app_pid() and rol = 'Admin' and estado = 'Activo';
  if v_p.id is null then raise exception 'No autorizado' using errcode = '42501'; end if;

  v_key := 'sudo:' || v_p.id::text;
  select count(*) into v_fails from public.login_attempts a
   where a.usuario = v_key and not a.ok and a.at > now() - interval '15 minutes'
     and a.at > coalesce((select max(b.at) from public.login_attempts b where b.usuario = v_key and b.ok), '-infinity');
  if v_fails >= 5 then
    raise exception 'Demasiados intentos. Intenta de nuevo en 15 minutos.' using errcode = '28000';
  end if;

  if v_p.password_hash = extensions.crypt(coalesce(p_password, ''), v_p.password_hash) then
    insert into public.login_attempts (usuario, ok, at) values (v_key, true, clock_timestamp());
    insert into public.sudo_sessions (personal_id, session_id, until_at)
    values (v_p.id, public.app_sid(), clock_timestamp() + interval '10 minutes')
    on conflict (personal_id, session_id) do update set until_at = excluded.until_at;
    delete from public.sudo_sessions where until_at < clock_timestamp() - interval '1 day';   -- limpieza
    return true;
  end if;

  insert into public.login_attempts (usuario, ok, at) values (v_key, false, clock_timestamp());
  return false;
end $$;
revoke all on function public.verify_sudo(text) from public, anon, authenticated;
grant execute on function public.verify_sudo(text) to authenticated;

-- Cierra la confirmación (al salir de Mi Perfil)
create or replace function public.end_sudo() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._require_admin();
  delete from public.sudo_sessions where personal_id = public.app_pid() and session_id = public.app_sid();
end $$;
revoke all on function public.end_sudo() from public, anon, authenticated;
grant execute on function public.end_sudo() to authenticated;

-- ── Acciones que ahora exigen la confirmación ───────────────────────────────

-- Perfil del super admin (usuario, contraseña, correo de recuperación)
create or replace function public.admin_update_profile(p_username text, p_password text, p_recovery_email text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._require_admin();
  perform public._require_sudo();
  if not exists (select 1 from public.personal where id = public.app_pid() and es_super) then
    raise exception 'Solo el super admin puede cambiar este perfil' using errcode = '42501';
  end if;
  update public.personal set
    usuario = coalesce(nullif(p_username, ''), usuario),
    password_hash = case when nullif(p_password, '') is null then password_hash
                         else extensions.crypt(p_password, extensions.gen_salt('bf', 10)) end,
    correo_recuperacion = coalesce(nullif(p_recovery_email, ''), correo_recuperacion)
  where id = public.app_pid();
  insert into public.app_config (param, value) values ('admin_recovery_email', p_recovery_email)
    on conflict (param) do update set value = excluded.value, updated_at = now()
    where nullif(excluded.value, '') is not null;
  perform public._audit('admin_update_profile', 'personal', public.app_pid()::text);
end $$;

-- Generar códigos de recuperación (los códigos dan acceso a la cuenta)
create or replace function public.generate_recovery_codes() returns text[]
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_codes text[] := '{}'; v_code text; v_bytes bytea; i int; j int;
begin
  perform public._require_admin();
  perform public._require_sudo();
  if not exists (select 1 from public.personal where id = public.app_pid() and rol = 'Admin' and estado = 'Activo') then
    raise exception 'Solo los administradores pueden generar códigos de recuperación' using errcode = '42501';
  end if;

  delete from public.recovery_codes where personal_id = public.app_pid();
  for i in 1..8 loop
    v_bytes := extensions.gen_random_bytes(12);
    v_code := '';
    for j in 0..11 loop
      v_code := v_code || substr(v_alpha, (get_byte(v_bytes, j) % 32) + 1, 1);
    end loop;
    insert into public.recovery_codes (personal_id, code_hash)
    values (public.app_pid(), extensions.crypt(v_code, extensions.gen_salt('bf', 8)));
    v_codes := v_codes || (substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4) || '-' || substr(v_code, 9, 4));
  end loop;

  perform public._audit('generate_recovery_codes', 'personal', public.app_pid()::text, jsonb_build_object('count', 8));
  return v_codes;
end $$;

-- Alta/edición de personal: crear o modificar una cuenta de ADMINISTRADOR exige confirmar la contraseña.
-- (Las cuentas de gestor siguen sin pedirla: no dan acceso al panel.)
create or replace function public.admin_save_personal(p jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid := nullif(p ->> 'id', '')::uuid; v_pw text := nullif(p ->> 'password', '');
begin
  perform public._require_admin();
  if p ->> 'rol' = 'Admin' or (v_id is not null and exists (select 1 from public.personal where id = v_id and rol = 'Admin')) then
    perform public._require_sudo();
  end if;
  if v_id is null then
    if v_pw is null then raise exception 'La contraseña es obligatoria'; end if;
    insert into public.personal (id_externo, nombre, usuario, password_hash, sector, estado, rol, correo_recuperacion)
    values (
      coalesce(nullif(p ->> 'id_externo', ''), right(floor(extract(epoch from now()) * 1000)::text, 6)),
      p ->> 'nombre', p ->> 'usuario',
      extensions.crypt(v_pw, extensions.gen_salt('bf', 10)),
      p ->> 'sector', coalesce(nullif(p ->> 'estado', ''), 'Activo'),
      coalesce(nullif(p ->> 'rol', ''), 'Inspector'), p ->> 'correo_recuperacion')
    returning id into v_id;
  else
    if exists (select 1 from public.personal where id = v_id and es_super)
       and (nullif(p ->> 'estado', '') = 'Inactivo' or coalesce(nullif(p ->> 'rol', ''), 'Admin') <> 'Admin') then
      raise exception 'No se puede desactivar ni degradar al super admin';
    end if;
    update public.personal set
      id_externo = coalesce(nullif(p ->> 'id_externo', ''), id_externo),
      nombre = coalesce(nullif(p ->> 'nombre', ''), nombre),
      usuario = coalesce(nullif(p ->> 'usuario', ''), usuario),
      password_hash = case when v_pw is null then password_hash else extensions.crypt(v_pw, extensions.gen_salt('bf', 10)) end,
      sector = coalesce(nullif(p ->> 'sector', ''), sector),
      estado = coalesce(nullif(p ->> 'estado', ''), estado),
      rol = coalesce(nullif(p ->> 'rol', ''), rol),
      correo_recuperacion = coalesce(nullif(p ->> 'correo_recuperacion', ''), correo_recuperacion)
    where id = v_id;
    if not found then raise exception 'Inspector no encontrado'; end if;
  end if;
  perform public._audit('admin_save_personal', 'personal', v_id::text, p - 'password');
  return v_id;
end $$;

create or replace function public.admin_delete_personal(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._require_admin();
  if exists (select 1 from public.personal where id = p_id and rol = 'Admin') then
    perform public._require_sudo();
  end if;
  if exists (select 1 from public.personal where id = p_id and es_super) then
    raise exception 'No se puede eliminar al super admin';
  end if;
  delete from public.personal where id = p_id;
  if not found then raise exception 'Inspector no encontrado'; end if;
  perform public._audit('admin_delete_personal', 'personal', p_id::text);
end $$;

-- Permisos (create or replace conserva los anteriores; se reafirman por claridad)
revoke all on function public.admin_update_profile(text, text, text) from public, anon, authenticated;
revoke all on function public.generate_recovery_codes() from public, anon, authenticated;
revoke all on function public.admin_save_personal(jsonb) from public, anon, authenticated;
revoke all on function public.admin_delete_personal(uuid) from public, anon, authenticated;
grant execute on function public.admin_update_profile(text, text, text) to authenticated;
grant execute on function public.generate_recovery_codes() to authenticated;
grant execute on function public.admin_save_personal(jsonb) to authenticated;
grant execute on function public.admin_delete_personal(uuid) to authenticated;
