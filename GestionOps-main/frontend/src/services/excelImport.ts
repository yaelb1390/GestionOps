// Lectura, detección de módulo y normalización de Excel para la importación del panel de admin.
// Lógica pura (sin DOM ni React). Porta las reglas de normalización de supabase/seed/import.mjs,
// que a su vez replican las del antiguo Apps Script (backend/Code.gs).
import * as XLSX from 'xlsx';

export type Modulo = 'tickets' | 'ordenes' | 'calidad' | 'razones';

export interface ModuloInfo {
  label: string;
  cols: { key: string; label: string }[]; // únicas columnas que se muestran en la vista previa
}

export const MODULOS: Record<Modulo, ModuloInfo> = {
  tickets: {
    label: 'Tickets',
    cols: [
      { key: 'ticket', label: 'Ticket' }, { key: 'descripcion_orden', label: 'Descripción' },
      { key: 'supervisor', label: 'Supervisor' }, { key: 'tech', label: 'Técnico' },
      { key: 'sector', label: 'Sector' }, { key: 'tecnologia', label: 'Tecnología' },
      { key: 'priority', label: 'Prioridad' }, { key: 'fecha', label: 'Fecha' },
    ],
  },
  ordenes: {
    label: 'Órdenes',
    cols: [
      { key: 'orden_externa_id', label: 'Orden externa' }, { key: 'descripcion_orden', label: 'Trabajo' },
      { key: 'cliente', label: 'Cliente' }, { key: 'tecnologia', label: 'Tecnología' },
      { key: 'sector', label: 'Sector' }, { key: 'terminal', label: 'Terminal' },
      { key: 'supervisor', label: 'Supervisor' }, { key: 'tech', label: 'Técnico' },
      { key: 'oe_vence', label: 'Vencimiento' }, { key: 'priority', label: 'Prioridad' },
    ],
  },
  calidad: {
    label: 'Averías repetidas',
    cols: [
      { key: 'ticket', label: 'Caso actual' }, { key: 'work_name', label: 'Work name' },
      { key: 'caso_repetido', label: 'Caso repetido' }, { key: 'tecnico_repetido', label: 'Técnico repetido' },
      { key: 'respuesta_repetido', label: 'Respuesta' }, { key: 'fecha_repetido', label: 'Cierre repetido' },
      { key: 'tech', label: 'Técnico' }, { key: 'supervisor', label: 'Supervisor' }, { key: 'sector', label: 'Sector' },
    ],
  },
  razones: {
    label: 'Códigos razón',
    cols: [
      { key: 'ticket', label: 'Ticket' }, { key: 'descripcion_orden', label: 'Descripción' },
      { key: 'cliente', label: 'Cliente' }, { key: 'supervisor', label: 'Supervisor' },
      { key: 'tech', label: 'Técnico' }, { key: 'sector', label: 'Sector' },
      { key: 'tecnologia', label: 'Tecnología' }, { key: 'priority', label: 'Prioridad' }, { key: 'fecha', label: 'Fecha' },
    ],
  },
};

// ── Normalización de encabezados (port de normalizeHeader de Code.gs / import.mjs) ──────────────

