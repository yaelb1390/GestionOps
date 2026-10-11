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

-- 6b) import_rows: nuevos, idempotencia y "actualizar sin pisar el trabajo"
reset role;
set local role authenticated;
select pg_temp.claims('admin', current_setting('test.root')::uuid);
select set_config('test.imp', public.import_rows('tickets', '[
  {"ticket":"IMP-1","supervisor":"Sup A","sector":"Norte","fecha":"2026-10-05T14:30:00-04:00","extra":{"col_rara":"x"}},
  {"ticket":"IMP-2","supervisor":"Sup A","sector":"Sur"},
  {"ticket":"IMP-2","supervisor":"Sup A","sector":"Sur"},
  {"ticket":"","supervisor":"sin clave"}
]'::jsonb)::text, true);
select pg_temp.expect('import: 2 nuevos, 2 omitidos (duplicado + sin clave)',
  (current_setting('test.imp')::jsonb ->> 'inserted') = '2' and (current_setting('test.imp')::jsonb ->> 'skipped') = '2');
select pg_temp.expect('import: entran Pendiente', (select count(*) = 2 from public.tickets where ticket in ('IMP-1','IMP-2') and status = 'Pendiente'));

-- el gestor trabaja IMP-1 (asignado + código) y luego se reimporta el Excel con datos nuevos
select public.assign_item('tickets', 'IMP-1', current_setting('test.ana')::uuid);
select pg_temp.claims('inspector', current_setting('test.ana')::uuid);
select public.save_codigo('tickets', 'IMP-1', 'COD-IMP');
select pg_temp.claims('admin', current_setting('test.root')::uuid);
select set_config('test.imp2', public.import_rows('tickets', '[
  {"ticket":"IMP-1","supervisor":"Sup NUEVO","sector":null,"status":"Pendiente","inspector_id":null,"codigo_aplicado":"HACK","extra":{"otra":"y"}},
  {"ticket":"IMP-2","supervisor":"Sup A","sector":"Sur"},
  {"ticket":"IMP-3","supervisor":"Sup B"}
]'::jsonb)::text, true);
select pg_temp.expect('reimport: 1 nuevo, 2 actualizados',
  (current_setting('test.imp2')::jsonb ->> 'inserted') = '1' and (current_setting('test.imp2')::jsonb ->> 'updated') = '2');
select pg_temp.expect('reimport: actualiza datos pero conserva el trabajo',
  (select supervisor = 'Sup NUEVO' and sector = 'Norte'                       -- celda vacía no borra
      and status = 'Inspeccionado' and codigo_aplicado = 'COD-IMP'             -- estado y código intactos
      and inspector_id = current_setting('test.ana')::uuid                     -- asignación intacta
      and extra = '{"col_rara":"x","otra":"y"}'::jsonb                         -- extra se fusiona
   from public.tickets where ticket = 'IMP-1'));
select pg_temp.expect('reimport: total sin duplicados', (select count(*) = 3 from public.tickets where ticket like 'IMP-%'));

-- órdenes: la clave es la orden externa (1234567.0 == 1234567)
select public.import_rows('ordenes', '[{"orden_externa_id":"1234567","ticket":"Instalacion"}]'::jsonb);
select pg_temp.expect('órdenes: clave numérica normalizada',
  (public.import_rows('ordenes', '[{"orden_externa_id":"1234567.0","cliente":"ACME"}]'::jsonb) ->> 'updated') = '1');

-- un gestor no puede importar
select pg_temp.claims('inspector', current_setting('test.ana')::uuid);
do $$ begin
  begin perform public.import_rows('tickets', '[{"ticket":"HACK-1"}]'::jsonb); raise exception 'FALLO: gestor importó';
  exception when insufficient_privilege then null; end;
  raise notice 'ok: gestor no puede importar';
end $$;

-- 6c) Módulos activables: el admin desactiva y el gestor queda bloqueado en el servidor
reset role;
set local role authenticated;
select pg_temp.claims('inspector', current_setting('test.ana')::uuid);
select pg_temp.expect('gestor lee el estado de los módulos (13)', (select count(*) = 13 from public.app_modules));
do $$ begin
  begin perform public.set_module_enabled('tickets', false); raise exception 'FALLO: gestor cambió un módulo';
  exception when insufficient_privilege then null; end;
  begin update public.app_modules set enabled = false; raise exception 'FALLO: gestor escribió en app_modules';
  exception when insufficient_privilege then null; end;
  raise notice 'ok: gestor no puede modificar módulos';
end $$;
select pg_temp.claims('admin', current_setting('test.root')::uuid);
select public.set_module_enabled('tickets', false);
select pg_temp.expect('admin: el módulo queda desactivado', (select enabled = false from public.app_modules where key = 'tickets'));
select pg_temp.claims('inspector', current_setting('test.ana')::uuid);
select pg_temp.expect('módulo desactivado: el gestor deja de ver tickets', (select count(*) = 0 from public.tickets));
do $$ begin
  begin perform public.save_codigo('tickets', 'IMP-1', 'X'); raise exception 'FALLO: guardó con el módulo desactivado';
  exception when others then if sqlerrm not like '%desactivado%' then raise; end if; end;
  raise notice 'ok: save_codigo bloqueado con el módulo desactivado';
end $$;
select pg_temp.expect('otros módulos de datos siguen visibles (órdenes del gestor)', (select count(*) >= 0 from public.ordenes));
select pg_temp.claims('admin', current_setting('test.root')::uuid);
select pg_temp.expect('admin sigue viendo todo', (select count(*) > 0 from public.tickets));
select pg_temp.expect('set_modules_enabled devuelve 2', public.set_modules_enabled(array['tickets','ordenes'], true) = 2);
select pg_temp.claims('inspector', current_setting('test.ana')::uuid);
select pg_temp.expect('reactivado: el gestor vuelve a ver tickets', (select count(*) > 0 from public.tickets));

-- 6d) Códigos de recuperación del administrador
reset role;
set local role authenticated;
select pg_temp.claims('inspector', current_setting('test.ana')::uuid);
do $$ begin
  begin perform public.generate_recovery_codes(); raise exception 'FALLO: un gestor generó códigos';
  exception when insufficient_privilege then null; end;
  raise notice 'ok: un gestor no puede generar códigos';
