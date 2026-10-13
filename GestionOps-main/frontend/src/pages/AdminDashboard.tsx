import { useState, useEffect, useRef } from 'react';
import { 
  LogOut, Search, Filter, AlertTriangle, CheckCircle2, Loader2,
  Sun, Moon, Settings, RotateCcw, AlertCircle,
  LayoutDashboard, FileText, Users, Package, Upload, SlidersHorizontal
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import ImportExcel from './ImportExcel';
import ConfigModulos from './ConfigModulos';
import RecoveryCodes from './RecoveryCodes';
import ConfirmarClave, { PerfilBloqueado } from './ConfirmarClave';
import './PerfilTabs.css';
import './TablaCompacta.css';
import { subscribeTables } from '../services/realtime';
import { SUDO_EVENT, cerrarConfirmacion } from '../services/api';
import { fetchPagina, fetchPanelStats, fetchSupervisores, fetchUltimasInspecciones, fetchTopRepetidas, fetchInspecciones, type PaginaParams, type PanelStats, type InspeccionFila, type TecnicoRepetidas } from '../services/api';
import { logout, type Ticket, fetchInspectors, fetchPersonalDetalle, createInspector, updateInspector, deleteInspector, autoAssignTickets, type Inspector, fetchConfig, updateAdminProfile, fetchCalidad, fetchRazones, assignCalidadBySupervisor, assignCalidadIndividual, type Orden, cancelManualCodigo, assignOrdenesBySupervisor, assignOrdenesIndividual, assignRazonesBySupervisor, assignRazonesIndividual, assignTicketsBySupervisor, assignTicket } from '../services/api';

// Espera a que el usuario deje de escribir antes de consultar al servidor
function useDebounced<T>(valor: T, ms = 300): T {
  const [d, setD] = useState(valor);
  useEffect(() => { const t = setTimeout(() => setD(valor), ms); return () => clearTimeout(t); }, [valor, ms]);
  return d;
}

// Encabezado de columna -> columna de la base (el servidor filtra solo por columnas permitidas)
const COL_TICKETS: Record<string, string> = { 'Ticket': 'ticket', 'Técnico': 'tech', 'Supervisor': 'supervisor', 'Sector': 'sector', 'Prioridad': 'priority', 'Estado': 'status' };
const COL_ORDENES: Record<string, string> = { 'Trabajo': 'descripcion_orden', 'Orden externa': 'orden_externa_id', 'Cliente': 'cliente', 'Asignado A': 'tech', 'Supervisor': 'supervisor', 'Tecnología': 'tecnologia', 'Sector': 'sector', 'Terminal': 'terminal' };
const aColumnas = (mapa: Record<string, string>, filtros: Record<string, string>) =>
  Object.fromEntries(Object.entries(filtros).filter(([, v]) => v && v.trim()).map(([k, v]) => [mapa[k] || k, v]));
const COLOR_ORIGEN: Record<string, string> = { Ticket: '#3b82f6', Orden: '#ef4444', Repetida: '#f59e0b', Razon: '#ec4899' };
const nf = (n: number | undefined | null) => (n ?? 0).toLocaleString('es-DO');
// El servidor cuenta hasta 10.001: si se pasa de 10.000 se muestra "10.000+"
const conteo = (n: number, capped: boolean) => capped ? `${nf(10000)}+` : nf(n);

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketsTotal, setTicketsTotal] = useState(0);
  const [ticketsCapped, setTicketsCapped] = useState(false);
  const [ordenesTotal, setOrdenesTotal] = useState(0);
  const [ordenesCapped, setOrdenesCapped] = useState(false);
  const [stats, setStats] = useState<PanelStats | null>(null);
  const [supsTickets, setSupsTickets] = useState<string[]>([]);
  const [supsOrdenes, setSupsOrdenes] = useState<string[]>([]);
  const [ultimas, setUltimas] = useState<any[]>([]);
  const [loadingUltimas, setLoadingUltimas] = useState(true);
  const [topRep, setTopRep] = useState<TecnicoRepetidas[]>([]);
  const [inspPage, setInspPage] = useState<{ rows: InspeccionFila[]; total: number; capped: boolean }>({ rows: [], total: 0, capped: false });
  const [loadingInsp, setLoadingInsp] = useState(false);


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
  const [inspeccionesPage, setInspeccionesPage] = useState(1);
  const [inspeccionesTypeFilter, setInspeccionesTypeFilter] = useState('Todos');
  const [ordenesSupervisorFilter, setOrdenesSupervisorFilter] = useState('');
  const [bulkAssignOrdenesInspector, setBulkAssignOrdenesInspector] = useState('');

  const [ticketsSearch, setTicketsSearch] = useState('');
  const [ticketsColumnFilters, setTicketsColumnFilters] = useState<Record<string, string>>({});
  const [ticketsSupervisorFilter, setTicketsSupervisorFilter] = useState('');
  const [bulkAssignTicketsInspector, setBulkAssignTicketsInspector] = useState('');

  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success'|'error'>('success');
  const [showToast, setShowToast] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, message: string, onConfirm: () => void} | null>(null);
  const [razonesSearch, setRazonesSearch] = useState('');
  const [razonesSupervisorFilter, setRazonesSupervisorFilter] = useState('');
  const [bulkAssignRazonesInspector, setBulkAssignRazonesInspector] = useState('');
  const [theme, setTheme] = useState(document.documentElement.getAttribute('data-theme') || 'light');

  // Mi Perfil pide la contraseña cada vez que se entra. El servidor además exige esa confirmación (10 min, por sesión)
  // para cambiar el perfil, generar códigos o tocar cuentas de administrador.
  const [perfilOk, setPerfilOk] = useState(false);
  const [pedirClave, setPedirClave] = useState(false);   // ventana flotante cuando el servidor pide confirmar
  const [perfilTab, setPerfilTab] = useState<'cuenta' | 'personal'>('cuenta');
  useEffect(() => {
    if (!perfilOk) { setPerfilTab('cuenta'); return; }
    loadAdminConfig();        // usuario y correo del super admin (exigen la confirmación)
    loadInspectors();         // completa la lista con usuarios y correos
  }, [perfilOk]);
  useEffect(() => {
    if (activeTab !== 'config' && perfilOk) { setPerfilOk(false); cerrarConfirmacion(); }
  }, [activeTab, perfilOk]);
  useEffect(() => {
    if (!perfilOk) return;
    const t = setTimeout(() => setPerfilOk(false), 10 * 60 * 1000);   // mismo plazo que el servidor
    return () => clearTimeout(t);
  }, [perfilOk]);
  useEffect(() => {
    const abrir = () => setPedirClave(true);
    window.addEventListener(SUDO_EVENT, abrir);
    return () => window.removeEventListener(SUDO_EVENT, abrir);
  }, []);

  const [ordenesPage, setOrdenesPage] = useState(1);
  const [calidadPage, setCalidadPage] = useState(1);
  const [razonesPage, setRazonesPage] = useState(1);
  const [ticketsPage, setTicketsPage] = useState(1);
  const itemsPerPage = 20;

  const ticketsSearchD = useDebounced(ticketsSearch);
  const ticketsColsD = useDebounced(ticketsColumnFilters);
  const ordenesSearchD = useDebounced(ordenesSearch);
  const ordenesColsD = useDebounced(ordenesColumnFilters);
  const inspSearchD = useDebounced(inspeccionesSearch);
  const reqT = useRef(0), reqO = useRef(0), reqI = useRef(0);
  const qTickets = useRef<PaginaParams>({ page: 1, pageSize: itemsPerPage });
  const qOrdenes = useRef<PaginaParams>({ page: 1, pageSize: itemsPerPage });
  const qInsp = useRef<{ search?: string; tipo?: string; page: number; pageSize: number }>({ page: 1, pageSize: 25 });
  qTickets.current = { search: ticketsSearchD, filtros: aColumnas(COL_TICKETS, ticketsColsD), supervisor: ticketsSupervisorFilter, page: ticketsPage, pageSize: itemsPerPage };
  qOrdenes.current = { search: ordenesSearchD, filtros: aColumnas(COL_ORDENES, ordenesColsD), supervisor: ordenesSupervisorFilter, page: ordenesPage, pageSize: itemsPerPage };
  qInsp.current = { search: inspSearchD, tipo: inspeccionesTypeFilter, page: inspeccionesPage, pageSize: 25 };

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
    loadInspectors();
    loadStats();
  }, []);




  const loadAdminConfig = async () => {
    const config = await fetchConfig();
    setAdminConfig(config);
  };

  // Tiempo real: recarga solo lo que se está viendo cuando cambia una tabla (reemplaza el sondeo de 30 s)
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  useEffect(() => {
    return subscribeTables((tabla) => {
      const tab = activeTabRef.current;
      loadStats();
      if (tab === 'dashboard') { loadUltimas(); loadTopRep(); return; }
      if (tab === 'inspecciones') { loadInsp(); return; }
      if (tab === 'tickets' && tabla === 'tickets') loadTickets();
      if (tab === 'ordenes' && tabla === 'ordenes') loadOrdenes();
      if (tab === 'calidad' && tabla === 'calidad') loadCalidad();
      if (tab === 'razones' && tabla === 'razones') loadRazones();
    }, 800);
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard') { loadStats(); loadUltimas(); loadTopRep(); }
    if (activeTab === 'calidad') loadCalidad();
    if (activeTab === 'razones') loadRazones();
    if (activeTab === 'inspecciones') loadStats();
    if (activeTab === 'tickets') fetchSupervisores('tickets').then(setSupsTickets);
    if (activeTab === 'ordenes') fetchSupervisores('ordenes').then(setSupsOrdenes);
  }, [activeTab]);

  // Tickets, Órdenes e Inspecciones: cada cambio de página, búsqueda o filtro pide al servidor solo esa página
  useEffect(() => { if (activeTab === 'tickets') loadTickets(); },
    [activeTab, ticketsPage, ticketsSearchD, ticketsColsD, ticketsSupervisorFilter]);
  useEffect(() => { if (activeTab === 'ordenes') loadOrdenes(); },
    [activeTab, ordenesPage, ordenesSearchD, ordenesColsD, ordenesSupervisorFilter]);
  useEffect(() => { if (activeTab === 'inspecciones') loadInsp(); },
    [activeTab, inspeccionesPage, inspSearchD, inspeccionesTypeFilter]);

  const ensureKeys = (item: any, type: 'ticket' | 'orden' | 'calidad') => {
    if (!item) return item;
    const normalized = { ...item };
    
    // Mapping universal de campos clave (por si el backend no lo hizo)
    const getVal = (keys: string[]) => {
      const foundKey = Object.keys(item).find(k => keys.includes(k.toLowerCase().trim()));
      return foundKey ? item[foundKey] : undefined;
    };

    if (!normalized.ticket) normalized.ticket = getVal(['trabajo', 'ticket', 'idd', 'nro trabajo', 'work name', 'orden externa', 'orden_externa', 'orden_externa_id']);
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
    
    if (type === 'orden' || type === 'ticket') {
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

  // Lista básica siempre (para asignar tickets); con la contraseña confirmada se completa con usuario y correo.
  const loadInspectors = async () => {
    setLoadingInspectors(true);
    const basica = await fetchInspectors();
    if (perfilOk) {
      const detalle = await fetchPersonalDetalle();
      const porId = new Map(detalle.map(d => [d.uuid, d]));
      setInspectors(basica.map(b => ({ ...b, ...(porId.get(b.uuid) || {}) })));
    } else {
      setInspectors(basica);
    }
    setLoadingInspectors(false);
  };

  const loadRazones = async () => {
    setLoadingRazones(true);
    const data = await fetchRazones();
    setRazones(data.map(item => ensureKeys(item, 'calidad'))); // Razones follows similar structure to Calidad/Tickets
    setLoadingRazones(false);
  };

  const loadOrdenes = async () => {
    const id = ++reqO.current;
    setLoadingOrdenes(true);
    const r = await fetchPagina('ordenes', qOrdenes.current);
    if (id !== reqO.current) return;                       // llegó una respuesta más nueva
    setOrdenes(r.rows.map(item => ensureKeys(item, 'orden')));
    setOrdenesTotal(r.total); setOrdenesCapped(r.capped);
    setLoadingOrdenes(false);
  };

  const loadTickets = async () => {
    const id = ++reqT.current;
    setLoading(true);
    const r = await fetchPagina('tickets', qTickets.current);
    if (id !== reqT.current) return;
    setTickets(r.rows.map(item => ensureKeys(item, 'ticket')));
    setTicketsTotal(r.total); setTicketsCapped(r.capped);
    setLoading(false);
  };

  const loadStats = async () => { setStats(await fetchPanelStats()); };
  const loadUltimas = async () => { setLoadingUltimas(true); setUltimas(await fetchUltimasInspecciones(3)); setLoadingUltimas(false); };
  const loadTopRep = async () => { setTopRep(await fetchTopRepetidas(5)); };
  const loadInsp = async () => {
    const id = ++reqI.current;
    setLoadingInsp(true);
    const r = await fetchInspecciones(qInsp.current);
    if (id !== reqI.current) return;
    setInspPage(r); setLoadingInsp(false);
  };

  const handleLogout = async () => {
    await logout();
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
  const totalOrdenesPages = Math.max(1, Math.ceil(ordenesTotal / itemsPerPage));
  const currentPaginatedOrdenes = ordenes;      // el servidor ya entrega solo la página visible

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

  const totalTicketsPages = Math.max(1, Math.ceil(ticketsTotal / itemsPerPage));
  const currentPaginatedTickets = tickets;      // el servidor ya entrega solo la página visible

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
          
          <button className={`nav-item ${activeTab === 'tickets' ? 'active' : ''}`} onClick={() => setActiveTab('tickets')}>
            <FileText size={20} /> Tickets <span className="nav-badge">{stats ? nf(stats.tickets.total) : '…'}</span>
          </button>

          <button className={`nav-item ${activeTab === 'ordenes' ? 'active' : ''}`} onClick={() => setActiveTab('ordenes')}>
            <Package size={20} /> Ordenes <span className="nav-badge">{stats ? nf(stats.ordenes.total) : '…'}</span>
          </button>
          <button className={`nav-item ${activeTab === 'calidad' ? 'active' : ''}`} onClick={() => setActiveTab('calidad')}>
            <RotateCcw size={20} /> Averías Repetidas <span className="nav-badge">{stats ? nf(stats.calidad.total) : calidadData.length}</span>
          </button>
          <button className={`nav-item ${activeTab === 'inspecciones' ? 'active' : ''}`} onClick={() => setActiveTab('inspecciones')}>
            <CheckCircle2 size={20} /> Inspecciones <span className="nav-badge">{stats ? nf(stats.tickets.inspeccionados + stats.ordenes.inspeccionados + stats.calidad.inspeccionados + stats.razones.inspeccionados) : '…'}</span>
          </button>
          <button className={`nav-item ${activeTab === 'importar' ? 'active' : ''}`} onClick={() => setActiveTab('importar')}>
            <Upload size={20} /> Importar Excel
          </button>
          <button className={`nav-item ${activeTab === 'configuracion' ? 'active' : ''}`} onClick={() => setActiveTab('configuracion')}>
            <SlidersHorizontal size={20} /> Configuración
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
        <div className="header-actions" style={activeTab === 'importar' ? { width: '100%', maxWidth: 1180, marginInline: 'auto' } : undefined}>
          <div>
            <h1 className="title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {activeTab === 'dashboard' ? <><LayoutDashboard size={28} color="var(--primary-color)" /> Resumen Operativo</> : 
               activeTab === 'tickets' ? <><FileText size={28} color="var(--primary-color)" /> Gestión de Tickets</> : 
               activeTab === 'ordenes' ? <><Package size={28} color="var(--primary-color)" /> Órdenes de Trabajo</> : 
               activeTab === 'inspecciones' ? <><CheckCircle2 size={28} color="var(--primary-color)" /> Historial de Inspecciones Mixtas</> :
               activeTab === 'personal' ? <><Users size={28} color="var(--primary-color)" /> Directorio de Personal ({inspectors.length})</> :
               activeTab === 'calidad' ? <> <RotateCcw size={28} color="var(--primary-color)" /> Averías Repetidas ({stats ? nf(stats.calidad.total) : calidadData.length})</> :
               activeTab === 'razones' ? <> <AlertCircle size={28} color="var(--primary-color)" /> Código Razón Cliente ({_razones.length})</> :
               activeTab === 'importar' ? <><Upload size={28} color="var(--primary-color)" /> Importar desde Excel</> :
               activeTab === 'configuracion' ? <><SlidersHorizontal size={28} color="var(--primary-color)" /> Configuración</> :
               <><Settings size={28} color="var(--primary-color)" /> Configuración de Perfil</>}
            </h1>
            <p className="subtitle">Centro de control de averías de fibra óptica</p>
          </div>

        </div>

        {activeTab === 'dashboard' && (
          <>
            <div className="kpi-grid">
              {([
                { k: 'tickets', tipo: 'Ticket', titulo: 'Tickets Inspeccionados', color: '#3b82f6', fondo: 'rgba(59, 130, 246, 0.1)', clase: 'blue', icono: <FileText color="#3b82f6" /> },
                { k: 'ordenes', tipo: 'Orden', titulo: 'Órdenes Inspeccionadas', color: '#ef4444', fondo: 'rgba(239, 68, 68, 0.1)', clase: 'red', icono: <Package color="#ef4444" /> },
                { k: 'calidad', tipo: 'Repetida', titulo: 'Averías Repetidas Insp.', color: '#f59e0b', fondo: 'rgba(245, 158, 11, 0.1)', clase: 'amber', icono: <RotateCcw color="#f59e0b" /> },
                { k: 'razones', tipo: 'Razon', titulo: 'Razones Inspeccionadas', color: '#ec4899', fondo: 'rgba(236, 72, 153, 0.1)', clase: '', icono: <AlertCircle color="#ec4899" /> },
              ] as const).map(c => {
                const d = stats?.[c.k];
                return (
                  <div key={c.k} className="glass-panel kpi-card" style={{ cursor: 'pointer', transition: 'transform 0.2s', position: 'relative' }}
                    onClick={() => { setInspeccionesSearch(''); setInspeccionesTypeFilter(c.tipo); setInspeccionesPage(1); setActiveTab('inspecciones'); }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                    <div className={`kpi-icon ${c.clase}`} style={{ background: c.fondo }}>{c.icono}</div>
                    <div className="kpi-info" style={{ width: '100%' }}>
                      <h3 style={{ fontSize: '0.9rem', marginBottom: '0.2rem' }}>{c.titulo}</h3>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                        <p style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>{d ? nf(d.inspeccionados) : '…'}</p>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, paddingBottom: '0.3rem' }}>de {d ? nf(d.total) : '…'}</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'var(--bg-color)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                        <div style={{ width: `${d ? (d.inspeccionados / (d.total || 1)) * 100 : 0}%`, height: '100%', background: c.color, transition: 'width 1s ease-out' }}></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="responsive-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="glass-panel" style={{ gridColumn: 'span 2' }}>
                <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={20} color="var(--primary-color)" /> Técnicos con Más Repetidas (%)
                </h3>
                <div className="top-techs">
                  {!stats ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="spinner" /></div>
                  ) : topRep.length > 0 ? (
                    topRep.map(t => ({ name: t.name, count: t.repeated, repPerc: (t.repeated / (t.total || t.repeated || 1)) * 100 })).map((tech, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 0', borderBottom: idx < 4 ? '1px solid var(--glass-border)' : 'none' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: idx === 0 ? 'var(--primary-color)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800, color: idx === 0 ? '#fff' : 'var(--text-main)', border: '1px solid var(--glass-border)' }}>
                          {idx + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>{tech.name}</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tech.count} repetidas</span>
                          </div>
                          <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: tech.repPerc > 20 ? '#ef4444' : tech.repPerc > 10 ? '#f59e0b' : '#10b981', width: `${Math.min(100, tech.repPerc)}%`, transition: 'width 1s ease-out' }}></div>
                          </div>
                        </div>
                        <div style={{ minWidth: '50px', textAlign: 'right', fontWeight: 800, color: tech.repPerc > 20 ? '#ef4444' : tech.repPerc > 10 ? '#f59e0b' : '#10b981', fontSize: '1rem' }}>
                          {tech.repPerc.toFixed(1)}%
                        </div>
                      </div>
                    ))
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
                    {loadingUltimas ? (
                      <tr><td colSpan={6} style={{textAlign: 'center', padding: '2rem'}}><Loader2 className="spinner" /></td></tr>
                    ) : (() => {
                      const etiqueta: Record<string, string> = { tickets: 'Ticket', ordenes: 'Orden', calidad: 'Calidad' };
                      const mk = (r: any) => ({ ...r, _type: etiqueta[r._tabla] || r._tabla,
                        _id: r._tabla === 'ordenes' ? (r.orden_externa_id || r.orden_servicio || r.ticket || '-') : (r.ticket || '-'),
                        _gestor: r.inspector || r.inspector_id || '', _fecha: r.fecha_inspeccion || '' });
                      const parseRDDate = (s: string) => {
                        if (!s) return 0;
                        // "dd/MM/yyyy HH:mm" o "dd-MM-yyyy HH:mm"
                        const m = s.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})\s+(\d{2}):(\d{2})/);
                        if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00`).getTime();
                        return new Date(s).getTime() || 0;
                      };
                      // El servidor entrega las 3 más recientes de cada módulo; aquí se mezclan y se muestran las 6 últimas
                      const combined = ultimas.map(mk).sort((a, b) => parseRDDate(b._fecha) - parseRDDate(a._fecha)).slice(0, 6);
                      const latest = combined;

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

        {activeTab === 'tickets' && (
          <div className="glass-panel">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <FileText size={20} color="var(--primary-color)" /> Gestión de Tickets
                </h3>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div className="search-bar" style={{ width: 'auto', minWidth: '300px' }}>
                    <Search size={18} />
                    <input 
                      type="text" 
                      placeholder="Buscar por Ticket, Técnico, Sector..." 
                      value={ticketsSearch}
                      onChange={(e) => { setTicketsSearch(e.target.value); setTicketsPage(1); }}
                    />
                  </div>
                </div>
              </div>

              {/* Panel Asignación Masiva */}
              <div className="bulk-assign-panel blue">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={18} color="#3b82f6" />
                  <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>Asignación Masiva:</span>
                </div>
                
                <div className="bulk-assign-controls">
                  <select 
                    className="input-control" 
                    value={ticketsSupervisorFilter} 
                    onChange={(e) => { setTicketsSupervisorFilter(e.target.value); setTicketsPage(1); }}
                    style={{ flex: 1, minWidth: '200px', height: '42px', border: '1px solid #3b82f6' }}
                  >
                    <option value="">1. Seleccionar Supervisor...</option>
                    {supsTickets.map(sup => (
                      <option key={sup} value={sup}>{sup}</option>
                    ))}
                  </select>

                  <span className="bulk-assign-arrow" style={{ color: '#3b82f6' }}>→</span>

                  <select 
                    className="assign-select" 
                    value={bulkAssignTicketsInspector}
                    onChange={(e) => setBulkAssignTicketsInspector(e.target.value)}
                    style={{ flex: 1, minWidth: '200px', height: '42px', border: '1px solid #3b82f6' }}
                  >
                    <option value="">2. Seleccionar Gestor...</option>
                    {inspectors.map(insp => (
                      <option key={insp.id} value={insp.id}>{insp.nombre}</option>
                    ))}
                  </select>
                  
                  <button 
                    className="btn-primary" 
                    style={{ padding: '0 1.5rem', height: '42px', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.3)', border: 'none' }}
                    disabled={!bulkAssignTicketsInspector || !ticketsSupervisorFilter}
                    onClick={async () => {
                      const inspector = inspectors.find(i => String(i.id) === String(bulkAssignTicketsInspector));
                      if (inspector && ticketsSupervisorFilter) {
                        try {
                           const updated = await assignTicketsBySupervisor(ticketsSupervisorFilter, inspector.id, inspector.nombre);
                           displayToast(`Se asignaron ${updated} tickets a ${inspector.nombre}`, 'success');
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
                {!ticketsSupervisorFilter && (
                  <span style={{ fontSize: '0.75rem', color: '#3b82f6', fontStyle: 'italic' }}>
                    * Selecciona un supervisor primero para habilitar la asignación masiva.
                  </span>
                )}
              </div>
            </div>

            <div className="table-container tabla-compacta">
              <table>
                <thead>
                  <tr>
                    {[
                      'Ticket', 'Técnico', 'Supervisor', 'Sector', 'Prioridad', 'Estado'
                    ].map(header => (
                      <th key={header}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{header}</span>
                          {header !== 'Prioridad' && header !== 'Estado' && (
                            <div className="search-bar" style={{ margin: 0, padding: '0.25rem 0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', height: '28px' }}>
                              <Search size={12} />
                              <input 
                                type="text" 
                                placeholder="Filtrar..." 
                                value={ticketsColumnFilters[header] || ''} 
                                onChange={(e) => { setTicketsColumnFilters(prev => ({ ...prev, [header]: e.target.value })); setTicketsPage(1); }}
                                style={{ fontSize: '0.75rem' }}
                              />
                            </div>
                          )}
                        </div>
                      </th>
                    ))}
                    <th>Gestor Asignado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} style={{textAlign: 'center', padding: '2rem'}}><Loader2 className="spinner" /></td></tr>
                  ) : currentPaginatedTickets.length === 0 ? (
                    <tr><td colSpan={8} style={{textAlign: 'center', padding: '2rem', color: 'var(--text-muted)'}}>No hay tickets que coincidan con la búsqueda.</td></tr>
                  ) : currentPaginatedTickets.map((t, idx) => {
                    const ticketId = t.ticket || t.id;
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{t.ticket || '-'}</td>
                        <td>{t.tech || t.tech_id || '-'}</td>
                        <td>{getSupervisor(t)}</td>
                        <td>{t.sector || '-'}</td>
                        <td>
                          <span title={String(t.priority || '')} className={`badge ${String(t.priority).toLowerCase() === 'alta' ? 'danger' : String(t.priority).toLowerCase() === 'media' ? 'warning' : 'info'}`}>
                            {t.priority || '-'}
                          </span>
                        </td>
                        <td>
                          {t.codigo_aplicado || t['Código Aplicado'] ? (
                            <span className="badge success" title={`Finalizado: ${t.codigo_aplicado || t['Código Aplicado']}`}>Finalizado: {t.codigo_aplicado || t['Código Aplicado']}</span>
                          ) : (
                            <span className={`badge ${t.status === 'Inspeccionado' || t.status === 'Aprobado' ? 'success' : t.status === 'Rechazado' ? 'danger' : t.status === 'En Proceso' ? 'info' : 'warning'}`}>
                              {t.status || 'Pendiente'}
                            </span>
                          )}
                        </td>
                        <td>
                          {t.inspector || t.inspector_id ? (
                            <span className="badge info" title={String(t.inspector || t.inspector_id)}>{t.inspector || t.inspector_id}</span>
                          ) : (
                            <span className="badge danger">Sin Asignar</span>
                          )}
                        </td>
                        <td>
                          <div className="tc-acciones">
                            <select
                              className="assign-select"
                              style={{ padding: '0.25rem 1.5rem 0.25rem 0.5rem', fontSize: '0.7rem' }}
                              value=""
                              onChange={async (e) => {
                                const inspectorId = e.target.value;
                                const inspector = inspectors.find(i => String(i.id) === String(inspectorId));
                                if (inspector && ticketId) {
                                  try {
                                    const success = await assignTicket(String(ticketId), inspector.id, inspector.nombre);
                                    if (success) {
                                      displayToast(`Ticket ${ticketId} asignado a ${inspector.nombre}`, 'success');
                                      loadTickets();
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

                            {(t.codigo_aplicado || t['Código Aplicado']) && (
                              <button 
                                className="btn-danger" 
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', width: '100%' }}
                                onClick={() => {
                                  setConfirmModal({
                                    isOpen: true,
                                    message: `¿Estás seguro de cancelar el código para el ticket ${ticketId}? Esto lo devolverá al gestor.`,
                                    onConfirm: async () => {
                                      try {
                                        const { success, message } = await cancelManualCodigo(String(ticketId), 'tickets');
                                        if (success) {
                                          displayToast('Código cancelado correctamente', 'success');
                                          loadTickets();
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
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.75rem' }}>
                {conteo(ticketsTotal, ticketsCapped)} resultados
              </div>
              <Pagination currentPage={ticketsPage} totalPages={totalTicketsPages} onPageChange={setTicketsPage} />
            </div>
          </div>
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
              <div className="bulk-assign-panel blue">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={18} color="#3b82f6" />
                  <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>Asignación Masiva:</span>
                </div>
                
                <div className="bulk-assign-controls">
                  <select 
                    className="input-control" 
                    value={ordenesSupervisorFilter} 
                    onChange={(e) => { setOrdenesSupervisorFilter(e.target.value); setOrdenesPage(1); }}
                    style={{ flex: 1, minWidth: '200px', height: '42px', border: '1px solid #3b82f6' }}
                  >
                    <option value="">1. Seleccionar Supervisor...</option>
                    {supsOrdenes.map(sup => (
                      <option key={sup} value={sup}>{sup}</option>
                    ))}
                  </select>

                  <span className="bulk-assign-arrow" style={{ color: '#3b82f6' }}>→</span>

                  <select 
                    className="assign-select" 
                    value={bulkAssignOrdenesInspector}
                    onChange={(e) => setBulkAssignOrdenesInspector(e.target.value)}
                    style={{ flex: 1, minWidth: '200px', height: '42px', border: '1px solid #3b82f6' }}
                  >
                    <option value="">2. Seleccionar Gestor...</option>
                    {inspectors.map(insp => (
                      <option key={insp.id} value={insp.id}>{insp.nombre}</option>
                    ))}
                  </select>
                  
                  <button 
                    className="btn-primary" 
                    style={{ padding: '0 1.5rem', height: '42px', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.3)', border: 'none' }}
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
                  <span style={{ fontSize: '0.75rem', color: '#3b82f6', fontStyle: 'italic' }}>
                    * Selecciona un supervisor primero para habilitar la asignación masiva.
                  </span>
                )}
              </div>
            </div>

            <div className="table-container tabla-compacta">
              <table>
                <thead>
                  <tr>
                    {[
                      'Trabajo', 'Orden externa', 'Cliente', 'Asignado A', 'Supervisor', 'Tecnología', 'Sector', 'Terminal'
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
                    <tr><td colSpan={10} style={{textAlign: 'center', padding: '2rem'}}><Loader2 className="spinner" /></td></tr>
                  ) : ordenes.length === 0 ? (
                    <tr><td colSpan={10} style={{textAlign: 'center', padding: '2rem', color: 'var(--text-muted)'}}>No se encontraron órdenes.</td></tr>
                  ) : currentPaginatedOrdenes.map((o, idx) => {
                    const ordenId = o.orden_servicio || o.ticket;
                    return (
                      <tr key={idx}>
                        <td className="tc-trunc tc-clave" style={{ fontWeight: 700, color: 'var(--text-main)', ['--w' as any]: '200px' }}
                          title={String(o.descripcion_orden || o.ticket || (o as any).trabajo || '')}>
                          {/* Trabajo = descripción del Excel */}
                          {o.descripcion_orden || o.ticket || (o as any).trabajo || '-'}
                        </td>
                        <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {/* Orden externa = número de la orden (la clave con la que se asigna y se aplica el código) */}
                          {o.orden_externa_id || o.orden_servicio || '-'}
                        </td>
                        <td className="tc-trunc" style={{ ['--w' as any]: '140px' }} title={String(o.cliente || '')}>{o.cliente || '-'}</td>
                        <td>{o.tech || (o as any).tech_name || '-'}</td>
                        <td>{o.supervisor || '-'}</td>
                        <td>{o.tecnologia || (o as any)['tipo red'] || '-'}</td>
                        <td className="tc-trunc" style={{ ['--w' as any]: '120px' }} title={String(o.sector || (o as any).ciudad || '')}>{o.sector || (o as any).ciudad || '-'}</td>
                        <td className="tc-trunc" style={{ ['--w' as any]: '110px' }} title={String(o.terminal || '')}>{o.terminal || '-'}</td>
                        {/* Gestor Asignado */}
                        <td>
                          {(o as any).inspector ? (
                            <span className="badge info" title={String((o as any).inspector)}>{(o as any).inspector}</span>
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
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.75rem' }}>
                {conteo(ordenesTotal, ordenesCapped)} resultados
              </div>
              <Pagination currentPage={ordenesPage} totalPages={totalOrdenesPages} onPageChange={setOrdenesPage} />
            </div>
          </div>
        )}




        {activeTab === 'config' && perfilOk && (
          <div className="pt-tabs" role="tablist" aria-label="Secciones de Mi Perfil">
            <button role="tab" aria-selected={perfilTab === 'cuenta'} className={`pt-tab${perfilTab === 'cuenta' ? ' on' : ''}`} onClick={() => setPerfilTab('cuenta')}>
              <Settings size={17} /> Mi cuenta
            </button>
            <button role="tab" aria-selected={perfilTab === 'personal'} className={`pt-tab${perfilTab === 'personal' ? ' on' : ''}`} onClick={() => setPerfilTab('personal')}>
              <Users size={17} /> Personal <span className="pt-count">{inspectors.length}</span>
            </button>
          </div>
        )}

        {activeTab === 'config' && perfilOk && perfilTab === 'personal' && (
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
                  success = await updateInspector(editingInspector.id, { new_id: id_inspector, nombre, rol: rol as 'Admin' | 'Inspector' | 'QAOR', sector, usuario, password, correo_recuperacion } as any);
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
                      <option value="Inspector">Gestor Standard</option>
                      <option value="Admin">Administrador</option>
                      <option value="QAOR">QAOR</option>
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
                    <input type="text" name="password" required={!editingInspector} className="input-control" placeholder={editingInspector ? 'Dejar vacío para no cambiar' : 'Contraseña...'} />
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
                      <td><span className={`badge ${insp.rol === 'Admin' ? 'danger' : insp.rol === 'QAOR' ? 'success' : 'info'}`}>{insp.rol === 'Inspector' ? 'Gestor' : insp.rol}</span></td>
                      <td>
                        <div title={String(insp.id)}>ID: {/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(String(insp.id)) ? String(insp.id).slice(0, 8) + '…' : insp.id}</div>
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

        {activeTab === 'configuracion' && <ConfigModulos notify={displayToast} />}

        {activeTab === 'importar' && (
          <ImportExcel
            notify={displayToast}
            onImported={(m) => {
              if (m === 'tickets') loadTickets();
              if (m === 'ordenes') loadOrdenes();
              if (m === 'calidad') loadCalidad();
              if (m === 'razones') loadRazones();
            }}
            onOpenModule={(m) => setActiveTab(m)}
          />
        )}

        {activeTab === 'config' && !perfilOk && (
          <>
          <PerfilBloqueado />
          <ConfirmarClave
            titulo="Confirma tu contraseña"
            mensaje="Por seguridad, escribe tu contraseña de administrador para ver y modificar tu perfil, tu correo, tus códigos de recuperación y el personal."
            onConfirmado={() => setPerfilOk(true)}
            onCancelar={() => setActiveTab('dashboard')}
          />
          </>
        )}

        {activeTab === 'config' && perfilOk && perfilTab === 'cuenta' && (
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
              
              let success = false;
              try { success = await updateAdminProfile(username, password, recovery_email); }
              catch (err: any) { displayToast(err?.message || 'Error al actualizar perfil', 'error'); setSavingConfig(false); return; }
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
                <input type="password" name="password" className="input-control" placeholder="Dejar vacío para no cambiar" autoComplete="new-password" />
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

        {activeTab === 'config' && perfilOk && perfilTab === 'cuenta' && <RecoveryCodes usuario={localStorage.getItem('username') || adminConfig.admin_username || 'admin'} notify={displayToast} />}
        {activeTab === 'razones' && (
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h3 style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <AlertCircle size={20} color="var(--primary-color)" /> Gestión de Código Razón Cliente
              </h3>
              
              <div className="bulk-assign-panel blue">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={18} color="#3b82f6" />
                  <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>Asignación Masiva:</span>
                </div>
                
                <div className="bulk-assign-controls">
                  <select 
                    className="input-control" 
                    value={razonesSupervisorFilter}
                    onChange={(e) => setRazonesSupervisorFilter(e.target.value)}
                    style={{ flex: 1, minWidth: '200px', height: '42px', border: '1px solid #3b82f6' }}
                  >
                    <option value="">1. Seleccionar Supervisor...</option>
                    {Array.from(new Set(_razones.map(r => r.supervisor || r['Nombre del Supervisor']).filter(Boolean))).sort().map(sup => (
                      <option key={String(sup)} value={String(sup)}>{String(sup)}</option>
                    ))}
                  </select>

                  <span className="bulk-assign-arrow" style={{ color: '#3b82f6' }}>→</span>

                  <select 
                    className="assign-select" 
                    value={bulkAssignRazonesInspector}
                    onChange={(e) => setBulkAssignRazonesInspector(e.target.value)}
                    style={{ flex: 1, minWidth: '200px', height: '42px', border: '1px solid #3b82f6' }}
                  >
                    <option value="">2. Seleccionar Gestor...</option>
                    {inspectors.map(insp => (
                      <option key={insp.id} value={insp.id}>{insp.nombre}</option>
                    ))}
                  </select>
                  
                  <button 
                    className="btn-primary" 
                    style={{ padding: '0 1.5rem', height: '42px', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.3)', border: 'none' }}
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

        {activeTab === 'inspecciones' && (() => {
          // La lista mixta, la búsqueda, el filtro por tipo y la paginación se resuelven en el servidor
          const INSP_PER_PAGE = 25;
          const totalInspPages = Math.max(1, Math.ceil(inspPage.total / INSP_PER_PAGE));
          const paginated = inspPage.rows.map(r => ({ _origin: r.origen, _color: COLOR_ORIGEN[r.origen] || '#3b82f6', _id: r.id, _tech: r.tech, _gestor: r.gestor, _sup: r.sup, _sector: r.sector, _date: r.fecha_inspeccion, _code: r.codigo }));

          // ── CSV Export (hasta 10.000 filas con el filtro actual) ──────────────
          const exportCSV = async () => {
            const todo = await fetchInspecciones({ search: inspSearchD, tipo: inspeccionesTypeFilter, page: 1, pageSize: 10000 });
            const headers = ['Origen','ID/Ticket','Técnico','Gestor','Supervisor','Sector','Fecha Inspección','Código Aplicado'];
            const rows = todo.rows.map(i => [i.origen, i.id, i.tech, i.gestor, i.sup, i.sector, i.fecha_inspeccion, i.codigo].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
            const csv = [headers.join(','), ...rows].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `inspecciones_${new Date().toISOString().slice(0,10)}.csv`; a.click();
            URL.revokeObjectURL(url);
          };

          // ── Contadores por tipo (de la base, no de las filas descargadas) ─────
          const types: { label: string; key: string; color: string }[] = [
            { label: 'Todos', key: 'Todos', color: 'var(--primary-color)' },
            { label: `Tickets (${nf(stats?.tickets.inspeccionados)})`, key: 'Ticket', color: '#3b82f6' },
            { label: `Órdenes (${nf(stats?.ordenes.inspeccionados)})`, key: 'Orden', color: '#ef4444' },
            { label: `Repetidas (${nf(stats?.calidad.inspeccionados)})`, key: 'Repetida', color: '#f59e0b' },
            { label: `Razones (${nf(stats?.razones.inspeccionados)})`, key: 'Razon', color: '#ec4899' },
          ];

          return (
            <div className="glass-panel">
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <CheckCircle2 size={20} color="var(--primary-color)" /> Panel de Inspecciones Unificado
                  <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>{conteo(inspPage.total, inspPage.capped)} registros</span>
                </h3>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div className="search-bar" style={{ width: 'auto', minWidth: '320px' }}>
                    <Search size={18} />
                    <input
                      type="text"
                      placeholder="Buscar por ID, Técnico, Gestor, Supervisor..."
                      value={inspeccionesSearch}
                      onChange={(e) => { setInspeccionesSearch(e.target.value); setInspeccionesPage(1); }}
                    />
                  </div>
                  <button
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.8rem', height: '42px', whiteSpace: 'nowrap' }}
                    onClick={exportCSV}
                  >
                    <Filter size={14} /> Exportar CSV
                  </button>
                </div>
              </div>

              {/* Type filter chips */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                {types.map(t => (
                  <button
                    key={t.key}
                    onClick={() => { setInspeccionesTypeFilter(t.key); setInspeccionesPage(1); }}
                    style={{
                      padding: '0.35rem 0.9rem',
                      borderRadius: '999px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: `2px solid ${inspeccionesTypeFilter === t.key ? t.color : 'var(--glass-border)'}`,
                      background: inspeccionesTypeFilter === t.key ? t.color + '20' : 'transparent',
                      color: inspeccionesTypeFilter === t.key ? t.color : 'var(--text-muted)',
                      transition: 'all 0.2s'
                    }}
                  >{t.label}</button>
                ))}
              </div>

              {/* Table */}
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Origen</th>
                      <th>ORDEN / TICKET</th>
                      <th>Técnico</th>
                      <th>Gestor</th>
                      <th>Supervisor</th>
                      <th>Sector</th>
                      <th>Fecha Inspección</th>
                      <th>Código Aplicado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingInsp && paginated.length === 0 ? (
                      <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}><Loader2 className="spinner" /></td></tr>
                    ) : paginated.length === 0 ? (
                      <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No se encontraron resultados</td></tr>
                    ) : paginated.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <span style={{ background: item._color + '20', color: item._color, padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                            {item._origin}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item._id}</td>
                        <td style={{ fontSize: '0.85rem' }}>{item._tech}</td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 600 }}>{item._gestor !== '-' ? item._gestor : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>}</td>
                        <td style={{ fontSize: '0.85rem' }}>{item._sup}</td>
                        <td style={{ fontSize: '0.85rem' }}>{item._sector}</td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{item._date ? formatRDDate(item._date) : '—'}</td>
                        <td>
                          {item._code
                            ? <span style={{ fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ background: 'rgba(16,185,129,0.12)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem' }}>{item._code}</span>
                              </span>
                            : <span style={{ color: 'var(--text-muted)' }}>—</span>
                          }
                        </td>
                        <td>
                          <button
                            className="btn-danger"
                            style={{ padding: '0.3rem 0.8rem', fontSize: '0.72rem', height: '30px' }}
                            onClick={() => {
                              setConfirmModal({
                                isOpen: true,
                                message: `¿Cancelar inspección de ${item._origin} ${item._id}? El registro volverá a estar pendiente.`,
                                onConfirm: async () => {
                                  const type = item._origin === 'Ticket' ? 'tickets' : item._origin === 'Orden' ? 'ordenes' : item._origin === 'Razon' ? 'razones' : 'calidad';
                                  const { success } = await cancelManualCodigo(String(item._id), type);
                                  if (success) { displayToast('Inspección cancelada'); loadInsp(); loadStats(); }
                                  setConfirmModal(null);
                                }
                              });
                            }}
                          >Cancelar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <Pagination currentPage={inspeccionesPage} totalPages={totalInspPages} onPageChange={setInspeccionesPage} />
            </div>
          );
        })()}
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
      {pedirClave && (
        <ConfirmarClave
          titulo="Confirma tu contraseña"
          mensaje="Esta acción es sensible. Escribe tu contraseña para continuar."
          onConfirmado={() => { setPedirClave(false); displayToast('Contraseña confirmada. Repite la acción.', 'success'); }}
          onCancelar={() => setPedirClave(false)}
        />
      )}
    </div>
  );
}
