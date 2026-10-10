#!/usr/bin/env node
// Importa las hojas de Google Sheets (exportadas a CSV) a Supabase.
//
//   node import.mjs --dir ./csv [--dry-run]
//
// CSV esperados en --dir (los que falten se omiten):
//   inspectores.csv  (id,nombre,usuario,password,sector,estado,rol,correo_recuperacion)
//   config.csv       (param,value)  -> admin_username / admin_password / admin_recovery_email
//   tickets.csv  ordenes.csv  calidad.csv  razones.csv
//
// Variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (ver .env.example). Idempotente:
// cada fila lleva import_hash (sha1 de su contenido) y se hace upsert por él.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dir = args.includes("--dir") ? args[args.indexOf("--dir") + 1] : "./csv";

// ── Port de normalizeString / normalizeHeader de backend/Code.gs ─────────────
const normalizeString = (s) =>
  !s ? "" : String(s).toLowerCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "");

function normalizeHeader(h) {
  if (!h) return "";
  const low = normalizeString(h);
  const is = (...xs) => xs.includes(low);

  if (is("trabajo", "idd", "nro trabajo", "id trabajo", "id_trabajo", "job id", "nro orden", "numero de orden",
    "nro de orden", "nro_orden", "ticket", "id ticket", "nro ticket", "id_ticket")) return "ticket";
  if (is("work name", "tipo trabajo", "tipo de trabajo", "descripcion trabajo", "tipo servicio", "tipo_servicio")) return "descripcion_orden";
  if (is("orden servicio", "orden de servicio", "orden_servicio", "os", "id orden")) return "orden_servicio";
  if (is("orden externa", "order externa", "external order")) return "orden_externa_id";
  if (is("descripcion", "descripcion orden")) return "descripcion_orden";
  if (is("cliente", "nombre cliente", "nombre_cliente", "subscriber")) return "cliente";
  if (is("fecha", "fecha reporte", "fecha_creacion")) return "fecha";
  if (is("vence", "oe vencimiento", "oe_vencimiento", "oe vence", "oe_vence")) return "oe_vence";
  if (is("tecnologia", "tipo red", "tipo_red", "red", "servicio", "tipo servicio")) return "tecnologia";
  if (low === "sector") return "sector";
  if (low === "barrio") return "barrio";
  if (low === "ciudad") return "ciudad";
  if (is("zona", "region", "municipio")) return "sector";
  if (is("terminal", "id terminal", "fat", "caja")) return "terminal";
  if (low.includes("supervisor") && !low.includes("id") && !low.includes("tarjeta")) return "supervisor";
  if (low.includes("supervisor") && (low.includes("id") || low.includes("tarjeta"))) return "supervisor_id";
  if (is("nombre tecnico", "nombre_tecnico", "asignado a", "asignado_a", "tech_name", "tech")) return "tech";
  if (is("tecnico", "cedula", "cedula tecnico", "tarjeta") || low.includes("id tecnico") ||
    low.includes("tarjeta tecnico") || low.includes("tech_id")) return "tech_id";
  if (is("inspector", "inspector_nombre", "nombre inspector", "inspector asignado", "inspector_asignado", "nombre_inspector")) return "inspector";
  if (is("inspector id", "inspector_id", "tarjeta inspector", "id inspector", "id_inspector")) return "inspector_id";
  if (is("caso actual", "caso_actual", "ticket_actual")) return "ticket";
  if (is("tecnico actual", "tecnico_actual")) return "tech";
  if (is("supervisor actual", "supervisor_actual")) return "supervisor";
  if (is("work name actual", "work_name_actual", "work name")) return "work_name";
  if (is("caso repetido", "caso_repetido", "ticket_repetido")) return "caso_repetido";
  if (is("tecnico caso repetido", "tecnico_caso_repetido", "tecnico repetido")) return "tecnico_repetido";
  if (is("respuesta caso repetido", "respuesta_caso_repetido", "respuesta_repetido")) return "respuesta_repetido";
  if (is("fecha cierre repetido", "fecha_cierre_repetido", "fecha_repetido")) return "fecha_repetido";
  if (is("tecnologia actual", "tecnologia_actual")) return "tecnologia";
  if (is("sector actual", "sector_actual")) return "sector";
  if (is("estado", "status", "estado_orden", "estado inspeccion", "estado_inspeccion")) return "status";
  if (is("prioridad", "priority", "tipo de prioridad", "clasificacion prioridad")) return "priority";
  if (is("codigo aplicado", "codigo_aplicado", "manual_code", "codigo_razon")) return "codigo_aplicado";
  if (is("fecha inspeccion", "fecha_inspeccion", "fecha registro", "fecha_registro")) return "fecha_inspeccion";
  return low.replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

// Port de getHeaderInfo: la fila de encabezados puede no ser la primera
function headerRowIndex(rows) {
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    for (const c of rows[r]) {
      const v = normalizeString(c);
      if (["trabajo", "ticket", "orden servicio", "id", "caso"].includes(v)) return r;
    }
  }
  return 0;
}

