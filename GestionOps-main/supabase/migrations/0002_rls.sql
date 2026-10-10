-- Seguridad: RLS en todo, sin acceso anónimo. Las escrituras de gestores pasan por RPC (0003).

alter table public.personal       enable row level security;
alter table public.app_config     enable row level security;
alter table public.tickets        enable row level security;
alter table public.ordenes        enable row level security;
alter table public.calidad        enable row level security;
alter table public.razones        enable row level security;
alter table public.audit_log      enable row level security;
alter table public.login_attempts enable row level security;

-- Cerrar todo por defecto y abrir solo lo necesario
revoke all on all tables in schema public from anon, authenticated;
-- Las policies y la vista usan estos helpers
grant execute on function public.app_role(), public.app_pid(), public.norm(text) to authenticated;

-- personal / app_config / login_attempts: sin policies => solo service_role.
-- El admin lee personal mediante la vista personal_publico (sin password_hash).
grant select on public.personal_publico to authenticated;

-- audit_log: solo lectura para admin
grant select on public.audit_log to authenticated;
create policy audit_admin_read on public.audit_log
  for select to authenticated using (public.app_role() = 'admin');

-- Tablas operativas
do $$
declare t text;
begin
  foreach t in array array['tickets', 'ordenes', 'calidad', 'razones'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    -- Admin: todo
    execute format($p$create policy %1$s_admin_all on public.%1$I for all to authenticated
      using (public.app_role() = 'admin') with check (public.app_role() = 'admin')$p$, t);

    -- Gestor: solo sus filas asignadas. Replica el filtro de 24 h del Apps Script:
    -- los registros ya inspeccionados/completados dejan de verse pasadas 24 h.
    execute format($p$create policy %1$s_inspector_read on public.%1$I for select to authenticated
      using (
        public.app_role() = 'inspector'
        and inspector_id = public.app_pid()
        and not (
          lower(coalesce(status, '')) in ('completado', 'inspeccionado')
          and fecha_inspeccion is not null
          and fecha_inspeccion < now() - interval '24 hours'
        )
      )$p$, t);
  end loop;
end $$;

-- Los gestores NO tienen insert/update/delete directo: ver RPC save_codigo, etc.
-- (policy de escritura solo para admin; el gestor no tiene ninguna)

-- Realtime (sustituye el polling de 3 s del frontend). RLS aplica a los eventos.
alter publication supabase_realtime add table public.tickets, public.ordenes, public.calidad, public.razones;