export const normalizeString = (s: unknown): string =>
  !s ? '' : String(s).toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function normalizeHeader(h: unknown): string {
  if (!h) return '';
  const low = normalizeString(h);
  const is = (...xs: string[]) => xs.includes(low);

  if (is('trabajo', 'idd', 'nro trabajo', 'id trabajo', 'id_trabajo', 'job id', 'nro orden', 'numero de orden',
    'nro de orden', 'nro_orden', 'ticket', 'id ticket', 'nro ticket', 'id_ticket')) return 'ticket';
  if (is('work name', 'tipo trabajo', 'tipo de trabajo', 'descripcion trabajo', 'tipo servicio', 'tipo_servicio')) return 'descripcion_orden';
  if (is('orden servicio', 'orden de servicio', 'orden_servicio', 'os', 'id orden')) return 'orden_servicio';
  if (is('orden externa', 'order externa', 'external order')) return 'orden_externa_id';
  if (is('descripcion', 'descripcion orden')) return 'descripcion_orden';
  if (is('cliente', 'nombre cliente', 'nombre_cliente', 'subscriber')) return 'cliente';
  if (is('fecha', 'fecha reporte', 'fecha_creacion')) return 'fecha';
  if (is('vence', 'oe vencimiento', 'oe_vencimiento', 'oe vence', 'oe_vence')) return 'oe_vence';
  if (is('tecnologia', 'tipo red', 'tipo_red', 'red', 'servicio', 'tipo servicio')) return 'tecnologia';
  if (low === 'sector') return 'sector';
  if (low === 'barrio') return 'barrio';
  if (low === 'ciudad') return 'ciudad';
  if (is('zona', 'region', 'municipio')) return 'sector';
  if (is('terminal', 'id terminal', 'fat', 'caja')) return 'terminal';
  if (low.includes('supervisor') && !low.includes('id') && !low.includes('tarjeta')) return 'supervisor';
  if (low.includes('supervisor') && (low.includes('id') || low.includes('tarjeta'))) return 'supervisor_id';
  if (is('nombre tecnico', 'nombre_tecnico', 'asignado a', 'asignado_a', 'tech_name', 'tech')) return 'tech';
  if (is('tecnico', 'cedula', 'cedula tecnico', 'tarjeta') || low.includes('id tecnico') ||
    low.includes('tarjeta tecnico') || low.includes('tech_id')) return 'tech_id';
  if (is('inspector', 'inspector_nombre', 'nombre inspector', 'inspector asignado', 'inspector_asignado', 'nombre_inspector')) return 'inspector';
  if (is('inspector id', 'inspector_id', 'tarjeta inspector', 'id inspector', 'id_inspector')) return 'inspector_id';
  if (is('caso actual', 'caso_actual', 'ticket_actual')) return 'ticket';
  if (is('tecnico actual', 'tecnico_actual')) return 'tech';
  if (is('supervisor actual', 'supervisor_actual')) return 'supervisor';
  if (is('work name actual', 'work_name_actual', 'work name')) return 'work_name';
  if (is('caso repetido', 'caso_repetido', 'ticket_repetido')) return 'caso_repetido';
  if (is('tecnico caso repetido', 'tecnico_caso_repetido', 'tecnico repetido')) return 'tecnico_repetido';
  if (is('respuesta caso repetido', 'respuesta_caso_repetido', 'respuesta_repetido')) return 'respuesta_repetido';
  if (is('fecha cierre repetido', 'fecha_cierre_repetido', 'fecha_repetido')) return 'fecha_repetido';
  if (is('tecnologia actual', 'tecnologia_actual')) return 'tecnologia';
  if (is('sector actual', 'sector_actual')) return 'sector';
  if (is('estado', 'status', 'estado_orden', 'estado inspeccion', 'estado_inspeccion')) return 'status';
  if (is('prioridad', 'priority', 'tipo de prioridad', 'clasificacion prioridad')) return 'priority';
  if (is('codigo aplicado', 'codigo_aplicado', 'manual_code', 'codigo_razon')) return 'codigo_aplicado';
  if (is('fecha inspeccion', 'fecha_inspeccion', 'fecha registro', 'fecha_registro')) return 'fecha_inspeccion';
  return low.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

// ── Lectura del archivo ─────────────────────────────────────────────────────────────────────────

export interface ParsedSheet {
  sheetNames: string[];
  sheetName: string;
  rawHeaders: string[];
  normHeaders: string[];
  rows: unknown[][];   // filas de datos (sin encabezado ni filas vacías)
}

export function readWorkbook(buf: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(buf, { type: 'array', cellDates: true });
}

// La fila de encabezados no siempre es la primera (títulos del reporte encima): se busca en las 10 primeras
function headerRowIndex(rows: unknown[][]): number {
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    if (rows[r].some(c => ['trabajo', 'ticket', 'orden servicio', 'id', 'caso', 'caso actual', 'orden externa'].includes(normalizeString(c)))) return r;
  }
  return 0;
}

