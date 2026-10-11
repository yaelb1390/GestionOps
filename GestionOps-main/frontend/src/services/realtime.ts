import { supabase } from './supabase';

export type Tabla = 'tickets' | 'ordenes' | 'calidad' | 'razones';
const TABLAS: Tabla[] = ['tickets', 'ordenes', 'calidad', 'razones'];

// Avisa cuando cambia cualquier fila visible (RLS filtra los eventos: el gestor solo recibe los suyos).
// Agrupa ráfagas (p. ej. una asignación masiva de 200 filas) en un solo aviso por tabla.
// Devuelve la función para cancelar la suscripción.
export function subscribeTables(onChange: (tabla: Tabla) => void, debounceMs = 500): () => void {
  const timers: Partial<Record<Tabla, ReturnType<typeof setTimeout>>> = {};
  const channel = supabase.channel('ops-' + Math.random().toString(36).slice(2));

  for (const tabla of TABLAS) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table: tabla }, () => {
      clearTimeout(timers[tabla]);
      timers[tabla] = setTimeout(() => onChange(tabla), debounceMs);
    });
  }
  channel.subscribe();

  return () => {
    Object.values(timers).forEach(t => clearTimeout(t));
    supabase.removeChannel(channel);
  };
}

// Avisa cuando el administrador activa o desactiva un módulo (para que el menú del gestor cambie al instante)
export function subscribeModules(onChange: () => void): () => void {
  const channel = supabase.channel('mods-' + Math.random().toString(36).slice(2));
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'app_modules' }, () => onChange());
  channel.subscribe();
  return () => { supabase.removeChannel(channel); };
}
