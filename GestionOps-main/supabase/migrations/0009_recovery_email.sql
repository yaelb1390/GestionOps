-- Recuperación por correo: se envía un código de 6 dígitos (vale 15 min, un solo uso) al correo registrado
-- en Mi Perfil. Convive con los 12 caracteres de respaldo de la migración 0008: en el login se acepta cualquiera.

create table public.recovery_otps (
  id          uuid primary key default gen_random_uuid(),
  personal_id uuid not null references public.personal(id) on delete cascade,
  code_hash   text not null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default clock_timestamp()
);
create index recovery_otps_idx on public.recovery_otps (personal_id, created_at desc);
alter table public.recovery_otps enable row level security;
revoke all on public.recovery_otps from anon, authenticated;   -- solo funciones SECURITY DEFINER

-- Correo de recuperación de una persona: el suyo, o (super admin) el de la configuración
create or replace function public._recovery_email(p public.personal) returns text
language sql stable security definer set search_path = public as $$
  select nullif(btrim(coalesce(
    nullif(btrim(coalesce(p.correo_recuperacion, '')), ''),
    case when p.es_super then (select value from public.app_config where param = 'admin_recovery_email') end,
    '')), '')
$$;
revoke all on function public._recovery_email(public.personal) from public, anon, authenticated;

-- ── Pedir un código (solo service_role: la Edge Function lo envía por correo) ───────────────────────
-- Devuelve {send:false} en cualquier caso en que no se deba enviar (usuario inexistente, no es admin, sin correo,
-- demasiadas solicitudes): la respuesta al navegador es siempre la misma, así no se descubre quién es admin.
-- El código en claro SOLO viaja hasta la Edge Function; en la base queda cifrado.
create or replace function public.request_recovery_otp(p_usuario text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_p public.personal; v_email text; v_n int; v_last timestamptz; v_code text;
begin
  select * into v_p from public.personal
   where lower(usuario) = lower(btrim(coalesce(p_usuario, ''))) and rol = 'Admin' and estado = 'Activo';
  if v_p.id is null then
    perform extensions.crypt('000000', extensions.gen_salt('bf', 8));   -- mismo coste que el camino real
    return jsonb_build_object('send', false);
  end if;

  v_email := public._recovery_email(v_p);
  if v_email is null then return jsonb_build_object('send', false, 'reason', 'no_email'); end if;

  -- Límites: 60 s entre solicitudes y 5 por hora
  select max(created_at), count(*) into v_last, v_n
    from public.recovery_otps where personal_id = v_p.id and created_at > clock_timestamp() - interval '1 hour';
  if (v_last is not null and v_last > clock_timestamp() - interval '60 seconds') or v_n >= 5 then
    return jsonb_build_object('send', false, 'reason', 'limit');
  end if;

  v_code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
  update public.recovery_otps set used_at = clock_timestamp() where personal_id = v_p.id and used_at is null;  -- anula los anteriores
  insert into public.recovery_otps (personal_id, code_hash, expires_at)
  values (v_p.id, extensions.crypt(v_code, extensions.gen_salt('bf', 8)), clock_timestamp() + interval '15 minutes');

  insert into public.audit_log (actor_id, actor_role, action, tabla, clave, detalle)
  values (v_p.id, 'recovery', 'request_recovery_otp', 'personal', v_p.id::text, null);
  return jsonb_build_object('send', true, 'email', v_email, 'nombre', v_p.nombre, 'code', v_code, 'minutos', 15);
end $$;

-- Destino del correo de prueba (admin con sesión: lo llama la Edge Function con su personal_id)
create or replace function public.recovery_target(p_personal uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_p public.personal;
begin
  select * into v_p from public.personal where id = p_personal and rol = 'Admin' and estado = 'Activo';
  if v_p.id is null then return jsonb_build_object('email', null); end if;
  return jsonb_build_object('email', public._recovery_email(v_p), 'nombre', v_p.nombre);
end $$;

-- ── recover_password: acepta código de correo (6 dígitos) o de respaldo (12 caracteres) ──────────────
create or replace function public.recover_password(p_usuario text, p_code text, p_new text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_norm text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_key text := 'rec:' || lower(btrim(coalesce(p_usuario, '')));
  v_fails int; v_p public.personal; v_cid uuid; v_oid uuid; v_left int;
begin
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
  if v_p.id is not null then
    if v_norm ~ '^[0-9]{6}$' then            -- código temporal enviado por correo
      select id into v_oid from public.recovery_otps
       where personal_id = v_p.id and used_at is null and expires_at > clock_timestamp()
         and code_hash = extensions.crypt(v_norm, code_hash)
       order by created_at desc limit 1;
    elsif length(v_norm) = 12 then           -- código de respaldo de Mi Perfil
      select id into v_cid from public.recovery_codes
       where personal_id = v_p.id and used_at is null and code_hash = extensions.crypt(v_norm, code_hash) limit 1;
    end if;
  end if;

  if v_cid is null and v_oid is null then
    if v_p.id is null then perform extensions.crypt(v_norm, extensions.gen_salt('bf', 8)); end if;
    -- Se DEVUELVE el fallo (no se lanza error): un RAISE deshacería este INSERT y el bloqueo no contaría.
    insert into public.login_attempts (usuario, ok, at) values (v_key, false, clock_timestamp());
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  if lower(p_new) = lower(v_p.usuario) then
    raise exception 'La nueva contraseña no puede ser igual al usuario' using errcode = '22023';
  end if;

  update public.personal set password_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)) where id = v_p.id;
  if v_cid is not null then update public.recovery_codes set used_at = now() where id = v_cid; end if;
  if v_oid is not null then update public.recovery_otps set used_at = clock_timestamp() where id = v_oid; end if;
  update public.recovery_otps set used_at = clock_timestamp() where personal_id = v_p.id and used_at is null;  -- cualquier otro pendiente
  insert into public.login_attempts (usuario, ok, at) values (v_key, true, clock_timestamp());
  delete from public.login_attempts where lower(usuario) = lower(v_p.usuario) and not ok;

  if v_p.auth_user_id is not null and to_regclass('auth.sessions') is not null then
    execute format('delete from auth.sessions where user_id = %L', v_p.auth_user_id);
  end if;

  insert into public.audit_log (actor_id, actor_role, action, tabla, clave, detalle)
  values (v_p.id, 'recovery', 'recover_password', 'personal', v_p.id::text,
          jsonb_build_object('usuario', v_p.usuario, 'via', case when v_oid is not null then 'correo' else 'respaldo' end));

  select count(*)::int into v_left from public.recovery_codes where personal_id = v_p.id and used_at is null;
  return jsonb_build_object('ok', true, 'restantes', v_left);
end $$;

revoke all on function public.request_recovery_otp(text) from public, anon, authenticated;
revoke all on function public.recovery_target(uuid) from public, anon, authenticated;
revoke all on function public.recover_password(text, text, text) from public, anon, authenticated;
grant execute on function public.request_recovery_otp(text) to service_role;
grant execute on function public.recovery_target(uuid) to service_role;
grant execute on function public.recover_password(text, text, text) to service_role;
