import { useState, useEffect } from 'react';
import { LogOut, ClipboardList, CheckCircle2, Loader2, RotateCcw, ChevronRight, X, AlertTriangle, Sun, Moon, Package, LayoutGrid, Check, ExternalLink, AlertCircle, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchTickets, type Ticket, fetchCalidad, fetchOrdenes, type Orden, saveManualCodigo, fetchRazones } from '../services/api';

export default function InspectorApp() {
  const [activeTab, setActiveTab] = useState('menu');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success'|'error'>('success');
  const [showToast, setShowToast] = useState(false);
  const [calidadAssignments, setCalidadAssignments] = useState<any[]>([]);
  const navigate = useNavigate();
  const inspectorName = localStorage.getItem('inspectorName') || '';
  const inspectorId = localStorage.getItem('inspectorId') || '';
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [loadingOrdenes, setLoadingOrdenes] = useState(false);
  const [selectedOrden, setSelectedOrden] = useState<Orden | null>(null);
  const [ordenesSearch, setOrdenesSearch] = useState('');
  const [ticketsSearch, setTicketsSearch] = useState('');
  const [theme, setTheme] = useState(document.documentElement.getAttribute('data-theme') || 'light');
  const [selectedCalidadTicket, setSelectedCalidadTicket] = useState<any | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isFormActive, setIsFormActive] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [razones, setRazones] = useState<any[]>([]);
  const [selectedRazon, setSelectedRazon] = useState<any | null>(null);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const handleLogout = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('inspectorName');
    localStorage.removeItem('inspectorId');
    localStorage.removeItem('username');
    navigate('/login');
  };

  // Helper para buscar campos con múltiples posibles nombres de columna (sinónimos)
  const getFlexVal = (row: any, keys: string[]) => {
    if (!row || typeof row !== 'object') return '';
    const rowKeys = Object.keys(row);
    for (const k of keys) {
      const searchKey = k.toLowerCase().trim();
      const found = rowKeys.find(rk => {
        const lowRK = rk.toLowerCase().trim();
        return lowRK === searchKey || lowRK === searchKey.replace(/\s+/g, '_') || searchKey === lowRK.replace(/\s+/g, '_');
      });
      if (found && row[found] !== undefined && row[found] !== null) return String(row[found]).trim();
    }
    return '';
  };

  const handleFormReturn = () => {
    setIsFormActive(false);
    setSelectedCalidadTicket(null);
    setSelectedOrden(null);
    setSelectedTicket(null);
    setSelectedRazon(null);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 4000);
    loadCalidadAssignments();
    loadOrdenes();
    loadTickets();
    loadRazones();
  };

  const handleSaveManualCode = async (type: string, id: string) => {
    if (!manualCode.trim()) return;
    setIsSubmittingCode(true);
    
    const { success, message } = await saveManualCodigo(id, manualCode, type);
    setIsSubmittingCode(false);
    if (success) {
      setManualCode('');
      setShowManualInput(false);
      handleFormReturn();
      if (type === 'tickets') loadTickets();
      if (type === 'ordenes') loadOrdenes();
      if (type === 'calidad') loadCalidadAssignments();
      if (type === 'razones') loadRazones();
    } else {
      displayToast(message || 'Error al guardar el código', 'error');
    }
  };

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
    loadCalidadAssignments();
    loadOrdenes();
    loadRazones();
  }, []);

  const loadCalidadAssignments = async () => {
    const data = await fetchCalidad('inspector');
    setCalidadAssignments(data);
  };

  const loadTickets = async () => {
    setLoading(true);
    const data = await fetchTickets('inspector');
    setTickets(data);
    setLoading(false);
  };

  const loadOrdenes = async () => {
    setLoadingOrdenes(true);
    const data = await fetchOrdenes('inspector');
    setOrdenes(data);
    setLoadingOrdenes(false);
  };

  const loadRazones = async () => {
    const data = await fetchRazones('inspector');
    setRazones(data);
  };

  const clean = (val: any) => String(val || '').replace(/\.0$/, '').toLowerCase().trim();

  const isMyTicket = (t: any) => {
    if (!t) return false;
    const myId = clean(inspectorId);
    const myName = clean(inspectorName);
    const myUser = clean(localStorage.getItem('username'));

    // Búsqueda específica en columnas conocidas
    const inspId = clean(t.inspector_id || getFlexVal(t, ['inspector_id', 'id_inspector', 'tarjeta_inspector', 'id inspector', 'tarjeta inspector']));
    const inspName = clean(t.inspector || getFlexVal(t, ['inspector', 'nombre_inspector', 'inspector_asignado', 'inspector asignado']));

    if ((inspId !== '' && (inspId === myId || inspId === myUser)) || 
        (inspName !== '' && (inspName === myName || inspName.includes(myName) || myName.includes(inspName)))) {
      return true;
    }

    // Búsqueda de "último recurso": Escanear TODOS los valores del objeto
    const allValues = Object.values(t).map(v => clean(v));
    return allValues.includes(myId) || 
           allValues.includes(myUser) || 
           (myName !== '' && allValues.some(v => v !== '' && (v === myName || v.includes(myName))));
  };

  return (
    <div className="mobile-view">
        <header className="header-actions" style={{ marginBottom: '1.5rem', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              width: '48px', 
              height: '48px', 
              borderRadius: '14px', 
              background: 'linear-gradient(135deg, var(--primary-color), #b91c1c)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 4px 12px rgba(218, 41, 28, 0.2)'
            }}>
              <LayoutGrid size={24} />
            </div>
            <div>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Inspector Asignado</p>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.01em' }}>{inspectorName}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
                 <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px rgba(16, 185, 129, 0.4)' }}></span>
                 <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>ID: {inspectorId}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              onClick={handleLogout}
              style={{ 
                background: 'var(--glass-bg)', 
                border: '1px solid var(--glass-border)', 
                color: '#ef4444', 
                padding: '0.5rem', 
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.1)'
              }}
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>


      <h3 style={{ color: 'var(--text-main)', marginBottom: '1rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {activeTab === 'repetidas' ? (
          <><RotateCcw size={20} color="var(--primary-color)" /> Averías Repetidas</>
        ) : activeTab === 'ordenes' ? (
          <><Package size={20} color="var(--primary-color)" /> Mis Órdenes</>
        ) : activeTab === 'menu' ? (
          <><LayoutGrid size={20} color="var(--primary-color)" /> Menú Principal</>
        ) : activeTab === 'mis_tickets' ? (
          <><CheckCircle2 size={20} color="var(--primary-color)" /> Inspecciones Realizadas</>
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
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {tickets.filter(t => {
                  const s = clean(t.status || getFlexVal(t, ['estado', 'status', 'estado_inspeccion', 'estado inspeccion']));
                  const isPending = s === 'pendiente' || s === 'asignado' || s === '' || s === 'asignada' || s === 'en proceso' || s === '-';
                  return isPending && isMyTicket(t);
                }).length} asignados
              </div>
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
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {ordenes.filter(o => isMyTicket(o)).length} pendientes
              </div>
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
              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>Averías Repetidas</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {calidadAssignments.filter(c => isMyTicket(c)).length} pendientes
              </div>
            </div>
          </button>

          <button 
            onClick={() => window.open('http://200.88.24.50/SACSMovil/?#/auth/login', '_blank')}
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
            <div style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', color: 'white', width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(139, 92, 246, 0.2)' }}>
              <Activity size={28} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>Diagnóstico</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>SACS Móvil</div>
            </div>
          </button>

          <button 
            onClick={() => window.open('https://forms.cloud.microsoft/pages/responsepage.aspx?id=sW-UmAXgFkyhaDp3K54oLT9CtjGptxpKqWQ3WHjwg0VUODJaQjBTNENIWEwxSThONVFIMllDN1AyQi4u&origin=lprLink&route=shorturl', '_blank')}
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
            <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', color: 'white', width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(59, 130, 246, 0.2)' }}>
              <ClipboardList size={28} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>Actividades</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Registro Gestores</div>
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
              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>Inspecciones</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Realizadas</div>
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
              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>Interfaz</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{theme === 'light' ? 'Modo Oscuro' : 'Modo Claro'}</div>
            </div>
          </button>


        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'var(--primary-color)' }}>
          <Loader2 className="spinner" size={32} />
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
          gap: '1.25rem' 
        }}>
          {(activeTab === 'pendientes' || activeTab === 'completadas' || activeTab === 'mis_tickets') && (
            <>
              {(activeTab === 'pendientes' || activeTab === 'completadas') && (
                <>
                  {/* Buscador de Tickets */}
                  <div style={{
                    gridColumn: '1 / -1',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    background: 'var(--glass-bg)',
                    border: '1.5px solid var(--glass-border)',
                    borderRadius: '14px',
                    padding: '0.65rem 1rem',
                    marginBottom: '0.5rem',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                      type="text"
                      placeholder="Buscar ticket o cliente..."
                      value={ticketsSearch}
                      onChange={(e) => setTicketsSearch(e.target.value)}
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
                    {ticketsSearch && (
                      <button
                        onClick={() => setTicketsSearch('')}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  {(() => {
                    const filtered = (Array.isArray(tickets) ? tickets : []).filter(t => {
                      if (!t) return false;
                      const isMine = isMyTicket(t);
                      const s = clean(t.status || getFlexVal(t, ['estado', 'status', 'estado_inspeccion', 'estado inspeccion']));
                      const matchesSearch = !ticketsSearch || 
                        String(t.ticket || '').toLowerCase().includes(ticketsSearch.toLowerCase()) ||
                        String(t.cliente || '').toLowerCase().includes(ticketsSearch.toLowerCase());
                      
                      if (activeTab === 'pendientes') {
                        const isPending = s === 'pendiente' || s === 'asignado' || s === 'asignada' || s === 'en proceso' || s === '' || s === '-';
                        return isPending && isMine && matchesSearch;
                      }
                      if (activeTab === 'completadas') {
                        const isDone = s === 'completado' || s === 'inspeccionado' || s === 'cerrado' || s === 'corregido' || s === 'aprobado' || s === 'rechazado' || s === 'finalizado' || s === 'cerrada';
                        return isDone && isMine && matchesSearch;
                      }
                      return false;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', marginTop: '2rem', gridColumn: '1 / -1' }}>
                          <p style={{ color: 'var(--text-muted)' }}>No hay tickets en esta sección</p>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.5, marginTop: '1rem' }}>
                            Depuración: {tickets.length} total | ID: {clean(inspectorId)} | Nombre: {clean(inspectorName)}
                          </p>
                        </div>
                      );
                    }

                    return filtered.map((t, idx) => (
                      <div key={t.id || t.ticket || idx} className="mobile-card" style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer', padding: '1.25rem', gap: '0.75rem' }} onClick={() => setSelectedTicket(t)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ background: 'var(--primary-color)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                              ID TICKET
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
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>{t.tech_id || t.tech || (t as any)['Asignado A']}</span>
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                               <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--secondary-color)', display: 'inline-block' }}></span> {t.sector || (t as any).Sector}
                            </div>
                          </div>
                          <div>
                            <span className={`badge ${t.priority === 'Alta' ? 'danger' : 'warning'}`}>{t.priority}</span>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </>
              )}
            </>
          )}

          {activeTab === 'mis_tickets' && (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
              gap: '1.25rem', 
              animation: 'fadeInUp 0.3s ease',
              gridColumn: '1 / -1' 
            }}>
              {[
                ...tickets.filter(t => {
                  const isMine = isMyTicket(t);
                  const status = clean(t.status || getFlexVal(t, ['estado', 'status']));
                  const isInspected = status === 'inspeccionado' || status === 'completado' || status === 'cerrado' || status === 'cerrada' || status === 'finalizado' || !!t.codigo_aplicado;
                  return isMine && isInspected;
                }).map(t => ({ id: t.ticket, fecha: t.fecha || (t as any).Fecha || '-', type: 'TICKET' })),
                ...ordenes.filter(o => {
                  const isMine = isMyTicket(o);
                  const isInspected = !!o.codigo_aplicado;
                  return isMine && isInspected;
                }).map(o => ({ id: o.ticket || o.orden_servicio || (o as any).TRABAJO, fecha: o.fecha || (o as any).Fecha || '-', type: 'ORDEN' }))
              ].sort((a, b) => {
                if (a.fecha === '-' || b.fecha === '-') return 0;
                return b.fecha.localeCompare(a.fecha);
              }).map((item, idx) => (
                <div key={idx} className="mobile-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', borderRadius: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ background: 'var(--primary-color)', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800 }}>
                      {item.type === 'TICKET' ? 'TRABAJO' : 'ORDEN EXTERNA'}
                    </div>
                    <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1.05rem' }}>{item.id}</div>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>{item.fecha}</div>
                </div>
              ))}
              {tickets.filter(t => {
                return isMyTicket(t) && (clean(t.status || '') === 'inspeccionado' || !!t.codigo_aplicado);
              }).length === 0 && 
               ordenes.filter(o => isMyTicket(o) && !!o.codigo_aplicado).length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>No hay inspecciones realizadas</p>
              )}
            </div>
          )}

          {activeTab === 'repetidas' && (
            <>
              {(() => {
                const filtered = (calidadAssignments || []).filter(t => {
                  if (!t) return false;
                  return isMyTicket(t);
                });

                const pending = filtered.filter(c => {
                  if (!c) return false;
                  const s = clean(c.status || getFlexVal(c, ['estado', 'status', 'estado_inspeccion', 'estado inspeccion']));
                  return s === 'asignado' || s === 'pendiente' || s === '' || s === 'en proceso' || s === '-';
                });

                if (pending.length === 0) {
                  return (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>No tienes técnicos asignados para seguimiento.</p>
                    </div>
                  );
                }

                return pending.map((c, idx) => {
                  const getField = (keys: string[]) => {
                    if (!c) return '-';
                    for (const k of keys) {
                      const found = Object.keys(c).find(ck => ck.toLowerCase().trim() === k.toLowerCase());
                      if (found && c[found]) return String(c[found]);
                    }
                    return '-';
                  };

                   const tecnico   = getField(['tech', 'tecnico', 'nombre del técnico', 'nombre', 'técnico', 'nombre técnico', 'tecnico actual', 'tecnico_actual']);
                   const techId    = getField(['tech_id', 'id técnico', 'id tecnico', 'tecnico id', 'tarjeta', 'ténico (id)', 'tecnico id', 'cedula']);
                   const trabajo   = getField(['ticket', 'trabajo', 'tickets', 'caso actual', 'id', 'caso_actual']);
                   const supervisor = getField(['supervisor', 'nombre del supervisor', 'supervisor actual', 'supervisor_actual']);
                   const workName  = getField(['work_name', 'work name actual', 'work_name_actual', 'work name', 'trabajo']);
                   // const cliente   = getField(['cliente', 'nombre cliente', 'customer', 'nombre del cliente']);
                   // const sector    = getField(['sector']);
                   // const barrio    = getField(['barrio']);
                   // const calle     = getField(['calle']);
                   
                   const casoRepetido = getField(['caso_repetido', 'caso repetido', 'ticket_repetido', 'trabajo repetido']);
                   const tecnicoRepetido = getField(['tecnico_repetido', 'tecnico caso repetido', 'tecnico repetido']);
                   const respuestaRepetido = getField(['respuesta_repetido', 'respuesta caso repetido', 'respuesta repetido']);
                   const fechaRepetido = getField(['fecha_repetido', 'fecha cierre repetido', 'fecha repetido']);

                    const isCompleted = (c.status || c['Estado Inspección']) === 'Completado' || !!c.codigo_aplicado;

                    return (
                      <div 
                        key={idx} 
                        className="mobile-card" 
                        onClick={() => {
                          setSelectedCalidadTicket(c);
                          setShowManualInput(false);
                        }}
                        style={{ 
                          marginBottom: '1rem', 
                          padding: '1.25rem', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '0.85rem',
                          cursor: 'pointer',
                          borderLeft: isCompleted ? '5px solid #10b981' : '5px solid var(--primary-color)',
                          boxShadow: isCompleted ? '0 4px 15px rgba(16, 185, 129, 0.1)' : '0 4px 12px rgba(0,0,0,0.03)'
                        }}
                      >

                        {/* — Nombre Técnico — */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
                          <div style={{ 
                            background: 'linear-gradient(135deg, var(--primary-color), #b91c1c)', 
                            color: 'white', 
                            width: '44px', 
                            height: '44px', 
                            borderRadius: '50%', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            fontWeight: 800, 
                            fontSize: '0.75rem', 
                            flexShrink: 0,
                            boxShadow: '0 4px 10px rgba(218, 41, 28, 0.3)',
                            border: '2px solid white'
                          }}>
                            {techId}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>TÉCNICO ACTUAL</div>
                            <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1rem', marginTop: '0.1rem' }}>{tecnico}</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ background: 'var(--primary-color)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', flexShrink: 0 }}>CASO ACTUAL</div>
                          <div style={{ color: 'var(--text-main)', fontWeight: 800, fontSize: '1.05rem' }}>{trabajo}</div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Supervisor Actual</div>
                            <div style={{ color: 'var(--text-main)', fontWeight: 500, fontSize: '0.9rem', marginTop: '0.15rem' }}>{supervisor}</div>
                          </div>
                          <span className="badge warning" style={{ fontSize: '0.7rem' }}>Avería Repetida</span>
                        </div>

                        <div style={{ 
                          background: 'var(--glass-bg)', 
                          border: '1px solid var(--glass-border)', 
                          borderRadius: '16px', 
                          padding: '1rem', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '0.8rem' 
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Reparación</span>
                            <span style={{ fontSize: '0.95rem', color: 'var(--text-main)', fontWeight: 800 }}>{workName}</span>
                          </div>
                        </div>

                        {casoRepetido !== '-' && (
                          <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                              <RotateCcw size={16} color="var(--primary-color)" />
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Historial de Incidencia</span>
                            </div>
                            
                            <div style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>CASO ANTERIOR</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)' }}>{casoRepetido}</span>
                              </div>
                              
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <div style={{ background: 'var(--glass-bg)', padding: '0.3rem', borderRadius: '6px' }}>
                                  <LayoutGrid size={14} color="var(--text-muted)" />
                                </div>
                                <div>
                                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>TÉCNICO PREVIO</div>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{tecnicoRepetido}</div>
                                </div>
                              </div>

                              <div style={{ background: 'rgba(218,41,28,0.03)', padding: '0.75rem', borderRadius: '10px', borderLeft: '3px solid var(--primary-color)' }}>
                                <div style={{ fontSize: '0.65rem', color: 'var(--primary-color)', fontWeight: 800, marginBottom: '0.2rem', textTransform: 'uppercase' }}>Respuesta Anterior</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: '1.4', fontStyle: 'italic' }}>{respuestaRepetido}</div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem', marginTop: '0.2rem' }}>
                                <AlertCircle size={12} color="var(--text-muted)" />
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>Cierre: {fechaRepetido}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                });
              })()}
            </>
          )}


          {activeTab === 'razones' && (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
              gap: '1.25rem',
              gridColumn: '1 / -1'
            }}>
              {(() => {
                const filtered = (razones || []).filter(r => {
                  if (!r) return false;
                  const inspName = String(r.inspector || getFlexVal(r, ['inspector', 'nombre inspector', 'inspector asignado']) || '').toLowerCase().trim();
                  const inspId = String(r.inspector_id || getFlexVal(r, ['inspector id', 'id inspector', 'tarjeta inspector']) || '').toLowerCase().trim();
                  const myName = inspectorName.toLowerCase().trim();
                  const myId = inspectorId.toLowerCase().trim();
                  const myUser = (localStorage.getItem('username') || '').toLowerCase().trim();

                  return (inspName === myName && myName !== '') || 
                         (inspId === myId && myId !== '') ||
                         (inspName === myUser && myUser !== '') ||
                         (inspId === myUser && myUser !== '');
                });

                if (filtered.length === 0) {
                  return <p style={{textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem'}}>No hay razones asignadas</p>;
                }

                return filtered.map((r, idx) => {
                  const getField = (keys: string[]) => {
                    for (const k of keys) {
                      const found = Object.keys(r).find(rk => rk.toLowerCase().trim() === k.toLowerCase());
                      if (found && r[found]) return String(r[found]);
                    }
                    return '-';
                  };
                  const idTicket = getField(['ticket', 'id', 'id ticket', 'trabajo', 'razon id']);
                  const tecnico = getField(['tech', 'tecnico', 'nombre del técnico', 'nombre', 'técnico', 'nombre técnico']);
                  const sector = getField(['sector', 'localidad', 'municipio']);
                  const isCompleted = !!(r.codigo_aplicado || r['Código Aplicado']);

                  return (
                    <div 
                      key={idx} 
                      className="mobile-card" 
                      onClick={() => setSelectedRazon(r)}
                      style={{ 
                        marginBottom: '1rem', 
                        padding: '1.25rem', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '0.85rem',
                        cursor: 'pointer',
                        borderLeft: isCompleted ? '5px solid #10b981' : '5px solid #ec4899',
                        animation: 'fadeInUp 0.3s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ background: '#ec4899', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em' }}>ID TICKET</div>
                        <div style={{ color: 'var(--text-main)', fontWeight: 800, fontSize: '1.15rem' }}>{idTicket}</div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Técnico</div>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{tecnico}</div>
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{sector}</div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {activeTab === 'ordenes' && (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: 'var(--glass-bg)',
                border: '1.5px solid var(--glass-border)',
                borderRadius: '14px',
                padding: '0.65rem 1rem',
                marginBottom: '1rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                gridColumn: '1 / -1'
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
                    const filtered = (ordenes || []).filter(o => {
                      if (!o) return false;
                      const isMine = isMyTicket(o);
                      
                      const matchesTerm = !term ||
                        String(o.orden_servicio || o.ticket || '').toLowerCase().includes(term) ||
                        String(o.cliente || '').toLowerCase().includes(term) ||
                        String(o.tech || (o as any).tech_id || '').toLowerCase().includes(term);
                        
                      return isMine && matchesTerm;
                    });
                    if (ordenes.length === 0) return (
                      <div className="mobile-card" style={{ textAlign: 'center', padding: '3rem 1.5rem', gridColumn: '1 / -1' }}>
                        <Package size={48} color="var(--text-muted)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
                        <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Sin Órdenes</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No se encontraron órdenes de trabajo asignadas.</p>
                      </div>
                    );
                    if (filtered.length === 0) return (
                      <div className="mobile-card" style={{ textAlign: 'center', padding: '2rem 1.5rem', gridColumn: '1 / -1' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No se encontró ninguna orden con ese criterio.</p>
                      </div>
                    );
                    return filtered.map((o, idx) => {
                      // En el contexto de Órdenes:
                      // - El ID real es 'orden_externa_id' o 'orden_servicio'
                      // - La descripción está en 'ticket' (columna Trabajo en el excel) o 'descripcion_orden'
                      const displayId = o.orden_externa_id || o.orden_servicio || o.ticket;
                      const displayDesc = (o.orden_externa_id && o.ticket) ? o.ticket : (o.descripcion_orden || '-');
                      
                      return (
                        <div
                          key={idx}
                          className="mobile-card"
                          style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem', gap: '0.75rem', cursor: 'pointer' }}
                          onClick={() => setSelectedOrden(o)}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ background: 'var(--primary-color)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>ORDEN EXTERNA</div>
                              <div style={{ color: 'var(--text-main)', fontWeight: 800 }}>{displayId}</div>
                            </div>
                            <ChevronRight color="var(--text-muted)" size={18} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <div style={{ color: 'var(--primary-color)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.25rem' }}>{displayDesc}</div>
                            <div style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '1rem' }}>{o.cliente}</div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Técnico:</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 500 }}>{o.tech || (o as any).tech_id || '-'}</span>
                              </div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{o.fecha || (o as any).oe_vencimiento}</span>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Bottom Navigation */}

      {/* — Toast de Éxito — */}
      {showSuccessToast && (
        <div className="toast-notification success" style={{ bottom: '2rem' }}>
          <div style={{ background: '#10b981', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={16} />
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>¡Registro Completado!</div>
            <div style={{ fontSize: '0.75rem' }}>La incidencia ha sido registrada correctamente.</div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>

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

      {/* — Modal de Detalle de Calidad — */}
      {selectedCalidadTicket && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface-color)', width: '100%', maxWidth: '500px', borderTopLeftRadius: '32px', borderTopRightRadius: '32px', padding: '2rem 1.5rem', animation: 'slideUp 0.3s ease-out', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ width: '40px', height: '4px', background: 'var(--border-color)', borderRadius: '2px', margin: '0 auto 1.5rem auto' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Detalle de Inspección</h2>
              <button onClick={() => { setSelectedCalidadTicket(null); setIsFormActive(false); setShowManualInput(false); }} style={{ background: 'transparent', color: 'var(--text-muted)' }}><X size={24} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid var(--primary-color)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>CASO ACTUAL</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{selectedCalidadTicket.ticket || selectedCalidadTicket['CASO ACTUAL'] || '-'}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>WORK NAME ACTUAL</div>
                <div style={{ fontWeight: 600, color: 'var(--primary-color)' }}>{selectedCalidadTicket.work_name || selectedCalidadTicket['WORK NAME ACTUAL'] || '-'}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>TÉCNICO ACTUAL</div>
                  <div style={{ fontWeight: 600 }}>{selectedCalidadTicket.tech || selectedCalidadTicket['TÉCNICO ACTUAL'] || '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>ID Tarjeta</div>
                  <div style={{ fontWeight: 600 }}>{selectedCalidadTicket.tech_id || selectedCalidadTicket['TÉCNICO (ID)'] || '-'}</div>
                </div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Supervisor Actual</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{selectedCalidadTicket.supervisor || selectedCalidadTicket['SUPERVISOR ACTUAL'] || '-'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Prioridad</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: (selectedCalidadTicket.priority || selectedCalidadTicket.prioridad) === 'Alta' ? 'var(--primary-color)' : 'inherit' }}>{selectedCalidadTicket.priority || selectedCalidadTicket.prioridad || 'Media'}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sector / Barrio</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedCalidadTicket.sector || '-'} / {selectedCalidadTicket['BARRIO'] || '-'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Dirección</div>
                    <div style={{ fontSize: '0.9rem' }}>{selectedCalidadTicket['CALLE'] || '-'}</div>
                  </div>
                </div>
              </div>
              {!isFormActive && !showManualInput && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                  <button onClick={() => { setIsFormActive(true); window.open('https://forms.cloud.microsoft/pages/responsepage.aspx?id=sW-UmAXgFkyhaDp3K54oLT9CtjGptxpKqWQ3WHjwg0VUMzM1QUhTSzRXOUNJTjhaN0hFNjlCQk9ORi4u&route=shorturl', '_blank'); }} className="btn-primary" style={{ width: '100%', padding: '1rem', borderRadius: '16px' }}><ExternalLink size={20} /> Registrar Hallazgos (Forms)</button>
                  <button onClick={() => setShowManualInput(true)} className="btn-secondary" style={{ width: '100%', padding: '1rem', borderRadius: '16px', border: '1px solid var(--primary-color)', color: 'var(--primary-color)' }}><ClipboardList size={20} /> Código Aplicado (Manual)</button>
                </div>
              )}
              {showManualInput ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                  <div className="input-group">
                    <label>Código Aplicado</label>
                    <input type="text" className="input-control" placeholder="Ingrese el código aquí..." value={manualCode} onChange={(e) => setManualCode(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => setShowManualInput(false)} className="btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                    <button onClick={() => handleSaveManualCode('calidad', String(selectedCalidadTicket.ticket || selectedCalidadTicket['CASO ACTUAL'] || selectedCalidadTicket['TRABAJO'] || ''))} disabled={isSubmittingCode || !manualCode.trim()} className="btn-primary" style={{ flex: 2 }}>{isSubmittingCode ? <Loader2 className="spinner" size={18} /> : 'Guardar Código'}</button>
                  </div>
                </div>
              ) : isFormActive ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#065f46', padding: '1rem', borderRadius: '12px', fontSize: '0.85rem', textAlign: 'center', fontWeight: 500 }}>Formulario abierto en otra pestaña. Por favor completa el registro.</div>
                  <button onClick={handleFormReturn} className="btn-primary" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', width: '100%', padding: '1rem', borderRadius: '16px' }}>Confirmar Registro Completado</button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* — Modal de Detalle de Ticket — */}
      {selectedTicket && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface-color)', width: '100%', maxWidth: '500px', borderTopLeftRadius: '32px', borderTopRightRadius: '32px', padding: '2rem 1.5rem', animation: 'slideUp 0.3s ease-out', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ width: '40px', height: '4px', background: 'var(--border-color)', borderRadius: '2px', margin: '0 auto 1.5rem auto' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Detalle de Ticket</h2>
              <button onClick={() => { setSelectedTicket(null); setShowManualInput(false); }} style={{ background: 'transparent', color: 'var(--text-muted)' }}><X size={24} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid var(--primary-color)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>ID TICKET</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{selectedTicket.ticket}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Estado</div>
                  <div style={{ fontWeight: 600 }}>{selectedTicket.status}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Prioridad</div>
                  <div style={{ fontWeight: 600 }}>{selectedTicket.priority || selectedTicket.prioridad || '-'}</div>
                </div>
              </div>
              {showManualInput ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                  <div className="input-group">
                    <label>Código Aplicado</label>
                    <input type="text" className="input-control" placeholder="Ingrese el código aquí..." value={manualCode} onChange={(e) => setManualCode(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => setShowManualInput(false)} className="btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                    <button onClick={() => handleSaveManualCode('tickets', String(selectedTicket.ticket || selectedTicket.id || selectedTicket['TRABAJO'] || ''))} disabled={isSubmittingCode || !manualCode.trim()} className="btn-primary" style={{ flex: 2 }}>{isSubmittingCode ? <Loader2 className="spinner" size={18} /> : 'Guardar Código'}</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowManualInput(true)} className="btn-secondary" style={{ width: '100%', padding: '1rem', borderRadius: '16px', border: '1px solid var(--primary-color)', color: 'var(--primary-color)', marginTop: '1rem' }}>
                  <ClipboardList size={20} /> Código Aplicado (Manual)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* — Modal de Detalle de Orden — */}
      {selectedOrden && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface-color)', width: '100%', maxWidth: '500px', borderTopLeftRadius: '32px', borderTopRightRadius: '32px', padding: '2rem 1.5rem', animation: 'slideUp 0.3s ease-out', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ width: '40px', height: '4px', background: 'var(--border-color)', borderRadius: '2px', margin: '0 auto 1.5rem auto' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Detalle de Orden</h2>
              <button onClick={() => { setSelectedOrden(null); setShowManualInput(false); }} style={{ background: 'transparent', color: 'var(--text-muted)' }}><X size={24} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #ef4444' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>ORDEN DE SERVICIO</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{selectedOrden.orden_servicio || selectedOrden.orden_externa_id}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cliente</div>
                <div style={{ fontWeight: 600 }}>{selectedOrden.cliente}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Descripción</div>
                <div style={{ fontSize: '0.9rem' }}>{selectedOrden.descripcion_orden || selectedOrden.ticket}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tecnología</div>
                  <div style={{ fontWeight: 600 }}>{selectedOrden.tecnologia || '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Prioridad</div>
                  <div style={{ fontWeight: 600 }}>{selectedOrden.priority || selectedOrden.prioridad || 'Media'}</div>
                </div>
              </div>
              {!isFormActive && !showManualInput && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                  <button onClick={() => { setIsFormActive(true); window.open('https://forms.cloud.microsoft/pages/responsepage.aspx?id=sW-UmAXgFkyhaDp3K54oLT9CtjGptxpKqWQ3WHjwg0VUMzM1QUhTSzRXOUNJTjhaN0hFNjlCQk9ORi4u&route=shorturl', '_blank'); }} className="btn-primary" style={{ width: '100%', padding: '1rem', borderRadius: '16px' }}><ExternalLink size={20} /> Registrar Hallazgos (Forms)</button>
                  <button onClick={() => setShowManualInput(true)} className="btn-secondary" style={{ width: '100%', padding: '1rem', borderRadius: '16px', border: '1px solid var(--primary-color)', color: 'var(--primary-color)' }}><ClipboardList size={20} /> Código Aplicado (Manual)</button>
                </div>
              )}
              {showManualInput ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                  <div className="input-group">
                    <label>Código Aplicado</label>
                    <input type="text" className="input-control" placeholder="Ingrese el código aquí..." value={manualCode} onChange={(e) => setManualCode(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => setShowManualInput(false)} className="btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                    <button onClick={() => handleSaveManualCode('ordenes', String(selectedOrden.orden_servicio || selectedOrden.orden_externa_id))} disabled={isSubmittingCode || !manualCode.trim()} className="btn-primary" style={{ flex: 2 }}>{isSubmittingCode ? <Loader2 className="spinner" size={18} /> : 'Guardar Código'}</button>
                  </div>
                </div>
              ) : isFormActive ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#065f46', padding: '1rem', borderRadius: '12px', fontSize: '0.85rem', textAlign: 'center', fontWeight: 500 }}>Formulario abierto en otra pestaña. Por favor completa el registro.</div>
                  <button onClick={handleFormReturn} className="btn-primary" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', width: '100%', padding: '1rem', borderRadius: '16px' }}>Confirmar Registro Completado</button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* — Modal de Detalle de Razón — */}
      {selectedRazon && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface-color)', width: '100%', maxWidth: '500px', borderTopLeftRadius: '32px', borderTopRightRadius: '32px', padding: '2rem 1.5rem', animation: 'slideUp 0.3s ease-out', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ width: '40px', height: '4px', background: 'var(--border-color)', borderRadius: '2px', margin: '0 auto 1.5rem auto' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Detalle de Razón</h2>
              <button onClick={() => { setSelectedRazon(null); setShowManualInput(false); }} style={{ background: 'transparent', color: 'var(--text-muted)' }}><X size={24} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #ec4899' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>ID TICKET</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{selectedRazon.ticket || selectedRazon.id || selectedRazon['ID TICKET']}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Motivo</div>
                <div style={{ fontWeight: 600 }}>{selectedRazon.motivo || selectedRazon.razon || selectedRazon['Motivo']}</div>
              </div>
              {showManualInput ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                  <div className="input-group">
                    <label>Código Aplicado</label>
                    <input type="text" className="input-control" placeholder="Ingrese el código aquí..." value={manualCode} onChange={(e) => setManualCode(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => setShowManualInput(false)} className="btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                    <button onClick={() => handleSaveManualCode('razones', String(selectedRazon.ticket || selectedRazon.id || selectedRazon['ID TICKET']))} disabled={isSubmittingCode || !manualCode.trim()} className="btn-primary" style={{ flex: 2 }}>{isSubmittingCode ? <Loader2 className="spinner" size={18} /> : 'Guardar Código'}</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowManualInput(true)} className="btn-secondary" style={{ width: '100%', padding: '1rem', borderRadius: '16px', border: '1px solid var(--primary-color)', color: 'var(--primary-color)', marginTop: '1rem' }}>
                  <ClipboardList size={20} /> Código Aplicado (Manual)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* — Toast de Éxito — */}
      {showSuccessToast && (
        <div className="toast-notification success" style={{ bottom: '6rem' }}>
          <div style={{ background: '#10b981', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={16} />
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>¡Registro Completado!</div>
            <div style={{ fontSize: '0.75rem' }}>La incidencia ha sido registrada correctamente.</div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
      {/* Spacer for bottom nav */}
      <div style={{ height: '160px', width: '100%', flexShrink: 0 }}></div>
    </div>
  );
}
