-- GestionOps: esquema base (migración desde Google Sheets / Apps Script)
-- Hojas origen -> tablas: Inspectores -> personal, Config -> app_config,
-- Tickets -> tickets, Ordenes -> ordenes, Calidad -> calidad, Razones -> razones.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ── Utilidades ───────────────────────────────────────────────────────────────
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Equivalente a normalizeString() del Apps Script (minúsculas, sin acentos, trim)
create or replace function public.norm(t text) returns text
language sql stable as $$
  select lower(extensions.unaccent(trim(coalesce(t, ''))))
$$;

-- Claims del JWT propio emitido por la Edge Function auth-login
create or replace function public.app_role() returns text
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role'
$$;

create or replace function public.app_pid() returns uuid
language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'personal_id')::uuid
$$;

-- ── Personal (hoja "Inspectores") ────────────────────────────────────────────
create table public.personal (
  id                  uuid primary key default gen_random_uuid(),
  id_externo          text unique,                 -- columna "id" de la hoja (tarjeta); es lo que usan tech_id/inspector_id
  nombre              text not null,
  usuario             text not null,
  password_hash       text not null,               -- bcrypt (crypt/gen_salt('bf')); nunca se expone
  sector              text,
  estado              text not null default 'Activo' check (estado in ('Activo', 'Inactivo')),
  rol                 text not null default 'Inspector' check (rol in ('Admin', 'Inspector')),
  correo_recuperacion text,
  es_super            boolean not null default false, -- super admin que antes vivía en la hoja Config
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index personal_usuario_uq on public.personal (lower(usuario));
create unique index personal_super_uq on public.personal (es_super) where es_super;
create trigger personal_updated before update on public.personal
  for each row execute function public.set_updated_at();

-- Vista sin hash para el cliente (solo admin, ver 0002)
create view public.personal_publico as
  select id, id_externo, nombre, usuario, sector, estado, rol, correo_recuperacion, es_super
  from public.personal
  where public.app_role() = 'admin';

-- ── Config (hoja "Config": param/value) ──────────────────────────────────────
create table public.app_config (
  param      text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

-- ── Tablas operativas ────────────────────────────────────────────────────────
-- Las 4 hojas comparten casi todas las columnas normalizadas (normalizeHeader).
-- Las columnas no reconocidas se guardan en `extra` para no perder datos.
do $$
declare t text;
begin
  foreach t in array array['tickets', 'ordenes', 'calidad', 'razones'] loop
    execute format($f$
      create table public.%1$I (
        id                uuid primary key default gen_random_uuid(),
        ticket            text,                 -- Trabajo / Ticket / IDD / Caso actual
        descripcion_orden text,                 -- descripción / tipo de trabajo
        orden_externa_id  text,                 -- "Orden externa" (id numérico en Órdenes)
        orden_servicio    text,
        cliente           text,
        tecnologia        text,
        sector            text,
        barrio            text,
        ciudad            text,
        terminal          text,
        supervisor        text,
        supervisor_id     text,
        tech              text,                 -- nombre del técnico
        tech_id           text,                 -- tarjeta / cédula del técnico
        priority          text,
        status            text,                 -- Pendiente | Asignado | Inspeccionado | Completado
        fecha             timestamptz,          -- fecha de reporte / creación
        oe_vence          timestamptz,          -- OE vencimiento
        inspector_id      uuid references public.personal(id) on update cascade on delete set null,
        inspector         text,                 -- nombre denormalizado (como en la hoja)
        codigo_aplicado   text,
        fecha_inspeccion  timestamptz,
        remarks           text,
        root_cause        text,
        evidence          text[] not null default '{}',
        extra             jsonb not null default '{}'::jsonb,
        import_hash       text unique,          -- idempotencia del importador
        created_at        timestamptz not null default now(),
        updated_at        timestamptz not null default now()
      )$f$, t);
    execute format('create trigger %1$s_updated before update on public.%1$I for each row execute function public.set_updated_at()', t);
    execute format('create index %1$s_inspector_idx on public.%1$I (inspector_id)', t);
    execute format('create index %1$s_status_idx on public.%1$I (status)', t);
    execute format('create index %1$s_supervisor_idx on public.%1$I (supervisor)', t);
    execute format('create index %1$s_ticket_idx on public.%1$I (ticket)', t);
  end loop;
end $$;

-- Columnas exclusivas de Calidad (Avería repetida)
alter table public.calidad
  add column work_name          text,
  add column caso_repetido      text,
  add column tecnico_repetido   text,
  add column respuesta_repetido text,
  add column fecha_repetido     timestamptz;

create index ordenes_externa_idx on public.ordenes (orden_externa_id);
create index ordenes_servicio_idx on public.ordenes (orden_servicio);

-- ── Auditoría e intentos de login ────────────────────────────────────────────
create table public.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor_id   uuid,
  actor_role text,
  action     text not null,
  tabla      text,
  clave      text,
  detalle    jsonb
);

create table public.login_attempts (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  usuario text not null,
  ok      boolean not null
);
create index login_attempts_idx on public.login_attempts (lower(usuario), at desc);