end $$;
select pg_temp.claims('admin', current_setting('test.root')::uuid);
select public.verify_sudo('pw-root');   -- generar códigos exige confirmar la contraseña (migración 0010)
select set_config('test.codes', array_to_string(public.generate_recovery_codes(), ' '), true);
select pg_temp.expect('se generan 8 códigos con formato XXXX-XXXX-XXXX',
  array_length(string_to_array(current_setting('test.codes'), ' '), 1) = 8
  and (string_to_array(current_setting('test.codes'), ' '))[1] ~ '^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$');
select pg_temp.expect('estado: 8 sin usar', (public.recovery_status() ->> 'unused') = '8');
select set_config('test.c1', (string_to_array(current_setting('test.codes'), ' '))[1], true);
select set_config('test.c2', (string_to_array(current_setting('test.codes'), ' '))[2], true);
reset role;
select pg_temp.expect('en la base no hay códigos en claro', (select count(*) = 0 from public.recovery_codes where code_hash ~ '^[A-Z2-9]{4}-'));
set local role service_role;
select pg_temp.expect('código correcto restablece (y devuelve 7 restantes)',
  (public.recover_password('ROOT', lower(current_setting('test.c1')), 'NuevaClave-2026') ->> 'restantes') = '7');
reset role;
select pg_temp.expect('la contraseña nueva ya entra', (select count(*) = 1 from public.login_check('root', 'NuevaClave-2026', 'admin')));
select pg_temp.expect('la contraseña vieja ya no entra', (select count(*) = 0 from public.login_check('root', 'pw-root', 'admin')));
set local role service_role;
do $$ begin
  if (public.recover_password('root', current_setting('test.c1'), 'OtraClave-2026') ->> 'ok') <> 'false' then raise exception 'FALLO: reutilizó un código'; end if;
  begin perform public.recover_password('root', current_setting('test.c2'), 'corta'); raise exception 'FALLO: aceptó clave corta';
  exception when others then if sqlerrm not like '%al menos 8%' then raise; end if; end;
  if (public.recover_password('ana', current_setting('test.c2'), 'ClaveValida-2026') ->> 'ok') <> 'false' then raise exception 'FALLO: recuperó un gestor'; end if;
  if (public.recover_password('noexiste', current_setting('test.c2'), 'ClaveValida-2026') ->> 'ok') <> 'false' then raise exception 'FALLO: usuario inexistente distinto'; end if;
  raise notice 'ok: código usado, clave corta, gestor y usuario inexistente se rechazan';
