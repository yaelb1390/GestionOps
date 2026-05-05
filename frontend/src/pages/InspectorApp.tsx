import { useState, useEffect } from 'react';
import { ClipboardList, CheckCircle, Camera, AlertTriangle, ChevronRight, X, LogOut, Loader2, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchTickets, updateTicketStatus, type Ticket } from '../services/api';

export default function InspectorApp() {
  const [activeTab, setActiveTab] = useState('pendientes');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success'|'error'>('success');
  const [showToast, setShowToast] = useState(false);
  const navigate = useNavigate();
  const inspectorName = localStorage.getItem('inspectorName') || 'Inspector Demo';

  const displayToast = (msg: string, type: 'success'|'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  useEffect(() => {
    loadTickets();
  }, []);

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

          const success = await updateTicketStatus(selectedTicket.id, result, remarks, rootCause);
          setSubmitting(false);

          if (success) {
            displayToast('Inspección guardada', 'success'); 
            setSelectedTicket(null); 
            loadTickets(); // Recargar datos
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
            <label>Evidencia Fotográfica</label>
            <button type="button" className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
              <Camera size={18} /> Tomar Foto
            </button>
          </div>

          <div className="input-group">
            <label>Resultado Inspección</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <label style={{ flex: 1, padding: '0.75rem', border: '1px solid var(--secondary-color)', borderRadius: '8px', textAlign: 'center', color: 'var(--secondary-color)', cursor: 'pointer' }}>
                <input type="radio" name="resultado" value="Aprobado" hidden /> Aprobado
              </label>
              <label style={{ flex: 1, padding: '0.75rem', border: '1px solid var(--warning-color)', borderRadius: '8px', textAlign: 'center', color: 'var(--warning-color)', cursor: 'pointer' }}>
                <input type="radio" name="resultado" value="Requiere corrección" hidden /> Requiere Corrección
              </label>
              <label style={{ flex: 1, padding: '0.75rem', border: '1px solid var(--danger-color)', borderRadius: '8px', textAlign: 'center', color: 'var(--danger-color)', cursor: 'pointer' }}>
                <input type="radio" name="resultado" value="Rechazado" hidden /> Rechazado
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingTop: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><User size={24} color="var(--primary-color)" /> Inspector</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{inspectorName}</p>
        </div>
        <button onClick={() => navigate('/login')} style={{ background: 'transparent', color: 'var(--danger-color)' }}>
          <LogOut size={24} />
        </button>
      </div>

      <h3 style={{ color: 'var(--text-main)', marginBottom: '1rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ClipboardList size={20} color="var(--primary-color)" /> Tickets Asignados</h3>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'var(--primary-color)' }}>
          <Loader2 className="spinner" size={32} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
        {tickets.length === 0 && <p style={{textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem'}}>No hay tickets</p>}
      </div>
      )}

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button className={`bottom-nav-item ${activeTab === 'pendientes' ? 'active' : ''}`} onClick={() => setActiveTab('pendientes')}>
          <AlertTriangle size={24} />
          <span>Pendientes</span>
        </button>
        <button className={`bottom-nav-item ${activeTab === 'completadas' ? 'active' : ''}`} onClick={() => setActiveTab('completadas')}>
          <CheckCircle size={24} />
          <span>Completadas</span>
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
