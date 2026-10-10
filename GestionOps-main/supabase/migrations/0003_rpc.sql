-- Lógica de servidor: equivalentes a las acciones de doPost() del Apps Script.
-- Todas son SECURITY DEFINER y validan el rol del JWT (app_role/app_pid) y la propiedad de la fila.

-- ── Helpers internos ─────────────────────────────────────────────────────────
create or replace function public._check_table(p_table text) returns void
language plpgsql immutable as $$
begin
  if p_table not in ('tickets', 'ordenes', 'calidad', 'razones') then
    raise exception 'Tabla no válida: %', p_table;
  end if;
end $$;

create or replace function public._require_admin() returns void
language plpgsql stable as $$
begin
  if public.app_role() is distinct from 'admin' then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
end $$;

create or replace function public._audit(p_action text, p_tabla text, p_clave text, p_detalle jsonb default null)
returns void language sql as $$
  insert into public.audit_log (actor_id, actor_role, action, tabla, clave, detalle)
  values (public.app_pid(), public.app_role(), p_action, p_tabla, p_clave, p_detalle)
$$;

-- Condición "la columna coincide con la clave", tolerante a formato numérico
-- (el Apps Script comparaba como texto y como Number para evitar notación científica).
create or replace function public._key_cond(p_col text, p_key text) returns text
language plpgsql immutable as $$
begin
  -- La rama numérica solo se genera si la clave es numérica: Postgres castea los
  -- literales al planificar, y 'T-1'::numeric fallaría aunque la rama no se ejecute.
  if btrim(p_key) ~ '^\d+(\.\d+)?$' then
    return format(
      $c$(btrim(coalesce(%1$I, '')) = %2$L or (case when btrim(coalesce(%1$I, '')) ~ '^\d+(\.\d+)?$'
          then btrim(%1$I)::numeric = %2$L::numeric else false end))$c$, p_col, btrim(p_key));
  end if;
  return format($c$btrim(coalesce(%1$I, '')) = %2$L$c$, p_col, btrim(p_key));
end $$;

-- Columnas por las que se identifica un registro de cada hoja
create or replace function public._id_cols(p_table text, p_for_assign boolean default false) returns text[]
language sql immutable as $$
  select case p_table
    when 'tickets' then array['ticket']
    when 'ordenes' then array['orden_externa_id', 'orden_servicio', 'ticket']
    when 'razones' then array['ticket', 'orden_externa_id', 'orden_servicio']
    -- Calidad: el Apps Script también permitía asignar por técnico (assign_calidad_individual)
    when 'calidad' then case when p_for_assign then array['ticket', 'tech', 'tech_id'] else array['ticket'] end
  end
$$;

create or replace function public._key_where(p_table text, p_key text, p_for_assign boolean default false) returns text
language plpgsql immutable as $$
declare c text; parts text[] := '{}';
begin
  foreach c in array public._id_cols(p_table, p_for_assign) loop
    parts := parts || public._key_cond(c, p_key);
  end loop;
  return '(' || array_to_string(parts, ' or ') || ')';
end $$;

-- Regla de estado al asignar (ver doPost):
--  tickets: solo cambia a Asignado si estaba vacío/Pendiente
--  ordenes/calidad: Asignado (aquí sin pisar registros ya inspeccionados/completados)
--  razones: no toca el estado
create or replace function public._assign_status_sql(p_table text) returns text
language sql immutable as $$
  select case p_table
    when 'tickets' then $s$case when btrim(coalesce(status, '')) in ('', 'Pendiente') then 'Asignado' else status end$s$
    when 'razones' then 'status'
    else $s$case when lower(coalesce(status, '')) in ('inspeccionado', 'completado') then status else 'Asignado' end$s$
  end
$$;

