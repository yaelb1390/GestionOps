import { useState, useEffect } from 'react';
import { 
  LogOut, Search, Filter, AlertTriangle, CheckCircle2, Loader2,
  Sun, Moon, Settings, RotateCcw, AlertCircle,
  LayoutDashboard, FileText, Users, Package
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { fetchTickets, type Ticket, fetchInspectors, createInspector, updateInspector, deleteInspector, autoAssignTickets, type Inspector, fetchConfig, updateAdminProfile, fetchCalidad, fetchRazones, assignCalidadBySupervisor, assignCalidadIndividual, fetchOrdenes, type Orden, cancelManualCodigo, assignOrdenesBySupervisor, assignOrdenesIndividual, assignRazonesBySupervisor, assignRazonesIndividual } from '../services/api';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);


  // Estados de Inspectores
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [loadingInspectors, setLoadingInspectors] = useState(false);
  const [calidadData, setCalidadData] = useState<any[]>([]);
  const [loadingCalidad, setLoadingCalidad] = useState(false);
  const [calidadSearch, setCalidadSearch] = useState('');
  const [calidadSupervisorFilter, setCalidadSupervisorFilter] = useState('');
  
  // Columnas fijas para el tablero de Calidad (Averías Repetidas)
  const CALIDAD_COLUMNS = [
    { label: 'CASO ACTUAL', key: 'ticket' },
    { label: 'TÉCNICO ACTUAL', key: 'tech' },
    { label: 'SUPERVISOR ACTUAL', key: 'supervisor' },
    { label: 'WORK NAME ACTUAL', key: 'work_name' },
    { label: 'CASO REPETIDO', key: 'caso_repetido' },
    { label: 'TÉCNICO CASO REPETIDO', key: 'tecnico_repetido' },
    { label: 'RESPUESTA CASO REPETIDO', key: 'respuesta_repetido' },
    { label: 'FECHA CIERRE REPETIDO', key: 'fecha_repetido' },
    { label: 'ESTADO', key: 'status' }
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
  const [razonesSearch, setRazonesSearch] = useState('');
  const [razonesSupervisorFilter, setRazonesSupervisorFilter] = useState('');
  const [bulkAssignRazonesInspector, setBulkAssignRazonesInspector] = useState('');
  const [theme, setTheme] = useState(document.documentElement.getAttribute('data-theme') || 'light');

  const [ordenesPage, setOrdenesPage] = useState(1);
  const [calidadPage, setCalidadPage] = useState(1);
  const [razonesPage, setRazonesPage] = useState(1);
  const itemsPerPage = 20;

  const Pagination = ({ currentPage, totalPages, onPageChange }: { currentPage: number, totalPages: number, onPageChange: (p: number) => void }) => {
    if (totalPages <= 1) return null;
    const pages = [];
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
        <button 
          type="button"
          onClick={() => onPageChange(currentPage - 1)} 
          disabled={currentPage === 1}
          className="btn-secondary"
          style={{ padding: '0.4rem 0.8rem', opacity: currentPage === 1 ? 0.5 : 1 }}
        >
          Retroceder
        </button>
        {startPage > 1 && <span style={{ color: 'var(--text-muted)' }}>...</span>}
        {pages.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={currentPage === p ? "btn-primary" : "btn-secondary"}
            style={{ padding: '0.4rem 0.8rem', minWidth: '36px' }}
          >
            {p}
          </button>
        ))}
        {endPage < totalPages && <span style={{ color: 'var(--text-muted)' }}>...</span>}
        <button 
          type="button"
          onClick={() => onPageChange(currentPage + 1)} 
          disabled={currentPage === totalPages}
          className="btn-secondary"
          style={{ padding: '0.4rem 0.8rem', opacity: currentPage === totalPages ? 0.5 : 1 }}
        >
          Avanzar
        </button>
      </div>
    );
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  // Convierte cualquier fecha a formato "dd-MM-yyyy H:mm" en hora RD (GMT-4)
  const formatRDDate = (raw: any): string => {
    if (!raw || raw === 'N/A' || String(raw).trim() === '') return '—';
    const s = String(raw).trim();
    const toRDParts = (d: Date) => {
      const opts: Intl.DateTimeFormatOptions = {
        timeZone: 'America/Santo_Domingo',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false
      };
      const parts = new Intl.DateTimeFormat('es-DO', opts).formatToParts(d);
      const get = (type: string) => parts.find(p => p.type === type)?.value || '';
      return `${get('day')}-${get('month')}-${get('year')} ${get('hour')}:${get('minute')}`;
    };
    // 1. Formato ISO: 2026-05-17T01:30:32.000Z
    if (s.includes('T') && (s.includes('Z') || s.includes('+'))) {
      try { return toRDParts(new Date(s)); } catch { /* continuar */ }
    }
    // 2. Formato texto "dd/MM/yyyy HH:mm:ss" → convertir slashes y recortar segundos
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
      const sp = s.split(' ');
      const datePart = (sp[0] || '').replace(/\//g, '-');
      const timePart = (sp[1] || '').split(':').slice(0, 2).join(':');
      return `${datePart} ${timePart}`.trim();
    }
    // 3. Cualquier otro formato ("Apr 24, 2026", "May 16 2026", etc.) → dejar que JS parsee
    try {
      const d = new Date(s);
      if (!isNaN(d.getTime())) return toRDParts(d);
    } catch { /* continuar */ }
    // 4. Fallback: mostrar tal cual si no se pudo parsear
    return s;
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
    let interval: any;
    if (activeTab === 'dashboard') {
      const refresh = () => {
        loadTickets();
        loadCalidad();
        loadOrdenes();
        loadRazones();
      };
      refresh();
      interval = setInterval(refresh, 30000); // 30 seconds
    }

    if (activeTab === 'ordenes') loadOrdenes();
    if (activeTab === 'calidad') loadCalidad();
    if (activeTab === 'personal') loadInspectors();
    if (activeTab === 'razones') loadRazones();

    return () => {
      if (interval) clearInterval(interval);
    };
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
    if (!normalized.inspector) normalized.inspector = getVal(['inspector', 'gestor asignado', 'nombre inspector', 'inspector_asignado', 'inspector_nombre']);
    if (!normalized.codigo_aplicado) normalized.codigo_aplicado = getVal(['código aplicado', 'codigo_aplicado', 'codigo aplicado', 'codigo', 'código', 'estado codigo']);
    if (!normalized.fecha_inspeccion) normalized.fecha_inspeccion = getVal(['fecha inspección', 'fecha inspeccion', 'fecha_inspeccion']);
    if (!normalized.fecha) normalized.fecha = getVal(['fecha', 'fecha_repetido', 'oe vencimiento', 'vence', 'oe_vencimiento']);
    
    // Campos de Calidad / Avería Repetida
    if (type === 'calidad') {
      if (!normalized.work_name) normalized.work_name = getVal(['work name actual', 'work_name_actual', 'work name', 'trabajo']);
      if (!normalized.caso_repetido) normalized.caso_repetido = getVal(['caso repetido', 'caso_repetido', 'ticket_repetido', 'trabajo repetido']);
      if (!normalized.tecnico_repetido) normalized.tecnico_repetido = getVal(['tecnico caso repetido', 'tecnico_repetido', 'tecnico repetido']);
      if (!normalized.respuesta_repetido) normalized.respuesta_repetido = getVal(['respuesta caso repetido', 'respuesta_repetido', 'respuesta repetido']);
      if (!normalized.fecha_repetido) normalized.fecha_repetido = getVal(['fecha cierre repetido', 'fecha_repetido', 'fecha repetido']);
    }
    
    if (type === 'orden') {
       // El ID real suele estar en 'orden_externa_id' o 'orden_servicio'
       const realId = getVal(['orden_externa_id', 'orden externa', 'orden_servicio', 'orden servicio', 'os', 'id orden']);
       
       if (realId) {
         normalized.orden_servicio = realId;
         // Si 'ticket' (columna Trabajo) es una descripción larga, lo movemos y usamos realId
         if (normalized.ticket && String(normalized.ticket).length > 15) {
           if (!normalized.descripcion_orden) normalized.descripcion_orden = normalized.ticket;
           normalized.ticket = realId;
         }
       }

       if (!normalized.descripcion_orden) normalized.descripcion_orden = getVal(['descripcion_orden', 'descripcion', 'tipo servicio', 'tipo_servicio', 'tipo trabajo']);
       if (!normalized.cliente) normalized.cliente = getVal(['cliente', 'subscriber']);
       if (!normalized.fecha) normalized.fecha = getVal(['fecha', 'oe vencimiento', 'vence', 'oe_vencimiento']);
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
    setRazones(data.map(item => ensureKeys(item, 'calidad'))); // Razones follows similar structure to Calidad/Tickets
    setLoadingRazones(false);
  };

  const loadOrdenes = async () => {
    setLoadingOrdenes(true);
    const data = await fetchOrdenes();
    setOrdenes(data.map(item => ensureKeys(item, 'orden')));
    setLoadingOrdenes(false);
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

  // Computed Arrays for Pagination
  const filteredOrdenes = ordenes.filter(o => {
    const term = ordenesSearch.toLowerCase();
    const matchesGlobal = !term || [
      o.orden_servicio, o.orden_externa_id, o.cliente, o.supervisor, o.tech, o.tech_id, o.ticket, o.sector, o.descripcion_orden
    ].some(v => String(v || '').toLowerCase().includes(term));
    const matchesSupervisor = ordenesSupervisorFilter === '' || 
      String(o.supervisor || '').toLowerCase() === ordenesSupervisorFilter.toLowerCase();
    const matchesColumns = Object.entries(ordenesColumnFilters).every(([key, val]) => {
      if (!val) return true;
      const term = val.toLowerCase();
      switch (key) {
        case 'Trabajo': return String(o.ticket || (o as any).trabajo || '').toLowerCase().includes(term);
        case 'Orden Externa': return String(o.descripcion_orden || (o as any)['orden externa'] || '').toLowerCase().includes(term);
        case 'Cliente': return String(o.cliente || '').toLowerCase().includes(term);
        case 'OE Vencimiento': return String(o.fecha || (o as any)['oe vencimiento'] || '').toLowerCase().includes(term);
        case 'Prioridad': return String(o.priority || (o as any).prioridad || '').toLowerCase().includes(term);
        case 'Asignado A': return String(o.tech || (o as any).tech_name || '').toLowerCase().includes(term);
        case 'Supervisor': return String(o.supervisor || '').toLowerCase().includes(term);
        case 'Estado': return String(o.status || '').toLowerCase().includes(term);
        case 'Tecnología': return String(o.tecnologia || (o as any)['tipo red'] || '').toLowerCase().includes(term);
        case 'Sector': return String(o.sector || (o as any).ciudad || '').toLowerCase().includes(term);
        case 'Terminal': return String(o.terminal || '').toLowerCase().includes(term);
        default: return String((o as any)[key] || '').toLowerCase().includes(term);
      }
    });
    return matchesGlobal && matchesSupervisor && matchesColumns;
  });
  const totalOrdenesPages = Math.ceil(filteredOrdenes.length / itemsPerPage);
  const currentPaginatedOrdenes = filteredOrdenes.slice((ordenesPage - 1) * itemsPerPage, ordenesPage * itemsPerPage);

  const filteredCalidad = calidadData.filter(c => {
    const term = calidadSearch.toLowerCase();
    const sup = getSupervisor(c);
    const tech = String(c.tech || c['Asignado A'] || '').trim();
    const matchesSearch = !term || [
      tech, c.ticket, c.tech_id, c.sector, c.status, sup, c.cliente, c.work_name
    ].some(v => String(v || '').toLowerCase().includes(term));
    const matchesSupervisor = calidadSupervisorFilter === '' || sup === calidadSupervisorFilter;
    const matchesColumns = Object.entries(columnFilters).every(([key, val]) => {
      if (!val) return true;
      const cellVal = String(c[key] || '').toLowerCase();
      return cellVal.includes(val.toLowerCase());
    });
    return matchesSearch && matchesSupervisor && matchesColumns;
  });
  const totalCalidadPages = Math.ceil(filteredCalidad.length / itemsPerPage);
  const currentPaginatedCalidad = filteredCalidad.slice((calidadPage - 1) * itemsPerPage, calidadPage * itemsPerPage);

  const filteredRazones = _razones.filter(row => {
    const term = razonesSearch.toLowerCase();
    const matchesSearch = !term || [
      row.ticket, row.id, row['ID TICKET'], row['TRABAJO'],
      row.tecnico, row.tech, row['Asignado A'],
      row.motivo, row.razon, row['Motivo'],
      row.supervisor, row['Nombre del Supervisor'],
      row.sector, row['Localidad']
    ].some(v => String(v || '').toLowerCase().includes(term));
    return matchesSearch;
  });
  const totalRazonesPages = Math.ceil(filteredRazones.length / itemsPerPage);
  const currentPaginatedRazones = filteredRazones.slice((razonesPage - 1) * itemsPerPage, razonesPage * itemsPerPage);

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '1.5rem 0' }}>
          <img src="/logo-gestores.png" alt="Gestores OPS Logo" style={{ width: '85%', maxWidth: '180px', height: 'auto', objectFit: 'contain', transform: 'scale(1.2)', filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.2))' }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.5px', marginTop: '0.2rem' }}>GESTIÓN OPS DE CAMPO</span>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <LayoutDashboard size={20} /> Dashboard
          </button>

          <button className={`nav-item ${activeTab === 'ordenes' ? 'active' : ''}`} onClick={() => setActiveTab('ordenes')}>
            <Package size={20} /> Ordenes <span className="nav-badge">{ordenes.length}</span>
          </button>
          <button className={`nav-item ${activeTab === 'calidad' ? 'active' : ''}`} onClick={() => setActiveTab('calidad')}>
            <RotateCcw size={20} /> Averías Repetidas <span className="nav-badge">{calidadData.length}</span>
          </button>
          <button className={`nav-item ${activeTab === 'inspecciones' ? 'active' : ''}`} onClick={() => setActiveTab('inspecciones')}>
            <CheckCircle2 size={20} /> Inspecciones <span className="nav-badge">{tickets.filter(t => t.status === 'Inspeccionado' || t.status === 'Aprobado' || t.status === 'Rechazado' || !!t.codigo_aplicado || !!t['Código Aplicado']).length + ordenes.filter(o => o.status === 'Completado' || o.status === 'Inspeccionado' || o.status === 'Aprobado' || !!o.codigo_aplicado || !!(o as any)['Código Aplicado']).length + calidadData.filter(c => c.status === 'Inspeccionado' || c.status === 'Aprobado' || !!c.codigo_aplicado || !!c['Código Aplicado']).length + _razones.filter(r => !!(r.codigo_aplicado || r['Código Aplicado'])).length}</span>
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
               activeTab === 'ordenes' ? <><Package size={28} color="var(--primary-color)" /> Órdenes de Trabajo</> : 
               activeTab === 'inspecciones' ? <><CheckCircle2 size={28} color="var(--primary-color)" /> Historial de Inspecciones Mixtas</> :
               activeTab === 'personal' ? <><Users size={28} color="var(--primary-color)" /> Directorio de Personal ({inspectors.length})</> :
               activeTab === 'calidad' ? <> <RotateCcw size={28} color="var(--primary-color)" /> Averías Repetidas ({calidadData.length})</> :
               activeTab === 'razones' ? <> <AlertCircle size={28} color="var(--primary-color)" /> Código Razón Cliente ({_razones.length})</> :
               <><Settings size={28} color="var(--primary-color)" /> Configuración de Perfil</>}
            </h1>
            <p className="subtitle">Centro de control de averías de fibra óptica</p>
          </div>

        </div>

        {activeTab === 'dashboard' && (
          <>
            <div className="kpi-grid">
              {/* Card 1 */}
              <div className="glass-panel kpi-card" style={{ cursor: 'pointer', transition: 'transform 0.2s', position: 'relative' }} onClick={() => { setInspeccionesSearch('Ticket'); setActiveTab('inspecciones'); }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                <div className="kpi-icon blue" style={{ background: 'rgba(59, 130, 246, 0.1)' }}><FileText color="#3b82f6" /></div>
                <div className="kpi-info" style={{ width: '100%' }}>
                  <h3 style={{ fontSize: '0.9rem', marginBottom: '0.2rem' }}>Tickets Inspeccionados</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                    <p style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>{tickets.filter(t => t.status === 'Aprobado' || t.status === 'Inspeccionado' || t.status === 'Rechazado' || !!t.codigo_aplicado || !!t['Código Aplicado']).length}</p>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, paddingBottom: '0.3rem' }}>de {tickets.length}</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--bg-color)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <div style={{ width: `${(tickets.filter(t => t.status === 'Aprobado' || t.status === 'Inspeccionado' || t.status === 'Rechazado' || !!t.codigo_aplicado || !!t['Código Aplicado']).length / (tickets.length || 1)) * 100}%`, height: '100%', background: '#3b82f6', transition: 'width 1s ease-out' }}></div>
                  </div>
                </div>
              </div>

              {/* Card 2 */}
              <div className="glass-panel kpi-card" style={{ cursor: 'pointer', transition: 'transform 0.2s', position: 'relative' }} onClick={() => { setInspeccionesSearch('Orden'); setActiveTab('inspecciones'); }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                <div className="kpi-icon red" style={{ background: 'rgba(239, 68, 68, 0.1)' }}><Package color="#ef4444" /></div>
                <div className="kpi-info" style={{ width: '100%' }}>
                  <h3 style={{ fontSize: '0.9rem', marginBottom: '0.2rem' }}>Órdenes Inspeccionadas</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                    <p style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>{ordenes.filter(o => o.status === 'Completado' || o.status === 'Inspeccionado' || o.status === 'Aprobado' || !!o.codigo_aplicado || !!(o as any)['Código Aplicado']).length}</p>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, paddingBottom: '0.3rem' }}>de {ordenes.length}</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--bg-color)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <div style={{ width: `${(ordenes.filter(o => o.status === 'Completado' || o.status === 'Inspeccionado' || o.status === 'Aprobado' || !!o.codigo_aplicado || !!(o as any)['Código Aplicado']).length / (ordenes.length || 1)) * 100}%`, height: '100%', background: '#ef4444', transition: 'width 1s ease-out' }}></div>
                  </div>
                </div>
              </div>

              {/* Card 3 */}
              <div className="glass-panel kpi-card" style={{ cursor: 'pointer', transition: 'transform 0.2s', position: 'relative' }} onClick={() => { setInspeccionesSearch('Repetida'); setActiveTab('inspecciones'); }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                <div className="kpi-icon amber" style={{ background: 'rgba(245, 158, 11, 0.1)' }}><RotateCcw color="#f59e0b" /></div>
                <div className="kpi-info" style={{ width: '100%' }}>
                  <h3 style={{ fontSize: '0.9rem', marginBottom: '0.2rem' }}>Averías Repetidas Insp.</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                    <p style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>{calidadData.filter(c => c.status === 'Inspeccionado' || c.status === 'Aprobado' || !!c.codigo_aplicado || !!c['Código Aplicado']).length}</p>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, paddingBottom: '0.3rem' }}>de {calidadData.length}</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--bg-color)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <div style={{ width: `${(calidadData.filter(c => c.status === 'Inspeccionado' || c.status === 'Aprobado' || !!c.codigo_aplicado || !!c['Código Aplicado']).length / (calidadData.length || 1)) * 100}%`, height: '100%', background: '#f59e0b', transition: 'width 1s ease-out' }}></div>
                  </div>

                </div>
              </div>

              {/* Card 4 */}
              <div className="glass-panel kpi-card" style={{ cursor: 'pointer', transition: 'transform 0.2s', position: 'relative' }} onClick={() => { setInspeccionesSearch('Razon'); setActiveTab('inspecciones'); }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                <div className="kpi-icon" style={{ background: 'rgba(236, 72, 153, 0.1)' }}><AlertCircle color="#ec4899" /></div>
                <div className="kpi-info" style={{ width: '100%' }}>
                  <h3 style={{ fontSize: '0.9rem', marginBottom: '0.2rem' }}>Razones Inspeccionadas</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                    <p style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>{_razones.filter(r => !!(r.codigo_aplicado || r['Código Aplicado'])).length}</p>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, paddingBottom: '0.3rem' }}>de {_razones.length}</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--bg-color)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <div style={{ width: `${(_razones.filter(r => !!(r.codigo_aplicado || r['Código Aplicado'])).length / (_razones.length || 1)) * 100}%`, height: '100%', background: '#ec4899', transition: 'width 1s ease-out' }}></div>
                  </div>
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
                      <th>Gestor</th>
                      <th>Supervisor</th>
                      <th>Estado</th>
                      <th>Fecha Registro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={5} style={{textAlign: 'center', padding: '2rem'}}><Loader2 className="spinner" /></td></tr>
                    ) : (() => {
                      const inspected: any[] = [];
                      
                      tickets.filter(t => t.status === 'Inspeccionado' || t.status === 'Aprobado' || t.status === 'Rechazado' || !!t.codigo_aplicado || !!t['Código Aplicado']).forEach(t => {
                        inspected.push({ ...t, _type: 'Ticket', _id: t.ticket, _gestor: t.inspector || t.inspector_id, _fecha: t.fecha_inspeccion || t['fecha_inspeccion'] || t['Fecha Inspección'] || '' });
                      });
                      
                      ordenes.filter(o => o.status === 'Inspeccionado' || o.status === 'Completado' || o.status === 'Aprobado' || !!o.codigo_aplicado || !!(o as any)['Código Aplicado']).forEach(o => {
                        inspected.push({ ...o, _type: 'Orden', _id: o.ticket || o.orden_servicio, _gestor: o.gestor || o.inspector, _fecha: (o as any).fecha_inspeccion || (o as any)['Fecha Inspección'] || '' });
                      });

                      calidadData.filter(c => c.status === 'Inspeccionado' || c.status === 'Aprobado' || !!c.codigo_aplicado || !!c['Código Aplicado']).forEach(c => {
                        inspected.push({ ...c, _type: 'Calidad', _id: c.ticket, _gestor: c.inspector || c.inspector_id, _fecha: c.fecha_inspeccion || c['fecha_inspeccion'] || c['Fecha Inspección'] || '' });
                      });

                      // Sort by recent (assuming newest are at the end of the lists, so we reverse or use slice)
                      // If we have a timestamp, we should use it. For now, we take the last 5.
                      const latest = inspected.slice(-5).reverse();

                      if (latest.length === 0) return <tr><td colSpan={6} style={{textAlign: 'center', padding: '2rem'}}>No se han realizado inspecciones aún</td></tr>;

                      return latest.map((t, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 500, color: 'var(--text-main)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span>{t._id}</span>
                              <small style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{t._type}</small>
                            </div>
                          </td>
                          <td>{t.tech || t.tech_id || '-'}</td>
                          <td>{t._gestor || 'Sin asignar'}</td>
                          <td>{getSupervisor(t)}</td>
                          <td>
                            <span className="badge success">
                              {t.codigo_aplicado || t['Código Aplicado'] || 'Completado'}
                            </span>
                          </td>
                          <td>{formatRDDate(t._fecha)}</td>
                        </tr>
                      ));
                    })()}
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
                      onChange={(e) => { setOrdenesSearch(e.target.value); setOrdenesPage(1); }}
                    />
                  </div>
                </div>
              </div>

              {/* Panel Asignación Masiva - misma arquitectura que Calidad */}
              <div className="bulk-assign-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={18} color="var(--primary-color)" />
                  <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>Asignación Masiva:</span>
                </div>
                
                <div className="bulk-assign-controls">
                  <select 
                    className="input-control" 
                    value={ordenesSupervisorFilter} 
                    onChange={(e) => { setOrdenesSupervisorFilter(e.target.value); setOrdenesPage(1); }}
                    style={{ flex: 1, minWidth: '200px', height: '42px', border: '1px solid var(--primary-color)' }}
                  >
                    <option value="">1. Seleccionar Supervisor...</option>
                    {Array.from(new Set(ordenes.map(o => String(o.supervisor || '')).filter(s => s && s !== '-'))).map(sup => (
                      <option key={sup} value={sup}>{sup}</option>
                    ))}
                  </select>

                  <span className="bulk-assign-arrow">→</span>

                  <select 
                    className="assign-select" 
                    value={bulkAssignOrdenesInspector}
                    onChange={(e) => setBulkAssignOrdenesInspector(e.target.value)}
                    style={{ flex: 1, minWidth: '200px', height: '42px' }}
                  >
                    <option value="">2. Seleccionar Gestor...</option>
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
                              onChange={(e) => { setOrdenesColumnFilters(prev => ({ ...prev, [header]: e.target.value })); setOrdenesPage(1); }}
                              style={{ fontSize: '0.75rem' }}
                            />
                          </div>
                        </div>
                      </th>
                    ))}
                    <th>Gestor Asignado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingOrdenes ? (
                    <tr><td colSpan={13} style={{textAlign: 'center', padding: '2rem'}}><Loader2 className="spinner" /></td></tr>
                  ) : ordenes.length === 0 ? (
                    <tr><td colSpan={13} style={{textAlign: 'center', padding: '2rem', color: 'var(--text-muted)'}}>No se encontraron órdenes.</td></tr>
                  ) : currentPaginatedOrdenes.map((o, idx) => {
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
                        {/* Gestor Asignado */}
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
              <Pagination currentPage={ordenesPage} totalPages={totalOrdenesPages} onPageChange={setOrdenesPage} />
            </div>
          </div>
        )}




        {activeTab === 'personal' && (
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
              <h3 style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Users size={20} color="var(--primary-color)" /> Directorio de Gestores</h3>
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
                  {showAddInspector && !editingInspector ? 'Cancelar' : 'Añadir Gestor'}
                </button>
              </div>
            </div>

            {showAddInspector && (
              <form style={{ marginBottom: '2rem', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }} onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const id_inspector = formData.get('id_inspector') as string;
                const nombre = formData.get('nombre') as string;
                const rol = formData.get('rol') as string;
                const sector = formData.get('sector') as string;
                const usuario = formData.get('usuario') as string;
                const password = formData.get('password') as string;
                const correo_recuperacion = formData.get('correo_recuperacion') as string;
                
                let success;
                if (editingInspector) {
                  success = await updateInspector(editingInspector.id, { new_id: id_inspector, nombre, rol: rol as 'Admin' | 'Inspector', sector, usuario, password, correo_recuperacion } as any);
                } else {
                  success = await createInspector(id_inspector, nombre, sector, usuario, password, rol, correo_recuperacion);
                }
                
                if (success) {
                  setShowAddInspector(false);
                  setEditingInspector(null);
                  loadInspectors();
                } else {
                  displayToast('Error al guardar gestor', 'error');
                }
              }}>
                <h4 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>{editingInspector ? 'Editar Gestor' : 'Nuevo Gestor'}</h4>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="input-group" style={{ flex: 1, minWidth: '150px', marginBottom: 0 }}>
                    <label>ID del Gestor</label>
                    <input type="text" name="id_inspector" className="input-control" placeholder="Ej. 12345" defaultValue={editingInspector?.id || ''} />
                  </div>
                  <div className="input-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                    <label>Nombre del Gestor</label>
                    <input type="text" name="nombre" required className="input-control" placeholder="Ej. Juan Perez" defaultValue={editingInspector?.nombre || ''} />
                  </div>
                  <div className="input-group" style={{ flex: 1, minWidth: '150px', marginBottom: 0 }}>
                    <label>Rol</label>
                    <select name="rol" className="input-control" defaultValue={editingInspector?.rol || 'Inspector'}>
                      <option value="Inspector">Gestor</option>
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
                           displayToast('Gestor eliminado', 'success');
                         } else {
                           displayToast('Error al eliminar gestor', 'error');
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
                    <tr><td colSpan={9} style={{textAlign: 'center', padding: '2rem', color: 'var(--text-muted)'}}>No hay gestores registrados. Haz clic en "Añadir Gestor".</td></tr>
                  ) : inspectors.map((insp, idx) => (
                    <tr key={idx}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{insp.nombre}</div>
                      </td>
                      <td><span className={`badge ${insp.rol === 'Admin' ? 'danger' : 'info'}`}>{insp.rol === 'Inspector' ? 'Gestor' : insp.rol}</span></td>
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
              <div className="bulk-assign-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={18} color="var(--primary-color)" />
                  <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>Asignación Masiva:</span>
                </div>
                
                <div className="bulk-assign-controls">
                  <select 
                    className="input-control" 
                    value={calidadSupervisorFilter} 
                    onChange={(e) => { setCalidadSupervisorFilter(e.target.value); setCalidadPage(1); }}
                    style={{ flex: 1, minWidth: '200px', height: '42px', border: '1px solid var(--primary-color)' }}
                  >
                    <option value="">1. Seleccionar Supervisor...</option>
                    {Array.from(new Set(calidadData.map(t => getSupervisor(t)).filter(s => s && s !== '-'))).map(sup => (
                      <option key={sup} value={sup}>{sup}</option>
                    ))}
                  </select>

                  <span className="bulk-assign-arrow">→</span>

                  <select 
                    className="assign-select" 
                    value={bulkAssignCalidadInspector}
                    onChange={(e) => setBulkAssignCalidadInspector(e.target.value)}
                    style={{ flex: 1, minWidth: '200px', height: '42px' }}
                  >
                    <option value="">2. Seleccionar Gestor...</option>
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
                              onChange={(e) => { setColumnFilters(prev => ({ ...prev, [col.key]: e.target.value })); setCalidadPage(1); }}
                              style={{ fontSize: '0.75rem' }}
                            />
                          </div>
                        </div>
                      </th>
                    ))}
                    <th>Gestor Asignado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingCalidad ? (
                    <tr><td colSpan={8} style={{textAlign: 'center', padding: '2rem'}}><Loader2 className="spinner" /></td></tr>
                  ) : calidadData.length === 0 ? (
                    <tr><td colSpan={10} style={{textAlign: 'center', padding: '2rem', color: 'var(--text-muted)'}}>No hay datos disponibles.</td></tr>
                  ) : currentPaginatedCalidad.map((row, idx) => {
                      // const techKey = Object.keys(row).find(k => ['nombre', 'técnico', 'tecnico', 'nombre del técnico', 'nombre del tecnico'].includes(k.toLowerCase().trim())) || 'Nombre';
                      // const technician = row[techKey];
                      
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
                                  const ticketId = row.ticket || row.IDD || row.id || row['ID TICKET'] || row['TRABAJO'];
                                  if (inspector && ticketId) {
                                    try {
                                      const success = await assignCalidadIndividual(String(ticketId), inspector.id, inspector.nombre);
                                      if (success) {
                                        displayToast(`Ticket ${ticketId} asignado a ${inspector.nombre}`, 'success');
                                        loadCalidad();
                                      }
                                    } catch (error: any) {
                                      displayToast(error.message || 'Error al asignar ticket', 'error');
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
                                      message: `¿Estás seguro de cancelar el código para el ticket ${ticketId}? Esto lo devolverá al gestor.`,
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
              <Pagination currentPage={calidadPage} totalPages={totalCalidadPages} onPageChange={setCalidadPage} />
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
        {activeTab === 'razones' && (
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h3 style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <AlertCircle size={20} color="var(--primary-color)" /> Gestión de Código Razón Cliente
              </h3>
              
              <div className="bulk-assign-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={18} color="var(--primary-color)" />
                  <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>Asignación Masiva:</span>
                </div>
                
                <div className="bulk-assign-controls">
                  <select 
                    className="input-control" 
                    value={razonesSupervisorFilter}
                    onChange={(e) => setRazonesSupervisorFilter(e.target.value)}
                    style={{ flex: 1, minWidth: '200px', height: '42px', border: '1px solid var(--primary-color)' }}
                  >
                    <option value="">1. Seleccionar Supervisor...</option>
                    {Array.from(new Set(_razones.map(r => r.supervisor || r['Nombre del Supervisor']).filter(Boolean))).sort().map(sup => (
                      <option key={String(sup)} value={String(sup)}>{String(sup)}</option>
                    ))}
                  </select>

                  <span className="bulk-assign-arrow">→</span>

                  <select 
                    className="assign-select" 
                    value={bulkAssignRazonesInspector}
                    onChange={(e) => setBulkAssignRazonesInspector(e.target.value)}
                    style={{ flex: 1, minWidth: '200px', height: '42px' }}
                  >
                    <option value="">2. Seleccionar Gestor...</option>
                    {inspectors.map(insp => (
                      <option key={insp.id} value={insp.id}>{insp.nombre}</option>
                    ))}
                  </select>
                  
                  <button 
                    className="btn-primary" 
                    style={{ padding: '0 1.5rem', height: '42px' }}
                    disabled={!razonesSupervisorFilter || !bulkAssignRazonesInspector}
                    onClick={() => {
                      const inspName = inspectors.find(i => i.id === bulkAssignRazonesInspector)?.nombre || bulkAssignRazonesInspector;
                      setConfirmModal({
                        isOpen: true,
                        message: `¿Deseas asignar TODAS las razones del supervisor "${razonesSupervisorFilter}" al gestor "${inspName}"?`,
                        onConfirm: async () => {
                          try {
                            const updatedCount = await assignRazonesBySupervisor(razonesSupervisorFilter, bulkAssignRazonesInspector, inspName);
                            if (updatedCount > 0) {
                              displayToast(`Asignación masiva completada: ${updatedCount} registros`, 'success');
                              loadRazones();
                              setBulkAssignRazonesInspector('');
                            } else {
                              displayToast('No se encontraron registros para asignar o error en la operación', 'error');
                            }
                          } catch (error) {
                            displayToast('Error de conexión', 'error');
                          }
                          setConfirmModal(null);
                        }
                      });
                    }}
                  >
                    Asignar Masivo
                  </button>
                </div>
              </div>
            </div>

            <div className="header-actions">
              <div className="search-bar">
                <Search size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar por Ticket, Técnico o Motivo..." 
                  value={razonesSearch}
                  onChange={(e) => { setRazonesSearch(e.target.value); setRazonesPage(1); }}
                />
              </div>
              <button className="btn-secondary" onClick={loadRazones}>
                <RotateCcw size={18} /> Actualizar Datos
              </button>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID Ticket</th>
                    <th>Supervisor</th>
                    <th>Técnico</th>
                    <th>Sector</th>
                    <th>Motivo / Razón</th>
                    <th>Estado</th>
                    <th>Fecha Registro</th>
                    <th>Asignación</th>
                  </tr>
                </thead>
                <tbody>
                  {_loadingRazones ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}><Loader2 className="spinner" size={32} /></td></tr>
                  ) : currentPaginatedRazones.map((row, idx) => {
                      const ticketId = row.ticket || row.id || row['ID TICKET'] || row['TRABAJO'];
                      const isAssigned = !!(row.inspector || row['Inspector']);
                      return (
                        <tr key={idx}>
                          <td>{ticketId}</td>
                          <td>{row.supervisor || row['Nombre del Supervisor'] || '-'}</td>
                          <td>{row.tecnico || row.tech || row['Asignado A'] || '-'}</td>
                          <td>{row.sector || row['Localidad'] || '-'}</td>
                          <td>{row.motivo || row.razon || row['Motivo'] || '-'}</td>
                          <td>
                            {row.codigo_aplicado || row['Código Aplicado'] ? (
                              <span className="badge success">Finalizado: {row.codigo_aplicado || row['Código Aplicado']}</span>
                            ) : isAssigned ? (
                              <span className="badge info">Asignado a: {row.inspector || row['Inspector']}</span>
                            ) : (
                              <span className="badge danger">Sin Asignar</span>
                            )}
                          </td>
                          <td>{formatRDDate(row.fecha_inspeccion || row['Fecha Inspección'] || row.fecha || row['Fecha'] || '')}</td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <select 
                                className="assign-select"
                                value={row.inspector_id || row['Inspector ID'] || ''}
                                onChange={async (e) => {
                                  const inspId = e.target.value;
                                  if (!inspId) return;
                                  const inspName = inspectors.find(i => i.id === inspId)?.nombre || inspId;
                                  
                                  const success = await assignRazonesIndividual(String(ticketId), inspId, inspName);
                                  if (success) {
                                    displayToast(`Asignado a ${inspName}`, 'success');
                                    loadRazones();
                                  } else {
                                    displayToast('Error al asignar', 'error');
                                  }
                                }}
                              >
                                <option value="">Asignar...</option>
                                {inspectors.map(insp => (
                                  <option key={insp.id} value={insp.id}>{insp.nombre}</option>
                                ))}
                              </select>

                              {(row.codigo_aplicado || row['Código Aplicado']) && (
                                <button 
                                  className="btn-danger" 
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', width: '100%' }}
                                  onClick={() => {
                                    setConfirmModal({
                                      isOpen: true,
                                      message: `¿Estás seguro de cancelar el código para el ticket ${ticketId}?`,
                                      onConfirm: async () => {
                                        try {
                                          const { success, message } = await cancelManualCodigo(String(ticketId), 'razones');
                                          if (success) {
                                            displayToast('Código cancelado correctamente', 'success');
                                            loadRazones();
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
              <Pagination currentPage={razonesPage} totalPages={totalRazonesPages} onPageChange={setRazonesPage} />
            </div>
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
                    <th>ORDEN / TICKET</th>
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
                    tickets.filter(t => t.status === 'Inspeccionado' || t.status === 'Aprobado' || t.status === 'Rechazado' || !!t.codigo_aplicado || !!t['Código Aplicado']).forEach(t => {
                      mixed.push({ ...t, _origin: 'Ticket', _id: t.ticket, _tech: t.tech || t.tech_id, _sup: getSupervisor(t), _sector: t.sector, _date: t.fecha_inspeccion || t.fecha || t.oe_vencimiento || 'N/A', _color: '#3b82f6', _code: t.codigo_aplicado || t['Código Aplicado'] });
                    });
                    
                    // 2. Órdenes Inspeccionadas
                    ordenes.filter(o => o.status === 'Inspeccionado' || o.status === 'Completado' || o.status === 'Aprobado' || !!o.codigo_aplicado || !!(o as any)['Código Aplicado']).forEach(o => {
                      mixed.push({ ...o, _origin: 'Orden', _id: o.ticket || o.orden_servicio, _tech: o.tech || (o as any).tech_id, _sup: o.supervisor, _sector: o.sector, _date: (o as any).fecha_inspeccion || o.fecha || (o as any).oe_vencimiento || 'N/A', _color: '#ef4444', _code: o.codigo_aplicado || (o as any)['Código Aplicado'] });
                    });

                    // 3. Calidad Inspeccionada (Repetidas)
                    calidadData.filter(c => c.status === 'Inspeccionado' || c.status === 'Aprobado' || !!c.codigo_aplicado || !!c['Código Aplicado']).forEach(c => {
                      mixed.push({ ...c, _origin: 'Repetida', _id: c.ticket, _tech: c.tech || c.tech_id, _sup: c.supervisor || getSupervisor(c), _sector: c.sector, _date: c.fecha_inspeccion || c.fecha || (c as any).oe_vencimiento || 'N/A', _color: '#f59e0b', _code: c.codigo_aplicado || c['Código Aplicado'] });
                    });

                    // 4. Razones Inspeccionadas
                    _razones.filter(r => !!(r.codigo_aplicado || r['Código Aplicado'])).forEach(r => {
                      const rId = r.ticket || r.id || r['ID TICKET'] || r['TRABAJO'];
                      mixed.push({ ...r, _origin: 'Razon', _id: rId, _tech: r.tecnico || r.tech || r['Asignado A'], _sup: r.supervisor || getSupervisor(r), _sector: r.sector, _date: r.fecha || 'N/A', _color: '#ec4899', _code: r.codigo_aplicado || r['Código Aplicado'] });
                    });

                    const term = inspeccionesSearch.toLowerCase().trim();
                    const terms = term.split(' ').filter(Boolean);
                    const filtered = mixed.filter(item => {
                      if (!term) return true;
                      return terms.some(t => 
                        String(item._id).toLowerCase().includes(t) ||
                        String(item._tech).toLowerCase().includes(t) ||
                        String(item._sup).toLowerCase().includes(t) ||
                        String(item._sector).toLowerCase().includes(t) ||
                        String(item._origin).toLowerCase().includes(t)
                      );
                    });

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
                        <td>{formatRDDate(item._date)}</td>
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
                                    message: `¿Cancelar código para ${item._id}? Volverá al gestor.`,
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
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn-secondary" style={{ padding: '0.4rem 1.2rem', fontSize: '0.75rem', height: '32px' }} onClick={() => {
                              if (item._origin === 'Ticket') setActiveTab('tickets');
                              else if (item._origin === 'Orden') setActiveTab('ordenes');
                              else setActiveTab('calidad');
                            }}>
                              Ver Detalle
                            </button>
                            <button 
                              className="btn-danger" 
                              style={{ padding: '0.4rem 1.2rem', fontSize: '0.75rem', height: '32px' }}
                              onClick={() => {
                                setConfirmModal({
                                  isOpen: true,
                                  message: `¿Eliminar inspección para ${item._id}? El registro volverá a estar pendiente.`,
                                  onConfirm: async () => {
                                    const type = item._origin === 'Ticket' ? 'tickets' : item._origin === 'Orden' ? 'ordenes' : 'calidad';
                                    const { success } = await cancelManualCodigo(String(item._id), type);
                                    if (success) { 
                                      displayToast('Inspección eliminada'); 
                                      loadTickets(); loadOrdenes(); loadCalidad();
                                    }
                                    setConfirmModal(null);
                                  }
                                });
                              }}
                            >
                              Eliminar
                            </button>
                          </div>
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
