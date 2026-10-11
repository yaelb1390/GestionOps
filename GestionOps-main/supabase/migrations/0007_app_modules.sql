-- Módulos del menú de gestores que el administrador puede activar/desactivar.
-- Desactivar un módulo de datos (tickets, órdenes, averías repetidas) lo oculta en la app Y bloquea al gestor
-- en el servidor (RLS + funciones), no solo visualmente. Los de enlace/formulario/tema solo cambian el menú.

create table public.app_modules (
  key         text primary key,
  menu        text not null check (menu in ('gestor', 'qaor', 'ambos')),  -- a qué menú pertenece
  label       text not null,
  descripcion text,
  orden       int not null default 0,
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

insert into public.app_modules (key, menu, label, descripcion, orden) values
  -- Menú estándar de gestores
  ('tickets',      'gestor', 'Tickets',            'Tickets asignados al gestor',               10),
  ('ordenes',      'gestor', 'Órdenes',            'Órdenes de servicio asignadas',             20),
  ('repetidas',    'gestor', 'Averías Repetidas',  'Casos repetidos para inspeccionar',         30),
  ('diagnostico',  'gestor', 'Diagnóstico',        'Acceso a SACS Móvil',                       40),
  ('actividades',  'gestor', 'Actividades',        'Registro de actividades de gestores',       50),
  ('inspecciones', 'gestor', 'Inspecciones',       'Inspecciones realizadas por el gestor',     60),
  -- Menú QAOR (formularios)
  ('qaor_gestores',       'qaor', 'QAOR-Gestores',     'Formulario QAOR-Gestores',          110),
  ('qaor_actividades',    'qaor', 'Registro Actividades', 'Formulario de registro de actividades', 120),
  ('qaor_acompanamiento', 'qaor', 'Acompañamiento',    'Formulario de acompañamiento',      130),
  ('qaor_preventivo',     'qaor', 'Mant. Preventivo',  'Formulario de mantenimiento preventivo', 140),
  ('qaor_inspecciones',   'qaor', 'Inspecciones',      'Formulario de registro de inspecciones', 150),
  ('qaor_sacs',           'qaor', 'SACS Móvil',        'Acceso a SACS Móvil',               160),
  -- Común a ambos menús
  ('interfaz',     'ambos',  'Interfaz',           'Cambio de modo claro / oscuro',            900);

alter table public.app_modules enable row level security;
revoke all on public.app_modules from anon, authenticated;
grant select on public.app_modules to authenticated;
-- Todos los usuarios con sesión leen el estado (el menú lo necesita); solo se escribe vía RPC de admin
create policy modules_read on public.app_modules for select to authenticated using (true);

-- ¿Está activo el módulo? Si no existe en la tabla, se considera activo (no bloquea lo que no se administra)
create or replace function public.module_enabled(p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from public.app_modules where key = p_key), true)
$$;
revoke all on function public.module_enabled(text) from public, anon;
grant execute on function public.module_enabled(text) to authenticated;

-- Tabla de datos -> módulo que la gobierna
create or replace function public._module_of_table(p_table text) returns text
language sql immutable as $$ select case p_table when 'calidad' then 'repetidas' else p_table end $$;
revoke all on function public._module_of_table(text) from public, anon;
grant execute on function public._module_of_table(text) to authenticated;

-- ── RPC de administración ───────────────────────────────────────────────────
create or replace function public.set_module_enabled(p_key text, p_enabled boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._require_admin();
  update public.app_modules set enabled = p_enabled, updated_at = now(), updated_by = public.app_pid() where key = p_key;
  if not found then raise exception 'Módulo no encontrado: %', p_key; end if;
  perform public._audit('set_module_enabled', 'app_modules', p_key, jsonb_build_object('enabled', p_enabled));
end $$;

create or replace function public.set_modules_enabled(p_keys text[], p_enabled boolean) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare v_n int;
begin
  perform public._require_admin();
  update public.app_modules set enabled = p_enabled, updated_at = now(), updated_by = public.app_pid() where key = any(p_keys);
  get diagnostics v_n = row_count;
  perform public._audit('set_modules_enabled', 'app_modules', null, jsonb_build_object('keys', p_keys, 'enabled', p_enabled, 'updated', v_n));
  return v_n;
end $$;

revoke all on function public.set_module_enabled(text, boolean) from public, anon, authenticated;
revoke all on function public.set_modules_enabled(text[], boolean) from public, anon, authenticated;
grant execute on function public.set_module_enabled(text, boolean) to authenticated;
grant execute on function public.set_modules_enabled(text[], boolean) to authenticated;

-- ── Bloqueo en el servidor para los módulos de datos ────────────────────────
-- El gestor deja de ver las filas cuando su módulo se desactiva (el admin sigue viendo todo).
do $$
declare t text;
begin
  foreach t in array array['tickets', 'ordenes', 'calidad'] loop
    execute format('drop policy if exists %1$s_inspector_read on public.%1$I', t);
    execute format($p$create policy %1$s_inspector_read on public.%1$I for select to authenticated
      using (
        public.app_role() = 'inspector'
        and public.module_enabled(public._module_of_table(%2$L))
        and inspector_id = public.app_pid()
        and not (
          lower(coalesce(status, '')) in ('completado', 'inspeccionado')
          and fecha_inspeccion is not null
          and fecha_inspeccion < now() - interval '24 hours'
        )
      )$p$, t, t);
  end loop;
end $$;

-- save_codigo / cancel_codigo / update_ticket_status: mismas definiciones que 0003 + comprobación del módulo
create or replace function public.save_codigo(p_table text, p_key text, p_codigo text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_cod text;
begin
  perform public._check_table(p_table);
  if public.app_role() not in ('admin', 'inspector') then raise exception 'No autorizado' using errcode = '42501'; end if;
  if public.app_role() = 'inspector' and not public.module_enabled(public._module_of_table(p_table)) then
    raise exception 'Este módulo fue desactivado por el administrador';
  end if;
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

create or replace function public.cancel_codigo(p_table text, p_key text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  perform public._check_table(p_table);
  if public.app_role() not in ('admin', 'inspector') then raise exception 'No autorizado' using errcode = '42501'; end if;
  if public.app_role() = 'inspector' and not public.module_enabled(public._module_of_table(p_table)) then
    raise exception 'Este módulo fue desactivado por el administrador';
  end if;

  execute format('select id from public.%I where %s and ($1 = ''admin'' or inspector_id = $2) order by created_at limit 1',
    p_table, public._key_where(p_table, p_key))
  into v_id using public.app_role(), public.app_pid();
  if v_id is null then raise exception 'Registro no encontrado: %', p_key; end if;

  execute format('update public.%I set codigo_aplicado = null, fecha_inspeccion = null, status = $1 where id = $2', p_table)
  using case when p_table in ('tickets', 'ordenes') then 'Asignado' else 'Pendiente' end, v_id;

  perform public._audit('cancel_codigo', p_table, p_key);
end $$;

create or replace function public.update_ticket_status(
  p_key text, p_status text, p_remarks text default null, p_root_cause text default null, p_evidence text[] default '{}'
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if public.app_role() not in ('admin', 'inspector') then raise exception 'No autorizado' using errcode = '42501'; end if;
  if public.app_role() = 'inspector' and not public.module_enabled('tickets') then
    raise exception 'Este módulo fue desactivado por el administrador';
  end if;
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

-- Tiempo real: el menú del gestor se actualiza solo cuando el admin cambia un interruptor
alter publication supabase_realtime add table public.app_modules;
