import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ShieldCheck, Loader2 } from 'lucide-react';
import { fetchInspectors, SCRIPT_URL } from '../services/api';

export default function Login() {
  const [role, setRole] = useState<'admin' | 'inspector'>('admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (role === 'admin') {
      try {
        // 1. Verificar contra el Súper Admin (Config)
        const config = await (await fetch(`${SCRIPT_URL}?type=config`)).json();
        
        if (username === config.admin_username && password === config.admin_password) {
          localStorage.setItem('userRole', 'admin');
          navigate('/admin');
          setLoading(false);
          return;
        }

        // 2. Si no es el súper admin, buscar en la lista de Personal con rol 'Admin'
        const inspectors = await fetchInspectors();
        const adminUser = inspectors.find(i => 
          String(i.usuario).toLowerCase() === String(username).toLowerCase() && 
          String(i.password) === String(password) && 
          i.rol === 'Admin'
        );

        if (adminUser) {
          localStorage.setItem('userRole', 'admin');
          localStorage.setItem('inspectorName', adminUser.nombre);
          navigate('/admin');
        } else {
          setError('Usuario o contraseña de administrador incorrectos');
        }
      } catch (err) {
        setError('Error al validar credenciales');
      }
      setLoading(false);
    } else {
      try {
        const inspectors = await fetchInspectors();
        const inspector = inspectors.find(i => 
          String(i.usuario).toLowerCase() === String(username).toLowerCase() && 
          String(i.password) === String(password) && 
          i.estado === 'Activo'
        );
        
        if (inspector) {
          localStorage.setItem('userRole', 'inspector');
          localStorage.setItem('inspectorName', inspector.nombre); // Para filtrar tickets
          localStorage.setItem('inspectorId', String(inspector.id));
          localStorage.setItem('username', String(inspector.usuario));
          navigate('/inspector');
        } else {
          setError('Credenciales incorrectas o gestor inactivo');
        }
      } catch (err) {
        setError('Error de conexión con el servidor');
      }
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, #ffffff 0%, #e2e8f0 100%)', position: 'relative' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem', background: '#FFFFFF', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.08)', color: '#1e293b' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
          <img src="/logo-gestores.png" alt="Gestores OPS Logo" style={{ width: '100%', maxWidth: '240px', height: 'auto', objectFit: 'contain', transform: 'scale(1.2)', filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.12))' }} />
        </div>
        <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '2.5rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '1px' }}>GESTIÓN OPS DE CAMPO</p>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <button 
            type="button" 
            onClick={() => setRole('admin')}
            style={{ 
              flex: 1, 
              padding: '0.75rem', 
              borderRadius: '12px',
              border: `2px solid ${role === 'admin' ? 'var(--primary-color)' : '#E2E8F0'}`,
              background: role === 'admin' ? 'rgba(218, 41, 28, 0.05)' : 'transparent',
              color: role === 'admin' ? 'var(--primary-color)' : '#64748b',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
              transition: 'all 0.2s', fontWeight: 600
            }}
          >
            <ShieldCheck size={24} />
            <span>Admin</span>
          </button>
          <button 
            type="button" 
            onClick={() => setRole('inspector')}
            style={{ 
              flex: 1, 
              padding: '0.75rem', 
              borderRadius: '12px',
              border: `2px solid ${role === 'inspector' ? 'var(--primary-color)' : '#E2E8F0'}`,
              background: role === 'inspector' ? 'rgba(218, 41, 28, 0.05)' : 'transparent',
              color: role === 'inspector' ? 'var(--primary-color)' : '#64748b',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
              transition: 'all 0.2s', fontWeight: 600
            }}
          >
            <Activity size={24} />
            <span>Gestor</span>
          </button>
        </div>

        {error && <div style={{ color: 'var(--danger-color)', marginBottom: '1rem', textAlign: 'center', fontWeight: 500, fontSize: '0.9rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '8px' }}>{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label style={{ color: '#475569' }}>Usuario</label>
            <input type="text" className="input-control" placeholder="Ingrese su usuario" value={username} onChange={(e) => setUsername(e.target.value)} required style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#0F172A' }} />
          </div>
          <div className="input-group">
            <label style={{ color: '#475569' }}>Contraseña</label>
            <input type="password" className="input-control" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#0F172A' }} />
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem', padding: '1rem', fontSize: '1rem' }} disabled={loading}>
            {loading ? <Loader2 className="spinner" size={20} /> : 'Ingresar al Sistema'}
          </button>
          
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <button 
              type="button" 
              onClick={async () => {
                try {
                  const res = await fetch(`${SCRIPT_URL}?type=config`);
                  const config = await res.json();
                  alert(`Si olvidaste tu contraseña, contacta al administrador en: ${config.admin_recovery_email || 'No configurado'}`);
                } catch (e) {
                  alert('Error al obtener información de recuperación');
                }
              }}
              style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </form>
      </div>
      <p style={{ position: 'absolute', bottom: '1.2rem', width: '100%', textAlign: 'center', fontSize: '0.78rem', color: '#94a3b8', letterSpacing: '0.3px' }}>
        Diseñado por{' '}
        <span style={{ color: 'var(--primary-color)', fontWeight: 700, letterSpacing: '0.5px', fontStyle: 'italic' }}>
          Joel Berroa
        </span>
      </p>
    </div>
  );
}
