// Capa de datos sobre Supabase (reemplaza al Google Apps Script).
// Mantiene los nombres y formas de respuesta anteriores para no tocar las páginas.
// Contrato completo: supabase/API.md
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

export interface Ticket {
  id: number | string;
  ticket: string;
  tech_id: string;
  tech: string;
  inspector_id?: string | number;
  inspector?: string;
  supervisor: string;
  sector: string;
  priority: string;
  status: string;
  evidence?: string;
  codigo_aplicado?: string;
  fecha?: string;
  [key: string]: any;
}

export interface Orden {
  ticket?: string;
  orden_servicio?: string;
  cliente?: string;
  fecha?: string;
  tecnologia?: string;
  sector?: string;
  terminal?: string;
  tech?: string;
  supervisor?: string;
  [key: string]: any;
}

export interface Inspector {
  id: string;            // id "tarjeta" (personal.id_externo); es lo que las pantallas usan como id
  uuid?: string;         // personal.id real
  nombre: string;
  sector: string;
  estado: string;
  usuario?: string;
  password?: string;     // nunca viene del servidor; solo se envía al crear/cambiar
  rol?: 'Admin' | 'Inspector' | 'QAOR';
  correo_recuperacion?: string;
  es_super?: boolean;
}

type Tabla = 'tickets' | 'ordenes' | 'calidad' | 'razones';

// ── Utilidades ───────────────────────────────────────────────────────────────

const rdFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/Santo_Domingo', day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

// timestamptz -> "dd/MM/yyyy HH:mm" en hora de RD (el formato que las pantallas ya parsean)
function fmtRD(ts: unknown): string {
  if (!ts) return '';
  const d = new Date(String(ts));
  if (isNaN(d.getTime())) return String(ts);
  const p = Object.fromEntries(rdFormatter.formatToParts(d).map(x => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

const DATE_FIELDS = ['fecha', 'oe_vence', 'fecha_inspeccion', 'fecha_repetido'];

// Fila de BD -> objeto con la forma que producía el Apps Script (extra aplanado, fechas RD, evidence en texto)
function mapRow(r: any): any {
  const { extra, import_hash, ...rest } = r;
  const out: any = { ...(extra || {}), ...rest };
  for (const k of DATE_FIELDS) if (k in out) out[k] = fmtRD(out[k]);
  if (Array.isArray(out.evidence)) out.evidence = out.evidence.join(', ');
  for (const k of Object.keys(out)) if (out[k] === null) out[k] = '';
  return out;
}

// PostgREST devuelve máx. 1000 filas por petición: se pagina
async function fetchAll(tabla: Tabla): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(tabla).select('*')
      .order('created_at', { ascending: true }).order('id').range(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out.map(mapRow);
}

// Lecturas: devuelven [] ante error (como antes), pero ya no se confunde con "sin datos" en consola
async function safeFetch(tabla: Tabla): Promise<any[]> {
  try {
    return await fetchAll(tabla);
  } catch (error) {
    console.error(`Error cargando ${tabla}:`, error);
    return [];
  }
}

const errMsg = (e: any) => e?.message || String(e);

// ── Sesión ───────────────────────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  id_externo: string | null;
  nombre: string;
  usuario: string;
  rol: 'Admin' | 'Inspector' | 'QAOR';
  es_super: boolean;
}

// Valida contra la Edge Function auth-login y abre la sesión de Supabase Auth
// `rol` es opcional: si no se envía, el servidor lo deduce del usuario (Admin -> 'admin'; Inspector/QAOR -> 'inspector')
export async function login(usuario: string, password: string, rol?: 'admin' | 'inspector'): Promise<SessionUser> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/auth-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ usuario, password, rol }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'No se pudo iniciar sesión');
  const { error } = await supabase.auth.setSession({ access_token: body.access_token, refresh_token: body.refresh_token });
  if (error) throw error;
  return body.user as SessionUser;
}

export async function logout(): Promise<void> {
  try { await supabase.auth.signOut(); } catch (e) { console.error(e); }
  ['userRole', 'inspectorName', 'inspectorId', 'username', 'inspectorRole'].forEach(k => localStorage.removeItem(k));
}

// Rol del JWT ('admin' | 'inspector') o null si no hay sesión válida. Es lo que aplica RLS en el servidor.
export async function getSessionRole(): Promise<'admin' | 'inspector' | null> {
  const { data } = await supabase.auth.getSession();
  const r = data.session?.user?.app_metadata?.app_role;
  return r === 'admin' || r === 'inspector' ? r : null;
}

export async function getRecoveryEmail(): Promise<string> {
  const { data } = await supabase.rpc('get_recovery_email');
  return (data as string) || '';
}

// ── Lecturas ─────────────────────────────────────────────────────────────────
// El parámetro `role` se conserva por compatibilidad: ahora lo decide RLS según la sesión.