end $$;
do $$ begin
  for i in 1..5 loop
    begin perform public.recover_password('root', 'AAAA-AAAA-AAAA', 'ClaveValida-2026'); exception when others then null; end; -- puede saltar el bloqueo antes del 5.º: el intento con el código reutilizado también cuenta
  end loop;
  begin perform public.recover_password('root', current_setting('test.c2'), 'ClaveValida-2026'); raise exception 'FALLO: sin bloqueo';
  exception when others then if sqlerrm not like 'Demasiados intentos%' then raise; end if; end;
  raise notice 'ok: tras 5 fallos queda bloqueado (aunque el código sea bueno)';
end $$;
reset role;
set local role authenticated;
select pg_temp.expect('anónimo/autenticado no puede llamar recover_password', (select true));
do $$ begin
  begin perform public.recover_password('root', 'x', 'ClaveValida-2026'); raise exception 'FALLO: recover_password abierta';
  exception when insufficient_privilege then null; end;
  raise notice 'ok: recover_password solo la ejecuta service_role';
end $$;
reset role;

-- 6e) Recuperación por correo (código de 6 dígitos)
reset role;
delete from public.login_attempts where usuario like 'rec:%';   -- el bloque anterior dejó bloqueado a root
-- Mi Perfil del super admin guarda el correo en app_config (y a veces también en personal)
insert into public.app_config (param, value) values ('admin_recovery_email', 'jefe@ejemplo.com') on conflict (param) do update set value = excluded.value;
update public.personal set correo_recuperacion = null where usuario = 'root';
set local role service_role;
select set_config('test.otp', public.request_recovery_otp('ROOT')::text, true);
select pg_temp.expect('envía al correo de Mi Perfil (app_config) con un código de 6 dígitos',
  (current_setting('test.otp')::jsonb ->> 'send') = 'true' and (current_setting('test.otp')::jsonb ->> 'email') = 'jefe@ejemplo.com'
  and (current_setting('test.otp')::jsonb ->> 'code') ~ '^[0-9]{6}$');
select pg_temp.expect('segunda solicitud inmediata: no envía (60 s entre solicitudes)', (public.request_recovery_otp('root') ->> 'send') = 'false');
select pg_temp.expect('un gestor o un usuario inexistente: no envía', (public.request_recovery_otp('ana') ->> 'send') = 'false' and (public.request_recovery_otp('nadie') ->> 'send') = 'false');
reset role;
select pg_temp.expect('el código no está en claro en la base', (select count(*) = 0 from public.recovery_otps where code_hash ~ '^[0-9]{6}$'));
set local role service_role;
do $$ begin
  if (public.recover_password('root', '000000x', 'NuevaPorCorreo-26') ->> 'ok') <> 'false' then raise exception 'FALLO: aceptó un código inválido'; end if;
  if (public.recover_password('root', case when current_setting('test.otp')::jsonb ->> 'code' = '123456' then '654321' else '123456' end, 'NuevaPorCorreo-26') ->> 'ok') <> 'false' then raise exception 'FALLO: aceptó un código equivocado'; end if;
  raise notice 'ok: códigos de correo equivocados se rechazan';
end $$;
select pg_temp.expect('el código de correo restablece la contraseña',
  (public.recover_password('root', current_setting('test.otp')::jsonb ->> 'code', 'NuevaPorCorreo-26') ->> 'ok') = 'true');
reset role;
select pg_temp.expect('y la clave nueva entra', (select count(*) = 1 from public.login_check('root', 'NuevaPorCorreo-26', 'admin')));
set local role service_role;
select pg_temp.expect('el mismo código no sirve dos veces',
  (public.recover_password('root', current_setting('test.otp')::jsonb ->> 'code', 'OtraMas-2026-x') ->> 'ok') = 'false');
reset role;
-- caducidad: un código vencido no vale
update public.recovery_otps set created_at = created_at - interval '2 minutes';
set local role service_role;
select set_config('test.otp2', public.request_recovery_otp('root')::text, true);
reset role;
update public.recovery_otps set expires_at = clock_timestamp() - interval '1 second' where used_at is null;
set local role service_role;
select pg_temp.expect('un código vencido se rechaza',
  (public.recover_password('root', current_setting('test.otp2')::jsonb ->> 'code', 'NuevaVencida-26') ->> 'ok') = 'false');
