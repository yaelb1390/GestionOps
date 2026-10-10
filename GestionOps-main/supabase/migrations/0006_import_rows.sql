-- Importación de Excel desde el panel de admin.
-- Regla: actualizar sin pisar el trabajo. Un registro existente (misma clave) recibe los datos
-- nuevos del Excel, pero conserva asignación, estado, código aplicado y fecha de inspección.
-- Los registros nuevos entran como 'Pendiente'. Subir el mismo archivo dos veces no duplica.

do $$
declare t text;
begin
  foreach t in array array['tickets', 'ordenes', 'calidad', 'razones'] loop
    execute format('alter table public.%I add column if not exists clave text', t);
    execute format('create unique index if not exists %1$s_clave_uq on public.%1$I (clave)', t);
  end loop;
end $$;

-- Identificador de negocio de cada módulo (misma lógica que usan las acciones de asignación)
create or replace function public._clave_sql(p_table text) returns text
language sql immutable as $$
  select case p_table
    when 'ordenes' then
      $k$coalesce(nullif(regexp_replace(btrim(coalesce(s.orden_externa_id, '')), '\.0$', ''), ''),
                  nullif(regexp_replace(btrim(coalesce(s.orden_servicio, '')), '\.0$', ''), ''),
                  nullif(regexp_replace(btrim(coalesce(s.ticket, '')), '\.0$', ''), ''))$k$
    when 'calidad' then
      $k$case when nullif(btrim(coalesce(s.ticket, '')), '') is null then null
              else regexp_replace(btrim(s.ticket), '\.0$', '') || '|' ||
                   regexp_replace(btrim(coalesce(s.caso_repetido, '')), '\.0$', '') end$k$
    else
      $k$nullif(regexp_replace(btrim(coalesce(s.ticket, '')), '\.0$', ''), '')$k$
  end
$$;

create or replace function public.import_rows(p_table text, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  -- nunca se tocan en filas existentes (el trabajo del gestor y el estado)
  v_protected text[] := array['id', 'clave', 'status', 'inspector_id', 'inspector', 'codigo_aplicado',
                              'fecha_inspeccion', 'evidence', 'created_at', 'updated_at', 'import_hash'];
  v_present text[];
  v_cols text;
  v_sel text;
  v_set text;
  v_total int; v_ins int; v_upd int;
begin
  perform public._require_admin();
  perform public._check_table(p_table);
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'p_rows debe ser un arreglo JSON'; end if;
  v_total := jsonb_array_length(p_rows);
  if v_total = 0 then return jsonb_build_object('inserted', 0, 'updated', 0, 'skipped', 0); end if;
  if v_total > 2000 then raise exception 'Máximo 2000 filas por llamada'; end if;

  -- Columnas del lote que existen en la tabla y no están protegidas
  select coalesce(array_agg(distinct k order by k), '{}') into v_present
    from (select jsonb_object_keys(r) as k from jsonb_array_elements(p_rows) r) q
   where k in (select column_name from information_schema.columns
                where table_schema = 'public' and table_name = p_table)
     and k <> all (v_protected);

  if cardinality(v_present) = 0 then
    v_cols := ''; v_sel := ''; v_set := 'clave = excluded.clave';
  else
    select string_agg(format('%I', c), ', '),
           string_agg(case when c = 'extra' then $e$coalesce(src.extra, '{}'::jsonb)$e$ else format('src.%I', c) end, ', '),
           string_agg(case when c = 'extra' then format('extra = public.%I.extra || excluded.extra', p_table)
                           -- una celda vacía del Excel no borra lo que ya había
                           else format('%1$I = coalesce(excluded.%1$I, public.%2$I.%1$I)', c, p_table) end, ', ')
      into v_cols, v_sel, v_set
      from unnest(v_present) c;
    v_cols := ', ' || v_cols;
    v_sel := ', ' || v_sel;
  end if;

  execute format($q$
    with raw as (
      select s.*, %3$s as kk from jsonb_populate_recordset(null::public.%1$I, $1) s
    ),
    src as (select distinct on (kk) * from raw where kk is not null order by kk),
    up as (
      insert into public.%1$I (clave, status%2$s)
      select src.kk, 'Pendiente'%4$s from src
      on conflict (clave) do update set %5$s
      returning (xmax = 0) as ins
    )
    select count(*) filter (where ins), count(*) filter (where not ins) from up
  $q$, p_table, v_cols, public._clave_sql(p_table), v_sel, v_set)
  into v_ins, v_upd using p_rows;

  perform public._audit('import_rows', p_table, null,
    jsonb_build_object('rows', v_total, 'inserted', v_ins, 'updated', v_upd));
  return jsonb_build_object('inserted', v_ins, 'updated', v_upd, 'skipped', v_total - v_ins - v_upd);
end $$;

revoke all on function public._clave_sql(text) from public, anon, authenticated;
revoke all on function public.import_rows(text, jsonb) from public, anon, authenticated;
grant execute on function public.import_rows(text, jsonb) to authenticated;
