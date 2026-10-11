import { useCallback, useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, Copy, Download, Printer, AlertTriangle, Check, Loader2, RefreshCw, Mail, Send } from 'lucide-react';
import { generateRecoveryCodes, getRecoveryStatus, enviarCorreoPrueba, type RecoveryStatus } from '../services/api';
import './RecoveryCodes.css';

interface Props {
  usuario: string;
  notify: (msg: string, type?: 'success' | 'error') => void;
}

// Códigos de recuperación del administrador (Mi Perfil). Se muestran UNA sola vez al generarlos.
export default function RecoveryCodes({ usuario, notify }: Props) {
  const [status, setStatus] = useState<RecoveryStatus | null | undefined>(undefined); // undefined = cargando
  const [codes, setCodes] = useState<string[] | null>(null);
  const [working, setWorking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState(false);
  const [probando, setProbando] = useState(false);

  const load = useCallback(async () => setStatus(await getRecoveryStatus()), []);
  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setWorking(true);
    try {
      const list = await generateRecoveryCodes();
      setCodes(list); setSaved(false); setConfirming(false);
      await load();
      notify('Códigos generados. Guárdalos ahora: no se volverán a mostrar.', 'success');
    } catch (e: any) {
      notify(e?.message || 'No se pudieron generar los códigos', 'error');
    }
    setWorking(false);
  };

  const probarCorreo = async () => {
    setProbando(true);
    try {
      const destino = await enviarCorreoPrueba();
      notify(`Correo de prueba enviado a ${destino}. Revisa tu bandeja (y spam).`, 'success');
    } catch (e: any) {
      notify(e?.message || 'No se pudo enviar el correo de prueba', 'error');
    }
    setProbando(false);
  };

  const texto = () =>
    `CÓDIGOS DE RECUPERACIÓN · Gestores OPS\nUsuario: ${usuario}\nGenerados: ${new Date().toLocaleString('es-DO')}\n\n` +
    (codes ?? []).map((c, i) => `${String(i + 1).padStart(2, '0')}.  ${c}`).join('\n') +
    '\n\nCada código sirve UNA sola vez. Guárdalos en un lugar seguro y no los compartas.\n' +
    'Para usarlos: en la pantalla de inicio de sesión → "¿Olvidaste tu contraseña?".\n';

  const copy = async () => {
    try { await navigator.clipboard.writeText(texto()); notify('Códigos copiados al portapapeles', 'success'); }
    catch { notify('No se pudo copiar. Usa Descargar.', 'error'); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([texto()], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `codigos-recuperacion-${usuario.replace(/\W+/g, '_')}.txt`; a.click();
    URL.revokeObjectURL(url);
  };
  const print = () => {
    const w = window.open('', '_blank', 'width=640,height=700');
    if (!w) { notify('El navegador bloqueó la ventana de impresión', 'error'); return; }
    w.document.write(`<pre style="font:16px/1.7 ui-monospace,Consolas,monospace;padding:24px">${texto().replace(/</g, '&lt;')}</pre>`);
    w.document.close(); w.focus(); w.print();
  };

  const unused = status?.unused ?? 0;
  const none = !status || status.total === 0;

  return (
    <div className="rc">
      <div className="rc-head">
        <div className="rc-ico"><KeyRound size={22} /></div>
        <div className="rc-title">
          <h3>Códigos de recuperación</h3>
          <p>Si algún día olvidas tu contraseña de administrador, estos códigos te permiten crear una nueva desde la pantalla de inicio de sesión.</p>
        </div>
      </div>

      <div className="rc-mail">
        <div className="rc-mail-ico"><Mail size={18} /></div>
        <div className="rc-mail-txt">
          <b>Código por correo</b>
          <span>Si olvidas tu contraseña, te enviamos un código de 6 dígitos al <b>correo de recuperación</b> de arriba. Comprueba ahora que te llegue.</span>
        </div>
        <button className="btn-secondary" onClick={probarCorreo} disabled={probando}>
          {probando ? <Loader2 className="spinner" size={16} /> : <Send size={16} />} Enviar correo de prueba
        </button>
      </div>

      {status === undefined ? (
        <div className="rc-loading"><Loader2 className="spinner" size={20} /></div>
      ) : (
        <>
          <div className={`rc-state ${none ? 'warn' : unused <= 2 ? 'low' : 'ok'}`}>
            {none ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
            <div>
              {none && <><b>Aún no tienes códigos.</b> Genéralos ahora: si olvidas tu contraseña sin ellos, solo se recupera con acceso al servidor.</>}
              {!none && <><b>{unused} de {status!.total} códigos sin usar.</b>{unused <= 2 && ' Quedan pocos: genera un lote nuevo.'}
                {status!.generated_at && <span> · Generados el {new Date(status!.generated_at).toLocaleDateString('es-DO')}</span>}</>}
            </div>
          </div>

          {!codes && !confirming && (
            <button className="btn-primary rc-btn" onClick={() => (none ? generate() : setConfirming(true))} disabled={working}>
              {working ? <Loader2 className="spinner" size={18} /> : <RefreshCw size={18} />} {none ? 'Generar códigos' : 'Generar códigos nuevos'}
            </button>
          )}

          {confirming && (
            <div className="rc-confirm">
              <AlertTriangle size={18} />
              <div>
                <b>Los códigos anteriores dejarán de funcionar.</b>
                <span>Se creará un lote nuevo de 8 y el actual se anula, incluidos los que no hayas usado.</span>
                <div className="rc-actions">
                  <button className="btn-primary" onClick={generate} disabled={working}>
                    {working ? <Loader2 className="spinner" size={16} /> : null} Sí, generar nuevos
                  </button>
                  <button className="btn-secondary" onClick={() => setConfirming(false)} disabled={working}>Cancelar</button>
                </div>
              </div>
            </div>
          )}

          {codes && (
            <div className="rc-codes-card" role="region" aria-label="Códigos de recuperación nuevos">
              <div className="rc-warn"><AlertTriangle size={16} /> Se muestran <b>una sola vez</b>. Guárdalos antes de cerrar esta pantalla.</div>
              <ol className="rc-grid">
                {codes.map((c, i) => <li key={c}><span>{String(i + 1).padStart(2, '0')}</span><code>{c}</code></li>)}
              </ol>
              <div className="rc-actions">
                <button className="btn-secondary" onClick={copy}><Copy size={16} /> Copiar</button>
                <button className="btn-secondary" onClick={download}><Download size={16} /> Descargar .txt</button>
                <button className="btn-secondary" onClick={print}><Printer size={16} /> Imprimir</button>
              </div>
              <label className="rc-check">
                <input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} />
                <span>Ya guardé mis códigos en un lugar seguro</span>
              </label>
              <button className="btn-primary rc-btn" disabled={!saved} onClick={() => setCodes(null)}>
                <Check size={18} /> Listo, ocultar códigos
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
