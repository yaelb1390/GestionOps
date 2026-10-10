-- QAOR es un tercer rol real de la app (menú propio de formularios). Se trata como gestor
-- a efectos de login (pestaña "Gestor"), RLS (app_role = 'inspector') y auto-asignación.

alter table public.personal drop constraint if exists personal_rol_check;
alter table public.personal
  add constraint personal_rol_check check (rol in ('Admin', 'Inspector', 'QAOR'));

-- auto_assign: reparte entre gestores activos (Inspector y QAOR), nunca Admin
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
    where p.estado = 'Activo' and p.rol in ('Inspector', 'QAOR');

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

-- admin_save_personal: el degradar al super admin ahora se detecta por "rol distinto de Admin"
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
