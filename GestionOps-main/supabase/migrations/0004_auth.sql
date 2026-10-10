-- Login con Supabase Auth: el token lo firma Supabase (no hace falta ningún JWT secret).
-- El rol y la persona viajan en app_metadata (no editable por el usuario), que la
-- Edge Function auth-login fija en cada inicio de sesión.

alter table public.personal
  add column if not exists auth_user_id uuid unique;

create or replace function public.app_role() returns text
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' ->> 'app_role'
$$;

create or replace function public.app_pid() returns uuid
language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' ->> 'personal_id')::uuid
$$;

-- Si se borra a una persona, su usuario de Auth queda huérfano e inutilizable
-- (login_check ya no la encuentra). Limpieza opcional desde el panel de Auth.
