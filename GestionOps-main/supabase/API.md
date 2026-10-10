# GestionOps – contrato del backend Supabase

Sustituye al Apps Script (`backend/Code.gs`). El frontend **no** se ha modificado todavía; esta tabla es el mapa para adaptarlo.

## Sesión
`POST {SUPABASE_URL}/functions/v1/auth-login` con `{ usuario, password, rol: "admin" | "inspector" }`
→ `{ access_token, refresh_token, expires_in, user: { id, id_externo, nombre, usuario, rol, es_super } }`.
La sesión la firma Supabase Auth: en el frontend, `supabase.auth.setSession({ access_token, refresh_token })` y todas las consultas/RPC van autenticadas (el refresh es automático). El rol y la persona viajan en `app_metadata` (`app_role`, `personal_id`).
Errores: 401 credenciales/inactivo, 429 bloqueo (5 fallos en 15 min).
Sustituye a `localStorage.userRole`: el rol ahora viaja firmado en el JWT y lo aplica RLS.

## Lecturas (`api.ts` → supabase-js)
| Función actual | Nueva |
|---|---|
| `fetchTickets(role)` | `from('tickets').select('*')` |
| `fetchOrdenes(role)` | `from('ordenes').select('*')` |
| `fetchCalidad(role)` | `from('calidad').select('*')` |
| `fetchRazones(role)` | `from('razones').select('*')` |
| `fetchInspectors()` | `from('personal_publico').select('*')` (solo admin; sin contraseñas) |
| `fetchConfig()` | ya no existe; recuperación: `rpc('get_recovery_email')` (sin sesión) |

`role` deja de ser parámetro: RLS devuelve todo al admin y, al gestor, solo sus filas (`inspector_id = personal_id`) ocultando los inspeccionados/completados hace más de 24 h (antes lo hacía el Apps Script). Esto elimina `isMyTicket()` y el filtro por nombre.
Reemplazo del polling de 3 s: `supabase.channel(...).on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, ...)` (igual para las otras tres).

Cambios de forma de los datos: `inspector_id` es ahora el **uuid** de `personal.id` (el id "tarjeta" antiguo es `personal.id_externo`); las fechas son `timestamptz` ISO (antes texto `dd/MM/yyyy HH:mm` en hora RD → formatear en el cliente con zona `America/Santo_Domingo`); `evidence` es `text[]`; lo no mapeado está en `extra` (jsonb). `ensureKeys`/`getFlexVal` ya no hacen falta.

## Escrituras (todas `supabase.rpc(...)`, tabla ∈ `tickets|ordenes|calidad|razones`)
| Acción Apps Script | RPC | Quién |
|---|---|---|
| `assign_ticket`, `assign_ordenes_individual`, `assign_razones_individual`, `assign_calidad_individual` | `assign_item(p_table, p_key, p_inspector uuid)` → nº filas | admin |
| `assign_*_by_supervisor` | `assign_by_supervisor(p_table, p_supervisor, p_inspector uuid)` → nº filas | admin |
| `auto_assign` | `auto_assign()` → nº asignados | admin |
| `save_manual_code`, `save_calidad_codigo` | `save_codigo(p_table, p_key, p_codigo)` | admin / gestor dueño |
| `cancel_manual_code` | `cancel_codigo(p_table, p_key)` | admin / gestor dueño |
| `update_status` | `update_ticket_status(p_key, p_status, p_remarks, p_root_cause, p_evidence text[])` | admin / gestor dueño |
| `add_inspector` / `update_inspector` | `admin_save_personal(p jsonb)` (sin `id` = alta; `password` solo si se cambia) → uuid | admin |
| `delete_inspector` | `admin_delete_personal(p_id uuid)` | admin |
| (nuevo) importar Excel desde el panel | `import_rows(p_table, p_rows jsonb)` → `{inserted, updated, skipped}` (máx. 2000 filas por llamada; el frontend envía lotes de 500) | admin |
| `update_admin_profile` | `admin_update_profile(p_username, p_password, p_recovery_email)` | super admin |

Los errores llegan como `error.message` (ej. `Ya tiene un código aplicado`, `Registro no encontrado: X`), en lugar de `{status:"error"}`.
Las imágenes (`images[]` en base64) pasan a **Supabase Storage** (bucket privado `evidencias`, pendiente de crear junto al frontend); `evidence` guarda las rutas.

### Importación de Excel (`import_rows`)
Clave de negocio por módulo: tickets/razones = `ticket`; órdenes = `orden_externa_id` › `orden_servicio` › `ticket`; calidad = `ticket|caso_repetido`. Si la clave ya existe se **actualizan** los datos del Excel (una celda vacía no borra lo que había; `extra` se fusiona) pero **nunca** `status`, `inspector(_id)`, `codigo_aplicado` ni `fecha_inspeccion`. Los nuevos entran como `Pendiente`. La lectura y detección del módulo ocurre en el navegador (`frontend/src/services/excelImport.ts`).

## Diferencias deliberadas respecto al Apps Script
- `assign_item/by_supervisor` en **órdenes y calidad** ya no pisan el estado de registros `Inspeccionado/Completado` (antes los reabrían a "Asignado").
- `auto_assign` solo reparte entre personal activo con rol **Inspector** (antes también Admin).
- El login de admin exige estado `Activo`; el bloqueo por intentos es nuevo.
- Las contraseñas se guardan con bcrypt; el cliente jamás las recibe.

## Despliegue
1. Proyecto nuevo → `supabase link` → `supabase db push` (migraciones 0001–0003).
2. Aplicar también `0004_auth.sql` y `supabase functions deploy auth-login --no-verify-jwt`. No requiere ningún secreto: usa Supabase Auth.
3. Exportar cada hoja a CSV en `supabase/seed/csv/` (`inspectores.csv`, `config.csv`, `tickets.csv`, `ordenes.csv`, `calidad.csv`, `razones.csv`), `cp .env.example .env`, `npm i`, `npm run dry-run`, revisar el informe y luego `npm run import`.
4. `psql "$DB_URL" -f tests/rls_smoke.sql` contra el proyecto (en una transacción con rollback).
5. Tras migrar el frontend y validar: rotar/retirar la URL del Apps Script (está expuesta en el repo).