const DESC_WORDS = ["reparacion", "instalacion", "averia", "proactiva", "internet", "voip", "cobre"];

// Port del bucle de doGet: decide qué es "ticket" y qué es descripción
function rowToObj(rawHeaders, normHeaders, row) {
  const obj = {};
  for (let j = 0; j < normHeaders.length; j++) {
    const key = normHeaders[j];
    if (!key) continue;
    const cell = (row[j] ?? "").toString().trim();
    const rawH = normalizeString(rawHeaders[j]);
    if (["ticket", "nro_ticket", "id_ticket", "id"].includes(rawH)) {
      if (cell) obj.ticket = cell;
    } else if (rawH === "trabajo") {
      const isDesc = DESC_WORDS.some((w) => cell.toLowerCase().includes(w));
      if (!isDesc) { if (!obj.ticket) obj.ticket = cell; } else obj.descripcion_orden = cell;
    } else if (key === "ticket") {
      if (!obj.ticket) obj.ticket = cell;
    } else {
      obj[key] = cell;
    }
  }
  return obj;
}

// "dd/MM/yyyy HH:mm[:ss]" (hora RD, GMT-4) | ISO | "yyyy-MM-dd" -> ISO UTC, o null
function parseDate(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [, d, mo, y, h = "0", mi = "0", se = "0"] = m;
    const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T${h.padStart(2, "0")}:${mi}:${se.padStart(2, "0")}-04:00`;
    const t = new Date(iso);
    return isNaN(t) ? null : t.toISOString();
  }
  const t = new Date(s);
  return isNaN(t) ? null : t.toISOString();
}

const cleanId = (v) => String(v ?? "").trim().replace(/\.0$/, "");
const sha1 = (s) => crypto.createHash("sha1").update(s).digest("hex");

const COMMON = ["ticket", "descripcion_orden", "orden_externa_id", "orden_servicio", "cliente", "tecnologia", "sector",
  "barrio", "ciudad", "terminal", "supervisor", "supervisor_id", "tech", "tech_id", "priority", "status",
  "codigo_aplicado", "remarks", "root_cause"];
const CALIDAD_ONLY = ["work_name", "caso_repetido", "tecnico_repetido", "respuesta_repetido"];
const DATES = ["fecha", "oe_vence", "fecha_inspeccion"];

function readCsv(name) {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) return null;
  return parse(fs.readFileSync(file, "utf8"), { bom: true, relax_column_count: true, skip_empty_lines: false });
}

const report = { tables: {}, warnings: [] };

// ── Personal + super admin ───────────────────────────────────────────────────
function buildPersonal() {
  const out = [];
  const rows = readCsv("inspectores.csv");
  if (rows) {
    const [head, ...data] = rows;
    const idx = Object.fromEntries(head.map((h, i) => [normalizeString(h), i]));
    for (const r of data) {
      if (!r.some((c) => c !== "")) continue;
      const g = (k) => (idx[k] === undefined ? "" : String(r[idx[k]] ?? "").trim());
      if (!g("usuario") || !g("nombre")) { report.warnings.push(`inspector sin usuario/nombre omitido: ${JSON.stringify(r)}`); continue; }
      out.push({
        id_externo: cleanId(g("id")), nombre: g("nombre"), usuario: g("usuario"), password: g("password"),
        sector: g("sector"), estado: g("estado") || "Activo", rol: ["Admin", "QAOR"].includes(g("rol")) ? g("rol") : "Inspector",
        correo_recuperacion: g("correo_recuperacion"), es_super: false,
      });
    }
  }
  const cfgRows = readCsv("config.csv");
  let recovery = "";
  if (cfgRows) {
    const cfg = Object.fromEntries(cfgRows.slice(1).map((r) => [String(r[0] ?? "").trim(), String(r[1] ?? "").trim()]));
    recovery = cfg.admin_recovery_email ?? "";
    if (cfg.admin_username) {
      const existing = out.find((p) => p.usuario.toLowerCase() === cfg.admin_username.toLowerCase());
      if (existing) Object.assign(existing, { es_super: true, rol: "Admin", password: cfg.admin_password || existing.password });
      else out.push({ id_externo: null, nombre: "Super Admin", usuario: cfg.admin_username, password: cfg.admin_password,
        sector: "", estado: "Activo", rol: "Admin", correo_recuperacion: recovery, es_super: true });
    }
  }
  return { personal: out, recovery };
}

// ── Tablas operativas ────────────────────────────────────────────────────────
function buildOps(table, file, resolve) {
  const rows = readCsv(file);
  if (!rows) return null;
  const hi = headerRowIndex(rows);
  const raw = rows[hi] ?? [];
  const norm = raw.map(normalizeHeader);
  const known = new Set([...COMMON, ...DATES, "inspector", "inspector_id", "evidence",
    ...(table === "calidad" ? [...CALIDAD_ONLY, "fecha_repetido"] : [])]);
  const out = [];
  const seen = new Set();
  let unresolved = 0, badDates = 0, dup = 0;

  for (const row of rows.slice(hi + 1)) {
    if (!row.some((c) => String(c ?? "").trim() !== "")) continue;
    const o = rowToObj(raw, norm, row);
    const rec = { extra: {} };
    for (const [k, v] of Object.entries(o)) {
      if (v === "" || v == null) continue;
      if (k === "fecha_repetido" && table === "calidad") { rec[k] = parseDate(v); if (!rec[k]) { badDates++; rec.extra[k] = v; } }
      else if (DATES.includes(k)) { rec[k] = parseDate(v); if (!rec[k]) { badDates++; rec.extra[k] = v; } }
      else if (k === "evidence") rec.evidence = String(v).split(",").map((s) => s.trim()).filter(Boolean);
      else if (k === "inspector" || k === "inspector_id") continue;
      else if (known.has(k)) rec[k] = v;
      else rec.extra[k] = v;
    }
    // Inspector: por id externo y, si no, por nombre (como isMyTicket en el frontend)
    const p = resolve(o.inspector_id, o.inspector);
    if (p) { rec.inspector_id = p.uuid; rec.inspector = p.nombre; }
    else if (o.inspector_id || o.inspector) {
      unresolved++;
      rec.inspector = o.inspector || null;
      rec.extra.inspector_id_original = o.inspector_id || null;
    }
    rec.import_hash = sha1(table + JSON.stringify(row));
    if (seen.has(rec.import_hash)) { dup++; continue; }
    seen.add(rec.import_hash);
    out.push(rec);
  }
  report.tables[table] = { source_rows: out.length + dup, importable: out.length, duplicates_skipped: dup,
    inspector_unresolved: unresolved, unparsed_dates: badDates, unmapped_columns: [...new Set(norm.filter((k) => k && !known.has(k)))] };
  return out;
}

// ── Main ─────────────────────────────────────────────────────────────────────
const supabase = dryRun ? null : createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });
if (!dryRun && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY))
  throw new Error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

const { personal, recovery } = buildPersonal();
report.tables.personal = { importable: personal.length, with_password: personal.filter((p) => p.password).length };
if (personal.some((p) => !p.password)) report.warnings.push("Hay personal sin contraseña: se les generará una aleatoria (deberán restablecerla).");

// uuid por id_externo / nombre. En dry-run se simula con ids ficticios.
const byExt = new Map(), byName = new Map();
if (!dryRun) {
  const n = await supabase.rpc("import_personal", { p: personal });
  if (n.error) throw n.error;
  if (recovery) await supabase.from("app_config").upsert({ param: "admin_recovery_email", value: recovery });
  const { data, error } = await supabase.from("personal").select("id,id_externo,nombre");
  if (error) throw error;
  for (const r of data) {
    if (r.id_externo) byExt.set(cleanId(r.id_externo), { uuid: r.id, nombre: r.nombre });
    byName.set(normalizeString(r.nombre), { uuid: r.id, nombre: r.nombre });
  }
} else {
  for (const p of personal) {
    const v = { uuid: `dry-${p.usuario}`, nombre: p.nombre };
    if (p.id_externo) byExt.set(cleanId(p.id_externo), v);
    byName.set(normalizeString(p.nombre), v);
  }
}
const resolve = (id, name) => (id && byExt.get(cleanId(id))) || (name && byName.get(normalizeString(name))) || null;

for (const [table, file] of [["tickets", "tickets.csv"], ["ordenes", "ordenes.csv"], ["calidad", "calidad.csv"], ["razones", "razones.csv"]]) {
  const recs = buildOps(table, file, resolve);
  if (!recs || dryRun) continue;
  for (let i = 0; i < recs.length; i += 500) {
    const { error } = await supabase.from(table).upsert(recs.slice(i, i + 500), { onConflict: "import_hash" });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
  report.tables[table].rows_in_db = count;
}

console.log(JSON.stringify({ mode: dryRun ? "dry-run" : "import", ...report }, null, 2));
