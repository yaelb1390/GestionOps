-- El módulo Personal pasa a Mi Perfil y queda protegido por la confirmación de contraseña (migración 0010).
--
--  · personal_basico: lo mínimo para ASIGNAR tickets/órdenes (nombre, sector, rol...). Sin usuario ni correo.
--  · personal_detalle(): el directorio completo (usuario, correo de recuperación...). Exige contraseña confirmada.
--  · Alta, edición y baja de personal: siempre exigen la confirmación (antes solo si se tocaba a un administrador).
--  · personal_publico (con usuario y correo) se cierra en la migración 0012, cuando el frontend nuevo ya está en producción.

create view public.personal_basico as
  select id, id_externo, nombre, sector, estado, rol, es_super
  from public.personal
  where public.app_role() = 'admin';
grant select on public.personal_basico to authenticated;

-- Directorio completo, solo con confirmación vigente. Para el correo devuelve el efectivo (el del super admin
-- puede vivir en la configuración) para que Mi Perfil lo muestre igual que lo usa la recuperación.
create or replace function public.personal_detalle() returns table (
  id uuid, id_externo text, nombre text, usuario text, sector text, estado text, rol text,
  correo_recuperacion text, es_super boolean
) language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  perform public._require_sudo();
  return query
    select p.id, p.id_externo, p.nombre, p.usuario, p.sector, p.estado, p.rol,
           public._recovery_email(p), p.es_super
      from public.personal p
     order by p.nombre;
end $$;
revoke all on function public.personal_detalle() from public, anon, authenticated;
grant execute on function public.personal_detalle() to authenticated;

-- Alta / edición de personal: siempre con confirmación
create or replace function public.admin_save_personal(p jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid := nullif(p ->> 'id', '')::uuid; v_pw text := nullif(p ->> 'password', '');
begin
  perform public._require_admin();
  perform public._require_sudo();
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

-- Baja de personal: siempre con confirmación
create or replace function public.admin_delete_personal(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._require_admin();
  perform public._require_sudo();
  if exists (select 1 from public.personal where id = p_id and es_super) then
    raise exception 'No se puede eliminar al super admin';
  end if;
  delete from public.personal where id = p_id;
  if not found then raise exception 'Inspector no encontrado'; end if;
  perform public._audit('admin_delete_personal', 'personal', p_id::text);
end $$;

revoke all on function public.admin_save_personal(jsonb) from public, anon, authenticated;
revoke all on function public.admin_delete_personal(uuid) from public, anon, authenticated;
grant execute on function public.admin_save_personal(jsonb) to authenticated;
grant execute on function public.admin_delete_personal(uuid) to authenticated;