-- ── Asignación ───────────────────────────────────────────────────────────────
-- assign_item: assign_ticket / assign_*_individual
create or replace function public.assign_item(p_table text, p_key text, p_inspector uuid) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare v_name text; v_n int;
begin
  perform public._require_admin();
  perform public._check_table(p_table);
  select nombre into v_name from public.personal where id = p_inspector and estado = 'Activo';
  if v_name is null then raise exception 'Inspector no encontrado o inactivo'; end if;

  execute format('update public.%I set inspector_id = $1, inspector = $2, status = %s where %s',
    p_table, public._assign_status_sql(p_table), public._key_where(p_table, p_key, true))
  using p_inspector, v_name;
  get diagnostics v_n = row_count;

  if v_n = 0 and p_table <> 'calidad' then
    raise exception 'Registro no encontrado: %', p_key;
  end if;
  perform public._audit('assign_item', p_table, p_key, jsonb_build_object('inspector', p_inspector, 'updated', v_n));
  return v_n;
end $$;

-- assign_by_supervisor: assign_*_by_supervisor
create or replace function public.assign_by_supervisor(p_table text, p_supervisor text, p_inspector uuid) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare v_name text; v_n int;
begin
  perform public._require_admin();
  perform public._check_table(p_table);
  select nombre into v_name from public.personal where id = p_inspector and estado = 'Activo';
  if v_name is null then raise exception 'Inspector no encontrado o inactivo'; end if;

  execute format('update public.%I set inspector_id = $1, inspector = $2, status = %s where public.norm(supervisor) = public.norm($3)',
    p_table, public._assign_status_sql(p_table))
  using p_inspector, v_name, p_supervisor;
  get diagnostics v_n = row_count;

  perform public._audit('assign_by_supervisor', p_table, p_supervisor, jsonb_build_object('inspector', p_inspector, 'updated', v_n));
  return v_n;
end $$;

-- auto_assign: reparte tickets pendientes sin inspector al gestor activo con menos
-- tickets en estado "Asignado" (misma regla del Apps Script). Mejora: solo rol Inspector.
create or replace function public.auto_assign() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare r record; v_pick record; v_updated int := 0;
begin
  perform public._require_admin();
  drop table if exists _load;
  create temp table _load on commit drop as
    select p.id, p.nombre,
           (select count(*)::int from public.tickets t where t.inspector_id = p.id and t.status = 'Asignado') as n
    from public.personal p
    where p.estado = 'Activo' and p.rol = 'Inspector';

  if not exists (select 1 from _load) then raise exception 'No hay inspectores activos'; end if;

  for r in
    select id from public.tickets
    where btrim(coalesce(status, '')) in ('', 'Pendiente') and inspector_id is null
    order by created_at, id
  loop
    select id, nombre into v_pick from _load order by n, nombre limit 1;
    update public.tickets set inspector_id = v_pick.id, inspector = v_pick.nombre, status = 'Asignado' where id = r.id;
    update _load set n = n + 1 where id = v_pick.id;
    v_updated := v_updated + 1;
  end loop;

  perform public._audit('auto_assign', 'tickets', null, jsonb_build_object('updated', v_updated));
  return v_updated;
end $$;

