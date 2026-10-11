import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, ArrowLeft, Eye, EyeOff, CheckCircle2, KeyRound, Mail } from 'lucide-react';
import { login, getRecoveryEmail, recoverPassword, enviarCodigoCorreo } from '../services/api';
import './Login.css';

// Rutas de la fibra óptica del fondo (decorativas). Los "pulse" son los destellos que las recorren.
const FIBRAS = [
  'M-50,640 C220,560 360,760 640,620 S1040,420 1500,520',
  'M-50,200 C260,300 420,80 760,200 S1180,380 1500,260',
  'M-50,820 C300,700 560,900 900,760 S1260,640 1500,720',
  'M-50,90 C200,40 440,180 700,100 S1140,20 1500,120',
];

type Modo = 'login' | 'recuperar' | 'listo';

// Dos tipos de código: el de 6 dígitos que llega al correo, o el de respaldo XXXX-XXXX-XXXX.
// Se escriben en mayúsculas y los guiones del de respaldo se ponen solos.
const formatearCodigo = (v: string) => {
  const limpio = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (limpio.length <= 6 && /^[0-9]*$/.test(limpio)) return limpio;   // 123456
  return limpio.replace(/(.{4})(?=.)/g, '$1-');                      // XXXX-XXXX-XXXX
};

