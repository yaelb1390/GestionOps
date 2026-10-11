import { useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, ArrowRight, Check, X, ListChecks,
  FileText, Package, RotateCcw, AlertCircle, Copy, ShieldCheck, RefreshCw, BookOpen, ChevronDown, Lightbulb,
} from 'lucide-react';
import type * as XLSX from 'xlsx';
import {
  readWorkbook, parseSheet, detectModule, buildRows, resumenHojas, MODULOS,
  type Modulo, type ParsedSheet, type ResumenHoja,
} from '../services/excelImport';
import { importRows, type ImportTotals } from '../services/api';
import './ImportExcel.css';

const ORDEN: Modulo[] = ['tickets', 'ordenes', 'calidad', 'razones'];
// Mismos iconos que el menú lateral, para que el módulo se reconozca de un vistazo
const ICONO: Record<Modulo, typeof FileText> = { tickets: FileText, ordenes: Package, calidad: RotateCcw, razones: AlertCircle };
const DESCRIPCION: Record<Modulo, string> = {
  tickets: 'Averías y trabajos', ordenes: 'Órdenes de servicio', calidad: 'Casos repetidos', razones: 'Código razón cliente',
};
const PREVIEW_ROWS = 50;

interface Props {
  onImported: (modulo: Modulo) => void;   // recarga los datos del módulo en el panel
  onOpenModule: (modulo: Modulo) => void; // abre la pestaña del módulo
  notify: (msg: string, type?: 'success' | 'error') => void;
}

