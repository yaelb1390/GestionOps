import { useState, useEffect } from 'react';
import { ClipboardList, CheckCircle, Camera, AlertTriangle, ChevronRight, X, LogOut, Loader2, Sun, Moon, RotateCcw, User, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchTickets, updateTicketStatus, type Ticket, fetchCalidad } from '../services/api';

export default function InspectorApp() {
  const [activeTab, setActiveTab] = useState('pendientes');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success'|'error'>('success');
  const [showToast, setShowToast] = useState(false);
  const [calidadAssignments, setCalidadAssignments] = useState<any[]>([]);
  const [loadingCalidad, setLoadingCalidad] = useState(false);
  const navigate = useNavigate();
  const inspectorName = localStorage.getItem('inspectorName') || '';
  const [selectedResult, setSelectedResult] = useState('');
  const [images, setImages] = useState<string[]>([]);
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
  }, []);

  const loadCalidadAssignments = async () => {
    setLoadingCalidad(true);
    const data = await fetchCalidad();
    setCalidadAssignments(data);
    setLoadingCalidad(false);
  };

  const loadTickets = async () => {
    setLoading(true);
    const data = await fetchTickets();
    setTickets(data);
    setLoading(false);
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

  return (
    <div className="mobile-view">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ color: 'var(--text-main)', fontSize: '1.5rem', fontWeight: 700 }}>Hola, {inspectorName.split(' ')[0]}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Gestiona tus inspecciones diarias</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              onClick={toggleTheme}
              style={{ padding: '0.5rem', borderRadius: '12px', background: 'var(--surface-color)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <button 
              onClick={handleLogout}
              style={{ padding: '0.5rem', borderRadius: '12px', background: 'rgba(218, 41, 28, 0.1)', border: '1px solid rgba(218, 41, 28, 0.2)', color: 'var(--primary-color)' }}
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

      <h3 style={{ color: 'var(--text-main)', marginBottom: '1rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {activeTab === 'repetidas' ? (
          <><RotateCcw size={20} color="var(--primary-color)" /> Tecnico averia repetida</>
        ) : (
          <><ClipboardList size={20} color="var(--primary-color)" /> Tickets Asignados</>
        )}
      </h3>

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
                  const percVal = c['% Repetidas'] || c['Porcentaje'] || '0%';
                  const numVal = parseFloat(String(percVal).replace('%', ''));
                  const cardColor = numVal < 7 ? '#10b981' : numVal < 15 ? '#f59e0b' : '#ef4444';
                  const badgeClass = numVal < 7 ? 'success' : numVal < 15 ? 'warning' : 'danger';

                  return (
                    <div key={idx} className="mobile-card" style={{ borderLeft: `4px solid ${cardColor}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Users size={18} color="var(--primary-color)" />
                          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{c['Nombre'] || c['Nombre del Técnico'] || c['Técnico']}</span>
                        </div>
                        <span className={`badge ${badgeClass}`}>Repetidas</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>% Repetidas</label>
                          <span style={{ fontWeight: 'bold', color: cardColor, fontSize: '1.1rem' }}>{percVal}</span>
                        </div>
                        <div>
                          <label style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Supervisor</label>
                          <span style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>{c['Supervisor'] || c['Nombre del Supervisor'] || '-'}</span>
                        </div>
                      </div>
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertTriangle size={14} color="var(--warning-color)" />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Seguimiento requerido por alto índice de fallas.</span>
                      </div>
                    </div>
                  );
                })}
              {calidadAssignments.filter(c => c['Inspector'] === inspectorName || c['Inspector ID'] == inspectorName).length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>No tienes técnicos asignados para seguimiento.</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button className={`bottom-nav-item ${activeTab === 'pendientes' ? 'active' : ''}`} onClick={() => setActiveTab('pendientes')}>
          <AlertTriangle size={24} />
          <span>Pendientes</span>
        </button>
        <button className={`bottom-nav-item ${activeTab === 'repetidas' ? 'active' : ''}`} onClick={() => setActiveTab('repetidas')}>
          <RotateCcw size={24} />
          <span>Repetidas</span>
        </button>
        <button className={`bottom-nav-item ${activeTab === 'mis_tickets' ? 'active' : ''}`} onClick={() => setActiveTab('mis_tickets')}>
          <ClipboardList size={24} />
          <span>Mis Tickets</span>
        </button>
      </nav>

      {/* Toast Notification */}
      {showToast && (
        <div className={`toast-notification ${toastType}`}>
          {toastType === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
