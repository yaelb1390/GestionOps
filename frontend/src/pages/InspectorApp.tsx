import { useState, useEffect } from 'react';
import { LogOut, ClipboardList, CheckCircle2, Loader2, RotateCcw, ChevronRight, Camera, X, AlertTriangle, Sun, Moon, Package, LayoutGrid } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchTickets, updateTicketStatus, type Ticket, fetchCalidad, fetchOrdenes, type Orden } from '../services/api';

export default function InspectorApp() {
  const [activeTab, setActiveTab] = useState('menu');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success'|'error'>('success');
  const [showToast, setShowToast] = useState(false);
  const [calidadAssignments, setCalidadAssignments] = useState<any[]>([]);
  const navigate = useNavigate();
  const inspectorName = localStorage.getItem('inspectorName') || '';
  const [selectedResult, setSelectedResult] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [loadingOrdenes, setLoadingOrdenes] = useState(false);
  const [selectedOrden, setSelectedOrden] = useState<Orden | null>(null);
  const [ordenesSearch, setOrdenesSearch] = useState('');
  const [theme, setTheme] = useState(document.documentElement.getAttribute('data-theme') || 'light');

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const handleLogout = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('inspectorName');
    navigate('/login');
  };

  const displayToast = (msg: string, type: 'success'|'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImages(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    loadTickets();
    loadCalidadAssignments();
    loadOrdenes();
  }, []);

  const loadCalidadAssignments = async () => {
    const data = await fetchCalidad();
    setCalidadAssignments(data);
  };

  const loadTickets = async () => {
    setLoading(true);
    const data = await fetchTickets();
    setTickets(data);
    setLoading(false);
  };

  const loadOrdenes = async () => {
    setLoadingOrdenes(true);
    const data = await fetchOrdenes();
    setOrdenes(data);
    setLoadingOrdenes(false);
  };

  if (selectedTicket) {
    return (
      <div className="mobile-view">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ color: 'var(--text-main)', fontSize: '1.25rem' }}>Inspección {selectedTicket.ticket}</h2>
          <button onClick={() => setSelectedTicket(null)} style={{ background: 'transparent', color: 'var(--text-muted)' }}>
            <X size={24} />
          </button>
        </div>

        <div className="mobile-card">
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Técnico</label>
            <div style={{ color: 'var(--text-main)', fontWeight: 500 }}>{selectedTicket.tech_id || selectedTicket.tech}</div>
          </div>
          <div style={{ display: 'flex', gap: '2rem' }}>
            <div>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Sector</label>
              <div style={{ color: 'var(--text-main)' }}>{selectedTicket.sector}</div>
            </div>
            <div>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Prioridad</label>
              <div style={{ color: 'var(--danger-color)' }}>{selectedTicket.priority}</div>
            </div>
          </div>
        </div>

        <form style={{ marginTop: '1.5rem' }} onSubmit={async (e) => { 
          e.preventDefault(); 
          setSubmitting(true);
          const formData = new FormData(e.currentTarget);
          const rootCause = formData.get('causa') as string;
          const remarks = formData.get('observaciones') as string;
          const result = formData.get('resultado') as string;
          
          if(!result) { displayToast("Seleccione un resultado", "error"); setSubmitting(false); return; }

          const success = await updateTicketStatus(selectedTicket.id, result, remarks, rootCause, images);
          setSubmitting(false);

          if (success) {
            displayToast('Inspección guardada', 'success'); 
            setSelectedTicket(null); 
            setSelectedResult('');
            setImages([]); // Limpiar imágenes
            loadTickets(); 
          } else {
            displayToast('Error al guardar. Intenta nuevamente.', 'error');
          }
        }}>
          <div className="input-group">
            <label>Causa Raíz de Avería</label>
            <select name="causa" className="input-control" required>
              <option value="">Seleccione una causa...</option>
              <option value="Error técnico">Error técnico</option>
              <option value="Fibra cortada">Fibra cortada</option>
              <option value="Material defectuoso">Material defectuoso</option>
              <option value="Cliente interno">Cliente interno</option>
              <option value="Daño externo">Daño externo</option>
              <option value="Otra">Otra</option>
            </select>
          </div>

          <div className="input-group">
            <label>Observaciones</label>
            <textarea name="observaciones" className="input-control" rows={3} placeholder="Detalles de la visita..."></textarea>
          </div>

          <div className="input-group">
            <label>Evidencia Fotográfica ({images.length})</label>
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
              {images.map((img, idx) => (
                <div key={idx} style={{ position: 'relative', flexShrink: 0 }}>
                  <img src={img} alt={`Evidencia ${idx}`} style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover', border: '2px solid var(--border-color)' }} />
                  <button 
                    type="button" 
                    onClick={() => removeImage(idx)}
                    style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'var(--danger-color)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <label style={{ 
                width: '80px', height: '80px', borderRadius: '12px', border: '2px dashed var(--border-color)', 
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0
              }}>
                <Camera size={24} />
                <span style={{ fontSize: '10px', marginTop: '4px' }}>Agregar</span>
                <input type="file" accept="image/*" capture="environment" multiple hidden onChange={handleImageChange} />
              </label>
            </div>
          </div>

          <div className="input-group">
            <label>Resultado Inspección</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <label style={{ 
                flex: 1, padding: '0.75rem', 
                border: '1px solid var(--secondary-color)', 
                borderRadius: '8px', textAlign: 'center', 
                color: selectedResult === 'Aprobado' ? 'white' : 'var(--secondary-color)', 
                background: selectedResult === 'Aprobado' ? 'var(--secondary-color)' : 'transparent',
                cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600
              }}>
                <input type="radio" name="resultado" value="Aprobado" hidden onChange={(e) => setSelectedResult(e.target.value)} /> Aprobado
              </label>
              <label style={{ 
                flex: 1, padding: '0.75rem', 
                border: '1px solid var(--warning-color)', 
                borderRadius: '8px', textAlign: 'center', 
                color: selectedResult === 'Requiere corrección' ? 'white' : 'var(--warning-color)', 
                background: selectedResult === 'Requiere corrección' ? 'var(--warning-color)' : 'transparent',
                cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600
              }}>
                <input type="radio" name="resultado" value="Requiere corrección" hidden onChange={(e) => setSelectedResult(e.target.value)} /> Requiere Corrección
              </label>
              <label style={{ 
                flex: 1, padding: '0.75rem', 
                border: '1px solid var(--danger-color)', 
                borderRadius: '8px', textAlign: 'center', 
                color: selectedResult === 'Rechazado' ? 'white' : 'var(--danger-color)', 
                background: selectedResult === 'Rechazado' ? 'var(--danger-color)' : 'transparent',
                cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600
              }}>
                <input type="radio" name="resultado" value="Rechazado" hidden onChange={(e) => setSelectedResult(e.target.value)} /> Rechazado
              </label>
            </div>
          </div>

          <button type="submit" disabled={submitting} className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem', padding: '1rem', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Guardando...' : 'Guardar Inspección'}
          </button>
        </form>
      </div>
    );
  }

  if (selectedOrden) {
    return (
      <div className="mobile-view">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ color: 'var(--text-main)', fontSize: '1.25rem' }}>Orden {selectedOrden['Orden Servicio']}</h2>
          <button onClick={() => setSelectedOrden(null)} style={{ background: 'transparent', color: 'var(--text-muted)' }}>
            <X size={24} />
          </button>
        </div>

        <div className="mobile-card" style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cliente</label>
            <div style={{ color: 'var(--text-main)', fontWeight: 700, fontSize: '1.1rem', marginTop: '0.25rem' }}>{selectedOrden.Cliente}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Sector</label>
              <div style={{ color: 'var(--text-main)', fontWeight: 500, marginTop: '0.25rem' }}>{selectedOrden.Sector || '-'}</div>
            </div>
            <div>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Fecha</label>
              <div style={{ color: 'var(--text-main)', fontWeight: 500, marginTop: '0.25rem' }}>{selectedOrden.Fecha || '-'}</div>
            </div>
            <div>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Supervisor</label>
              <div style={{ color: 'var(--text-main)', fontWeight: 500, marginTop: '0.25rem' }}>{selectedOrden.Supervisor || '-'}</div>
            </div>
            <div>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Terminal</label>
              <div style={{ color: 'var(--text-main)', fontWeight: 500, marginTop: '0.25rem' }}>{selectedOrden.Terminal || '-'}</div>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Trabajo</label>
              <div style={{ color: 'var(--text-main)', marginTop: '0.25rem' }}>{selectedOrden.Trabajo}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Asignado A</label>
                <div style={{ color: 'var(--primary-color)', fontWeight: 600 }}>{selectedOrden['Asignado A']}</div>
              </div>
              <span className={`badge ${selectedOrden['Tecnología']?.toLowerCase().includes('gpon') ? 'info' : selectedOrden['Tecnología']?.toLowerCase().includes('vsat') ? 'warning' : selectedOrden['Tecnología']?.toLowerCase().includes('hfc') ? 'success' : 'danger'}`}>{selectedOrden['Tecnología']}</span>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setSelectedOrden(null)} 
          className="btn-primary" 
          style={{ width: '100%', justifyContent: 'center', marginTop: '1.5rem', padding: '1rem' }}
        >
          Cerrar Detalle
        </button>
      </div>
    );
  }

  return (
    <div className="mobile-view">
        <header className="header-actions" style={{ marginBottom: '1.5rem', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="avatar-container" style={{ 
              width: '52px', 
              height: '52px', 
              borderRadius: '50%', 
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--glass-bg)',
              border: '2px solid var(--primary-color)',
              boxShadow: '0 8px 16px rgba(218, 41, 28, 0.2)',
              position: 'relative'
            }}>
              <img 
                src="/tech-avatar.png" 
                alt="Avatar" 
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.1)' }}
              />
            </div>
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '-2px' }}>Bienvenido</p>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>{inspectorName}</h2>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {/* Solo dejamos el avatar y nombre, quitamos botones de más del header */}
          </div>
        </header>


      <h3 style={{ color: 'var(--text-main)', marginBottom: '1rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {activeTab === 'repetidas' ? (
          <><RotateCcw size={20} color="var(--primary-color)" /> Tecnico averia repetida</>
        ) : activeTab === 'ordenes' ? (
          <><Package size={20} color="var(--primary-color)" /> Mis Órdenes</>
        ) : activeTab === 'menu' ? (
          <><LayoutGrid size={20} color="var(--primary-color)" /> Menú Principal</>
        ) : (
          <><ClipboardList size={20} color="var(--primary-color)" /> Tickets Asignados</>
        )}
      </h3>

      {activeTab === 'menu' && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
          gap: '1.25rem', 
          marginTop: '0.5rem',
          animation: 'fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <button 
            onClick={() => setActiveTab('pendientes')}
            className="mobile-card" 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '1rem', 
              padding: '1.75rem 1rem', 
              textAlign: 'center', 
              justifyContent: 'center',
              border: '1px solid var(--glass-border)',
              background: 'var(--glass-bg)',
              borderRadius: '24px',
              transition: 'all 0.3s ease'
            }}
          >
            <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(59, 130, 246, 0.2)' }}>
              <ClipboardList size={28} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>Tickets</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{tickets.filter(t => (t.status === 'Pendiente' || t.status === 'Asignado') && (t.inspector === inspectorName || t.inspector_id == inspectorName)).length} asignados</div>
            </div>
          </button>

          <button 
            onClick={() => setActiveTab('ordenes')}
            className="mobile-card" 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '1rem', 
              padding: '1.75rem 1rem', 
              textAlign: 'center', 
              justifyContent: 'center',
              border: '1px solid var(--glass-border)',
              background: 'var(--glass-bg)',
              borderRadius: '24px',
              transition: 'all 0.3s ease'
            }}
          >
            <div style={{ background: 'linear-gradient(135deg, var(--primary-color) 0%, #b91c1c 100%)', color: 'white', width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(218, 41, 28, 0.2)' }}>
              <Package size={28} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>Órdenes</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Gestión campo</div>
            </div>
          </button>

          <button 
            onClick={() => setActiveTab('repetidas')}
            className="mobile-card" 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '1rem', 
              padding: '1.75rem 1rem', 
              textAlign: 'center', 
              justifyContent: 'center',
              border: '1px solid var(--glass-border)',
              background: 'var(--glass-bg)',
              borderRadius: '24px',
              transition: 'all 0.3s ease'
            }}
          >
            <div style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: 'white', width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(245, 158, 11, 0.2)' }}>
              <RotateCcw size={28} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>Repetidas</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Seguimiento</div>
            </div>
          </button>

          <button 
            onClick={() => setActiveTab('mis_tickets')}
            className="mobile-card" 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '1rem', 
              padding: '1.75rem 1rem', 
              textAlign: 'center', 
              justifyContent: 'center',
              border: '1px solid var(--glass-border)',
              background: 'var(--glass-bg)',
              borderRadius: '24px',
              transition: 'all 0.3s ease'
            }}
          >
            <div style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(16, 185, 129, 0.2)' }}>
              <CheckCircle2 size={28} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>Historial</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Mis Tickets</div>
            </div>
          </button>

          <button 
            onClick={toggleTheme}
            className="mobile-card" 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '1rem', 
              padding: '1.75rem 1rem', 
              textAlign: 'center', 
              justifyContent: 'center',
              border: '1px solid var(--glass-border)',
              background: 'var(--glass-bg)',
              borderRadius: '24px',
              transition: 'all 0.3s ease'
            }}
          >
            <div style={{ background: 'linear-gradient(135deg, #64748b 0%, #334155 100%)', color: 'white', width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(100, 116, 139, 0.2)' }}>
              {theme === 'light' ? <Moon size={28} /> : <Sun size={28} />}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>Tema</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{theme === 'light' ? 'Oscuro' : 'Claro'}</div>
            </div>
          </button>

          <button 
            onClick={handleLogout}
            className="mobile-card" 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '1rem', 
              padding: '1.75rem 1rem', 
              textAlign: 'center', 
              justifyContent: 'center',
              border: '1px solid var(--glass-border)',
              background: 'var(--glass-bg)',
              borderRadius: '24px',
              transition: 'all 0.3s ease'
            }}
          >
            <div style={{ background: 'linear-gradient(135deg, #ef4444 0%, #991b1b 100%)', color: 'white', width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(239, 68, 68, 0.2)' }}>
              <LogOut size={28} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>Salir</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Cerrar sesión</div>
            </div>
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'var(--primary-color)' }}>
          <Loader2 className="spinner" size={32} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {(activeTab === 'pendientes' || activeTab === 'completadas' || activeTab === 'mis_tickets') && (
            <>
              {tickets.filter(t => {
                const isMine = t.inspector === inspectorName || t.inspector_id == inspectorName;
                if (activeTab === 'pendientes') return (t.status === 'Pendiente' || t.status === 'Asignado') && isMine;
                if (activeTab === 'completadas') return (t.status === 'Inspeccionado' || t.status === 'Aprobado' || t.status === 'Rechazado') && isMine;
                if (activeTab === 'mis_tickets') return isMine;
                return false;
              }).map(t => (
                <div key={t.id} className="mobile-card" style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer', padding: '1.25rem', gap: '0.75rem' }} onClick={() => setSelectedTicket(t)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ background: 'var(--primary-color)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                        TICKET
                      </div>
                      <div style={{ color: 'var(--text-main)', fontWeight: 800, fontSize: '1.15rem' }}>{t.ticket}</div>
                    </div>
                    <ChevronRight color="var(--text-muted)" size={20} />
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '0.25rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(218, 41, 28, 0.1)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                          {String(t.tech_id || t.tech || 'T').charAt(0).toUpperCase()}
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>{t.tech_id || t.tech}</span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                         <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--secondary-color)', display: 'inline-block' }}></span> {t.sector}
                      </div>
                    </div>
                    <div>
                      <span className={`badge ${t.priority === 'Alta' ? 'danger' : 'warning'}`}>{t.priority}</span>
                    </div>
                  </div>
                </div>
              ))}
              {tickets.filter(t => {
                const isMine = t.inspector === inspectorName || t.inspector_id == inspectorName;
                if (activeTab === 'pendientes') return (t.status === 'Pendiente' || t.status === 'Asignado') && isMine;
                if (activeTab === 'completadas') return (t.status === 'Inspeccionado' || t.status === 'Aprobado' || t.status === 'Rechazado') && isMine;
                if (activeTab === 'mis_tickets') return isMine;
                return false;
              }).length === 0 && <p style={{textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem'}}>No hay tickets en esta sección</p>}
            </>
          )}

          {activeTab === 'repetidas' && (
            <>
              {calidadAssignments
                .filter(c => {
                  const inspectorKey = Object.keys(c).find(k => k.toLowerCase().trim() === 'inspector') || 'Inspector';
                  const inspectorIdKey = Object.keys(c).find(k => k.toLowerCase().trim() === 'inspector id') || 'Inspector ID';
                  return c[inspectorKey] === inspectorName || c[inspectorIdKey] == inspectorName;
                })
                .map((c, idx) => {
                  // Helpers para leer campos con nombres flexibles
                  const getField = (keys: string[]) => {
                    for (const k of keys) {
                      const found = Object.keys(c).find(ck => ck.toLowerCase().trim() === k.toLowerCase());
                      if (found && c[found]) return String(c[found]);
                    }
                    return '-';
                  };

                   const tecnico   = getField(['tecnico', 'nombre del técnico', 'nombre', 'técnico']);
                   const techId    = getField(['tech_id', 'id técnico', 'id tecnico', 'tecnico id', 'tarjeta']);
                   const trabajo   = getField(['trabajo', 'ticket', 'tickets']);
                   const supervisor = getField(['supervisor', 'nombre del supervisor']);
                   const sector    = getField(['sector']);
                   const barrio    = getField(['barrio']);
                   const calle     = getField(['calle']);

                  return (
                    <div key={idx} className="mobile-card" style={{ marginBottom: '1rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

                      {/* — Nombre Técnico — */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
                        <div style={{ background: 'linear-gradient(135deg, var(--primary-color), #b91c1c)', color: 'white', width: '38px', height: '38px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.65rem', flexShrink: 0 }}>
                          {techId}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nombre Técnico</div>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>{tecnico}</div>
                        </div>
                      </div>

                      {/* — Tickets / Trabajo — (mismo estilo que órdenes) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ background: 'var(--primary-color)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', flexShrink: 0 }}>TICKET</div>
                        <div style={{ color: 'var(--text-main)', fontWeight: 800, fontSize: '1.05rem' }}>{trabajo}</div>
                      </div>

                      {/* — Supervisor — */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Supervisor</div>
                          <div style={{ color: 'var(--text-main)', fontWeight: 500, fontSize: '0.9rem', marginTop: '0.15rem' }}>{supervisor}</div>
                        </div>
                        <span className="badge warning" style={{ fontSize: '0.7rem' }}>Avería Repetida</span>
                      </div>

                      {/* — Ubicación agrupada — */}
                      <div style={{ background: 'rgba(218,41,28,0.04)', border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sector</div>
                          <div style={{ color: 'var(--text-main)', fontSize: '0.82rem', fontWeight: 600, marginTop: '0.15rem' }}>{sector}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Barrio</div>
                          <div style={{ color: 'var(--text-main)', fontSize: '0.82rem', fontWeight: 600, marginTop: '0.15rem' }}>{barrio}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Calle</div>
                          <div style={{ color: 'var(--text-main)', fontSize: '0.82rem', fontWeight: 600, marginTop: '0.15rem' }}>{calle}</div>
                        </div>
                      </div>

                    </div>
                  );
                })}
              {calidadAssignments.filter(c => c['Inspector'] === inspectorName || c['Inspector ID'] == inspectorName).length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>No tienes técnicos asignados para seguimiento.</p>
              )}
            </>
          )}


          {activeTab === 'ordenes' && (
            <>
              {/* Buscador de órdenes */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: 'var(--glass-bg)',
                border: '1.5px solid var(--glass-border)',
                borderRadius: '14px',
                padding: '0.65rem 1rem',
                marginBottom: '1rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  placeholder="Buscar por N° orden, cliente..."
                  value={ordenesSearch}
                  onChange={(e) => setOrdenesSearch(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-main)',
                    fontSize: '0.95rem',
                    fontFamily: 'inherit'
                  }}
                />
                {ordenesSearch && (
                  <button
                    onClick={() => setOrdenesSearch('')}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {loadingOrdenes ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="spinner" /></div>
              ) : (
                <>
                  {(() => {
                    const term = ordenesSearch.toLowerCase().trim();
                    const filtered = ordenes.filter(o =>
                      !term ||
                      String(o['Orden Servicio'] || '').toLowerCase().includes(term) ||
                      String(o.Cliente || '').toLowerCase().includes(term) ||
                      String(o['Asignado A'] || '').toLowerCase().includes(term)
                    );
                    if (ordenes.length === 0) return (
                      <div className="mobile-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                        <Package size={48} color="var(--text-muted)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
                        <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Sin Órdenes</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No se encontraron órdenes de trabajo asignadas.</p>
                      </div>
                    );
                    if (filtered.length === 0) return (
                      <div className="mobile-card" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No se encontró ninguna orden con ese criterio.</p>
                      </div>
                    );
                    return filtered.map((o, idx) => (
                      <div
                        key={idx}
                        className="mobile-card"
                        style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem', gap: '0.75rem', cursor: 'pointer' }}
                        onClick={() => setSelectedOrden(o)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ background: 'var(--primary-color)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>ORDEN</div>
                            <div style={{ color: 'var(--text-main)', fontWeight: 800, fontSize: '1.1rem' }}>{o['Orden Servicio']}</div>
                          </div>
                          <ChevronRight color="var(--text-muted)" size={18} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <div style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '1rem' }}>{o.Cliente}</div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Asignado:</span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 500 }}>{o['Asignado A']}</span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{o.Fecha}</span>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button 
          className={`bottom-nav-item ${activeTab === 'menu' ? 'active' : ''}`} 
          onClick={() => setActiveTab('menu')}
          style={{ 
            background: activeTab === 'menu' ? 'var(--primary-color)' : 'transparent',
            color: activeTab === 'menu' ? 'white' : 'var(--primary-color)',
            borderRadius: '18px',
            padding: '0.6rem 2.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            boxShadow: activeTab === 'menu' ? '0 8px 20px rgba(218, 41, 28, 0.25)' : 'none',
            border: 'none',
            flex: 'none'
          }}
        >
          <LayoutGrid size={24} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.05em' }}>MENÚ</span>
        </button>
      </nav>

      {/* Toast Notification */}
      {showToast && (
        <div className={`toast-notification ${toastType}`}>
          {toastType === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