export default function ImportExcel({ onImported, onOpenModule, notify }: Props) {
  const [reading, setReading] = useState(false);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [wb, setWb] = useState<XLSX.WorkBook | null>(null);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [detectado, setDetectado] = useState<Modulo>('tickets');
  const [modulo, setModulo] = useState<Modulo>('tickets');
  const [confianza, setConfianza] = useState<'alta' | 'media' | 'baja'>('baja');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ modulo: Modulo; totals: ImportTotals } | null>(null);
  const [hojas, setHojas] = useState<ResumenHoja[]>([]);        // todas las hojas del archivo y su módulo detectado
  const [importadas, setImportadas] = useState<string[]>([]);   // hojas de este archivo ya importadas
  const [motivo, setMotivo] = useState('');                      // por qué se eligió el módulo (contenido / nombre de hoja)

  const built = useMemo(() => (sheet ? buildRows(modulo, sheet) : null), [sheet, modulo]);
  const importing = progress !== null;
  const step = result ? 3 : sheet ? 2 : 1;

  const reset = () => { setWb(null); setSheet(null); setFile(null); setResult(null); setProgress(null); setHojas([]); setImportadas([]); setMotivo(''); };
  // Siguiente hoja del archivo que todavía no se importó (para encadenar Órdenes → Tickets sin volver a subir)
  const siguiente = hojas.find(h => !importadas.includes(h.nombre));

  const analyze = (book: XLSX.WorkBook, sheetName?: string) => {
    const parsed = parseSheet(book, sheetName);
    if (!parsed || !parsed.rows.length) {
      setSheet(null);
      notify('El archivo no tiene filas con datos.', 'error');
      return;
    }
    const det = detectModule(parsed);
    setSheet(parsed);
    setModulo(det.modulo);
    setDetectado(det.modulo);
    setConfianza(det.confianza);
    setMotivo(det.motivo ?? '');
  };

  const handleFile = async (f: File) => {
    setReading(true); setResult(null);
    try {
      const book = readWorkbook(await f.arrayBuffer());
      setWb(book); setFile({ name: f.name, size: f.size });
      setHojas(resumenHojas(book)); setImportadas([]);
      analyze(book);
    } catch (e) {
      console.error(e);
      notify('No se pudo leer el archivo. ¿Está dañado o protegido con contraseña?', 'error');
    }
    setReading(false);
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    multiple: false,
    disabled: reading,
    noClick: true,       // el clic lo maneja la zona completa (abajo) para poder usar "open"
    noKeyboard: true,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls', '.csv'],
      'text/csv': ['.csv'],
    },
    onDropAccepted: files => handleFile(files[0]),
    onDropRejected: () => notify('Formato no soportado. Sube un archivo .xlsx, .xls o .csv', 'error'),
  });

  const doImport = async () => {
    if (!built || !built.rows.length) return;
    setProgress({ done: 0, total: built.rows.length });
    const hojaActual = sheet?.sheetName;
    try {
      const totals = await importRows(modulo, built.rows, (done, total) => setProgress({ done, total }));
      setImportadas(p => (hojaActual && !p.includes(hojaActual) ? [...p, hojaActual] : p));
      setResult({ modulo, totals });
      onImported(modulo);
      notify(`Importación terminada: ${totals.inserted} nuevos, ${totals.updated} actualizados`, 'success');
    } catch (e: any) {
      notify(e?.message || 'Error al importar', 'error');
    }
    setProgress(null);
  };

  const cols = MODULOS[modulo].cols;
  const hasRows = !!built && built.rows.length > 0;
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="imp">
      <Steps current={step} finished={!!result} />

      {/* 1 · Subir */}
      {!sheet && !result && (
        <div
          {...getRootProps({
            className: `imp-drop${isDragActive ? ' active' : ''}${reading ? ' busy' : ''}`,
            onClick: open,
            onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } },
            tabIndex: 0,
            role: 'button',
            'aria-label': 'Subir archivo de Excel',
          })}
        >
          <input {...getInputProps()} />
          <div className="imp-drop-icon">
            {reading ? <Loader2 className="spinner" size={34} /> : <Upload size={34} />}
          </div>
          <h3>{reading ? 'Leyendo archivo…' : isDragActive ? 'Suelta el archivo aquí' : 'Arrastra tu Excel aquí'}</h3>
          <p>{reading ? 'Esto toma solo un momento' : <>o <span className="imp-link">haz clic para elegirlo</span> desde tu equipo</>}</p>
          <div className="imp-chips">
            {['XLSX', 'XLS', 'CSV'].map(f => <span key={f} className="imp-chip mono">{f}</span>)}
            <span className="imp-chip" style={{ background: 'none' }}>·</span>
            {ORDEN.map(m => {
              const Icon = ICONO[m];
              return <span key={m} className="imp-chip"><Icon size={13} /> {MODULOS[m].label}</span>;
            })}
          </div>
        </div>
      )}

      {/* 2 · Revisar */}
      {sheet && built && !result && (
        <>
          <div className="imp-card">
            <div className="imp-file">
              <div className="imp-file-icon"><FileSpreadsheet size={24} /></div>
              <div className="imp-file-info">
                <div className="imp-file-name">{file?.name}</div>
                <div className="imp-file-meta">
                  <span>{formatSize(file?.size ?? 0)}</span> · <span>{sheet.rows.length} filas</span> · <span>hoja</span> <b>“{sheet.sheetName}”</b>
                </div>
              </div>
              <button className="imp-icon-btn" onClick={reset} disabled={importing}><X size={15} /> Quitar</button>
            </div>
            {hojas.length > 1 && (
              <div className="imp-sheets" role="tablist" aria-label="Hojas del archivo">
                <span className="imp-sheets-label">Este archivo trae {hojas.length} hojas. Cada una se importa por separado:</span>
                {hojas.map(h => {
                  const Icono = ICONO[h.modulo];
                  const activa = h.nombre === sheet.sheetName, hecha = importadas.includes(h.nombre);
                  return (
                    <button key={h.nombre} role="tab" aria-selected={activa} disabled={importing}
                      className={`imp-sheet${activa ? ' on' : ''}${hecha ? ' done' : ''}`} onClick={() => wb && analyze(wb, h.nombre)}>
                      <b>{h.nombre}</b>
                      <span className="imp-sheet-mod"><Icono size={13} /> {MODULOS[h.modulo].label}</span>
                      <span className="imp-sheet-n">{h.filas} filas</span>
                      {hecha && <Check size={14} strokeWidth={3} className="imp-sheet-ok" aria-label="ya importada" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="imp-card">
            <div className="imp-section-title">
              Módulo de destino
              <span className={`imp-pill ${confianza}`}>detección {confianza}</span>
              {motivo && <span className="imp-hint">· {motivo}</span>}
              {confianza !== 'alta' && <span className="imp-hint">Confirma que sea el correcto antes de importar.</span>}
            </div>
            <div className="imp-modules" role="radiogroup" aria-label="Módulo de destino">
              {ORDEN.map(m => {
                const Icon = ICONO[m];
                return (
                  <button key={m} role="radio" aria-checked={modulo === m} disabled={importing}
                    className={`imp-mod${modulo === m ? ' selected' : ''}`} onClick={() => setModulo(m)}>
                    <div className="imp-mod-icon"><Icon size={20} /></div>
                    <div><b>{MODULOS[m].label}</b><span>{DESCRIPCION[m]}</span></div>
                    {m === detectado && <em className="imp-mod-tag" style={{ fontStyle: 'normal' }}>detectado</em>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="imp-stats">
            <Stat icon={<CheckCircle2 size={22} />} tone="ok" value={built.informe.validas} label="Listos para importar" />
            <Stat icon={<AlertTriangle size={22} />} tone={built.informe.sinClave ? 'warn' : 'idle'} value={built.informe.sinClave} label="Sin identificador (se omiten)" />
            <Stat icon={<Copy size={22} />} tone={built.informe.repetidasEnArchivo ? 'warn' : 'idle'} value={built.informe.repetidasEnArchivo} label="Repetidos en el archivo" />
          </div>

          {(built.informe.noMapeadas.length > 0 || built.informe.ignoradas.length > 0 || built.informe.fechasNoInterpretadas > 0) && (
            <div className="imp-notice">
              <ShieldCheck size={18} />
              <div>
                {built.informe.noMapeadas.length > 0 && (
                  <span>Columnas que no pertenecen al módulo (se guardan aparte, no se muestran): <b>{built.informe.noMapeadas.join(', ')}</b></span>
                )}
                {built.informe.ignoradas.length > 0 && (
                  <span>Se ignoran para no pisar el trabajo de los gestores: <b>{built.informe.ignoradas.join(', ')}</b></span>
                )}
                {built.informe.fechasNoInterpretadas > 0 && (
                  <span>
                    {built.informe.fechasNoInterpretadas} fecha(s) no se pudieron interpretar y se guardaron como texto, p. ej. <b>{built.informe.ejemplosFechas.join(" · ")}</b>
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="imp-card">
            <div className="imp-section-title" style={{ marginBottom: '0.25rem' }}>
              <ListChecks size={18} color="var(--primary-color)" /> Vista previa · {MODULOS[modulo].label}
            </div>
            <p className="imp-hint" style={{ marginBottom: '1rem' }}>
              {hasRows
                ? `Primeras ${Math.min(PREVIEW_ROWS, built.rows.length)} de ${built.rows.length} filas, solo con las columnas de este módulo.`
                : 'Ninguna fila tiene el identificador de este módulo. Prueba con otro módulo.'}
            </p>
            {hasRows && (
              <div className="imp-table-wrap">
                <table>
                  <thead><tr><th>#</th>{cols.map(c => <th key={c.key}>{c.label}</th>)}</tr></thead>
                  <tbody>
                    {built.rows.slice(0, PREVIEW_ROWS).map((r, i) => (
                      <tr key={i}>
                        <td className="imp-row-no">{i + 1}</td>
                        {cols.map(c => {
                          const t = fmtCell(c.key, r[c.key]);
                          return <td key={c.key} className={t === '—' ? 'imp-empty' : undefined}>{t}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="imp-action">
            {importing ? (
              <div className="grow">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6, color: 'var(--text-main)', fontWeight: 600 }}>
                  <span>Importando a {MODULOS[modulo].label}…</span><span>{progress!.done} / {progress!.total} · {pct}%</span>
                </div>
                <div className="imp-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
              </div>
            ) : (
              <>
                <button className="btn-primary" disabled={!hasRows} onClick={doImport}>
                  <Upload size={18} /> Importar {built.rows.length} registros
                </button>
                <small className="grow">Lo que ya existe se actualiza sin tocar asignaciones, estados ni códigos aplicados.</small>
              </>
            )}
          </div>
        </>
      )}

      {/* 3 · Resultado */}
      {result && (
        <div className="imp-card imp-done">
          <div className="imp-done-icon"><Check size={42} strokeWidth={2.5} /></div>
          <h3>Importación completada · {MODULOS[result.modulo].label}</h3>
          <div className="imp-totals">
            <div><strong>{result.totals.inserted}</strong><span>nuevos</span></div>
            <div><strong>{result.totals.updated}</strong><span>actualizados</span></div>
            <div><strong>{result.totals.skipped}</strong><span>omitidos</span></div>
          </div>
          {siguiente && (
            <p className="imp-next">
              Falta importar la hoja <b>«{siguiente.nombre}»</b> ({MODULOS[siguiente.modulo].label}, {siguiente.filas} filas).
            </p>
          )}
          <div className="imp-done-actions">
            {siguiente && (
              <button className="btn-primary" onClick={() => { setResult(null); if (wb) analyze(wb, siguiente.nombre); }}>
                Importar hoja «{siguiente.nombre}» · {MODULOS[siguiente.modulo].label} <ArrowRight size={16} />
              </button>
            )}
            <button className={siguiente ? 'btn-secondary' : 'btn-primary'} onClick={() => onOpenModule(result.modulo)}>
              Ver {MODULOS[result.modulo].label} {!siguiente && <ArrowRight size={16} />}
            </button>
            <button className="btn-secondary" onClick={reset}><RefreshCw size={16} /> Subir otro archivo</button>
          </div>
        </div>
      )}

      <Guia abierta={step === 1} />
    </div>
  );
}

// ── Instructivo: cómo se usa esta pantalla ──────────────────────────────────────
const PASOS: { icon: typeof Upload; titulo: string; texto: string }[] = [
  { icon: FileSpreadsheet, titulo: 'Prepara tu Excel', texto: 'Usa el reporte tal como sale del sistema (.xlsx, .xls o .csv). Puede traer títulos arriba o varias hojas: no hace falta limpiarlo.' },
  { icon: Upload, titulo: 'Súbelo', texto: 'Arrastra el archivo a la zona de carga o haz clic para elegirlo. El sistema detecta solo si son Tickets, Órdenes, Averías repetidas o Códigos razón.' },
  { icon: ListChecks, titulo: 'Revisa y confirma', texto: 'Confirma el módulo (puedes cambiarlo), mira los totales y la vista previa. Solo se muestran las columnas del módulo.' },
  { icon: CheckCircle2, titulo: 'Importa', texto: 'Pulsa Importar. Los registros nuevos entran como Pendiente y los que ya existían se actualizan. Luego usa “Ver módulo” para abrirlos.' },
];

const COLUMNAS: { modulo: Modulo; clave: string; resto: string }[] = [
  { modulo: 'tickets', clave: 'Ticket (o el número de “Orden externa” si no hay columna Ticket)', resto: 'Supervisor, Técnico, Sector, Tecnología, Prioridad, Fecha' },
  { modulo: 'ordenes', clave: 'Orden externa (o Orden servicio)', resto: 'Trabajo (descripción), Cliente, Terminal, Sector, Tecnología, Vencimiento' },
  { modulo: 'calidad', clave: 'Caso actual + Caso repetido', resto: 'Técnico repetido, Respuesta, Cierre repetido, Supervisor, Sector' },
  { modulo: 'razones', clave: 'Ticket (y una columna con “razón” en su nombre)', resto: 'Cliente, Supervisor, Técnico, Sector, Tecnología, Fecha' },
];

const CONSEJOS: { t: string; d: string }[] = [
  { t: 'Subir el mismo archivo dos veces no duplica nada.', d: 'Cada registro se identifica por su número (ticket u orden). Si ya existe, solo se actualizan sus datos.' },
  { t: 'El trabajo de los gestores nunca se pisa.', d: 'Asignación, estado y código aplicado se conservan. Las columnas Estado, Inspector o Código del Excel se ignoran a propósito.' },
  { t: 'Una celda vacía no borra lo que ya había.', d: 'Si el Excel trae un campo en blanco, se mantiene el valor guardado.' },
  { t: 'Si hay dos columnas parecidas, gana la principal.', d: 'Por ejemplo, “Trabajo” manda sobre “Tipo servicio”. La otra no se pierde: se guarda aparte.' },
  { t: 'Fechas: se aceptan los formatos habituales.', d: 'Fechas de Excel, 13/10/2026 12:00 p. m., 2026-10-13 o 15-oct-2026, siempre en hora de República Dominicana. Si alguna no se entiende, el aviso te muestra ejemplos.' },
  { t: 'Archivos con varias hojas (por ejemplo, Órdenes y Tickets).', d: 'Cada hoja se detecta e importa por separado: al terminar una, un botón te lleva a la siguiente sin volver a subir el archivo. Órdenes y Tickets salen del sistema con los mismos encabezados, así que se distinguen por el contenido (reparación o avería frente a instalación o traslado) y, si no alcanza, por el nombre de la hoja.' },
  { t: 'Filas que se omiten.', d: 'Las que no tienen número de ticket u orden, o están repetidas dentro del mismo archivo. El resumen te dice cuántas son.' },
  { t: 'Un módulo equivocado se corrige antes de importar.', d: 'Si la detección no es “alta”, revisa que la tarjeta marcada sea la correcta; si la vista previa sale vacía, prueba con otro módulo.' },
];

function Guia({ abierta }: { abierta: boolean }) {
  return (
    <details className="imp-guide" open={abierta}>
      <summary>
        <span className="imp-guide-ico"><BookOpen size={20} /></span>
        <span className="imp-guide-title">
          <b>¿Cómo se usa esta pantalla?</b>
          <small>Instructivo paso a paso, columnas que reconoce y preguntas frecuentes</small>
        </span>
        <ChevronDown size={20} className="imp-guide-chev" />
      </summary>

      <div className="imp-guide-body">
        <ol className="imp-how">
          {PASOS.map((p, i) => {
            const Icon = p.icon;
            return (
              <li key={p.titulo}>
                <div className="imp-how-top"><span className="imp-how-n">{i + 1}</span><Icon size={20} /></div>
                <b>{p.titulo}</b>
                <p>{p.texto}</p>
              </li>
            );
          })}
        </ol>

        <h4 className="imp-guide-h"><ListChecks size={17} /> Qué columnas reconoce cada módulo</h4>
        <p className="imp-guide-sub">Los nombres no tienen que ser idénticos (acepta variantes como “Orden Externa”, “OE Vence” o “Zona”). Lo único obligatorio es el identificador.</p>
        <div className="imp-table-wrap imp-cols">
          <table>
            <thead><tr><th>Módulo</th><th>Identificador (obligatorio)</th><th>Otras columnas que usa</th></tr></thead>
            <tbody>
              {COLUMNAS.map(c => {
                const Icon = ICONO[c.modulo];
                return (
                  <tr key={c.modulo}>
                    <td><span className="imp-cols-mod"><Icon size={15} /> {MODULOS[c.modulo].label}</span></td>
                    <td><b>{c.clave}</b></td>
                    <td className="imp-cols-rest">{c.resto}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h4 className="imp-guide-h"><Lightbulb size={17} /> Buenas prácticas y preguntas frecuentes</h4>
        <ul className="imp-tips">
          {CONSEJOS.map(c => (
            <li key={c.t}><Check size={16} strokeWidth={3} /><div><b>{c.t}</b><span>{c.d}</span></div></li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function Steps({ current, finished }: { current: number; finished: boolean }) {
  const items = ['Subir archivo', 'Revisar y confirmar', 'Importar'];
  return (
    <div className="imp-card imp-steps" aria-label="Progreso de la importación">
      {items.map((label, i) => {
        const n = i + 1;
        const done = finished || n < current;
        const state = done ? 'done' : n === current ? 'active' : '';
        return (
          <div key={label} style={{ display: 'contents' }}>
            <div className={`imp-step ${state}`} aria-current={n === current && !finished ? 'step' : undefined}>
              <div className="imp-step-dot">{done ? <Check size={15} strokeWidth={3} /> : n}</div>
              <span>{label}</span>
            </div>
            {i < items.length - 1 && <div className={`imp-step-line${done ? ' done' : ''}`} />}
          </div>
        );
      })}
    </div>
  );
}

function Stat({ icon, tone, value, label }: { icon: React.ReactNode; tone: 'ok' | 'warn' | 'idle'; value: number; label: string }) {
  return (
    <div className="imp-stat">
      <div className={`imp-stat-icon ${tone}`}>{icon}</div>
      <div><strong>{value}</strong><span>{label}</span></div>
    </div>
  );
}

const formatSize = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);

// ISO -> hora de RD legible; el resto tal cual
const rd = new Intl.DateTimeFormat('es-DO', { timeZone: 'America/Santo_Domingo', dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23' });
function fmtCell(key: string, v: unknown): string {
  if (v == null || v === '') return '—';
  if (['fecha', 'oe_vence', 'fecha_repetido'].includes(key)) {
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? String(v) : rd.format(d);
  }
  return String(v);
}
