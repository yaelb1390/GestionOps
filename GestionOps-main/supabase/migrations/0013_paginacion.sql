-- Paginación, búsqueda y contadores en el servidor.
-- Antes el panel descargaba TODAS las filas (de 1000 en 1000) y filtraba en el navegador: con miles de filas tarda
-- y con millones no termina. Ahora la base entrega solo la página que se ve, con índices para que sea instantáneo.
-- Todas las funciones son SECURITY INVOKER: siguen mandando las políticas RLS (admin ve todo, gestor solo lo suyo).

create extension if not exists pg_trgm with schema extensions;

-- ── Texto de búsqueda (una sola expresión indexada con trigramas) ────────────────────────────────────────────
-- (concat_ws no es IMMUTABLE y no se puede indexar: se arma con coalesce y ||)
create or replace function public._search_expr(p_table text) returns text
language sql immutable as $$
  select 'lower(' || string_agg('coalesce(' || c || ', '''')', ' || '' '' || ') || ')'
  from unnest(case p_table
    when 'ordenes' then array['orden_servicio','orden_externa_id','cliente','supervisor','tech','tech_id','ticket','sector','descripcion_orden','status','inspector','codigo_aplicado']
    when 'calidad' then array['ticket','tech','tech_id','sector','status','supervisor','cliente','work_name','inspector','codigo_aplicado']
    when 'razones' then array['ticket','tech','supervisor','sector','orden_externa_id','orden_servicio','status','inspector','codigo_aplicado']
    else array['ticket','tech','tech_id','supervisor','sector','status','inspector','codigo_aplicado']
  end) c
$$;

-- Condición de "inspeccionado" de cada módulo (misma regla que usaba el panel)
create or replace function public._insp_cond(p_table text) returns text
language sql immutable as $$
  select case p_table
    when 'tickets' then $e$(status in ('Inspeccionado','Aprobado','Rechazado') or codigo_aplicado is not null)$e$
    when 'ordenes' then $e$(status in ('Completado','Inspeccionado','Aprobado') or codigo_aplicado is not null)$e$
    when 'calidad' then $e$(status in ('Inspeccionado','Aprobado') or codigo_aplicado is not null)$e$
    else $e$(codigo_aplicado is not null)$e$
  end
$$;

-- ── Índices ──────────────────────────────────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['tickets', 'ordenes', 'calidad', 'razones'] loop
    execute format('create index if not exists %1$s_creado_idx on public.%1$I (created_at desc, id desc)', t);
    execute format('create index if not exists %1$s_estado_creado_idx on public.%1$I (status, created_at desc)', t);
    execute format('create index if not exists %1$s_tech_idx on public.%1$I (tech)', t);
    execute format('create index if not exists %1$s_busqueda_trgm on public.%1$I using gin ((%2$s) extensions.gin_trgm_ops)', t, public._search_expr(t));
    execute format('create index if not exists %1$s_insp_idx on public.%1$I (fecha_inspeccion desc nulls last) where %2$s', t, public._insp_cond(t));
  end loop;
end $$;

-- ── Página de resultados ─────────────────────────────────────────────────────────────────────────────────────
-- p_filtros: { columna: texto } (contiene, sin distinguir mayúsculas). Solo columnas permitidas.
-- El total se cuenta hasta 10.001 filas ("capped") para no recorrer millones solo por dibujar los números de página.
create or replace function public.listar_pagina(
  p_table text, p_search text default null, p_filtros jsonb default '{}'::jsonb,
  p_supervisor text default null, p_limit int default 20, p_offset int default 0)
returns jsonb language plpgsql stable as $$
declare
  v_where text[] := '{}';
  v_k text; v_v text;
  v_cols text[] := array['ticket','descripcion_orden','orden_externa_id','orden_servicio','cliente','tecnologia','sector',
                         'barrio','ciudad','terminal','supervisor','tech','tech_id','priority','status','inspector',
                         'codigo_aplicado','work_name','caso_repetido','tecnico_repetido','respuesta_repetido'];
  v_w text; v_rows jsonb; v_n int; v_lim int := least(greatest(coalesce(p_limit, 20), 1), 200);
  v_off int := greatest(coalesce(p_offset, 0), 0);
  v_esc text;
begin
  if p_table not in ('tickets', 'ordenes', 'calidad', 'razones') then raise exception 'Tabla no válida: %', p_table; end if;
  if coalesce(btrim(p_search), '') <> '' then
    v_esc := replace(replace(replace(lower(btrim(p_search)), '\', '\\'), '%', '\%'), '_', '\_');
    v_where := v_where || format('%s like %L', public._search_expr(p_table), '%' || v_esc || '%');
  end if;
  if coalesce(p_supervisor, '') <> '' then
    v_where := v_where || format('supervisor = %L', p_supervisor);
  end if;
  for v_k, v_v in select key, value from jsonb_each_text(coalesce(p_filtros, '{}'::jsonb)) loop
    if coalesce(btrim(v_v), '') = '' then continue; end if;
    if v_k = any (v_cols) then
      v_esc := replace(replace(replace(btrim(v_v), '\', '\\'), '%', '\%'), '_', '\_');
      v_where := v_where || format('%I ilike %L', v_k, '%' || v_esc || '%');
    elsif v_k = 'fecha' then
      v_esc := replace(replace(replace(btrim(v_v), '\', '\\'), '%', '\%'), '_', '\_');
      v_where := v_where || format('(fecha::text ilike %1$L or oe_vence::text ilike %1$L)', '%' || v_esc || '%');
    end if;
  end loop;
  v_w := case when array_length(v_where, 1) is null then 'true' else array_to_string(v_where, ' and ') end;

  execute format('select count(*) from (select 1 from public.%I where %s limit 10001) s', p_table, v_w) into v_n;
  execute format($q$select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
      select * from public.%1$I where %2$s order by created_at desc, id desc limit %3$s offset %4$s) x$q$,
      p_table, v_w, v_lim, v_off) into v_rows;
  return jsonb_build_object('rows', v_rows, 'total', v_n, 'capped', v_n > 10000);
end $$;

-- ── Contadores del dashboard ─────────────────────────────────────────────────────────────────────────────────
create or replace function public.panel_stats() returns jsonb
language plpgsql stable as $$
declare t text; v jsonb := '{}'::jsonb; n_tot bigint; n_ins bigint; v_est jsonb;
begin
  foreach t in array array['tickets', 'ordenes', 'calidad', 'razones'] loop
    execute format('select count(*) from public.%I', t) into n_tot;
    execute format('select count(*) from public.%I where %s', t, public._insp_cond(t)) into n_ins;
    execute format('select coalesce(jsonb_object_agg(coalesce(status, ''Pendiente''), n), ''{}''::jsonb) from (select status, count(*) n from public.%I group by status) s', t) into v_est;
    v := v || jsonb_build_object(t, jsonb_build_object('total', n_tot, 'inspeccionados', n_ins, 'por_estado', v_est));
  end loop;
  return v;
end $$;

-- ── Supervisores distintos (recorrido por índice, sin leer toda la tabla) ────────────────────────────────────
create or replace function public.listar_supervisores(p_table text) returns text[]
language plpgsql stable as $$
declare r text[];
begin
  if p_table not in ('tickets', 'ordenes', 'calidad', 'razones') then raise exception 'Tabla no válida: %', p_table; end if;
  execute format($q$
    with recursive s as (
      (select supervisor v from public.%1$I where supervisor is not null and supervisor <> '' order by supervisor limit 1)
      union all
      select (select supervisor from public.%1$I where supervisor > s.v order by supervisor limit 1) from s where s.v is not null)
    select coalesce(array_agg(v), '{}') from s where v is not null$q$, p_table) into r;
  return r;
end $$;

-- ── Últimas inspecciones (3 de cada módulo, por fecha de inspección) ─────────────────────────────────────────
create or replace function public.ultimas_inspecciones(p_n int default 3) returns jsonb
language plpgsql stable as $$
declare t text; v jsonb := '[]'::jsonb; r jsonb;
begin
  foreach t in array array['tickets', 'ordenes', 'calidad'] loop
    execute format($q$select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('_type', %2$L)), '[]'::jsonb) from (
        select * from public.%1$I where %3$s order by fecha_inspeccion desc nulls last limit %4$s) x$q$,
        t, t, public._insp_cond(t), least(greatest(p_n, 1), 20)) into r;
    v := v || r;
  end loop;
  return v;
end $$;

-- ── Panel de Inspecciones (lista mixta de los 4 módulos, paginada) ──────────────────────────────────────────
-- p_tipo: Todos | Ticket | Orden | Repetida | Razon
create or replace function public.listar_inspecciones(
  p_search text default null, p_tipo text default 'Todos', p_limit int default 25, p_offset int default 0)
returns jsonb language plpgsql stable as $$
declare
  v_def text[][] := array[
    ['Ticket',   'tickets', 'ticket'],
    ['Orden',    'ordenes', 'coalesce(orden_externa_id, orden_servicio, ticket)'],
    ['Repetida', 'calidad', 'ticket'],
    ['Razon',    'razones', 'ticket']];
  v_parts text[] := '{}'; v_i int; v_search text := ''; v_esc text; v_u text; v_rows jsonb; v_n int;
begin
  for v_i in 1 .. array_length(v_def, 1) loop
    continue when p_tipo is not null and p_tipo <> 'Todos' and p_tipo <> v_def[v_i][1];
    v_search := '';
    if coalesce(btrim(p_search), '') <> '' then
      v_esc := replace(replace(replace(lower(btrim(p_search)), '\', '\\'), '%', '\%'), '_', '\_');
      v_search := format(' and (%s like %L or %L like %L)', public._search_expr(v_def[v_i][2]), '%' || v_esc || '%',
                         lower(v_def[v_i][1]), '%' || v_esc || '%');
    end if;
    v_parts := v_parts || format(
      $p$select %1$L::text as origen, %3$s::text as id, coalesce(nullif(tech, ''), tech_id, '-') as tech,
                coalesce(nullif(inspector, ''), '-') as gestor, coalesce(nullif(supervisor, ''), '-') as sup,
                coalesce(nullif(sector, ''), '-') as sector, fecha_inspeccion, coalesce(codigo_aplicado, '') as codigo
         from public.%2$I where %4$s%5$s$p$,
      v_def[v_i][1], v_def[v_i][2], v_def[v_i][3], public._insp_cond(v_def[v_i][2]), v_search);
  end loop;
  if array_length(v_parts, 1) is null then
    return jsonb_build_object('rows', '[]'::jsonb, 'total', 0, 'capped', false);
  end if;
  v_u := array_to_string(v_parts, ' union all ');
  execute format('select count(*) from (select 1 from (%s) u limit 10001) s', v_u) into v_n;
  execute format($q$select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
      select * from (%s) u order by fecha_inspeccion desc nulls last limit %s offset %s) x$q$,
      v_u, least(greatest(coalesce(p_limit, 25), 1), 10000), greatest(coalesce(p_offset, 0), 0)) into v_rows;
  return jsonb_build_object('rows', v_rows, 'total', v_n, 'capped', v_n > 10000);
end $$;

-- ── Técnicos con más averías repetidas ───────────────────────────────────────────────────────────────────────
create or replace function public.top_repetidas(p_n int default 5) returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'repeated', rep, 'total', total) order by pct desc), '[]'::jsonb)
  from (
    select c.tech as name, c.n as rep, coalesce(nullif(t.n, 0), c.n) as total,
           c.n::float / coalesce(nullif(t.n, 0), c.n) as pct
    from (select tech, count(*) n from public.calidad where coalesce(btrim(tech), '') <> '' group by tech) c
    left join lateral (select count(*) n from public.tickets where tech = c.tech) t on true
    order by pct desc limit least(greatest(p_n, 1), 20)
  ) z
$$;

grant execute on function public.listar_pagina(text, text, jsonb, text, int, int),
                          public.panel_stats(), public.listar_supervisores(text),
                          public.ultimas_inspecciones(int), public.top_repetidas(int),
                          public.listar_inspecciones(text, text, int, int) to authenticated;

-- Solo con sesión iniciada (Supabase da EXECUTE a anon por defecto)
revoke execute on function public.listar_pagina(text, text, jsonb, text, int, int),
                           public.panel_stats(), public.listar_supervisores(text),
                           public.ultimas_inspecciones(int), public.top_repetidas(int),
                           public.listar_inspecciones(text, text, int, int) from public, anon;
