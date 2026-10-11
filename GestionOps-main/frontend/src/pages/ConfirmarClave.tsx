import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Lock, Eye, EyeOff, Loader2, AlertCircle, ShieldCheck, X } from 'lucide-react';
import { verificarClave } from '../services/api';
import './ConfirmarClave.css';

interface Props {
  titulo?: string;
  mensaje?: string;
  onConfirmado: () => void;
  onCancelar: () => void;          // Cancelar, Escape o clic fuera
}

// Ventana flotante que pide la contraseña del administrador que tiene la sesión. La comprobación la hace el
// servidor (bcrypt, bloqueo tras 5 fallos); si es correcta, el servidor recuerda la confirmación 10 minutos.
// Radix Dialog aporta lo difícil de hacer bien a mano: foco atrapado, Escape, bloqueo del fondo y lectores de pantalla.
export default function ConfirmarClave({
  titulo = 'Confirma tu contraseña',
  mensaje = 'Por seguridad, escribe tu contraseña para ver y modificar tu perfil.',
  onConfirmado, onCancelar,
}: Props) {
  const [clave, setClave] = useState('');
  const [ver, setVer] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [sacudir, setSacudir] = useState(0);   // cambia en cada fallo para repetir la animación
  const campo = useRef<HTMLInputElement>(null);
  // Tras un fallo el campo se vuelve a montar (para repetir la animación): el cursor vuelve a él para reintentar
  useEffect(() => { if (sacudir > 0) campo.current?.focus(); }, [sacudir]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clave || cargando) return;
    setError(''); setCargando(true);
    try {
      if (await verificarClave(clave)) { setClave(''); onConfirmado(); return; }
      setError('Contraseña incorrecta');
    } catch (err: any) {
      setError(err?.message || 'No se pudo comprobar la contraseña');
    }
    setClave(''); setSacudir(n => n + 1); setCargando(false);
  };

  return (
    <Dialog.Root open onOpenChange={(abierto) => { if (!abierto && !cargando) onCancelar(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="cc-overlay" />
        <Dialog.Content className="cc-card" aria-describedby="cc-desc" onOpenAutoFocus={(e) => { e.preventDefault(); campo.current?.focus(); }}>
          <Dialog.Close className="cc-close" aria-label="Cerrar" disabled={cargando}><X size={18} /></Dialog.Close>

          <form onSubmit={enviar} className="cc-form">
            <div className="cc-ico"><Lock size={26} /></div>
            <Dialog.Title className="cc-title">{titulo}</Dialog.Title>
            <Dialog.Description id="cc-desc" className="cc-desc">{mensaje}</Dialog.Description>

            <div className="cc-field" key={sacudir} data-error={error ? 'true' : undefined}>
              <input
                ref={campo} type={ver ? 'text' : 'password'} className="input-control" placeholder="Tu contraseña de administrador"
                autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} aria-label="Contraseña"
                aria-invalid={!!error} aria-describedby={error ? 'cc-err' : undefined}
              />
              <button type="button" className="cc-eye" onClick={() => setVer(v => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                {ver ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && <div id="cc-err" className="cc-error" role="alert"><AlertCircle size={15} /> {error}</div>}

            <div className="cc-actions">
              <button type="submit" className="btn-primary" disabled={cargando || !clave}>
                {cargando ? <Loader2 className="spinner" size={18} /> : <ShieldCheck size={18} />} Confirmar
              </button>
              <button type="button" className="btn-secondary" onClick={onCancelar} disabled={cargando}>Cancelar</button>
            </div>
            <small className="cc-foot">La confirmación dura 10 minutos y se cierra al salir de esta sección.</small>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Fondo de "perfil bloqueado" para la pantalla de Mi Perfil: solo siluetas, sin ningún dato real.
// Así la ventana flotante se ve sobre una página y no sobre un vacío.
export function PerfilBloqueado() {
  return (
    <div className="pb" aria-hidden="true">
      <div className="pb-card">
        <div className="pb-line w40" /><div className="pb-line w70 thin" />
        <div className="pb-label" /><div className="pb-input" />
        <div className="pb-label" /><div className="pb-input" />
        <div className="pb-label" /><div className="pb-input" />
        <div className="pb-btn" />
      </div>
      <div className="pb-card">
        <div className="pb-line w50" /><div className="pb-line w80 thin" /><div className="pb-line w60 thin" />
        <div className="pb-block" />
      </div>
    </div>
  );
}