-- ── Códigos / estado de inspección ───────────────────────────────────────────
-- save_codigo: save_manual_code / save_calidad_codigo
create or replace function public.save_codigo(p_table text, p_key text, p_codigo text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_cod text;
begin
  perform public._check_table(p_table);
  if public.app_role() not in ('admin', 'inspector') then raise exception 'No autorizado' using errcode = '42501'; end if;
  if btrim(coalesce(p_codigo, '')) = '' then raise exception 'El código es obligatorio'; end if;

  execute format('select id, codigo_aplicado from public.%I where %s and ($1 = ''admin'' or inspector_id = $2) order by created_at limit 1',
    p_table, public._key_where(p_table, p_key))
  into v_id, v_cod using public.app_role(), public.app_pid();

  if v_id is null then raise exception 'Registro no encontrado: %', p_key; end if;
  if btrim(coalesce(v_cod, '')) <> '' then raise exception 'Ya tiene un código aplicado'; end if;

  execute format('update public.%I set codigo_aplicado = $1, status = $2, fecha_inspeccion = now() where id = $3', p_table)
  using btrim(p_codigo), case when p_table in ('tickets', 'ordenes') then 'Inspeccionado' else 'Completado' end, v_id;

  perform public._audit('save_codigo', p_table, p_key, jsonb_build_object('codigo', btrim(p_codigo)));
end $$;

-- cancel_codigo: cancel_manual_code
create or replace function public.cancel_codigo(p_table text, p_key text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  perform public._check_table(p_table);
  if public.app_role() not in ('admin', 'inspector') then raise exception 'No autorizado' using errcode = '42501'; end if;

  execute format('select id from public.%I where %s and ($1 = ''admin'' or inspector_id = $2) order by created_at limit 1',
    p_table, public._key_where(p_table, p_key))
  into v_id using public.app_role(), public.app_pid();
  if v_id is null then raise exception 'Registro no encontrado: %', p_key; end if;

  execute format('update public.%I set codigo_aplicado = null, fecha_inspeccion = null, status = $1 where id = $2', p_table)
  using case when p_table in ('tickets', 'ordenes') then 'Asignado' else 'Pendiente' end, v_id;

  perform public._audit('cancel_codigo', p_table, p_key);
end $$;

-- update_ticket_status: update_status (status, remarks, root cause, evidencias)
create or replace function public.update_ticket_status(
  p_key text, p_status text, p_remarks text default null, p_root_cause text default null, p_evidence text[] default '{}'
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if public.app_role() not in ('admin', 'inspector') then raise exception 'No autorizado' using errcode = '42501'; end if;
  select id into v_id from public.tickets
   where (id::text = btrim(p_key) or ticket = btrim(p_key))
     and (public.app_role() = 'admin' or inspector_id = public.app_pid())
   limit 1;
  if v_id is null then raise exception 'Ticket no encontrado'; end if;

  update public.tickets
     set status = p_status,
         remarks = coalesce(p_remarks, remarks),
         root_cause = coalesce(p_root_cause, root_cause),
         evidence = evidence || coalesce(p_evidence, '{}')
   where id = v_id;
  perform public._audit('update_ticket_status', 'tickets', p_key, jsonb_build_object('status', p_status));
end $$;

-- ── Personal (admin) ─────────────────────────────────────────────────────────
-- admin_save_personal: add_inspector / update_inspector. Sin `id` => alta.
create or replace function public.admin_save_personal(p jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid := nullif(p ->> 'id', '')::uuid; v_pw text := nullif(p ->> 'password', '');
begin
  perform public._require_admin();
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
       and (nullif(p ->> 'estado', '') = 'Inactivo' or nullif(p ->> 'rol', '') = 'Inspector') then
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

-- admin_delete_personal: delete_inspector
create or replace function public.admin_delete_personal(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._require_admin();
  if exists (select 1 from public.personal where id = p_id and es_super) then
    raise exception 'No se puede eliminar al super admin';
  end if;
  delete from public.personal where id = p_id;
  if not found then raise exception 'Inspector no encontrado'; end if;
  perform public._audit('admin_delete_personal', 'personal', p_id::text);
end $$;

-- admin_update_profile: update_admin_profile (credenciales del super admin)
create or replace function public.admin_update_profile(p_username text, p_password text, p_recovery_email text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._require_admin();
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

-- Texto de "¿Olvidaste tu contraseña?" (la pantalla de login lo muestra sin sesión)
create or replace function public.get_recovery_email() returns text
language sql stable security definer set search_path = public as $$
  select value from public.app_config where param = 'admin_recovery_email'
$$;

-- ── Login (solo service_role, invocado por la Edge Function auth-login) ──────
create or replace function public.login_check(p_usuario text, p_password text, p_rol text)
returns table (id uuid, id_externo text, nombre text, usuario text, rol text, es_super boolean)
language plpgsql security definer set search_path = public, extensions as $$
declare v_fails int; v_row public.personal;
begin
  -- Bloqueo: 5 fallos en 15 min sin un acierto posterior
  select count(*) into v_fails from public.login_attempts a
   where lower(a.usuario) = lower(p_usuario) and not a.ok and a.at > now() - interval '15 minutes'
     and a.at > coalesce((select max(b.at) from public.login_attempts b where lower(b.usuario) = lower(p_usuario) and b.ok), '-infinity');
  if v_fails >= 5 then raise exception 'Demasiados intentos. Intenta de nuevo en 15 minutos.' using errcode = '28000'; end if;

  select * into v_row from public.personal pe
   where lower(pe.usuario) = lower(p_usuario)
     and pe.estado = 'Activo'
     and pe.password_hash = extensions.crypt(p_password, pe.password_hash)
     and (p_rol <> 'admin' or pe.rol = 'Admin');

  insert into public.login_attempts (usuario, ok) values (p_usuario, v_row.id is not null);
  if v_row.id is null then return; end if;
  return query select v_row.id, v_row.id_externo, v_row.nombre, v_row.usuario, v_row.rol, v_row.es_super;
end $$;

-- ── Importación de personal (solo service_role; lo usa seed/import.mjs) ──────
create or replace function public.import_personal(p jsonb) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare r jsonb; v_n int := 0;
begin
  for r in select value from jsonb_array_elements(p) loop
    insert into public.personal (id_externo, nombre, usuario, password_hash, sector, estado, rol, correo_recuperacion, es_super)
    values (
      nullif(r ->> 'id_externo', ''), r ->> 'nombre', r ->> 'usuario',
      extensions.crypt(coalesce(nullif(r ->> 'password', ''), gen_random_uuid()::text), extensions.gen_salt('bf', 10)),
      r ->> 'sector', coalesce(nullif(r ->> 'estado', ''), 'Activo'),
      coalesce(nullif(r ->> 'rol', ''), 'Inspector'), r ->> 'correo_recuperacion',
      coalesce((r ->> 'es_super')::boolean, false))
    on conflict (lower(usuario)) do update set
      id_externo = excluded.id_externo, nombre = excluded.nombre, sector = excluded.sector,
      estado = excluded.estado, rol = excluded.rol, correo_recuperacion = excluded.correo_recuperacion,
      password_hash = case when nullif(r ->> 'password', '') is null then public.personal.password_hash else excluded.password_hash end;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- ── Permisos de ejecución ────────────────────────────────────────────────────
do $$
declare f text;
begin
  -- Cerrar todo
  foreach f in array array[
    'assign_item(text,text,uuid)', 'assign_by_supervisor(text,text,uuid)', 'auto_assign()',
    'save_codigo(text,text,text)', 'cancel_codigo(text,text)',
    'update_ticket_status(text,text,text,text,text[])',
    'admin_save_personal(jsonb)', 'admin_delete_personal(uuid)', 'admin_update_profile(text,text,text)',
    'get_recovery_email()', 'login_check(text,text,text)', 'import_personal(jsonb)',
    '_check_table(text)', '_require_admin()', '_audit(text,text,text,jsonb)', '_key_cond(text,text)',
    '_id_cols(text,boolean)', '_key_where(text,text,boolean)', '_assign_status_sql(text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;

  -- Abrir lo que usa el cliente (los guards internos validan app_role)
  foreach f in array array[
    'assign_item(text,text,uuid)', 'assign_by_supervisor(text,text,uuid)', 'auto_assign()',
    'save_codigo(text,text,text)', 'cancel_codigo(text,text)',
    'update_ticket_status(text,text,text,text,text[])',
    'admin_save_personal(jsonb)', 'admin_delete_personal(uuid)', 'admin_update_profile(text,text,text)'
  ] loop
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

grant execute on function public.get_recovery_email() to anon, authenticated;
-- login_check e import_personal: solo service_role (conserva su grant por defecto)
