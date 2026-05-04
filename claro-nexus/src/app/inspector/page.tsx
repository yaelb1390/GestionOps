'use client';
import { useState } from 'react';
import { ClipboardList, CheckCircle, Camera, AlertTriangle, ChevronRight, X, LogOut, UserCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

const mockTickets = [
  { id: 1, ticket: '53541154', tech_id: '601499', tech: 'Victor Manuel Martinez', supervisor: 'Jean Carlos Ramirez', sector: 'PUEBLO NUEVO', state: 'Activa', tech_type: 'ADSL2+,POTS', work_name: 'Reparacion Internet' },
  { id: 2, ticket: '53544683', tech_id: '601504', tech: 'Henry Perez', supervisor: 'Jean Carlos Ramirez', sector: 'LOS PERALEJOS', state: 'Activa', tech_type: 'GPON', work_name: 'Reparacion Internet' },
];

export default function InspectorApp() {
  const [activeTab, setActiveTab] = useState('pendientes');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const router = useRouter();

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
            <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Tipo de Trabajo</label>
            <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>{selectedTicket.work_name}</div>
          </div>
          <div style={{ display: 'flex', gap: '2rem' }}>
            <div>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Sector</label>
              <div style={{ color: 'var(--text-main)' }}>{selectedTicket.sector}</div>
            </div>
            <div>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Tecnología</label>
              <div style={{ color: 'var(--text-main)' }}>{selectedTicket.tech_type}</div>
            </div>
          </div>
        </div>

        <form style={{ marginTop: '1.5rem' }} onSubmit={(e) => { e.preventDefault(); alert('Inspección guardada'); setSelectedTicket(null); }}>
          <div className="input-group">
            <label>Causa Raíz de Avería</label>
            <select className="input-control" required>
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
            <textarea className="input-control" rows={3} placeholder="Detalles de la visita..."></textarea>
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

          <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem', padding: '1rem' }}>
            Guardar Inspección
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mobile-view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingTop: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ position: 'relative', width: '56px', height: '56px', background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)', borderRadius: '16px', padding: '2px', boxShadow: '0 8px 16px rgba(0,0,0,0.08)' }}>
            <img 
              src="/inspector-red.png" 
              alt="Inspector Claro" 
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '14px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }} 
            />
            <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', background: 'var(--secondary-color)', width: '16px', height: '16px', borderRadius: '50%', border: '3px solid var(--surface-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}></div>
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', color: 'var(--text-main)', margin: 0, fontWeight: 800, letterSpacing: '-0.02em' }}>Inspector</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>Juan Carlos M.</p>
          </div>
        </div>
        <button onClick={() => router.push('/')} style={{ background: 'transparent', color: 'var(--danger-color)', padding: '0.5rem', borderRadius: '50%', border: '1px solid rgba(218, 41, 28, 0.2)' }}>
          <LogOut size={20} />
        </button>
      </div>

      <h3 style={{ color: 'var(--text-main)', marginBottom: '1rem', fontSize: '1.1rem' }}>Tickets Asignados</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {mockTickets.map(t => (
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
                    {t.tech.charAt(0)}
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>{t.tech}</span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                   <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--secondary-color)', display: 'inline-block' }}></span> {t.sector}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'var(--text-main)', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>{t.work_name}</div>
                <span className={`badge ${t.tech_type.includes('GPON') ? 'success' : 'info'}`}>{t.tech_type}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

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
    </div>
  );
}
