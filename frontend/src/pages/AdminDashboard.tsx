import { useState, useEffect } from 'react';
import { 
  LogOut, Search, Filter, AlertTriangle, CheckCircle2, Loader2,
  Sun, Moon, Settings, RotateCcw, AlertCircle, Activity,
  LayoutDashboard, FileText, Users, Package
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { fetchTickets, type Ticket, fetchInspectors, createInspector, updateInspector, deleteInspector, autoAssignTickets, assignTicket, assignTicketsBySupervisor, type Inspector, fetchConfig, updateAdminProfile, fetchCalidad, fetchRazones, assignCalidadBySupervisor, assignCalidadIndividual, fetchOrdenes, type Orden, cancelManualCodigo, assignOrdenesBySupervisor, assignOrdenesIndividual } from '../services/api';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('tickets');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [supervisorFilter, setSupervisorFilter] = useState('');
  const [bulkAssignInspector, setBulkAssignInspector] = useState('');

  // Estados de Inspectores
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [loadingInspectors, setLoadingInspectors] = useState(false);
  const [calidadData, setCalidadData] = useState<any[]>([]);
  const [loadingCalidad, setLoadingCalidad] = useState(false);
  const [calidadSearch, setCalidadSearch] = useState('');
  const [calidadSupervisorFilter, setCalidadSupervisorFilter] = useState('');
  
  // Columnas fijas para el tablero de Calidad (Averías Repetidas)
  const CALIDAD_COLUMNS = [
    { label: 'TÉCNICO (ID)', key: 'tech_id' },
    { label: 'NOMBRE TÉCNICO', key: 'tech' },
    { label: 'TRABAJO', key: 'ticket' },
    { label: 'TARJETA SUPERVISOR', key: 'supervisor_id' },
    { label: 'NOMBRE SUPERVISOR', key: 'supervisor' },
    { label: 'CÓDIGO APLICADO', key: 'codigo_aplicado' },
    { label: 'ESTADO', key: 'status' },
    { label: 'SECTOR', key: 'sector' },
    { label: 'TECNOLOGÍA', key: 'tecnologia' }
  ];
  const [showAddInspector, setShowAddInspector] = useState(false);
  const [editingInspector, setEditingInspector] = useState<Inspector | null>(null);
  const [_razones, setRazones] = useState<any[]>([]);
  const [_loadingRazones, setLoadingRazones] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [bulkAssignCalidadInspector, setBulkAssignCalidadInspector] = useState('');

  const [adminConfig, setAdminConfig] = useState({ admin_username: '', admin_password: '', admin_recovery_email: '' });
  const [savingConfig, setSavingConfig] = useState(false);

  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [loadingOrdenes, setLoadingOrdenes] = useState(false);
  const [ordenesSearch, setOrdenesSearch] = useState('');
  const [ordenesColumnFilters, setOrdenesColumnFilters] = useState<Record<string, string>>({});
  const [inspeccionesSearch, setInspeccionesSearch] = useState('');
  const [ordenesSupervisorFilter, setOrdenesSupervisorFilter] = useState('');
  const [bulkAssignOrdenesInspector, setBulkAssignOrdenesInspector] = useState('');

  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success'|'error'>('success');
  const [showToast, setShowToast] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, message: string, onConfirm: () => void} | null>(null);
  const [theme, setTheme] = useState(document.documentElement.getAttribute('data-theme') || 'light');

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
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
    loadInspectors();
    loadAdminConfig();
    loadRazones();
  }, []);

  useEffect(() => {
    if (tickets.length > 0) {
      console.log("DEBUG - Primer Ticket Recibido:", tickets[0]);
      console.log("DEBUG - Keys Disponibles:", Object.keys(tickets[0]));
      const sampleSup = getSupervisor(tickets[0]);
      console.log("DEBUG - Resultado getSupervisor:", sampleSup);
    }
  }, [tickets]);

  useEffect(() => {
    if (calidadData.length > 0) {
      console.log("DEBUG - Primer Calidad Recibido:", calidadData[0]);
      console.log("DEBUG - Keys Disponibles en Calidad:", Object.keys(calidadData[0]));
      const sampleSup = getSupervisor(calidadData[0]);
      console.log("DEBUG - Resultado getSupervisor en Calidad:", sampleSup);
    }
  }, [calidadData]);


  const loadAdminConfig = async () => {
    const config = await fetchConfig();
    setAdminConfig(config);
  };

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadTickets();
      loadCalidad();
      loadOrdenes();
      loadRazones();
    }
    if (activeTab === 'tickets') {
      loadTickets();
    }
    if (activeTab === 'ordenes') {
      loadOrdenes();
    }
    if (activeTab === 'calidad') {
      loadCalidad();
    }
    if (activeTab === 'personal') {
      loadInspectors();
    }
  }, [activeTab]);

  const ensureKeys = (item: any, type: 'ticket' | 'orden' | 'calidad') => {
    if (!item) return item;
    const normalized = { ...item };
    
    // Mapping universal de campos clave (por si el backend no lo hizo)
    const getVal = (keys: string[]) => {
      const foundKey = Object.keys(item).find(k => keys.includes(k.toLowerCase().trim()));
      return foundKey ? item[foundKey] : undefined;
    };

    if (!normalized.ticket) normalized.ticket = getVal(['trabajo', 'ticket', 'idd', 'nro trabajo', 'work name']);
    if (!normalized.tech) normalized.tech = getVal(['asignado a', 'nombre tecnico', 'nombre_tecnico', 'tech_name']);
    if (!normalized.tech_id) normalized.tech_id = getVal(['tech_id', 'tecnico', 'cedula', 'id tecnico', 'tarjeta', 'cedula tecnico']);
    if (!normalized.supervisor) normalized.supervisor = getVal(['supervisor', 'nombre supervisor']);
    if (!normalized.sector) normalized.sector = getVal(['sector', 'zona', 'barrio', 'ciudad', 'localidad']);
    if (!normalized.status) normalized.status = getVal(['estado', 'status', 'estado inspeccion', 'estado_inspeccion']);
    if (!normalized.tecnologia) normalized.tecnologia = getVal(['tecnologia', 'tipo red', 'tipo_red']);
    
    if (type === 'orden') {
       if (!normalized.orden_servicio) normalized.orden_servicio = getVal(['orden servicio', 'os', 'id orden', 'orden_servicio', 'orden_externa_id']);
       if (!normalized.descripcion_orden) normalized.descripcion_orden = getVal(['descripcion_orden', 'orden externa', 'order externa', 'descripcion', 'tipo servicio', 'tipo_servicio']);
       if (!normalized.cliente) normalized.cliente = getVal(['cliente', 'subscriber']);
       if (!normalized.fecha) normalized.fecha = getVal(['fecha', 'oe vencimiento', 'vence', 'oe_vencimiento']);
       
       // Si el campo 'ticket' (columna Trabajo) contiene una descripción larga,
       // y tenemos un ID numérico en 'orden_externa_id', los reajustamos.
       if (normalized.ticket && String(normalized.ticket).length > 15 && normalized.orden_externa_id) {
          normalized.descripcion_orden = normalized.ticket;
          normalized.ticket = normalized.orden_externa_id;
       }
    }

    return normalized;
  };

  const loadCalidad = async () => {
    setLoadingCalidad(true);
    const data = await fetchCalidad();
    setCalidadData(data.map(item => ensureKeys(item, 'calidad')));
    setLoadingCalidad(false);
  };

  const loadInspectors = async () => {
    setLoadingInspectors(true);
    const data = await fetchInspectors();
    setInspectors(data);
    setLoadingInspectors(false);
  };

  const loadRazones = async () => {
    setLoadingRazones(true);
    const data = await fetchRazones();
    setRazones(data);
    setLoadingRazones(false);
  };

  const loadOrdenes = async () => {
    setLoadingOrdenes(true);
    const data = await fetchOrdenes();
    setOrdenes(data.map(item => ensureKeys(item, 'orden')));
    setLoadingOrdenes(false);
  };



  const handleAssign = async (ticketId: string | number, inspectorId: string) => {
    if(!inspectorId) return;
    const inspector = inspectors.find(i => String(i.id) === String(inspectorId));
    if(inspector) {
      const success = await assignTicket(ticketId, inspector.id, inspector.nombre);
      if(success) {
        displayToast(`Ticket asignado a ${inspector.nombre}`, 'success');
        loadTickets();
      } else {
        displayToast('Error al asignar el ticket', 'error');
      }
    }
  };

  const loadTickets = async () => {
    setLoading(true);
    const data = await fetchTickets();
    setTickets(data.map(item => ensureKeys(item, 'ticket')));
    setLoading(false);
  };
  
  const handleLogout = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('inspectorName');
    navigate('/login');
  };

  const getSupervisor = (t: any) => {
    if (!t) return '-';
    // Buscar en claves comunes normalizadas
    const sup = t.supervisor || t.nombre_supervisor || t['Nombre Supervisor'] || t['Supervisor'];
    if (sup) return String(sup);
    
    // Buscar cualquier clave que contenga 'supervisor'
    const dynamicKey = Object.keys(t).find(k => k.toLowerCase().includes('supervisor') && !k.toLowerCase().includes('id'));
    if (dynamicKey) return String(t[dynamicKey]);
    
    return '-';
  };



  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src="https://logodownload.org/wp-content/uploads/2014/02/claro-logo-8.png" alt="Claro" style={{ height: '32px' }} />
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button className={`nav-item ${activeTab === 'tickets' ? 'active' : ''}`} onClick={() => setActiveTab('tickets')}>
            <FileText size={20} /> Tickets <span className="nav-badge">{tickets.length}</span>
          </button>
          <button className={`nav-item ${activeTab === 'ordenes' ? 'active' : ''}`} onClick={() => setActiveTab('ordenes')}>
            <Package size={20} /> Ordenes <span className="nav-badge">{ordenes.length}</span>
          </button>
          <button className={`nav-item ${activeTab === 'calidad' ? 'active' : ''}`} onClick={() => setActiveTab('calidad')}>
            <RotateCcw size={20} /> Averías Repetidas <span className="nav-badge">{calidadData.length}</span>
          </button>
          <button className={`nav-item ${activeTab === 'inspecciones' ? 'active' : ''}`} onClick={() => setActiveTab('inspecciones')}>
            <CheckCircle2 size={20} /> Inspecciones <span className="nav-badge">{tickets.filter(t => t.status === 'Inspeccionado' || t.status === 'Aprobado' || t.status === 'Rechazado').length + ordenes.length + calidadData.length}</span>
          </button>
          <button className={`nav-item ${activeTab === 'personal' ? 'active' : ''}`} onClick={() => setActiveTab('personal')}>
            <Users size={20} /> Personal <span className="nav-badge">{inspectors.length}</span>
          </button>
          <button className={`nav-item ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>
            <Settings size={20} /> Mi Perfil
          </button>
          <div style={{ flex: 1 }}></div>
          <button className="nav-item" onClick={toggleTheme} style={{ marginBottom: '0.5rem' }}>
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            {theme === 'light' ? 'Modo Oscuro' : 'Modo Claro'}
          </button>
          <button className="nav-item" onClick={handleLogout} style={{ color: 'var(--danger-color)' }}>
            <LogOut size={20} /> Salir
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="header-actions">
          <div>
            <h1 className="title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {activeTab === 'dashboard' ? <><LayoutDashboard size={28} color="var(--primary-color)" /> Resumen Operativo</> : 
               activeTab === 'tickets' ? <><FileText size={28} color="var(--primary-color)" /> Gestión de Tickets ({tickets.length})</> : 
               activeTab === 'ordenes' ? <><Package size={28} color="var(--primary-color)" /> Órdenes de Trabajo</> : 
               activeTab === 'inspecciones' ? <><CheckCircle2 size={28} color="var(--primary-color)" /> Historial de Inspecciones Mixtas</> :
               activeTab === 'personal' ? <><Users size={28} color="var(--primary-color)" /> Directorio de Personal ({inspectors.length})</> :
               activeTab === 'calidad' ? <> <RotateCcw size={28} color="var(--primary-color)" /> Averías Repetidas ({calidadData.length})</> :
               <><Settings size={28} color="var(--primary-color)" /> Configuración de Perfil</>}
            </h1>
            <p className="subtitle">Centro de control de averías de fibra óptica</p>
          </div>
          {activeTab === 'tickets' && (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <select 
                className="assign-select" 
                style={{ padding: '0.45rem 2rem 0.45rem 1rem', height: 'auto', background: 'var(--surface-color)', minWidth: '200px' }}
                value={supervisorFilter}
                onChange={(e) => setSupervisorFilter(e.target.value)}
              >
                <option value="">Todos los supervisores</option>
                {Array.from(new Set(tickets.map(t => t.supervisor).filter(Boolean))).map(sup => (
                  <option key={sup} value={sup}>{sup}</option>
                ))}
              </select>
              <div className="search-bar" style={{ margin: 0 }}>
                <Search size={18} color="var(--text-muted)" />
                <input type="text" placeholder="Buscar ticket, técnico..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {activeTab === 'dashboard' && (
          <>
            <div className="kpi-grid">
              <div className="glass-panel kpi-card">
                <div className="kpi-icon blue"><FileText /></div>
                <div className="kpi-info">
                  <h3>Tickets Totales</h3>
                  <p>{tickets.length}</p>
                </div>
              </div>
              <div className="glass-panel kpi-card">
                <div className="kpi-icon amber"><AlertTriangle /></div>
                <div className="kpi-info">
                  <h3>Pendientes Inspección</h3>
                  <p>{tickets.filter(t => t.status === 'Pendiente').length}</p>
                </div>
              </div>
              <div className="glass-panel kpi-card">
                <div className="kpi-icon green"><CheckCircle2 /></div>
                <div className="kpi-info">
                  <h3>Inspeccionados</h3>
                  <p>{tickets.filter(t => t.status === 'Aprobado' || t.status === 'Inspeccionado').length}</p>
                </div>
              </div>
              <div className="glass-panel kpi-card">
                <div className="kpi-icon red"><Activity /></div>
                <div className="kpi-info">
                  <h3>Requieren Corrección</h3>
                  <p>{tickets.filter(t => t.status === 'Requiere corrección').length}</p>
                </div>
              </div>
            </div>

            <div className="responsive-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="glass-panel" style={{ gridColumn: 'span 2' }}>
                <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={20} color="var(--primary-color)" /> Técnicos con Más Repetidas (%)
                </h3>
                <div className="top-techs">
                  {loadingCalidad ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="spinner" /></div>
                  ) : calidadData && calidadData.length > 0 ? (
                    (() => {
                      const techStats: Record<string, { name: string, repeated: number, total: number }> = {};
                      
                      // Aggregar repetidas de calidadData
                      calidadData.forEach(item => {
                        const nameKey = Object.keys(item).find(k => 
                          ['nombre', 'técnico', 'tecnico', 'nombre del técnico', 'nombre del tecnico', 'tech'].includes(k.toLowerCase().trim())
                        ) || 'Nombre';
                        const name = String(item[nameKey] || 'N/A').trim();
                        if (name === 'N/A' || name === '-') return;
                        
                        if (!techStats[name]) techStats[name] = { name, repeated: 0, total: 0 };
                        techStats[name].repeated++;
                      });

                      // Estimar totales desde tickets para el porcentaje
                      tickets.forEach(t => {
                        const name = String(t.tech || t.tech_id || '').trim();
                        if (name && techStats[name]) {
                          techStats[name].total++;
                        }
                      });

                      return Object.values(techStats)
                        .map(t => {
                          // Si no hay total en tickets, usamos el count de repetidas como base (mínimo 1)
                          const total = t.total || t.repeated;
                          const repPerc = (t.repeated / total) * 100;
                          return { name: t.name, repPerc, count: t.repeated };
                        })
                        .sort((a, b) => b.repPerc - a.repPerc)
                        .slice(0, 5)
                        .map((tech, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 0', borderBottom: idx < 4 ? '1px solid var(--glass-border)' : 'none' }}>
                            <div style={{ 
                              width: '28px', 
                              height: '28px', 
                              borderRadius: '8px', 
                              background: idx === 0 ? 'var(--primary-color)' : 'rgba(255,255,255,0.05)', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              fontSize: '0.8rem', 
                              fontWeight: 800, 
                              color: idx === 0 ? '#fff' : 'var(--text-main)',
                              border: '1px solid var(--glass-border)'
                            }}>
                              {idx + 1}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>{tech.name}</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tech.count} repetidas</span>
                              </div>
                              <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ 
                                  height: '100%', 
                                  background: tech.repPerc > 20 ? '#ef4444' : tech.repPerc > 10 ? '#f59e0b' : '#10b981', 
                                  width: `${Math.min(100, tech.repPerc)}%`,
                                  transition: 'width 1s ease-out'
                                }}></div>
                              </div>
                            </div>
                            <div style={{ 
                              minWidth: '50px', 
                              textAlign: 'right', 
                              fontWeight: 800, 
                              color: tech.repPerc > 20 ? '#ef4444' : tech.repPerc > 10 ? '#f59e0b' : '#10b981', 
                              fontSize: '1rem' 
                            }}>
                              {tech.repPerc.toFixed(1)}%
                            </div>
                          </div>
                        ));
                    })()
                  ) : (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No hay datos de calidad suficientes.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle2 size={20} color="var(--primary-color)" /> Últimas Inspecciones</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Ticket</th>
                      <th>Técnico</th>
                      <th>Inspector</th>
                      <th>Supervisor</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={5} style={{textAlign: 'center', padding: '2rem'}}><Loader2 className="spinner" /></td></tr>
                    ) : tickets.slice(0, 5).map((t, idx) => (
                      <tr key={t.id || t.ticket || idx}>
                        <td style={{ fontWeight: 500, color: 'var(--text-main)' }}>{t.ticket}</td>
                        <td>{t.tech || t.tech_id || '-'}</td>
                        <td>{t.inspector || t.inspector_id || 'Sin asignar'}</td>
                        <td>{getSupervisor(t)}</td>
                        <td>
                          <span className={`badge ${t.status === 'Pendiente' ? 'warning' : t.status === 'Inspeccionado' ? 'success' : 'danger'}`}>
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'ordenes' && (
          <div className="glass-panel">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <Package size={20} color="var(--primary-color)" /> Gestión de Órdenes
                </h3>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div className="search-bar" style={{ width: 'auto', minWidth: '300px' }}>
                    <Search size={18} />
                    <input 
                      type="text" 
                      placeholder="Buscar por Orden, Cliente, Supervisor..." 
                      value={ordenesSearch}
                      onChange={(e) => setOrdenesSearch(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Panel Asignación Masiva - misma arquitectura que Calidad */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '1rem', 
                flexWrap: 'wrap', 
                background: 'rgba(var(--primary-color-rgb, 218, 41, 28), 0.05)', 
                padding: '1rem', 
                borderRadius: '12px',
                border: '1px dashed var(--primary-color)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={18} color="var(--primary-color)" />
                  <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>Asignación Masiva:</span>
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '300px', flexWrap: 'wrap' }}>
                  <select 
                    className="input-control" 
                    value={ordenesSupervisorFilter} 
                    onChange={(e) => setOrdenesSupervisorFilter(e.target.value)}
                    style={{ flex: 1, minWidth: '200px', height: '42px', border: '1px solid var(--primary-color)' }}
                  >
                    <option value="">1. Seleccionar Supervisor...</option>
                    {Array.from(new Set(ordenes.map(o => String(o.supervisor || '')).filter(s => s && s !== '-'))).map(sup => (
                      <option key={sup} value={sup}>{sup}</option>
                    ))}
                  </select>

                  <span style={{color: 'var(--primary-color)', display: 'flex', alignItems: 'center', fontWeight: 'bold'}}>→</span>

                  <select 
                    className="assign-select" 
                    value={bulkAssignOrdenesInspector}
                    onChange={(e) => setBulkAssignOrdenesInspector(e.target.value)}
                    style={{ flex: 1, minWidth: '200px', height: '42px' }}
                  >
                    <option value="">2. Seleccionar Inspector...</option>
                    {inspectors.map(insp => (
                      <option key={insp.id} value={insp.id}>{insp.nombre}</option>
                    ))}
                  </select>
                  
                  <button 
                    className="btn-primary" 
                    style={{ padding: '0 1.5rem', height: '42px' }}
                    disabled={!bulkAssignOrdenesInspector || !ordenesSupervisorFilter}
                    onClick={async () => {
                      const inspector = inspectors.find(i => String(i.id) === String(bulkAssignOrdenesInspector));
                      if (inspector && ordenesSupervisorFilter) {
                        try {
                          const updated = await assignOrdenesBySupervisor(ordenesSupervisorFilter, inspector.id, inspector.nombre);
                          displayToast(`Se asignaron ${updated} órdenes a ${inspector.nombre}`, 'success');
                          loadOrdenes();
                        } catch (error: any) {
                          displayToast(error.message || 'Error en la asignación masiva', 'error');
                        }
                      }
                    }}
                  >
                    Asignar Masivo
                  </button>
                </div>
                {!ordenesSupervisorFilter && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--primary-color)', fontStyle: 'italic' }}>
                    * Selecciona un supervisor primero para habilitar la asignación masiva.
                  </span>
                )}
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    {[
                      'Trabajo', 'Orden Externa', 'Cliente', 'OE Vencimiento', 'Prioridad', 
                      'Asignado A', 'Supervisor', 'Estado', 'Tecnología', 'Sector', 'Terminal'
                    ].map(header => (
                      <th key={header}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{header}</span>
                          <div className="search-bar" style={{ margin: 0, padding: '0.25rem 0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', height: '28px' }}>
                            <Search size={12} />
                            <input 
                              type="text" 
                              placeholder="Filtrar..." 
                              value={ordenesColumnFilters[header] || ''} 
                              onChange={(e) => setOrdenesColumnFilters(prev => ({ ...prev, [header]: e.target.value }))}
                              style={{ fontSize: '0.75rem' }}
                            />
                          </div>
                        </div>
                      </th>
                    ))}
                    <th>Inspector Asignado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingOrdenes ? (
                    <tr><td colSpan={13} style={{textAlign: 'center', padding: '2rem'}}><Loader2 className="spinner" /></td></tr>
                  ) : ordenes.length === 0 ? (
                    <tr><td colSpan={13} style={{textAlign: 'center', padding: '2rem', color: 'var(--text-muted)'}}>No se encontraron órdenes.</td></tr>
                  ) : ordenes.filter(o => {
                    const term = ordenesSearch.toLowerCase();
                    const matchesGlobal = !term || [
                      o.orden_servicio, o.cliente, o.supervisor, o.tech, o.ticket
                    ].some(v => String(v || '').toLowerCase().includes(term));
                    
                    const matchesSupervisor = ordenesSupervisorFilter === '' || 
                      String(o.supervisor || '').toLowerCase() === ordenesSupervisorFilter.toLowerCase();

                    const matchesColumns = Object.entries(ordenesColumnFilters).every(([key, val]) => {
                      if (!val) return true;
                      return String((o as any)[key] || '').toLowerCase().includes(val.toLowerCase());
                    });
                    
                    return matchesGlobal && matchesSupervisor && matchesColumns;
                  }).map((o, idx) => {
                    const ordenId = o.orden_servicio || o.ticket;
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{o.ticket || (o as any).trabajo || '-'}</td>
                        <td style={{ fontSize: '0.8rem' }}>{o.descripcion_orden || (o as any)['orden externa'] || '-'}</td>
                        <td style={{ fontSize: '0.8rem' }}>{o.cliente || '-'}</td>
                        <td>{o.fecha || (o as any)['oe vencimiento'] || '-'}</td>
                        <td>
                          <span style={{ 
                            padding: '0.2rem 0.5rem', 
                            borderRadius: '4px', 
                            fontSize: '0.7rem', 
                            fontWeight: 600,
                            background: String(o.priority || (o as any).prioridad).toLowerCase().includes('alta') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                            color: String(o.priority || (o as any).prioridad).toLowerCase().includes('alta') ? '#ef4444' : '#3b82f6'
                          }}>
                            {o.priority || (o as any).prioridad || '-'}
                          </span>
                        </td>
                        <td>{o.tech || (o as any).tech_name || '-'}</td>
                        <td>{o.supervisor || '-'}</td>
                        <td>
                          <span className={`badge ${o.status === 'Completado' || o.status === 'Inspeccionado' ? 'success' : o.status === 'Pendiente' ? 'warning' : 'info'}`}>
                            {o.status || 'Pendiente'}
                          </span>
                        </td>
                        <td>{o.tecnologia || (o as any)['tipo red'] || '-'}</td>
                        <td>{o.sector || (o as any).ciudad || '-'}</td>
                        <td>{o.terminal || '-'}</td>
                        {/* Inspector Asignado */}
                        <td>
                          {(o as any).inspector ? (
                            <span className="badge info">{(o as any).inspector}</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              {(o as any).inspector_id ? `ID: ${(o as any).inspector_id}` : '-'}
                            </span>
                          )}
                        </td>
                        {/* Acciones: asignación individual */}
                        <td>
                          <select
                            className="assign-select"
                            style={{ padding: '0.25rem 1.5rem 0.25rem 0.5rem', fontSize: '0.7rem' }}
                            value=""
                            onChange={async (e) => {
                              const inspectorId = e.target.value;
                              const inspector = inspectors.find(i => String(i.id) === String(inspectorId));
                              if (inspector && ordenId) {
                                try {
                                  const success = await assignOrdenesIndividual(String(ordenId), inspector.id, inspector.nombre);
                                  if (success) {
                                    displayToast(`Orden ${ordenId} asignada a ${inspector.nombre}`, 'success');
                                    loadOrdenes();
                                  }
                                } catch (error: any) {
                                  displayToast(error.message || 'Error al asignar orden', 'error');
                                }
                              }
                            }}
                          >
                            <option value="">Asignar...</option>
                            {inspectors.map(insp => (
                              <option key={insp.id} value={insp.id}>{insp.nombre}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}


        {activeTab === 'tickets' && (
          <div className="glass-panel">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <FileText size={20} color="var(--primary-color)" /> Gestión de Tickets
                </h3>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div className="search-bar" style={{ width: 'auto', minWidth: '240px' }}>
                    <Search size={18} />
                    <input 
                      type="text" 
                      placeholder="Buscar por ticket, técnico..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Bulk Assign Section for Tickets */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '1rem', 
                flexWrap: 'wrap', 
                background: 'rgba(59, 130, 246, 0.05)', 
                padding: '1rem', 
                borderRadius: '12px',
                border: '1px dashed #3b82f6'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={18} color="#3b82f6" />
                  <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>Asignación Masiva:</span>
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '300px', flexWrap: 'wrap' }}>
                  <select 
                    className="input-control" 
                    value={supervisorFilter} 
                    onChange={(e) => setSupervisorFilter(e.target.value)}
                    style={{ flex: 1, minWidth: '200px', height: '42px', border: '1px solid #3b82f6' }}
                  >
                    <option value="">1. Seleccionar Supervisor...</option>
                    {Array.from(new Set(tickets.map(t => getSupervisor(t)).filter(s => s && s !== '-'))).map(sup => (
                      <option key={sup} value={sup}>{sup}</option>
                    ))}
                  </select>

                  <span style={{color: '#3b82f6', display: 'flex', alignItems: 'center', fontWeight: 'bold'}}>→</span>

                  <select 
                    className="assign-select"
                    style={{ flex: 1, minWidth: '200px', height: '42px', color: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.2)' }}
                    value={bulkAssignInspector}
                    onChange={e => setBulkAssignInspector(e.target.value)}
                  >
                    <option value="" disabled>2. Seleccionar Inspector...</option>
                    {inspectors.map(insp => <option key={insp.id} value={insp.id}>{insp.nombre}</option>)}
                  </select>
                  
                  <button 
                    className="btn-primary" 
                    style={{ padding: '0 1.5rem', height: '42px', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)' }}
                    disabled={!bulkAssignInspector || !supervisorFilter}
                    onClick={async () => {
                      const inspector = inspectors.find(i => String(i.id) === String(bulkAssignInspector));
                      if (inspector && supervisorFilter) {
                        try {
                          const updatedCount = await assignTicketsBySupervisor(supervisorFilter, inspector.id, inspector.nombre);
                          displayToast(`${updatedCount} tickets asignados a ${inspector.nombre}`, 'success');
                          loadTickets();
                        } catch (error: any) {
                          displayToast(error.message || 'Error en la asignación masiva', 'error');
                        }
                      }
                    }}
                  >
                    Asignar Masivo
                  </button>
                </div>
                {!supervisorFilter && (
                  <span style={{ fontSize: '0.75rem', color: '#3b82f6', fontStyle: 'italic' }}>
                    * Filtra por supervisor primero para habilitar la asignación masiva de tickets.
                  </span>
                )}
              </div>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Trabajo</th>
                    <th>Order Externa</th>
                    <th>Sector</th>
                    <th>Cliente</th>
                    <th>Tecnología</th>
                    <th>Terminal</th>
                    <th>Asignado A</th>
                    <th>Supervisor</th>
                    <th>Estado</th>
                    <th>Prioridad</th>
                    <th>Tipo Prioridad</th>
                    <th>OE Vencimiento</th>
                    <th>Inspector Asignado</th>
                    <th>Acción Asignar</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={16} style={{textAlign: 'center', padding: '2rem'}}><Loader2 className="spinner" /></td></tr>
                  ) : tickets.filter(t => {
                    const search = searchTerm.toLowerCase();
                    const matchesSearch = !search || 
                                          t.ticket?.toString().toLowerCase().includes(search) || 
                                          t.tech_id?.toString().toLowerCase().includes(search) || 
                                          (t.tech || (t as any).Asignado_A)?.toString().toLowerCase().includes(search) ||
                                          t.cliente?.toString().toLowerCase().includes(search);
                    
                    const tSupervisor = getSupervisor(t);
                    const matchesSupervisor = !supervisorFilter || tSupervisor === supervisorFilter;
                    return matchesSearch && matchesSupervisor;
                  }).length === 0 ? (
                    <tr><td colSpan={16} style={{textAlign: 'center', padding: '2rem', color: 'var(--text-muted)'}}>No se encontraron tickets con los filtros actuales.</td></tr>
                  ) : tickets.filter(t => {
                    const search = searchTerm.toLowerCase();
                    const matchesSearch = !search || 
                                          t.ticket?.toString().toLowerCase().includes(search) || 
                                          t.tech_id?.toString().toLowerCase().includes(search) || 
                                          (t.tech || (t as any).Asignado_A)?.toString().toLowerCase().includes(search) ||
                                          t.cliente?.toString().toLowerCase().includes(search);
                    
                    const tSupervisor = getSupervisor(t);
                    const matchesSupervisor = !supervisorFilter || tSupervisor === supervisorFilter;
                    return matchesSearch && matchesSupervisor;
                  }).map((t, idx) => (
                    <tr key={t.id || t.ticket || idx}>
                      <td style={{ fontWeight: 500, color: 'var(--text-main)' }}>{t.ticket}</td>
                      <td>{t.descripcion_orden || t.orden_servicio || '-'}</td>
                      <td>{t.sector || '-'}</td>
                      <td>{t.cliente || '-'}</td>
                      <td>{t.tecnologia || '-'}</td>
                      <td>{t.terminal || '-'}</td>
                      <td>{t.tech || t.tech_id || '-'}</td>
                      <td>{getSupervisor(t)}</td>
                      <td>
                        <span className={`badge ${t.status === 'Pendiente' ? 'warning' : (t.status === 'Inspeccionado' || t.status === 'Aprobado' || t.status === 'Asignado') ? 'success' : 'danger'}`}>
                          {t.status || 'Pendiente'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${t.priority === 'Alta' ? 'danger' : t.priority === 'Media' ? 'warning' : 'info'}`}>
                          {t.priority || '-'}
                        </span>
                      </td>
                      <td>{(t as any).tipo_prioridad || '-'}</td>
                      <td>{t.fecha || (t as any).oe_vencimiento || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 700, color: '#10b981' }}>{t.codigo_aplicado || '-'}</span>
                          {t.codigo_aplicado && (
                            <button 
                              className="btn-danger" 
                              style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem' }}
                              onClick={() => {
                                setConfirmModal({
                                  isOpen: true,
                                  message: `¿Cancelar código para el ticket ${t.ticket}? Volverá al inspector.`,
                                  onConfirm: async () => {
                                    const { success } = await cancelManualCodigo(String(t.ticket), 'tickets');
                                    if (success) { displayToast('Código cancelado'); loadTickets(); }
                                    setConfirmModal(null);
                                  }
                                });
                              }}
                            >
                              X
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        <div>{t.inspector || <span style={{ color: 'var(--text-muted)' }}>Sin asignar</span>}</div>
                        {t.inspector_id && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {t.inspector_id}</div>}
                      </td>
                      <td>
                        <select 
                          className="assign-select" 
                          value=""
                          onChange={(e) => handleAssign(t.id || t.ticket, e.target.value)}
                        >
                          <option value="" disabled>Asignar a...</option>
                          {inspectors.map(insp => (
                            <option key={insp.id} value={insp.id}>{insp.nombre}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'personal' && (
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
              <h3 style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Users size={20} color="var(--primary-color)" /> Directorio de Inspectores</h3>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn-secondary" onClick={async () => {
                  const res = await autoAssignTickets();
                  if(res.success) {
                    displayToast(`¡Carga balanceada! Se asignaron ${res.updated} tickets.`, 'success');
                    loadTickets();
                  } else {
                    displayToast('Error al auto-asignar tickets. Asegúrate de tener la pestaña "Inspectores" en tu Google Sheet.', 'error');
                  }
                }}>
                  <Filter size={16} style={{marginRight: '0.5rem'}}/> Auto-Balancear Carga
                </button>
                <button className="btn-primary" onClick={() => {
                  setEditingInspector(null);
                  setShowAddInspector(!showAddInspector);
                }}>
                  {showAddInspector && !editingInspector ? 'Cancelar' : 'Añadir Inspector'}
                </button>
              </div>
            </div>

            {showAddInspector && (
              <form style={{ marginBottom: '2rem', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }} onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const nombre = formData.get('nombre') as string;
                const rol = formData.get('rol') as string;
                const sector = formData.get('sector') as string;
                const usuario = formData.get('usuario') as string;
                const password = formData.get('password') as string;
                const correo_recuperacion = formData.get('correo_recuperacion') as string;
                
                let success;
                if (editingInspector) {
                  success = await updateInspector(editingInspector.id, { nombre, rol: rol as 'Admin' | 'Inspector', sector, usuario, password, correo_recuperacion });
                } else {
                  success = await createInspector(nombre, sector, usuario, password, rol, correo_recuperacion);
                }
                
                if (success) {
                  setShowAddInspector(false);
                  setEditingInspector(null);
                  loadInspectors();
                } else {
                  displayToast('Error al guardar inspector', 'error');
                }
              }}>
                <h4 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>{editingInspector ? 'Editar Inspector' : 'Nuevo Inspector'}</h4>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="input-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                    <label>Nombre del Inspector</label>
                    <input type="text" name="nombre" required className="input-control" placeholder="Ej. Juan Perez" defaultValue={editingInspector?.nombre || ''} />
                  </div>
                  <div className="input-group" style={{ flex: 1, minWidth: '150px', marginBottom: 0 }}>
                    <label>Rol</label>
                    <select name="rol" className="input-control" defaultValue={editingInspector?.rol || 'Inspector'}>
                      <option value="Inspector">Inspector</option>
                      <option value="Admin">Administrador</option>
                    </select>
                  </div>
                  <div className="input-group" style={{ flex: 1, minWidth: '150px', marginBottom: 0 }}>
                    <label>Sector / Zona</label>
                    <input type="text" name="sector" required className="input-control" placeholder="Ej. Zona Norte" defaultValue={editingInspector?.sector || ''} />
                  </div>
                  <div className="input-group" style={{ flex: 1, minWidth: '150px', marginBottom: 0 }}>
                    <label>Usuario (Login)</label>
                    <input type="text" name="usuario" required className="input-control" placeholder="Ej. juan@claro.com" defaultValue={editingInspector?.usuario || ''} />
                  </div>
                  <div className="input-group" style={{ flex: 1, minWidth: '150px', marginBottom: 0 }}>
                    <label>Contraseña</label>
                    <input type="text" name="password" required className="input-control" placeholder="Contraseña..." defaultValue={editingInspector?.password || ''} />
                  </div>
                  <div className="input-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                    <label>Correo de Recuperación</label>
                    <input type="email" name="correo_recuperacion" className="input-control" placeholder="ejemplo@correo.com" defaultValue={editingInspector?.correo_recuperacion || ''} />
                  </div>
                  <button type="submit" className="btn-primary" style={{ padding: '0.8rem 1.5rem', height: '42px' }}>
                    {editingInspector ? 'Actualizar' : 'Guardar'}
                  </button>
                  {editingInspector && (
                    <>
                     <button type="button" className="btn-secondary" style={{ padding: '0.8rem 1.5rem', height: '42px', borderColor: 'var(--danger-color)', color: 'var(--danger-color)' }} onClick={async (e) => {
                       e.preventDefault();
                       if (e.currentTarget.textContent === '¿Seguro?') {
                         e.currentTarget.textContent = 'Eliminando...';
                         const success = await deleteInspector(editingInspector.id);
                         if (success) {
                           setShowAddInspector(false);
                           setEditingInspector(null);
                           loadInspectors();
                           displayToast('Inspector eliminado', 'success');
                         } else {
                           displayToast('Error al eliminar inspector', 'error');
                           e.currentTarget.textContent = 'Eliminar';
                         }
                       } else {
                         e.currentTarget.textContent = '¿Seguro?';
                         setTimeout(() => {
                            if (e.currentTarget && e.currentTarget.textContent === '¿Seguro?') {
                               e.currentTarget.textContent = 'Eliminar';
                            }
                         }, 3000);
                       }
                     }}>
                       Eliminar
                     </button>
                     <button type="button" className="btn-secondary" style={{ padding: '0.8rem 1.5rem', height: '42px' }} onClick={() => { setShowAddInspector(false); setEditingInspector(null); }}>
                       Cancelar
                     </button>
                    </>
                  )}
                </div>
              </form>
            )}

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Rol</th>
                    <th>ID / Usuario</th>
                    <th>Contraseña</th>
                    <th>Sector / Asignación</th>
                    <th>Recuperación</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingInspectors ? (
                    <tr><td colSpan={9} style={{textAlign: 'center', padding: '2rem'}}><Loader2 className="spinner" /></td></tr>
                  ) : inspectors.length === 0 ? (
                    <tr><td colSpan={9} style={{textAlign: 'center', padding: '2rem', color: 'var(--text-muted)'}}>No hay inspectores registrados. Haz clic en "Añadir Inspector".</td></tr>
                  ) : inspectors.map((insp, idx) => (
                    <tr key={idx}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{insp.nombre}</div>
                      </td>
                      <td><span className={`badge ${insp.rol === 'Admin' ? 'danger' : 'info'}`}>{insp.rol || 'Inspector'}</span></td>
                      <td>
                        <div>ID: {insp.id}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{insp.usuario || 'Sin usuario'}</div>
                      </td>
                      <td>{insp.password ? '••••••••' : '***'}</td>
                      <td>{insp.sector}</td>
                      <td><div style={{ fontSize: '0.8rem' }}>{insp.correo_recuperacion || '-'}</div></td>
                      <td><span className={`badge ${insp.estado === 'Activo' ? 'success' : 'warning'}`}>{insp.estado || 'Activo'}</span></td>
                      <td>
                        <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => {
                          setEditingInspector(insp);
                          setShowAddInspector(true);
                        }}>
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'calidad' && (
          <div className="glass-panel">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <RotateCcw size={20} color="var(--primary-color)" /> Detalle de Averías Repetidas (v1.5)
                </h3>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div className="search-bar" style={{ width: 'auto', minWidth: '240px' }}>
                    <Search size={18} />
                    <input 
                      type="text" 
                      placeholder="Buscar técnico..." 
                      value={calidadSearch}
                      onChange={(e) => setCalidadSearch(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Bulk Assign Section - Now more prominent and organized */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '1rem', 
                flexWrap: 'wrap', 
                background: 'rgba(var(--primary-color-rgb, 218, 41, 28), 0.05)', 
                padding: '1rem', 
                borderRadius: '12px',
                border: '1px dashed var(--primary-color)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={18} color="var(--primary-color)" />
                  <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>Asignación Masiva:</span>
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '300px', flexWrap: 'wrap' }}>
                  <select 
                    className="input-control" 
                    value={calidadSupervisorFilter} 
                    onChange={(e) => setCalidadSupervisorFilter(e.target.value)}
                    style={{ flex: 1, minWidth: '200px', height: '42px', border: '1px solid var(--primary-color)' }}
                  >
                    <option value="">1. Seleccionar Supervisor...</option>
                    {Array.from(new Set(calidadData.map(t => getSupervisor(t)).filter(s => s && s !== '-'))).map(sup => (
                      <option key={sup} value={sup}>{sup}</option>
                    ))}
                  </select>

                  <span style={{color: 'var(--primary-color)', display: 'flex', alignItems: 'center', fontWeight: 'bold'}}>→</span>

                  <select 
                    className="assign-select" 
                    value={bulkAssignCalidadInspector}
                    onChange={(e) => setBulkAssignCalidadInspector(e.target.value)}
                    style={{ flex: 1, minWidth: '200px', height: '42px' }}
                  >
                    <option value="">2. Seleccionar Inspector...</option>
                    {inspectors.map(insp => (
                      <option key={insp.id} value={insp.id}>{insp.nombre}</option>
                    ))}
                  </select>
                  
                  <button 
                    className="btn-primary" 
                    style={{ padding: '0 1.5rem', height: '42px' }}
                    disabled={!bulkAssignCalidadInspector || !calidadSupervisorFilter}
                    onClick={async () => {
                      const inspector = inspectors.find(i => String(i.id) === String(bulkAssignCalidadInspector));
                      if (inspector && calidadSupervisorFilter) {
                        try {
                          const updated = await assignCalidadBySupervisor(calidadSupervisorFilter, inspector.id, inspector.nombre);
                          displayToast(`Se asignaron ${updated} técnicos a ${inspector.nombre}`, 'success');
                          loadCalidad();
                        } catch (error: any) {
                          displayToast(error.message || 'Error en la asignación masiva', 'error');
                        }
                      }
                    }}
                  >
                    Asignar Masivo
                  </button>
                </div>
                {!calidadSupervisorFilter && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--primary-color)', fontStyle: 'italic' }}>
                    * Selecciona un supervisor primero para habilitar la asignación masiva.
                  </span>
                )}
              </div>
            </div>
            
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    {CALIDAD_COLUMNS.map(col => (
                      <th key={col.key}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col.label}</span>
                          <div className="search-bar" style={{ margin: 0, padding: '0.25rem 0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', height: '28px' }}>
                            <Search size={12} />
                            <input 
                              type="text" 
                              placeholder="Filtrar..." 
                              value={columnFilters[col.key] || ''} 
                              onChange={(e) => setColumnFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                              style={{ fontSize: '0.75rem' }}
                            />
                          </div>
                        </div>
                      </th>
                    ))}
                    <th>Inspector Asignado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingCalidad ? (
                    <tr><td colSpan={8} style={{textAlign: 'center', padding: '2rem'}}><Loader2 className="spinner" /></td></tr>
                  ) : calidadData.length === 0 ? (
                    <tr><td colSpan={10} style={{textAlign: 'center', padding: '2rem', color: 'var(--text-muted)'}}>No hay datos disponibles.</td></tr>
                  ) : calidadData
                    .filter(c => {
                      const term = calidadSearch.toLowerCase();
                      const sup = getSupervisor(c);
                      // Usar clave normalizada 'tech' directamente
                      const tech = String(c.tech || c['Asignado A'] || '').trim();
                      
                      // Sin término de búsqueda → mostrar todo (solo filtrar supervisor si está activo)
                      const matchesSearch = !term || 
                        tech.toLowerCase().includes(term) ||
                        String(c.ticket || '').toLowerCase().includes(term) ||
                        String(c.tech_id || '').toLowerCase().includes(term) ||
                        String(c.sector || '').toLowerCase().includes(term) ||
                        String(c.status || '').toLowerCase().includes(term);

                      const matchesSupervisor = calidadSupervisorFilter === '' || sup === calidadSupervisorFilter;

                      // Filtros por columna
                      const matchesColumns = Object.entries(columnFilters).every(([key, val]) => {
                        if (!val) return true;
                        const cellVal = String(c[key] || '').toLowerCase();
                        return cellVal.includes(val.toLowerCase());
                      });
                      
                      return matchesSearch && matchesSupervisor && matchesColumns;
                    })

                    .map((row, idx) => {
                      const techKey = Object.keys(row).find(k => ['nombre', 'técnico', 'tecnico', 'nombre del técnico', 'nombre del tecnico'].includes(k.toLowerCase().trim())) || 'Nombre';
                      const technician = row[techKey];
                      
                      return (
                        <tr key={idx}>
                          {CALIDAD_COLUMNS.map((col, i) => {
                            // Mapeo ultra-resiliente para asegurar que se muestre el dato aunque el backend no esté actualizado
                            let val = row[col.key];
                            if (val === undefined || val === null) val = row[col.label];
                            
                            // Fallbacks adicionales por si acaso
                            if (!val) {
                              if (col.key === 'tech') val = row.tech || row['Asignado A'];
                              if (col.key === 'supervisor') val = row.supervisor || row['Supervisor'];
                            }
                            
                            val = (val !== undefined && val !== null) ? val : '-';
                            return (
                              <td key={i}>
                                {String(val).includes('%') ? (
                                  (() => {
                                    const numVal = parseFloat(String(val || '0').replace('%', ''));
                                    const color = numVal < 7 ? '#10b981' : numVal < 15 ? '#f59e0b' : '#ef4444';
                                    return (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden', minWidth: '60px' }}>
                                          <div style={{ 
                                            height: '100%', 
                                            background: color, 
                                            width: String(val || '0%').includes('%') ? String(val) : `${numVal}%` 
                                          }} />
                                        </div>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color }}>{val}</span>
                                      </div>
                                    );
                                  })()
                                ) : (
                                  <span style={{ color: val === '-' ? 'var(--text-muted)' : 'inherit' }}>
                                    {val}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          <td>
                            {row['Inspector'] ? (
                              <span className="badge info">{row['Inspector']}</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                {row.tech_id ? `Tarjeta: ${row.tech_id}` : '-'}
                              </span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <select 
                                className="assign-select" 
                                style={{ padding: '0.25rem 1.5rem 0.25rem 0.5rem', fontSize: '0.7rem' }}
                                value=""
                                onChange={async (e) => {
                                  const inspectorId = e.target.value;
                                  const inspector = inspectors.find(i => String(i.id) === String(inspectorId));
                                  if (inspector && technician) {
                                    try {
                                      const success = await assignCalidadIndividual(String(technician), inspector.id, inspector.nombre);
                                      if (success) {
                                        displayToast(`Técnico asignado a ${inspector.nombre}`, 'success');
                                        loadCalidad();
                                      }
                                    } catch (error: any) {
                                      displayToast(error.message || 'Error al asignar técnico', 'error');
                                    }
                                  }
                                }}
                              >
                                <option value="">Asignar...</option>
                                {inspectors.map(insp => (
                                  <option key={insp.id} value={insp.id}>{insp.nombre}</option>
                                ))}
                              </select>

                              {(row['codigo_aplicado'] || row['Código Aplicado']) && (
                                <button 
                                  className="btn-danger" 
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', width: '100%' }}
                                  onClick={() => {
                                    const ticketId = row.ticket || row.IDD || row.id || row['ID TICKET'] || row['TRABAJO'];
                                    setConfirmModal({
                                      isOpen: true,
                                      message: `¿Estás seguro de cancelar el código para el ticket ${ticketId}? Esto lo devolverá al inspector.`,
                                      onConfirm: async () => {
                                        try {
                                          const { success, message } = await cancelManualCodigo(String(ticketId), 'calidad');
                                          if (success) {
                                            displayToast('Código cancelado correctamente', 'success');
                                            loadCalidad();
                                          } else {
                                            displayToast(message || 'Error al cancelar el código', 'error');
                                          }
                                        } catch (error) {
                                          displayToast('Error de conexión', 'error');
                                        }
                                        setConfirmModal(null);
                                      }
                                    });
                                  }}
                                >
                                  Cancelar Código
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="glass-panel" style={{ maxWidth: '600px' }}>
            <h3 style={{ color: 'var(--text-main)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings size={20} color="var(--primary-color)" /> Configuración de Super Administrador
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
              Modifica tus credenciales de acceso y configura tu correo de recuperación.
            </p>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              setSavingConfig(true);
              const formData = new FormData(e.currentTarget);
              const username = formData.get('username') as string;
              const password = formData.get('password') as string;
              const recovery_email = formData.get('recovery_email') as string;
              
              const success = await updateAdminProfile(username, password, recovery_email);
              if (success) {
                displayToast('Perfil actualizado correctamente', 'success');
                loadAdminConfig();
              } else {
                displayToast('Error al actualizar perfil', 'error');
              }
              setSavingConfig(false);
            }}>
              <div className="input-group">
                <label>Nombre de Usuario Admin</label>
                <input type="text" name="username" required className="input-control" defaultValue={adminConfig.admin_username} />
              </div>
              <div className="input-group">
                <label>Nueva Contraseña</label>
                <input type="text" name="password" required className="input-control" defaultValue={adminConfig.admin_password} />
              </div>
              <div className="input-group">
                <label>Correo de Recuperación</label>
                <input type="email" name="recovery_email" required className="input-control" defaultValue={adminConfig.admin_recovery_email} placeholder="ejemplo@claro.com" />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Este correo se usará si olvidas tu contraseña.</p>
              </div>
              
              <button type="submit" className="btn-primary" style={{ marginTop: '1rem', width: '100%', justifyContent: 'center', padding: '1rem' }} disabled={savingConfig}>
                {savingConfig ? <Loader2 className="spinner" size={20} /> : 'Guardar Cambios de Perfil'}
              </button>
            </form>
          </div>
        )}
        {activeTab === 'inspecciones' && (
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h3 style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <CheckCircle2 size={20} color="var(--primary-color)" /> Panel de Inspecciones Unificado
              </h3>
              <div className="search-bar" style={{ width: 'auto', minWidth: '400px' }}>
                <Search size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar por Ticket, Orden, Técnico o Supervisor..." 
                  value={inspeccionesSearch}
                  onChange={(e) => setInspeccionesSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Origen</th>
                    <th>ID / Ticket</th>
                    <th>Técnico</th>
                    <th>Supervisor</th>
                    <th>Sector</th>
                    <th>Estado / Fecha</th>
                    <th>Código Aplicado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const mixed: any[] = [];
                    
                    // 1. Tickets Inspeccionados
                    tickets.filter(t => t.status === 'Inspeccionado' || t.status === 'Aprobado' || t.status === 'Rechazado').forEach(t => {
                      mixed.push({ ...t, _origin: 'Ticket', _id: t.ticket, _tech: t.tech || t.tech_id, _sup: getSupervisor(t), _sector: t.sector, _date: t.fecha || t.oe_vencimiento || 'N/A', _color: '#3b82f6', _code: t.codigo_aplicado });
                    });
                    
                    // 2. Órdenes Inspeccionadas
                    ordenes.filter(o => o.status === 'Inspeccionado' || o.status === 'Completado' || o.status === 'Aprobado').forEach(o => {
                      mixed.push({ ...o, _origin: 'Orden', _id: o.ticket || o.orden_servicio, _tech: o.tech || (o as any).tech_id, _sup: o.supervisor, _sector: o.sector, _date: o.fecha || (o as any).oe_vencimiento || 'N/A', _color: '#ef4444', _code: o.codigo_aplicado });
                    });

                    // 3. Calidad Inspeccionada (Repetidas)
                    calidadData.filter(c => c.status === 'Inspeccionado' || c.status === 'Aprobado').forEach(c => {
                      mixed.push({ ...c, _origin: 'Repetida', _id: c.ticket, _tech: c.tech || c.tech_id, _sup: c.supervisor || getSupervisor(c), _sector: c.sector, _date: c.fecha || (c as any).oe_vencimiento || 'N/A', _color: '#f59e0b', _code: c.codigo_aplicado });
                    });

                    const term = inspeccionesSearch.toLowerCase();
                    const filtered = mixed.filter(item => 
                      String(item._id).toLowerCase().includes(term) ||
                      String(item._tech).toLowerCase().includes(term) ||
                      String(item._sup).toLowerCase().includes(term) ||
                      String(item._sector).toLowerCase().includes(term)
                    );

                    if (filtered.length === 0) return <tr><td colSpan={7} style={{textAlign: 'center', padding: '2rem'}}>No se encontraron resultados</td></tr>;

                    return filtered.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <span style={{ 
                            background: item._color + '20', 
                            color: item._color, 
                            padding: '0.25rem 0.6rem', 
                            borderRadius: '6px', 
                            fontSize: '0.7rem', 
                            fontWeight: 800,
                            textTransform: 'uppercase'
                          }}>
                            {item._origin}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item._id}</td>
                        <td>{item._tech}</td>
                        <td>{item._sup}</td>
                        <td>{item._sector}</td>
                        <td>
                          <span className={`badge ${item._date === 'Aprobado' || item._origin === 'Orden' ? 'success' : 'warning'}`}>
                            {item._date}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 700, color: '#10b981' }}>{item._code || '-'}</span>
                            {item._code && (
                              <button 
                                className="btn-danger" 
                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem' }}
                                onClick={() => {
                                  setConfirmModal({
                                    isOpen: true,
                                    message: `¿Cancelar código para ${item._id}? Volverá al inspector.`,
                                    onConfirm: async () => {
                                      const type = item._origin === 'Ticket' ? 'tickets' : item._origin === 'Orden' ? 'ordenes' : 'calidad';
                                      const { success } = await cancelManualCodigo(String(item._id), type);
                                      if (success) { 
                                        displayToast('Código cancelado'); 
                                        loadTickets(); loadOrdenes(); loadCalidad();
                                      }
                                      setConfirmModal(null);
                                    }
                                  });
                                }}
                              >
                                X
                              </button>
                            )}
                          </div>
                        </td>
                        <td>
                          <button className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }} onClick={() => {
                            if (item._origin === 'Ticket') setActiveTab('tickets');
                            else if (item._origin === 'Orden') setActiveTab('ordenes');
                            else setActiveTab('calidad');
                          }}>
                            Ver Detalle
                          </button>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>


      {/* Toast Notification */}
      {showToast && (
        <div className={`toast-notification ${toastType}`}>
          {toastType === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <span>{toastMessage}</span>
        </div>
      )}

      {confirmModal?.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel" style={{ width: '400px', background: 'var(--surface-color)', padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--text-main)' }}>
              <AlertTriangle size={24} color="var(--warning-color)" />
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Confirmar Acción</h3>
            </div>
            <p style={{ marginBottom: '2rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{confirmModal.message}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn-secondary" onClick={() => setConfirmModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={confirmModal.onConfirm}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