export default function Login() {
  const [modo, setModo] = useState<Modo>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Recuperación
  const [codigo, setCodigo] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [restantes, setRestantes] = useState<number | null>(null);
  const [contacto, setContacto] = useState('');
  const [enviado, setEnviado] = useState(false);   // ya se pidió el código por correo
  const [espera, setEspera] = useState(0);          // segundos para poder pedir otro
  const [enviando, setEnviando] = useState(false);
  const navigate = useNavigate();

  // Correo del administrador (para los gestores que olvidaron su clave)
  useEffect(() => { if (modo === 'recuperar') getRecoveryEmail().then(setContacto).catch(() => {}); }, [modo]);

  // Cuenta regresiva para volver a pedir el código (el servidor también limita: 60 s entre solicitudes)
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera(e => e - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const irA = (m: Modo) => { setModo(m); setError(''); if (m !== 'recuperar') { setEnviado(false); setEspera(0); } };

  const pedirCodigo = async () => {
    setError('');
    if (!username.trim()) return setError('Escribe primero tu usuario administrador');
    setEnviando(true);
    try {
      await enviarCodigoCorreo(username.trim());
      setEnviado(true);
      setEspera(60);
    } catch (err: any) {
      setError(err?.message || 'No se pudo enviar el código');
    }
    setEnviando(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Un solo acceso para todos: el servidor valida (bcrypt, estado activo, bloqueo por intentos)
      // y decide por el rol del usuario a dónde va: Admin -> panel; Inspector/QAOR -> app del gestor.
      const user = await login(username.trim(), password);
      localStorage.setItem('inspectorName', user.nombre);
      localStorage.setItem('username', user.usuario);
      if (user.rol === 'Admin') {
        localStorage.setItem('userRole', 'admin');
        navigate('/admin');
      } else {
        localStorage.setItem('userRole', 'inspector');
        localStorage.setItem('inspectorId', user.id); // uuid: coincide con inspector_id de las filas
        localStorage.setItem('username', user.usuario);
        localStorage.setItem('inspectorRole', user.rol || 'Inspector'); // menú QAOR / gestor
        navigate('/inspector');
      }
    } catch (err: any) {
      setError(err?.message || 'Error de conexión con el servidor');
    }
    setLoading(false);
  };

  const handleRecuperar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const largo = codigo.replace(/-/g, '').length;
    if (largo !== 6 && largo !== 12) return setError('Escribe el código completo: 6 dígitos (del correo) o 12 caracteres (de respaldo)');
    if (nueva.length < 8) return setError('La nueva contraseña debe tener al menos 8 caracteres');
    if (nueva !== confirmar) return setError('Las contraseñas no coinciden');
    setLoading(true);
    try {
      const r = await recoverPassword(username.trim(), codigo, nueva);
      setRestantes(r.restantes);
      setPassword(''); setCodigo(''); setNueva(''); setConfirmar('');
      setModo('listo');
    } catch (err: any) {
      setError(err?.message || 'No se pudo restablecer la contraseña');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-glow" aria-hidden />
      <svg className="login-fiber" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id="fiber-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#da291c" stopOpacity="0" />
            <stop offset="0.6" stopColor="#ff5a4d" stopOpacity="0.95" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        {FIBRAS.map(d => <path key={'b' + d} d={d} />)}
        {FIBRAS.map(d => <path key={'p' + d} d={d} className="pulse" />)}
      </svg>
      <div className="login-grain" aria-hidden />

      <main className="login-card">
        <div className="login-logo">
          <img src="/logo-gestores.png" alt="Gestores OPS" />
        </div>
        <p className="login-brand">GESTIÓN OPS DE CAMPO</p>

        {error && (
          <div className="login-error" role="alert">
            <AlertCircle size={16} /> <span>{error}</span>
          </div>
        )}

        {/* ── Inicio de sesión ── */}
        {modo === 'login' && (
          <>
            <div className="login-title">
              <h1>Bienvenido</h1>
              <p>Ingresa con tu usuario y contraseña</p>
            </div>
            <form onSubmit={handleLogin}>
              <div className="input-group">
                <label htmlFor="login-user">Usuario</label>
                <input id="login-user" type="text" className="input-control" placeholder="Ingrese su usuario" autoComplete="username"
                  autoFocus value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div className="input-group">
                <label htmlFor="login-pass">Contraseña</label>
                <input id="login-pass" type="password" className="input-control" placeholder="••••••••" autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <button type="submit" className="btn-primary login-submit" disabled={loading}>
                {loading ? <Loader2 className="spinner" size={20} /> : 'Ingresar al Sistema'}
              </button>
              <div className="login-forgot">
                <button type="button" onClick={() => irA('recuperar')}>¿Olvidaste tu contraseña?</button>
              </div>
            </form>
          </>
        )}

        {/* ── Recuperar contraseña de administrador ── */}
        {modo === 'recuperar' && (
          <>
            <div className="login-title">
              <h1>Recuperar contraseña</h1>
              <p>Para administradores. Te enviamos un código al correo registrado en Mi Perfil, o usa uno de respaldo.</p>
            </div>
            <form onSubmit={handleRecuperar}>
              <div className="input-group">
                <label htmlFor="rec-user">Usuario administrador</label>
                <input id="rec-user" type="text" className="input-control" placeholder="Ingrese su usuario" autoComplete="username"
                  autoFocus value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <button type="button" className="login-mail-btn" onClick={pedirCodigo} disabled={enviando || espera > 0}>
                {enviando ? <Loader2 className="spinner" size={16} /> : <Mail size={16} />}
                {espera > 0 ? `Reenviar código en ${espera} s` : enviado ? 'Reenviar código al correo' : 'Enviarme un código al correo'}
              </button>
              {enviado && (
                <p className="login-sent" role="status">
                  Si el usuario es administrador y tiene un correo registrado, te enviamos un <b>código de 6 dígitos</b>. Revisa tu bandeja
                  de entrada y la carpeta de <b>spam</b>. Vale 15 minutos.
                </p>
              )}
              <div className="input-group">
                <label htmlFor="rec-code">Código recibido <small>(6 dígitos del correo, o 12 caracteres de respaldo)</small></label>
                <input id="rec-code" type="text" className="input-control login-code" placeholder="123456  ·  XXXX-XXXX-XXXX" autoComplete="one-time-code" spellCheck={false}
                  inputMode="text" value={codigo} onChange={(e) => setCodigo(formatearCodigo(e.target.value))} required />
              </div>
              <div className="input-group">
                <label htmlFor="rec-new">Nueva contraseña</label>
                <div className="login-pw">
                  <input id="rec-new" type={verClave ? 'text' : 'password'} className="input-control" placeholder="Mínimo 8 caracteres" autoComplete="new-password"
                    value={nueva} onChange={(e) => setNueva(e.target.value)} required />
                  <button type="button" className="login-eye" onClick={() => setVerClave(v => !v)} aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                    {verClave ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="input-group">
                <label htmlFor="rec-confirm">Confirmar contraseña</label>
                <input id="rec-confirm" type={verClave ? 'text' : 'password'} className="input-control" placeholder="Repite la contraseña" autoComplete="new-password"
                  value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required />
              </div>
              <button type="submit" className="btn-primary login-submit" disabled={loading}>
                {loading ? <Loader2 className="spinner" size={20} /> : <><KeyRound size={18} /> Restablecer contraseña</>}
              </button>
              <div className="login-forgot">
                <button type="button" onClick={() => irA('login')}><ArrowLeft size={14} /> Volver al inicio de sesión</button>
              </div>
            </form>
            <p className="login-help">
              <b>¿Eres gestor?</b> Pide a tu administrador que cambie tu contraseña en <i>Personal → editar</i>
              {contacto ? <> o escríbele a <b>{contacto}</b>.</> : '.'}
              <br />¿Sin correo ni códigos? Un técnico con acceso al servidor puede restablecerla (ver <i>herramientas/RECUPERAR_ADMIN.md</i>).
            </p>
          </>
        )}

        {/* ── Listo ── */}
        {modo === 'listo' && (
          <div className="login-done">
            <div className="login-done-ico"><CheckCircle2 size={44} /></div>
            <h1>Contraseña actualizada</h1>
            <p>Ya puedes iniciar sesión con tu nueva contraseña.</p>
            {restantes !== null && restantes <= 2 && (
              <p className="login-done-warn">Te quedan {restantes} código(s). Genera un lote nuevo desde <b>Mi Perfil</b>.</p>
            )}
            <button type="button" className="btn-primary login-submit" onClick={() => irA('login')}>Ir a iniciar sesión</button>
          </div>
        )}
      </main>

      <p className="login-foot">Diseñado por <b>Joel Berroa</b></p>
    </div>
  );
}
