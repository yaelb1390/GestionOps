-- Prueba de humo de RLS y RPC. Ejecutar tras aplicar las migraciones:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_smoke.sql
-- Todo ocurre en una transacción que termina en ROLLBACK.
begin;

create or replace function pg_temp.claims(p_role text, p_pid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'app_metadata', json_build_object('app_role', p_role, 'personal_id', p_pid))::text, true);
end $$;

create or replace function pg_temp.expect(p_name text, p_ok boolean) returns void language plpgsql as $$
begin
  if not p_ok then raise exception 'FALLO: %', p_name; end if;
  raise notice 'ok: %', p_name;
end $$;

-- Datos de prueba (como postgres/service_role, sin RLS)
select public.import_personal('[
  {"id_externo":"1","nombre":"Ana Gestor","usuario":"ana","password":"pw-ana","rol":"Inspector"},
  {"id_externo":"2","nombre":"Beto Gestor","usuario":"beto","password":"pw-beto","rol":"Inspector"},
  {"id_externo":"9","nombre":"Super","usuario":"root","password":"pw-root","rol":"Admin","es_super":true}
]'::jsonb);

insert into public.tickets (ticket, supervisor, status) values
  ('T-1', 'Carlos Muñoz', 'Pendiente'), ('T-2', 'Carlos Muñoz', null), ('T-3', 'Otro', 'Pendiente');
insert into public.ordenes (orden_externa_id, ticket, supervisor, status) values ('1000000', 'Instalacion', 'Carlos Muñoz', 'Pendiente');

-- 1) login_check: hash correcto/incorrecto, rol admin
select pg_temp.expect('login inspector ok', (select count(*) = 1 from public.login_check('ANA', 'pw-ana', 'inspector')));
select pg_temp.expect('login clave mala', (select count(*) = 0 from public.login_check('ana', 'x', 'inspector')));
select pg_temp.expect('inspector no entra como admin', (select count(*) = 0 from public.login_check('ana', 'pw-ana', 'admin')));
select pg_temp.expect('super entra como admin', (select count(*) = 1 from public.login_check('root', 'pw-root', 'admin')));

-- 2) Admin asigna por supervisor (tilde/mayúsculas tolerantes) y por ticket
select set_config('test.ana', (select id::text from public.personal where usuario = 'ana'), true);
select set_config('test.beto', (select id::text from public.personal where usuario = 'beto'), true);
select set_config('test.root', (select id::text from public.personal where usuario = 'root'), true);

set local role authenticated;
select pg_temp.claims('admin', current_setting('test.root')::uuid);
select pg_temp.expect('assign_by_supervisor (norm) = 2',
  public.assign_by_supervisor('tickets', 'carlos munoz', current_setting('test.ana')::uuid) = 2);
select pg_temp.expect('ticket pasó a Asignado', (select count(*) = 2 from public.tickets where status = 'Asignado'));
select pg_temp.expect('assign_item orden por id numérico',
  public.assign_item('ordenes', '1000000.0', current_setting('test.beto')::uuid) = 1);

-- 3) RLS: cada gestor ve solo lo suyo
select pg_temp.claims('inspector', current_setting('test.ana')::uuid);
select pg_temp.expect('Ana ve 2 tickets', (select count(*) = 2 from public.tickets));
select pg_temp.expect('Ana no ve órdenes de Beto', (select count(*) = 0 from public.ordenes));
select pg_temp.claims('inspector', current_setting('test.beto')::uuid);
select pg_temp.expect('Beto no ve tickets de Ana', (select count(*) = 0 from public.tickets));

-- 4) Gestor no puede escribir directo ni usar RPC de admin
select pg_temp.claims('inspector', current_setting('test.ana')::uuid);
do $$ begin
  update public.tickets set status = 'X'; -- RLS: 0 filas afectadas
  if (select count(*) from public.tickets where status = 'X') > 0 then raise exception 'FALLO: update directo'; end if;
  begin perform public.auto_assign(); raise exception 'FALLO: auto_assign permitido'; exception when insufficient_privilege then null; end;
  begin perform public.assign_item('tickets', 'T-1', null); raise exception 'FALLO: assign_item permitido'; exception when insufficient_privilege then null; end;
  begin perform * from public.personal; raise exception 'FALLO: personal legible'; exception when insufficient_privilege then null; end;
  raise notice 'ok: gestor sin escritura directa ni RPC admin ni personal';
end $$;

-- 5) save_codigo / cancel_codigo
select public.save_codigo('tickets', 'T-1', 'COD-9');
select pg_temp.expect('queda Inspeccionado con fecha', (select status = 'Inspeccionado' and fecha_inspeccion is not null from public.tickets where ticket = 'T-1'));
do $$ begin
  begin perform public.save_codigo('tickets', 'T-1', 'OTRO'); raise exception 'FALLO: doble código';
  exception when others then if sqlerrm not like 'Ya tiene%' then raise; end if; end;
  raise notice 'ok: segundo código rechazado';
end $$;
select public.cancel_codigo('tickets', 'T-1');
select pg_temp.expect('cancelar vuelve a Asignado', (select status = 'Asignado' and codigo_aplicado is null from public.tickets where ticket = 'T-1'));

-- 6) Filtro de 24 h: un inspeccionado de hace 2 días desaparece para el gestor
reset role;
update public.tickets set status = 'Inspeccionado', fecha_inspeccion = now() - interval '2 days' where ticket = 'T-1';
set local role authenticated;
select pg_temp.claims('inspector', current_setting('test.ana')::uuid);
select pg_temp.expect('inspeccionado >24h oculto', (select count(*) = 1 from public.tickets));

-- 7) Anónimo no ve nada
reset role;
set local role anon;
do $$ begin
  begin perform * from public.tickets; raise exception 'FALLO: anon lee tickets'; exception when insufficient_privilege then null; end;
  raise notice 'ok: anon sin acceso';
end $$;

rollback;