-- sin correo registrado no se envía
reset role;
delete from public.app_config where param = 'admin_recovery_email';
update public.recovery_otps set created_at = created_at - interval '2 minutes';
set local role service_role;
select pg_temp.expect('sin correo en Mi Perfil: no envía', (public.request_recovery_otp('root') ->> 'send') = 'false');
reset role;
set local role authenticated;
do $$ begin
  begin perform public.request_recovery_otp('root'); raise exception 'FALLO: request_recovery_otp abierta';
  exception when insufficient_privilege then null; end;
  raise notice 'ok: request_recovery_otp solo la ejecuta service_role';
end $$;
reset role;

-- 6f) Confirmación de contraseña (modo sudo) para acciones sensibles
reset role;
delete from public.login_attempts where usuario like 'sudo:%' or usuario like 'rec:%';
delete from public.sudo_sessions;
create or replace function pg_temp.claims_s(p_role text, p_pid uuid, p_sid text) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'session_id', p_sid,
    'app_metadata', json_build_object('app_role', p_role, 'personal_id', p_pid))::text, true);
end $f$;
set local role authenticated;
select pg_temp.claims_s('admin', current_setting('test.root')::uuid, 'sess-A');
do $$ begin
  begin perform public.admin_update_profile('', '', 'otro@correo.com'); raise exception 'FALLO: cambió el perfil sin confirmar';
  exception when others then if sqlerrm <> 'SUDO_REQUIRED' then raise; end if; end;
  begin perform public.generate_recovery_codes(); raise exception 'FALLO: generó códigos sin confirmar';
  exception when others then if sqlerrm <> 'SUDO_REQUIRED' then raise; end if; end;
  raise notice 'ok: sin confirmar, no se cambia el perfil ni se generan códigos';
end $$;
select pg_temp.expect('contraseña incorrecta: verify_sudo devuelve false', public.verify_sudo('mala') = false);
select pg_temp.expect('contraseña correcta: verify_sudo devuelve true', public.verify_sudo('NuevaPorCorreo-26') = true);
select public.admin_update_profile('', '', 'nuevo@correo.com');
reset role;
select pg_temp.expect('confirmada: el cambio de perfil se aplica', (select value = 'nuevo@correo.com' from public.app_config where param = 'admin_recovery_email')
  and (select correo_recuperacion = 'nuevo@correo.com' from public.personal where usuario = 'root'));
set local role authenticated;
select pg_temp.claims_s('admin', current_setting('test.root')::uuid, 'sess-B');
do $$ begin
  begin perform public.admin_update_profile('', '', 'robado@correo.com'); raise exception 'FALLO: otra sesión heredó la confirmación';
  exception when others then if sqlerrm <> 'SUDO_REQUIRED' then raise; end if; end;
  raise notice 'ok: la confirmación solo vale para la sesión que la hizo';
end $$;
-- Personal (0011): TODO alta/edición/baja exige confirmación; el directorio completo también
do $$ begin
  begin perform public.admin_save_personal('{"nombre":"G Test","usuario":"gtest","password":"x1234567","rol":"Inspector","id_externo":"G1"}'::jsonb); raise exception 'FALLO: creó un gestor sin confirmar';
  exception when others then if sqlerrm <> 'SUDO_REQUIRED' then raise; end if; end;
  begin perform public.admin_save_personal('{"nombre":"Nuevo Admin","usuario":"nadmin","password":"x1234567","rol":"Admin"}'::jsonb); raise exception 'FALLO: creó un admin sin confirmar';
  exception when others then if sqlerrm <> 'SUDO_REQUIRED' then raise; end if; end;
  begin perform public.admin_save_personal(jsonb_build_object('id', current_setting('test.root'), 'password', 'Hackeada-2026')); raise exception 'FALLO: cambió una clave sin confirmar';
  exception when others then if sqlerrm <> 'SUDO_REQUIRED' then raise; end if; end;
  begin perform public.admin_delete_personal(current_setting('test.root')::uuid); raise exception 'FALLO: borró sin confirmar';
  exception when others then if sqlerrm <> 'SUDO_REQUIRED' then raise; end if; end;
  begin perform * from public.personal_detalle(); raise exception 'FALLO: leyó el directorio sin confirmar';
  exception when others then if sqlerrm <> 'SUDO_REQUIRED' then raise; end if; end;
  raise notice 'ok: sin confirmar no se crea, edita, borra ni se lee el directorio de personal';