export function parseSheet(wb: XLSX.WorkBook, sheetName?: string): ParsedSheet | null {
  const names = wb.SheetNames;
  const read = (n: string) => XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, raw: true, defval: '', blankrows: false });
  // Sin hoja indicada: la primera que tenga datos
  const chosen = sheetName && names.includes(sheetName) ? sheetName : names.find(n => read(n).length > 1) ?? names[0];
  if (!chosen) return null;
  const all = read(chosen);
  if (!all.length) return null;
  const hi = headerRowIndex(all);
  const rawHeaders = (all[hi] ?? []).map(h => String(h ?? '').trim());
  return {
    sheetNames: names,
    sheetName: chosen,
    rawHeaders,
    normHeaders: rawHeaders.map(normalizeHeader),
    rows: all.slice(hi + 1).filter(r => r.some(c => String(c ?? '').trim() !== '')),
  };
}

// ── Detección de módulo ─────────────────────────────────────────────────────────────────────────

export interface Deteccion {
  modulo: Modulo;
  confianza: 'alta' | 'media' | 'baja';
  scores: Record<Modulo, number>;
}

export function detectModule(sheet: Pick<ParsedSheet, 'rawHeaders' | 'normHeaders'>): Deteccion {
  const has = (k: string) => sheet.normHeaders.includes(k);
  const base = ['ticket', 'supervisor', 'tech', 'priority', 'sector', 'tecnologia'].filter(has).length;
  const razonHeader = sheet.rawHeaders.some(h => normalizeString(h).includes('razon'));

  const scores: Record<Modulo, number> = {
    calidad: ['caso_repetido', 'tecnico_repetido', 'respuesta_repetido', 'fecha_repetido'].filter(has).length * 3 + (has('work_name') ? 1 : 0),
    ordenes: (has('orden_externa_id') ? 3 : 0) + (has('orden_servicio') ? 3 : 0) + (has('oe_vence') ? 2 : 0) + (has('cliente') ? 1 : 0) + (has('terminal') ? 1 : 0),
    tickets: base + (has('ticket') ? 1 : 0),
    razones: base + (has('ticket') ? 1 : 0) + (razonHeader ? 4 : 0),
  };
  // Orden de desempate: tickets antes que razones (el caso por defecto)
  const order: Modulo[] = ['calidad', 'ordenes', 'razones', 'tickets'];
  const ranked = order.map(m => [m, scores[m]] as const).sort((a, b) => b[1] - a[1]);
  const [top, second] = [ranked[0], ranked[1]];
  const gap = top[1] - second[1];
  const confianza = top[1] >= 6 && gap >= 3 ? 'alta' : top[1] >= 3 && gap >= 1 ? 'media' : 'baja';
  // Si hay empate entre tickets y razones, se propone tickets
  const modulo = top[1] === second[1] && [top[0], second[0]].every(m => m === 'tickets' || m === 'razones') ? 'tickets' : top[0];
  return { modulo, confianza, scores };
}

// ── Construcción de filas para la importación ───────────────────────────────────────────────────

// Columnas reales de la tabla (el resto del Excel va a `extra`)
const BASE_COLS = ['ticket', 'descripcion_orden', 'orden_externa_id', 'orden_servicio', 'cliente', 'tecnologia', 'sector',
  'barrio', 'ciudad', 'terminal', 'supervisor', 'supervisor_id', 'tech', 'tech_id', 'priority', 'remarks', 'root_cause',
  'fecha', 'oe_vence'];
const CALIDAD_COLS = ['work_name', 'caso_repetido', 'tecnico_repetido', 'respuesta_repetido', 'fecha_repetido'];
const DATE_COLS = ['fecha', 'oe_vence', 'fecha_repetido'];
// Pertenecen al trabajo del gestor: el servidor nunca los pisa, así que no se envían
const PROTECTED_COLS = ['status', 'inspector', 'inspector_id', 'codigo_aplicado', 'fecha_inspeccion'];
const DESC_WORDS = ['reparacion', 'instalacion', 'averia', 'proactiva', 'internet', 'voip', 'cobre'];

const pad = (n: number) => String(n).padStart(2, '0');

