import { useMemo, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import {
  readWorkbook, parseSheet, detectModule, buildRows, MODULOS,
  type Modulo, type ParsedSheet,
} from '../services/excelImport';
import { importRows, type ImportTotals } from '../services/api';
import type * as XLSX from 'xlsx';

const ORDEN: Modulo[] = ['tickets', 'ordenes', 'calidad', 'razones'];
const CONFIANZA = { alta: 'success', media: 'warning', baja: 'danger' } as const;
const PREVIEW_ROWS = 50;

interface Props {
  // Se llama al terminar con el módulo importado, para que el panel recargue y pueda abrirlo
  onImported: (modulo: Modulo) => void;
  onOpenModule: (modulo: Modulo) => void;
  notify: (msg: string, type?: 'success' | 'error') => void;
}

export default function ImportExcel({ onImported, onOpenModule, notify }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [wb, setWb] = useState<XLSX.WorkBook | null>(null);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [modulo, setModulo] = useState<Modulo>('tickets');
  const [confianza, setConfianza] = useState<'alta' | 'media' | 'baja'>('baja');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ modulo: Modulo; totals: ImportTotals } | null>(null);

  const built = useMemo(() => (sheet ? buildRows(modulo, sheet) : null), [sheet, modulo]);
  const importing = progress !== null;

  const reset = () => {
    setWb(null); setSheet(null); setFileName(''); setResult(null); setProgress(null);
    if (inputRef.current) inputRef.current.value = '';
  };

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
    setConfianza(det.confianza);
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      notify('Formato no soportado. Sube un archivo .xlsx, .xls o .csv', 'error');
      return;
    }
    setReading(true); setResult(null);
    try {
      const book = readWorkbook(await file.arrayBuffer());
      setWb(book); setFileName(file.name);
      analyze(book);
    } catch (e) {
      console.error(e);
      notify('No se pudo leer el archivo. ¿Está dañado o protegido con contraseña?', 'error');
    }
    setReading(false);
  };

  const doImport = async () => {
    if (!built || !built.rows.length) return;
    setProgress({ done: 0, total: built.rows.length });
    try {
      const totals = await importRows(modulo, built.rows, (done, total) => setProgress({ done, total }));
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
  const soft = { background: 'rgba(100, 116, 139, 0.08)', borderRadius: '12px' } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => handleFile(e.target.files?.[0])} />

      {/* 1. Subida */}
      {!sheet && !result && (
        <div
          className="glass-panel"
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); }}
          onClick={() => inputRef.current?.click()}
          style={{
            cursor: 'pointer', textAlign: 'center', padding: '3rem 1.5rem',
            background: dragging ? 'rgba(59, 130, 246, 0.10)' : undefined,
            transition: 'background 0.2s',
          }}
        >
          {reading ? <Loader2 className="spinner" size={40} /> : <Upload size={40} color="var(--primary-color)" />}
          <h3 style={{ margin: '1rem 0 0.4rem', color: 'var(--text-main)' }}>
            {reading ? 'Leyendo archivo…' : 'Arrastra tu Excel aquí o haz clic para elegirlo'}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            .xlsx, .xls o .csv · el sistema detecta si son Tickets, Órdenes, Averías repetidas o Códigos razón
          </p>
        </div>
      )}

      {/* 2. Análisis y vista previa */}
      {sheet && built && !result && (
        <>
          <div className="glass-panel" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              <FileSpreadsheet size={28} color="var(--secondary-color)" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fileName}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {sheet.rows.length} filas · hoja
                  {sheet.sheetNames.length > 1 ? (
                    <select
                      className="input-control" value={sheet.sheetName} disabled={importing}
                      onChange={e => wb && analyze(wb, e.target.value)}
                      style={{ display: 'inline-block', width: 'auto', padding: '0.15rem 0.5rem', margin: '0 0 0 0.4rem' }}
                    >
                      {sheet.sheetNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  ) : ` “${sheet.sheetName}”`}
                </div>
              </div>
            </div>
            <button className="btn-secondary" onClick={reset} disabled={importing}>Cambiar archivo</button>
          </div>

          <div className="glass-panel">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Módulo detectado</span>
              <span className={`badge ${CONFIANZA[confianza]}`}>confianza {confianza}</span>
              {confianza !== 'alta' && (
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Confirma que sea el correcto antes de importar.</span>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
              {ORDEN.map(m => (
                <button
                  key={m} disabled={importing}
                  className={modulo === m ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setModulo(m)}
                >
                  {MODULOS[m].label}
                </button>
              ))}
            </div>
          </div>

          {/* Resumen */}
          <div className="kpi-grid">
            <Stat label="Listos para importar" value={built.informe.validas} tone="green" />
            <Stat label="Sin identificador (se omiten)" value={built.informe.sinClave} tone={built.informe.sinClave ? 'amber' : 'blue'} />
            <Stat label="Repetidos en el archivo" value={built.informe.repetidasEnArchivo} tone={built.informe.repetidasEnArchivo ? 'amber' : 'blue'} />
          </div>

          {(built.informe.noMapeadas.length > 0 || built.informe.ignoradas.length > 0 || built.informe.fechasNoInterpretadas > 0) && (
            <div className="glass-panel" style={{ ...soft, fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', gap: '0.6rem' }}>
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} color="var(--warning-color)" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {built.informe.noMapeadas.length > 0 && (
                  <span>Columnas que no pertenecen al módulo (se guardan aparte, no se muestran): <b>{built.informe.noMapeadas.join(', ')}</b></span>
                )}
                {built.informe.ignoradas.length > 0 && (
                  <span>Se ignoran para no pisar el trabajo de los gestores: <b>{built.informe.ignoradas.join(', ')}</b></span>
                )}
                {built.informe.fechasNoInterpretadas > 0 && (
                  <span>{built.informe.fechasNoInterpretadas} fecha(s) no se pudieron interpretar y se guardaron como texto.</span>
                )}
              </div>
            </div>
          )}

          {/* Vista previa: solo columnas del módulo */}
          <div className="glass-panel">
            <h3 style={{ color: 'var(--text-main)', marginBottom: '0.25rem' }}>Vista previa · {MODULOS[modulo].label}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {hasRows ? `Primeras ${Math.min(PREVIEW_ROWS, built.rows.length)} de ${built.rows.length} filas, solo con las columnas de este módulo.` : 'Ninguna fila tiene el identificador de este módulo. Prueba con otro módulo.'}
            </p>
            {hasRows && (
              <div className="table-container">
                <table>
                  <thead><tr>{cols.map(c => <th key={c.key}>{c.label}</th>)}</tr></thead>
                  <tbody>
                    {built.rows.slice(0, PREVIEW_ROWS).map((r, i) => (
                      <tr key={i}>{cols.map(c => <td key={c.key}>{fmtCell(c.key, r[c.key])}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn-primary" disabled={!hasRows || importing} onClick={doImport}>
              {importing ? <><Loader2 className="spinner" size={18} /> Importando {progress!.done}/{progress!.total}…</>
                : <><Upload size={18} /> Importar {built.rows.length} registros a {MODULOS[modulo].label}</>}
            </button>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Lo que ya existe se actualiza sin tocar asignaciones, estados ni códigos aplicados.
            </span>
          </div>
        </>
      )}

      {/* 3. Resultado */}
      {result && (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <CheckCircle2 size={44} color="var(--secondary-color)" />
          <h3 style={{ margin: '1rem 0 0.5rem', color: 'var(--text-main)' }}>Importación completada · {MODULOS[result.modulo].label}</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            <b>{result.totals.inserted}</b> nuevos · <b>{result.totals.updated}</b> actualizados · <b>{result.totals.skipped}</b> omitidos
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={() => onOpenModule(result.modulo)}>
              Ver {MODULOS[result.modulo].label} <ArrowRight size={16} />
            </button>
            <button className="btn-secondary" onClick={reset}>Subir otro archivo</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'green' | 'amber' | 'red' }) {
  return (
    <div className="glass-panel kpi-card">
      <div className={`kpi-icon ${tone}`}><FileSpreadsheet size={22} /></div>
      <div className="kpi-info"><h3>{label}</h3><p>{value}</p></div>
    </div>
  );
}

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
