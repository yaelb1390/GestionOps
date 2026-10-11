-- Recuperación de la contraseña de administrador con códigos de un solo uso.
-- El admin genera 8 códigos desde Mi Perfil y los guarda. Si olvida su clave, en el login usa
-- usuario + un código + nueva contraseña. Los códigos se guardan con bcrypt (como las contraseñas):
-- nadie, ni el servidor, puede volver a verlos después de generarlos.

create table public.recovery_codes (
  id          uuid primary key default gen_random_uuid(),
  personal_id uuid not null references public.personal(id) on delete cascade,
  code_hash   text not null,
  created_at  timestamptz not null default now(),
  used_at     timestamptz
);
create index recovery_codes_pend_idx on public.recovery_codes (personal_id) where used_at is null;
alter table public.recovery_codes enable row level security;
revoke all on public.recovery_codes from anon, authenticated;   -- sin policies: solo funciones SECURITY DEFINER

-- ── Generar un lote nuevo (invalida el anterior) ─────────────────────────────
-- Devuelve los 8 códigos en texto claro UNA sola vez. Alfabeto sin 0/O/1/I para evitar confusiones;
-- 32 símbolos x 12 = 60 bits por código (256 es múltiplo de 32: el sorteo no tiene sesgo).
create or replace function public.generate_recovery_codes() returns text[]
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_codes text[] := '{}'; v_code text; v_bytes bytea; i int; j int;
begin
  perform public._require_admin();
  if not exists (select 1 from public.personal where id = public.app_pid() and rol = 'Admin' and estado = 'Activo') then
    raise exception 'Solo los administradores pueden generar códigos de recuperación' using errcode = '42501';
  end if;

  delete from public.recovery_codes where personal_id = public.app_pid();   -- el lote anterior deja de valer
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

-- ── Estado para mostrar en Mi Perfil ─────────────────────────────────────────
create or replace function public.recovery_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform public._require_admin();
  select jsonb_build_object(
           'total', count(*)::int,
           'unused', count(*) filter (where used_at is null)::int,
           'generated_at', max(created_at))
    into r from public.recovery_codes where personal_id = public.app_pid();
  return r;
end $$;

-- ── Restablecer con un código (solo la Edge Function auth-recover, con service_role) ────────────
create or replace function public.recover_password(p_usuario text, p_code text, p_new text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_norm text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_key text := 'rec:' || lower(btrim(coalesce(p_usuario, '')));
  v_fails int; v_p public.personal; v_cid uuid; v_left int;
begin
  -- Bloqueo: 5 fallos en 15 min sin un acierto posterior (por usuario)
  select count(*) into v_fails from public.login_attempts a
   where a.usuario = v_key and not a.ok and a.at > now() - interval '15 minutes'
     and a.at > coalesce((select max(b.at) from public.login_attempts b where b.usuario = v_key and b.ok), '-infinity');
  if v_fails >= 5 then
    raise exception 'Demasiados intentos. Intenta de nuevo en 15 minutos.' using errcode = '28000';
  end if;

  if length(coalesce(p_new, '')) < 8 then
    raise exception 'La nueva contraseña debe tener al menos 8 caracteres' using errcode = '22023';
  end if;

  select * into v_p from public.personal
   where lower(usuario) = lower(btrim(coalesce(p_usuario, ''))) and rol = 'Admin' and estado = 'Activo';
  if v_p.id is not null and length(v_norm) = 12 then
    select id into v_cid from public.recovery_codes
     where personal_id = v_p.id and used_at is null and code_hash = extensions.crypt(v_norm, code_hash) limit 1;
  end if;

  if v_cid is null then
    -- Mismo mensaje y mismo coste si el usuario no existe: no se puede averiguar quién es administrador
    if v_p.id is null then perform extensions.crypt(v_norm, extensions.gen_salt('bf', 8)); end if;
    -- Se DEVUELVE el fallo (no se lanza un error): un RAISE deshacería este INSERT y el bloqueo nunca contaría.
    insert into public.login_attempts (usuario, ok, at) values (v_key, false, clock_timestamp());
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  if lower(p_new) = lower(v_p.usuario) then
    raise exception 'La nueva contraseña no puede ser igual al usuario' using errcode = '22023';
  end if;

  update public.personal set password_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)) where id = v_p.id;
  update public.recovery_codes set used_at = now() where id = v_cid;
  insert into public.login_attempts (usuario, ok, at) values (v_key, true, clock_timestamp());
  delete from public.login_attempts where lower(usuario) = lower(v_p.usuario) and not ok;   -- desbloquea el login

  -- Cierra las sesiones abiertas de esa cuenta (si alguien tenía la clave vieja, queda fuera)
  if v_p.auth_user_id is not null and to_regclass('auth.sessions') is not null then
    execute format('delete from auth.sessions where user_id = %L', v_p.auth_user_id);
  end if;

  insert into public.audit_log (actor_id, actor_role, action, tabla, clave, detalle)
  values (v_p.id, 'recovery', 'recover_password', 'personal', v_p.id::text, jsonb_build_object('usuario', v_p.usuario));

  select count(*)::int into v_left from public.recovery_codes where personal_id = v_p.id and used_at is null;
  return jsonb_build_object('ok', true, 'restantes', v_left);
end $$;

-- Permisos: generar/estado los usa el admin con sesión; recover_password solo service_role
revoke all on function public.generate_recovery_codes() from public, anon, authenticated;
revoke all on function public.recovery_status() from public, anon, authenticated;
revoke all on function public.recover_password(text, text, text) from public, anon, authenticated;
grant execute on function public.generate_recovery_codes() to authenticated;
grant execute on function public.recovery_status() to authenticated;
grant execute on function public.recover_password(text, text, text) to service_role;
