'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Activity, AlertTriangle } from 'lucide-react';

// Credenciales de Admin hardcoded
const ADMIN_CREDENTIALS = { usuario: 'admin', password: 'admin123' };

export default function Login() {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      // Verificar credenciales de Admin
      if (usuario === ADMIN_CREDENTIALS.usuario && password === ADMIN_CREDENTIALS.password) {
        localStorage.setItem('claro_session', JSON.stringify({ role: 'admin', nombre: 'Administrador' }));
        router.push('/admin');
        return;
      }

      // Verificar inspectores guardados en localStorage
      const storedUsers = localStorage.getItem('claro_inspectors');
      if (storedUsers) {
        const inspectors: { usuario: string; password: string; nombre: string; apellido: string; activo: boolean }[] = JSON.parse(storedUsers);
        const found = inspectors.find(u => u.usuario === usuario && u.password === password && u.activo);
        if (found) {
          localStorage.setItem('claro_session', JSON.stringify({
            role: 'inspector',
            nombre: `${found.nombre} ${found.apellido}`,
            usuario: found.usuario
          }));
          router.push('/inspector');
          return;
        }
      }

      setError('Usuario o contraseña incorrectos. Verifica tus credenciales.');
      setLoading(false);
    }, 600);
  };

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: '#f8f9fa',
      backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(218, 41, 28, 0.04) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(218, 41, 28, 0.08) 0%, transparent 50%), linear-gradient(135deg, #ffffff 0%, #f4f6f9 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Barra roja corporativa superior */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'var(--primary-color)' }}></div>

      <div className="glass-panel" style={{ 
        width: '100%', 
        maxWidth: '420px', 
        padding: '2.5rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0,0,0,0.02)'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/claro-logo.png" alt="Claro Logo" style={{ height: '60px', width: 'auto', objectFit: 'contain' }} />
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '2rem', fontWeight: 500 }}>
          Gestion de averia repetidas.
        </p>

        {/* Tip de acceso rápido */}
        <div style={{ 
          background: 'rgba(218,41,28,0.05)', border: '1px solid rgba(218,41,28,0.12)', 
          borderRadius: '10px', padding: '0.65rem 1rem', marginBottom: '1.5rem',
          display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem'
        }}>
          <div>
            <span style={{ display: 'flex', gap: '1rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>
                <ShieldCheck size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle', color: 'var(--primary-color)' }}/>
                Admin: <strong>admin</strong> / <strong>admin123</strong>
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                <Activity size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle', color: 'var(--secondary-color)' }}/>
                Inspector: credenciales creadas por el admin
              </span>
            </span>
          </div>
        </div>

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label>Usuario</label>
            <input 
              type="text" 
              className="input-control" 
              placeholder="Ej: admin o joel.berroa" 
              value={usuario}
              onChange={e => { setUsuario(e.target.value); setError(''); }}
              required 
              autoComplete="username"
            />
          </div>
          <div className="input-group">
            <label>Contraseña</label>
            <input 
              type="password" 
              className="input-control" 
              placeholder="••••••••" 
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              required 
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={{ 
              background: 'rgba(218,41,28,0.08)', border: '1px solid rgba(218,41,28,0.25)', 
              borderRadius: '10px', padding: '0.65rem 1rem', marginBottom: '0.75rem',
              color: 'var(--primary-color)', fontSize: '0.85rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}>
              <AlertTriangle size={15} /> {error}
            </div>
          )}

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ 
              width: '100%', justifyContent: 'center', 
              marginTop: '1rem', padding: '1rem', fontSize: '1rem',
              opacity: loading ? 0.7 : 1
            }}
            disabled={loading}
          >
            {loading ? 'Verificando...' : 'Ingresar al Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}