export async function fetchTickets(_role: string = 'admin'): Promise<Ticket[]> { return safeFetch('tickets'); }
export const fetchOrdenes = async (_role: string = 'admin'): Promise<Orden[]> => safeFetch('ordenes');
export const fetchCalidad = async (_role: string = 'admin'): Promise<any[]> => safeFetch('calidad');
export const fetchRazones = async (_role: string = 'admin'): Promise<any[]> => safeFetch('razones');

// ── Personal ─────────────────────────────────────────────────────────────────

let inspectorCache: Inspector[] = [];

export const fetchInspectors = async (): Promise<Inspector[]> => {
  try {
    // Lista básica (para asignar): sin usuario ni correo. El directorio completo está en fetchPersonalDetalle().
    const { data, error } = await supabase.from('personal_basico').select('*').order('nombre');
    if (error) throw error;
    inspectorCache = (data || []).map((p: any) => ({
      id: p.id_externo || p.id,
      uuid: p.id,
      nombre: p.nombre,
      sector: p.sector || '',
      estado: p.estado,
      usuario: p.usuario,
      rol: p.rol,
      correo_recuperacion: p.correo_recuperacion || '',
    }));
    return inspectorCache;
  } catch (error) {
    console.error('Error fetching inspectors:', error);
    return [];
  }
};

// Directorio completo (usuario y correo). El servidor lo entrega solo con la contraseña confirmada: se usa dentro de Mi Perfil.
export const fetchPersonalDetalle = async (): Promise<Inspector[]> => {
  const { data, error } = await supabase.rpc('personal_detalle');
  if (error) { avisarSiFaltaConfirmacion(error); console.error('Error leyendo el directorio de personal:', error); return []; }
  return (data || []).map((p: any) => ({
    id: p.id_externo || p.id, uuid: p.id, nombre: p.nombre, sector: p.sector || '', estado: p.estado,
    usuario: p.usuario, rol: p.rol, correo_recuperacion: p.correo_recuperacion || '', es_super: p.es_super,
  }));
};

// Las pantallas identifican al gestor por su id "tarjeta"; la BD usa el uuid
async function resolveUuid(idOrUuid: string): Promise<string> {
  const find = () => inspectorCache.find(i => i.id === String(idOrUuid) || i.uuid === String(idOrUuid));
  let hit = find();
  if (!hit) { await fetchInspectors(); hit = find(); }
  if (!hit?.uuid) throw new Error('Gestor no encontrado: ' + idOrUuid);
  return hit.uuid;
}

export const createInspector = async (id: string, nombre: string, sector: string, usuario: string, password: string, rol: string = 'Inspector', correo_recuperacion: string = ''): Promise<boolean> => {
  const { error } = await supabase.rpc('admin_save_personal', {
    p: { id_externo: id, nombre, sector, usuario, password, rol, correo_recuperacion },
  });
  if (error) { console.error('Error creating inspector:', error); avisarSiFaltaConfirmacion(error); }
  return !error;
};

export const updateInspector = async (id: string, updates: Partial<Inspector> & { new_id?: string }): Promise<boolean> => {
  try {
    const uuid = await resolveUuid(id);
    const { new_id, id: _ignore, uuid: _u, ...rest } = updates as any;
    const { error } = await supabase.rpc('admin_save_personal', {
      p: { ...rest, id: uuid, id_externo: new_id || undefined },
    });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating inspector:', error);
    avisarSiFaltaConfirmacion(error as any);
    return false;
  }
};

export const deleteInspector = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase.rpc('admin_delete_personal', { p_id: await resolveUuid(id) });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting inspector:', error);
    avisarSiFaltaConfirmacion(error as any);
    return false;
  }
};

// Antes: hoja Config. Ahora: el super admin. La contraseña nunca se devuelve.
export const fetchConfig = async (): Promise<any> => {
  try {
    // Usuario y correo del super admin: viven en el directorio completo, que exige la contraseña confirmada (Mi Perfil)
    const { data, error } = await supabase.rpc('personal_detalle');
    if (error) return {};
    const su = (data || []).find((p: any) => p.es_super);
    return { admin_username: su?.usuario || '', admin_password: '', admin_recovery_email: su?.correo_recuperacion || '' };
  } catch (error) {
    console.error('Error fetching config:', error);
    return {};
  }
};

export const updateAdminProfile = async (username: string, password: string, recovery_email: string): Promise<boolean> => {
  const { error } = await supabase.rpc('admin_update_profile', {
    p_username: username, p_password: password || '', p_recovery_email: recovery_email,
  });
  if (error) {
    console.error('Error updating admin profile:', error);
    if (avisarSiFaltaConfirmacion(error)) throw new Error(MSG_SUDO);
  }
  return !error;
};