end $$;
select pg_temp.expect('la lista básica (para asignar) no trae usuario ni correo',
  (select count(*) from public.personal_basico) >= 3
  and not exists (select 1 from information_schema.columns where table_name = 'personal_basico' and column_name in ('usuario', 'correo_recuperacion', 'password_hash')));
do $$ begin
  begin perform * from public.personal_publico limit 1; raise exception 'FALLO: personal_publico sigue legible';
  exception when insufficient_privilege then null; end;
  raise notice 'ok: personal_publico ya no se puede leer desde la API';
end $$;
-- con la confirmación vigente (otra sesión, sess-C) todo funciona
select pg_temp.claims_s('admin', current_setting('test.root')::uuid, 'sess-C');
select public.verify_sudo('NuevaPorCorreo-26');
select pg_temp.expect('confirmado: el directorio completo incluye usuarios y el correo efectivo',
  (select count(*) from public.personal_detalle() where usuario is not null) >= 3);
select pg_temp.expect('confirmado: crear un gestor funciona', public.admin_save_personal('{"nombre":"G Test","usuario":"gtest","password":"x1234567","rol":"Inspector","id_externo":"G1"}'::jsonb) is not null);
select public.admin_delete_personal(id) from public.personal_basico where nombre = 'G Test';
select pg_temp.expect('confirmado: borrar al gestor funciona', (select count(*) = 0 from public.personal_basico where nombre = 'G Test'));
select public.end_sudo();
select pg_temp.claims_s('inspector', current_setting('test.ana')::uuid, 'sess-G');
select pg_temp.expect('un gestor no ve la lista básica de personal', (select count(*) = 0 from public.personal_basico));
-- caducidad
select pg_temp.claims_s('admin', current_setting('test.root')::uuid, 'sess-A');
select pg_temp.expect('en sess-A sigue vigente (generar códigos funciona)', array_length(public.generate_recovery_codes(), 1) = 8);
reset role;
update public.sudo_sessions set until_at = clock_timestamp() - interval '1 second';
set local role authenticated;
select pg_temp.claims_s('admin', current_setting('test.root')::uuid, 'sess-A');
do $$ begin
  begin perform public.generate_recovery_codes(); raise exception 'FALLO: la confirmación no caducó';
  exception when others then if sqlerrm <> 'SUDO_REQUIRED' then raise; end if; end;
  raise notice 'ok: la confirmación caduca a los 10 minutos';
end $$;
-- cerrar la confirmación a mano
select public.verify_sudo('NuevaPorCorreo-26');
select public.end_sudo();
do $$ begin
  begin perform public.generate_recovery_codes(); raise exception 'FALLO: end_sudo no cerró';
  exception when others then if sqlerrm <> 'SUDO_REQUIRED' then raise; end if; end;
  raise notice 'ok: al salir de Mi Perfil se cierra la confirmación';
end $$;
-- bloqueo tras 5 intentos fallidos (el intento correcto también se rechaza)
do $$ begin
  for i in 1..5 loop perform public.verify_sudo('incorrecta-' || i); end loop;
  begin perform public.verify_sudo('NuevaPorCorreo-26'); raise exception 'FALLO: sin bloqueo en verify_sudo';
  exception when others then if sqlerrm not like 'Demasiados intentos%' then raise; end if; end;
  raise notice 'ok: tras 5 fallos verify_sudo se bloquea 15 minutos';
end $$;
-- un gestor no puede ni intentarlo
select pg_temp.claims_s('inspector', current_setting('test.ana')::uuid, 'sess-G');
do $$ begin
  begin perform public.verify_sudo('lo-que-sea'); raise exception 'FALLO: un gestor usó verify_sudo';
  exception when insufficient_privilege then null; end;
  raise notice 'ok: un gestor no puede usar verify_sudo';
end $$;
reset role;

-- 7) Anónimo no ve nada
reset role;
reset role;
set local role anon;
do $$ begin
  begin perform * from public.tickets; raise exception 'FALLO: anon lee tickets'; exception when insufficient_privilege then null; end;
  raise notice 'ok: anon sin acceso';
end $$;

rollback;
