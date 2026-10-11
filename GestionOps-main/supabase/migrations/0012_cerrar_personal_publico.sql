-- Paso final de 0011: la vista personal_publico (con usuario y correo de recuperación) deja de ser legible desde la API.
-- Se aplica DESPUÉS de desplegar el frontend que usa personal_basico y personal_detalle(); antes rompería el sitio anterior.
revoke select on public.personal_publico from authenticated;