// ── Asignación ───────────────────────────────────────────────────────────────

async function assignItem(tabla: Tabla, key: string, tech_id: string): Promise<number> {
  const { data, error } = await supabase.rpc('assign_item', {
    p_table: tabla, p_key: String(key), p_inspector: await resolveUuid(tech_id),
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

async function assignBySupervisor(tabla: Tabla, supervisor: string, tech_id: string): Promise<number> {
  const { data, error } = await supabase.rpc('assign_by_supervisor', {
    p_table: tabla, p_supervisor: supervisor, p_inspector: await resolveUuid(tech_id),
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

// Tickets: antes devolvían false/0 ante error
export async function assignTicket(id: number | string, tech_id: string, _tech_name?: string): Promise<boolean> {
  try { await assignItem('tickets', String(id), tech_id); return true; }
  catch (error) { console.error('Error assigning ticket:', error); return false; }
}

export async function assignTicketsBySupervisor(supervisor: string, tech_id: string, _tech_name?: string): Promise<number> {
  try { return await assignBySupervisor('tickets', supervisor, tech_id); }
  catch (error) { console.error('Error bulk assigning tickets:', error); return 0; }
}

export const autoAssignTickets = async (): Promise<{ success: boolean; updated: number }> => {
  const { data, error } = await supabase.rpc('auto_assign');
  if (error) { console.error('Error auto assigning tickets:', error); return { success: false, updated: 0 }; }
  return { success: true, updated: (data as number) || 0 };
};

// Calidad / Razones / Órdenes: antes lanzaban Error ante fallo (las pantallas lo capturan)
export async function assignCalidadBySupervisor(supervisor: string, tech_id: string, _tech_name?: string): Promise<number> {
  return assignBySupervisor('calidad', supervisor, tech_id);
}
export async function assignCalidadIndividual(technician: string, tech_id: string, _tech_name?: string): Promise<boolean> {
  await assignItem('calidad', technician, tech_id);
  return true;
}
export async function assignRazonesBySupervisor(supervisor: string, tech_id: string, _tech_name?: string): Promise<number> {
  return assignBySupervisor('razones', supervisor, tech_id);
}
export async function assignRazonesIndividual(ticket: string, tech_id: string, _tech_name?: string): Promise<boolean> {
  await assignItem('razones', ticket, tech_id);
  return true;
}
export async function assignOrdenesBySupervisor(supervisor: string, tech_id: string, _tech_name?: string): Promise<number> {
  return assignBySupervisor('ordenes', supervisor, tech_id);
}
export async function assignOrdenesIndividual(orden_id: string | number, tech_id: string, _tech_name?: string): Promise<boolean> {
  await assignItem('ordenes', String(orden_id), tech_id);
  return true;
}

// ── Códigos y estado ─────────────────────────────────────────────────────────

export async function saveManualCodigo(ticket: string, codigo: string, type: string): Promise<{ success: boolean; message?: string }> {
  const { error } = await supabase.rpc('save_codigo', { p_table: type || 'calidad', p_key: String(ticket), p_codigo: codigo });
  return error ? { success: false, message: errMsg(error) } : { success: true };
}

export async function saveCalidadCodigo(ticket: string, codigo: string): Promise<{ success: boolean; message?: string }> {
  return saveManualCodigo(ticket, codigo, 'calidad');
}

export async function cancelManualCodigo(ticket: string, type: string): Promise<{ success: boolean; message?: string }> {
  const { error } = await supabase.rpc('cancel_codigo', { p_table: type || 'calidad', p_key: String(ticket) });
  return error ? { success: false, message: errMsg(error) } : { success: true };
}

// No lo usa ninguna pantalla hoy. Las imágenes (base64) irán a Supabase Storage cuando se necesiten.
export async function updateTicketStatus(id: number | string, newStatus: string, remarks?: string, rootCause?: string, images: string[] = []): Promise<boolean> {
  if (images.length) console.warn('updateTicketStatus: subida de imágenes pendiente de migrar a Storage; se omiten.');
  const { error } = await supabase.rpc('update_ticket_status', {
    p_key: String(id), p_status: newStatus, p_remarks: remarks ?? null, p_root_cause: rootCause ?? null, p_evidence: [],
  });
  if (error) console.error('Error updating ticket:', error);
  return !error;
}

// ── Importación de Excel (solo admin) ────────────────────────────────────────

export interface ImportTotals { inserted: number; updated: number; skipped: number }

// Envía las filas ya normalizadas (ver excelImport.ts) en lotes. El servidor actualiza lo existente sin pisar
// asignación, estado ni códigos, y crea lo nuevo como Pendiente. Lanza Error si algún lote falla.
export async function importRows(
  tabla: Tabla, rows: Record<string, any>[], onProgress?: (done: number, total: number) => void,
): Promise<ImportTotals> {
  const BATCH = 500;
  const totals: ImportTotals = { inserted: 0, updated: 0, skipped: 0 };
  for (let i = 0; i < rows.length; i += BATCH) {
    const { data, error } = await supabase.rpc('import_rows', { p_table: tabla, p_rows: rows.slice(i, i + BATCH) });
    if (error) throw new Error(`Falló el lote ${Math.floor(i / BATCH) + 1}: ${error.message}`);
    totals.inserted += data?.inserted ?? 0;
    totals.updated += data?.updated ?? 0;
    totals.skipped += data?.skipped ?? 0;
    onProgress?.(Math.min(i + BATCH, rows.length), rows.length);
  }
  return totals;
}

// ── Módulos del menú de gestores (Configuración) ─────────────────────────────

export interface ModuloApp {
  key: string;
  menu: 'gestor' | 'qaor' | 'ambos';
  label: string;
  descripcion: string;
  orden: number;
  enabled: boolean;
}

// Lo leen admin y gestores (el menú lo necesita). Ante error devuelve null: la app NO bloquea módulos por un fallo de red.
export async function fetchModulos(): Promise<ModuloApp[] | null> {
  const { data, error } = await supabase.from('app_modules').select('key, menu, label, descripcion, orden, enabled').order('orden');
  if (error) { console.error('Error cargando módulos:', error); return null; }
  return (data || []).map(m => ({ ...m, descripcion: m.descripcion || '' })) as ModuloApp[];
}

export async function setModulo(key: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_module_enabled', { p_key: key, p_enabled: enabled });
  if (error) throw new Error(error.message);
}

export async function setModulos(keys: string[], enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_modules_enabled', { p_keys: keys, p_enabled: enabled });
  if (error) throw new Error(error.message);
}

// ── Recuperación de la contraseña de administrador (códigos de un solo uso) ──

export interface RecoveryStatus { total: number; unused: number; generated_at: string | null }

export async function getRecoveryStatus(): Promise<RecoveryStatus | null> {
  const { data, error } = await supabase.rpc('recovery_status');
  if (error) { console.error('Error leyendo códigos de recuperación:', error); return null; }
  return data as RecoveryStatus;
}

// Genera un lote de 8 códigos (anula el anterior). Se devuelven una sola vez, en texto claro.
export async function generateRecoveryCodes(): Promise<string[]> {
  const { data, error } = await supabase.rpc('generate_recovery_codes');
  if (error) throw new Error(avisarSiFaltaConfirmacion(error) ? MSG_SUDO : error.message);
  return data as string[];
}

// Sin sesión: el admin que olvidó su clave usa su usuario + un código. Lanza Error con un mensaje apto para mostrar.
export async function recoverPassword(usuario: string, codigo: string, nueva: string): Promise<{ restantes: number }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/auth-recover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ usuario, codigo, nueva }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'No se pudo restablecer la contraseña');
  return { restantes: body.restantes ?? 0 };
}

// ── Recuperación por correo ──────────────────────────────────────────────────

// Pide que se envíe un código de 6 dígitos al correo registrado en Mi Perfil. La respuesta es siempre la misma
// exista o no el usuario (no se revela quién es administrador). Lanza Error solo si el envío no está disponible.
export async function enviarCodigoCorreo(usuario: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/auth-recover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ accion: 'enviar', usuario }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'No se pudo enviar el código');
}

// Admin con sesión: envía un correo de prueba al correo de Mi Perfil. Devuelve el destino enmascarado (y***@gmail.com).
export async function enviarCorreoPrueba(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/auth-recover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: JSON.stringify({ accion: 'probar' }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'No se pudo enviar el correo de prueba');
  return body.destino as string;
}

// ── Confirmación de contraseña (acciones sensibles) ──────────────────────────

// Si el servidor rechazó una acción por falta de confirmación, avisa a la app para que pida la contraseña.
export const SUDO_EVENT = 'sudo-required';
export function avisarSiFaltaConfirmacion(error: { message?: string } | null | undefined): boolean {
  if (error?.message?.includes('SUDO_REQUIRED')) {
    window.dispatchEvent(new Event(SUDO_EVENT));
    return true;
  }
  return false;
}
const MSG_SUDO = 'Confirma tu contraseña para continuar';

// true = contraseña correcta (el servidor recuerda la confirmación 10 min en ESTA sesión). Lanza Error si está bloqueado.
export async function verificarClave(password: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('verify_sudo', { p_password: password });
  if (error) throw new Error(error.message);
  return data === true;
}

// Cierra la confirmación (al salir de Mi Perfil). No es crítico si falla: caduca sola.
export async function cerrarConfirmacion(): Promise<void> {
  try { await supabase.rpc('end_sudo'); } catch { /* caduca a los 10 min */ }
}
