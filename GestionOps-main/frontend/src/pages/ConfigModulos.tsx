import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Switch from '@radix-ui/react-switch';
import {
  FileText, Package, RotateCcw, Activity, ClipboardList, CheckCircle2, Moon, Users, Wrench, Eye, Loader2,
  SlidersHorizontal, Smartphone, ShieldCheck, Info,
} from 'lucide-react';
import { fetchModulos, setModulo, setModulos, type ModuloApp } from '../services/api';
import { subscribeModules } from '../services/realtime';
import './ConfigModulos.css';

// Icono y color de cada módulo (mismos colores que las tarjetas de la app del gestor)
const ESTILO: Record<string, { icon: typeof FileText; bg: string }> = {
  tickets: { icon: FileText, bg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
  ordenes: { icon: Package, bg: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' },
  repetidas: { icon: RotateCcw, bg: 'linear-gradient(135deg, #f59e0b, #d97706)' },
  diagnostico: { icon: Activity, bg: 'linear-gradient(135deg, #ef4444, #dc2626)' },
  actividades: { icon: ClipboardList, bg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
  inspecciones: { icon: CheckCircle2, bg: 'linear-gradient(135deg, #10b981, #059669)' },
  interfaz: { icon: Moon, bg: 'linear-gradient(135deg, #64748b, #334155)' },
  qaor_gestores: { icon: Users, bg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
  qaor_actividades: { icon: ClipboardList, bg: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' },
  qaor_acompanamiento: { icon: Eye, bg: 'linear-gradient(135deg, #10b981, #059669)' },
  qaor_preventivo: { icon: Wrench, bg: 'linear-gradient(135deg, #f59e0b, #d97706)' },
  qaor_inspecciones: { icon: CheckCircle2, bg: 'linear-gradient(135deg, #14b8a6, #0f766e)' },
  qaor_sacs: { icon: Activity, bg: 'linear-gradient(135deg, #ef4444, #dc2626)' },
};
// Estos tres también bloquean los datos en el servidor, no solo la tarjeta
const BLOQUEAN_DATOS = new Set(['tickets', 'ordenes', 'repetidas']);

const SECCIONES: { id: string; titulo: string; detalle: string; icon: typeof Smartphone; filtro: (m: ModuloApp) => boolean }[] = [
  { id: 'gestor', titulo: 'Menú de gestores', detalle: 'Lo que ve un gestor al abrir la app', icon: Smartphone, filtro: m => m.menu === 'gestor' },
  { id: 'qaor', titulo: 'Menú QAOR', detalle: 'Formularios del personal QAOR', icon: ClipboardList, filtro: m => m.menu === 'qaor' },
  { id: 'ambos', titulo: 'Común a todos los menús', detalle: 'Aparece tanto en el menú de gestores como en el QAOR', icon: SlidersHorizontal, filtro: m => m.menu === 'ambos' },
];

interface Props {
  notify: (msg: string, type?: 'success' | 'error') => void;
}

export default function ConfigModulos({ notify }: Props) {
  const [modulos, setModulosState] = useState<ModuloApp[] | null>(null);
  const [pendientes, setPendientes] = useState<Set<string>>(new Set()); // llaves guardándose

  const cargar = useCallback(async () => {
    const data = await fetchModulos();
    if (data) setModulosState(data);
    else notify('No se pudo cargar la configuración', 'error');
  }, [notify]);

  useEffect(() => {
    cargar();
    return subscribeModules(cargar); // si otro administrador cambia algo, se ve al instante
  }, [cargar]);

  const marcar = (keys: string[], on: boolean) =>
    setPendientes(p => { const n = new Set(p); keys.forEach(k => (on ? n.add(k) : n.delete(k))); return n; });
  const aplicarLocal = (keys: string[], enabled: boolean) =>
    setModulosState(ms => ms && ms.map(m => (keys.includes(m.key) ? { ...m, enabled } : m)));

  // Actualización optimista: el interruptor cambia al instante y vuelve atrás si el servidor lo rechaza
  const cambiar = async (keys: string[], enabled: boolean) => {
    if (!modulos) return;
    const antes = new Map(modulos.filter(m => keys.includes(m.key)).map(m => [m.key, m.enabled]));
    aplicarLocal(keys, enabled);
    marcar(keys, true);
    try {
      if (keys.length === 1) await setModulo(keys[0], enabled);
      else await setModulos(keys, enabled);
      const nombres = modulos.filter(m => keys.includes(m.key)).map(m => m.label);
      notify(keys.length === 1 ? `${nombres[0]} ${enabled ? 'activado' : 'desactivado'}` : `${keys.length} módulos ${enabled ? 'activados' : 'desactivados'}`, 'success');
    } catch (e: any) {
      setModulosState(ms => ms && ms.map(m => (antes.has(m.key) ? { ...m, enabled: antes.get(m.key)! } : m)));
      notify(e?.message || 'No se pudo guardar el cambio', 'error');
    }
    marcar(keys, false);
  };

  const total = modulos?.length ?? 0;
  const activos = useMemo(() => modulos?.filter(m => m.enabled).length ?? 0, [modulos]);

  if (!modulos) {
    return <div className="cfg"><div className="cfg-card" style={{ textAlign: 'center', padding: '3rem' }}><Loader2 className="spinner" size={28} /></div></div>;
  }

  return (
    <div className="cfg">
      <div className="cfg-card">
        <div className="cfg-head">
          <div>
            <h3>Módulos de la app del gestor</h3>
            <p>Activa o desactiva lo que aparece en el menú. Los cambios se aplican al instante, sin que el gestor tenga que recargar.</p>
          </div>
          <div className="cfg-count"><b>{activos}</b> de {total} activos</div>
        </div>
      </div>

      {SECCIONES.map(sec => {
        const lista = modulos.filter(sec.filtro);
        if (!lista.length) return null;
        const keys = lista.map(m => m.key);
        const todos = lista.every(m => m.enabled), ninguno = lista.every(m => !m.enabled);
        const Icon = sec.icon;
        return (
          <section className="cfg-card" key={sec.id} aria-label={sec.titulo}>
            <div className="cfg-section-top">
              <h4><Icon size={18} /> {sec.titulo} <small>· {sec.detalle}</small></h4>
              {lista.length > 1 && (
                <div className="cfg-bulk">
                  <button className="cfg-link" disabled={todos} onClick={() => cambiar(keys, true)}>Activar todos</button>
                  <button className="cfg-link" disabled={ninguno} onClick={() => cambiar(keys, false)}>Desactivar todos</button>
                </div>
              )}
            </div>
            {lista.map(m => {
              const est = ESTILO[m.key] ?? { icon: FileText, bg: 'linear-gradient(135deg, #64748b, #334155)' };
              const MIcon = est.icon;
              const guardando = pendientes.has(m.key);
              return (
                <div key={m.key} className={`cfg-row${m.enabled ? '' : ' off'}`}>
                  <div className="cfg-icon" style={{ background: est.bg }}><MIcon size={22} /></div>
                  <div className="cfg-info">
                    <div className="cfg-name">
                      <label htmlFor={`sw-${m.key}`} style={{ cursor: 'pointer' }}>{m.label}</label>
                      {BLOQUEAN_DATOS.has(m.key) && <span className="cfg-tag" title="Al desactivarlo, el gestor tampoco puede leer ni modificar estos datos">Bloquea datos</span>}
                    </div>
                    <div className="cfg-desc">{m.descripcion}</div>
                  </div>
                  <span className="cfg-state" aria-hidden>{m.enabled ? 'Activo' : 'Inactivo'}</span>
                  <Switch.Root
                    id={`sw-${m.key}`}
                    className="cfg-switch"
                    checked={m.enabled}
                    disabled={guardando}
                    onCheckedChange={(v) => cambiar([m.key], v)}
                    aria-label={`${m.enabled ? 'Desactivar' : 'Activar'} ${m.label}`}
                  >
                    <Switch.Thumb className="cfg-switch-thumb" />
                  </Switch.Root>
                </div>
              );
            })}
          </section>
        );
      })}

      <div className="cfg-note">
        <ShieldCheck size={18} />
        <div>
          <b>Tickets, Órdenes y Averías Repetidas</b> también se bloquean en el servidor: aunque alguien abra la app con un
          enlace guardado, no podrá leer ni cambiar esos datos mientras estén desactivados. El administrador siempre los ve.
          <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}><Info size={14} /> El resto solo oculta la tarjeta del menú.</div>
        </div>
      </div>
    </div>
  );
}