// Date de Excel / "dd/MM/yyyy HH:mm[:ss]" / ISO -> ISO con la hora de reloj interpretada en RD (GMT-4), o null.
// Los Date de SheetJS llevan la hora de reloj del Excel en componentes locales, por eso no se usa toISOString().
export function parseDate(v: unknown): string | null {
  if (v === '' || v == null) return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}T${pad(v.getHours())}:${pad(v.getMinutes())}:00-04:00`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [, d, mo, y, h = '0', mi = '0', se = '0'] = m;
    const t = new Date(`${y}-${pad(+mo)}-${pad(+d)}T${pad(+h)}:${mi}:${pad(+se)}-04:00`);
    return isNaN(t.getTime()) ? null : t.toISOString();
  }
  const t = new Date(s);
  return isNaN(t.getTime()) ? null : t.toISOString();
}

const cleanId = (v: string) => v.replace(/\.0$/, '');

function cellText(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return parseDate(v) ?? '';
  return String(v).trim();
}

// Claves de negocio (mismas reglas que _clave_sql en la migración 0006) para contar duplicados antes de enviar
export function claveDe(modulo: Modulo, r: Record<string, any>): string | null {
  const c = (x: unknown) => cleanId(String(x ?? '').trim());
  if (modulo === 'ordenes') return c(r.orden_externa_id) || c(r.orden_servicio) || c(r.ticket) || null;
  if (modulo === 'calidad') return c(r.ticket) ? `${c(r.ticket)}|${c(r.caso_repetido)}` : null;
  return c(r.ticket) || null;
}

export interface Informe {
  total: number;
  validas: number;
  sinClave: number;
  repetidasEnArchivo: number;
  fechasNoInterpretadas: number;
  noMapeadas: string[];      // columnas del Excel que se guardan en `extra`
  ignoradas: string[];       // columnas que existen pero no se pisan (estado, inspector, código...)
}

export interface Resultado {
  rows: Record<string, any>[];   // listas para import_rows
  informe: Informe;
}

export function buildRows(modulo: Modulo, sheet: Pick<ParsedSheet, 'rawHeaders' | 'normHeaders' | 'rows'>): Resultado {
  const known = new Set([...BASE_COLS, ...(modulo === 'calidad' ? CALIDAD_COLS : [])]);
  const informe: Informe = { total: sheet.rows.length, validas: 0, sinClave: 0, repetidasEnArchivo: 0, fechasNoInterpretadas: 0, noMapeadas: [], ignoradas: [] };
  const noMap = new Set<string>(), ign = new Set<string>();
  const vistas = new Set<string>();
  const rows: Record<string, any>[] = [];

  for (const raw of sheet.rows) {
    // Mismo criterio que doGet: "Trabajo" es el ticket salvo que parezca una descripción
    const o: Record<string, string> = {};
    for (let j = 0; j < sheet.normHeaders.length; j++) {
      const key = sheet.normHeaders[j];
      if (!key) continue;
      const cell = cellText(raw[j]);
      const rawH = normalizeString(sheet.rawHeaders[j]);
      if (['ticket', 'nro_ticket', 'id_ticket', 'id'].includes(rawH)) { if (cell) o.ticket = cell; }
      else if (rawH === 'trabajo') {
        if (!DESC_WORDS.some(w => cell.toLowerCase().includes(w))) { if (!o.ticket) o.ticket = cell; }
        else o.descripcion_orden = cell;
      } else if (key === 'ticket') { if (!o.ticket) o.ticket = cell; }
      else o[key] = cell;
    }

    const rec: Record<string, any> = {};
    const extra: Record<string, string> = {};
    for (const [k, v] of Object.entries(o)) {
      if (v === '') continue;
      if (PROTECTED_COLS.includes(k)) { ign.add(k); continue; }
      if (DATE_COLS.includes(k) && known.has(k)) {
        const iso = parseDate(v);
        if (iso) rec[k] = iso; else { informe.fechasNoInterpretadas++; extra[k] = v; }
      } else if (known.has(k)) rec[k] = k.endsWith('_id') || k === 'ticket' || k === 'orden_servicio' ? cleanId(v) : v;
      else { extra[k] = v; noMap.add(k); }
    }
    if (Object.keys(extra).length) rec.extra = extra;

    const clave = claveDe(modulo, rec);
    if (!clave) { informe.sinClave++; continue; }
    if (vistas.has(clave)) { informe.repetidasEnArchivo++; continue; }
    vistas.add(clave);
    rows.push(rec);
  }

  informe.validas = rows.length;
  informe.noMapeadas = [...noMap];
  informe.ignoradas = [...ign];
  return { rows, informe };
}
