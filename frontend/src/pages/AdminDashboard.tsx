import { useState, useEffect } from 'react';
import { 
  Activity, LayoutDashboard, Users, FileText, BookOpen,
  LogOut, Search, Filter, AlertTriangle, CheckCircle2, Loader2,
  Sun, Moon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { fetchTickets, type Ticket, fetchInspectors, createInspector, updateInspector, deleteInspector, autoAssignTickets, assignTicket, assignTicketsBySupervisor, type Inspector, fetchRazones, assignRazonesBySupervisor, assignRazonIndividual, type RazonCliente } from '../services/api';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [supervisorFilter, setSupervisorFilter] = useState('');
  const [bulkAssignInspector, setBulkAssignInspector] = useState('');

  // Estados de Inspectores
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [loadingInspectors, setLoadingInspectors] = useState(false);
  const [showAddInspector, setShowAddInspector] = useState(false);
  const [editingInspector, setEditingInspector] = useState<Inspector | null>(null);

  const [razones, setRazones] = useState<RazonCliente[]>([]);
  const [loadingRazones, setLoadingRazones] = useState(false);
  const [razonesSearch, setRazonesSearch] = useState('');
  const [razonesSupervisorFilter, setRazonesSupervisorFilter] = useState('');
  const [razonesBulkAssignInspector, setRazonesBulkAssignInspector] = useState('');

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
  }, []);

  useEffect(() => {
    if (activeTab === 'personal') {
      loadInspectors();
    }
    if ((activeTab === 'codigos' || activeTab === 'dashboard') && razones.length === 0) {
      loadRazones();
    }
  }, [activeTab]);

  const loadRazones = async () => {
    setLoadingRazones(true);
    const data = await fetchRazones();
    setRazones(data);
    setLoadingRazones(false);
  };

  const loadInspectors = async () => {
    setLoadingInspectors(true);
    const data = await fetchInspectors();
    setInspectors(data);
    setLoadingInspectors(false);
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
    setTickets(data);
    setLoading(false);
  };
  
  const filteredRazones = razones.filter(r => {
    const term = razonesSearch.toLowerCase();
    const matchesSearch = (
      (r.Casos?.toString().toLowerCase().includes(term)) ||
      (r['Nombre del Ejecutor']?.toLowerCase().includes(term)) ||
      (r['Tarjeta del Ejecutor']?.toString().toLowerCase().includes(term)) ||
      (r['Nombre del Supervisor']?.toLowerCase().includes(term)) ||
      (r.Localidad?.toLowerCase().includes(term)) ||
      (r.Descripcion?.toLowerCase().includes(term))
    );
    const matchesSupervisor = razonesSupervisorFilter === '' || r['Nombre del Supervisor'] === razonesSupervisorFilter;
    return matchesSearch && matchesSupervisor;
  });
  
  const handleLogout = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('inspectorName');
    navigate('/login');
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
          <button className={`nav-item ${activeTab === 'personal' ? 'active' : ''}`} onClick={() => setActiveTab('personal')}>
            <Users size={20} /> Personal <span className="nav-badge">{inspectors.length}</span>
          </button>
          <button className={`nav-item ${activeTab === 'codigos' ? 'active' : ''}`} onClick={() => setActiveTab('codigos')}>
            <BookOpen size={20} /> Código Razón Cliente <span className="nav-badge">{razones.length}</span>
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
               activeTab === 'codigos' ? <><BookOpen size={28} color="var(--primary-color)" /> Código Razón Cliente ({razones.length})</> :
               <><Users size={28} color="var(--primary-color)" /> Directorio de Personal ({inspectors.length})</>}
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
              <div className="glass-panel kpi-card">
                <div className="kpi-icon blue"><BookOpen /></div>
                <div className="kpi-info">
                  <h3>Casos Razón Cliente</h3>
                  <p>{razones.length}</p>
                </div>
              </div>
            </div>

            <div className="glass-panel">
              <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle2 size={20} color="var(--primary-color)" /> Últimas Inspecciones</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Ticket</th>
                      <th>Técnico</th>
                      <th>Inspector</th>
                      <th>Asignar</th>
                      <th>Supervisor</th>
                      <th>Sector</th>
                      <th>Prioridad</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={8} style={{textAlign: 'center', padding: '2rem'}}><Loader2 className="spinner" /></td></tr>
                    ) : tickets.slice(0, 5).map((t, idx) => (
                      <tr key={t.id || t.ticket || idx}>
                        <td style={{ fontWeight: 500, color: 'var(--text-main)' }}>{t.ticket}</td>
                        <td>
                          <div>{t.tech || t.tech_id || '-'}</div>
                          {(t.tech || t.tech_id) && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {t.tech_id || t.tech}</div>}
                        </td>
                        <td>
                          <div>{t.inspector || t.inspector_id || <span style={{ color: 'var(--text-muted)' }}>Sin asignar</span>}</div>
                          {(t.inspector || t.inspector_id) && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {t.inspector_id || t.inspector}</div>}
                        </td>
                        <td>
                          <select 
                            className="assign-select" 
                            value=""
                            onChange={(e) => handleAssign(t.id || t.ticket, e.target.value)}
                          >
                            <option value="" disabled>Reasignar...</option>
                            {inspectors.map(insp => (
                              <option key={insp.id} value={insp.id}>{insp.nombre}</option>
                            ))}
                          </select>
                        </td>
                        <td>{t.supervisor}</td>
                        <td>{t.sector}</td>
                        <td>
                          <span className={`badge ${t.priority === 'Alta' ? 'danger' : t.priority === 'Media' ? 'warning' : 'success'}`}>
                            {t.priority}
                          </span>
                        </td>
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

            {/* ══ Charts Section (Recharts Premium) ══ */}
            {(() => {
              // Dynamic color based on percentage
              const pctColor = (pct: number): string => {
                if (pct >= 80) return '#da291c';
                if (pct >= 60) return '#e84d4d';
                if (pct >= 45) return '#f07a50';
                if (pct >= 30) return '#f0a030';
                if (pct >= 20) return '#d4b800';
                if (pct >= 12) return '#4fb86c';
                if (pct >= 7)  return '#3399cc';
                return '#7b68ee';
              };

              // Build bar chart data from Razones
              const techMap: Record<string, number> = {};
              razones.forEach(r => {
                const name = r['Nombre del Ejecutor'];
                if (name && String(name).trim()) {
                  const key = String(name).trim();
                  techMap[key] = (techMap[key] || 0) + 1;
                }
              });
              const allSorted = Object.entries(techMap).sort((a, b) => b[1] - a[1]);
              const maxVal = allSorted.length > 0 ? allSorted[0][1] : 1;
              const totalCases = allSorted.reduce((s, [, c]) => s + c, 0);

              const barData = allSorted
                .slice(0, 10)
                .map(([name, casos], i) => {
                  const pct = Math.round((casos / maxVal) * 100);
                  return { name: name.length > 18 ? name.slice(0, 16) + '…' : name, fullName: name, casos, pct, color: pctColor(pct), rank: i + 1 };
                });

              const pieTop = allSorted.slice(0, 7);
              const othersTotal = allSorted.slice(7).reduce((s, [, c]) => s + c, 0);
              const pieData = [
                ...pieTop.map(([name, value]) => ({ name, value, color: pctColor(Math.round((value / (maxVal || 1)) * 100)) })),
                ...(othersTotal > 0 ? [{ name: 'Otros', value: othersTotal, color: '#555e72' }] : []),
              ];

              // Gradient bar shape
              const GradientBar = (props: any) => {
                const { x, y, width, height, color, rank } = props;
                const id = `gb-${rank}`;
                return (
                  <g>
                    <defs>
                      <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                        <stop offset="100%" stopColor={color} stopOpacity={1} />
                      </linearGradient>
                      {rank === 1 && <filter id="glow-top"><feGaussianBlur stdDeviation="2.5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>}
                    </defs>
                    <rect x={x} y={y+2} width={width} height={height-4} rx={5} ry={5} fill={`url(#${id})`} filter={rank===1?'url(#glow-top)':undefined} />
                  </g>
                );
              };

              // Custom Y-axis tick with rank badge
              const CustomYTick = ({ x, y, payload }: any) => {
                const e = barData.find(d => d.name === payload.value);
                return (
                  <g transform={`translate(${x},${y})`}>
                    {e && <rect x={-112} y={-9} width={14} height={14} rx={3} fill={e.color} opacity={0.9} />}
                    {e && <text x={-105} y={1} textAnchor="middle" fill="#fff" fontSize={8} fontWeight={700}>{e.rank}</text>}
                    <text x={-92} y={4} fill="#c8d4e8" fontSize={11} fontWeight={500}>{payload.value}</text>
                  </g>
                );
              };

              const CustomTooltipBar = ({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                const sharePct = totalCases > 0 ? Math.round((d.casos / totalCases) * 100) : 0;
                const tooltipBg = theme === 'light' ? 'rgba(255,255,255,0.97)' : 'rgba(30,41,59,0.97)';
                const tooltipText = theme === 'light' ? '#111827' : '#f8fafc';
                const subText = theme === 'light' ? '#9ca3af' : '#94a3b8';

                return (
                  <div style={{ background: tooltipBg, border: `1px solid ${d.color}30`, borderRadius: '14px', padding: '0.85rem 1.1rem', boxShadow: `0 0 20px ${d.color}22, 0 8px 24px rgba(0,0,0,0.1)`, backdropFilter: 'blur(12px)', minWidth: 160 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, boxShadow: `0 0 6px ${d.color}` }} />
                      <span style={{ color: tooltipText, fontWeight: 700, fontSize: '0.82rem' }}>{d.fullName}</span>
                    </div>
                    <div style={{ color: d.color, fontWeight: 900, fontSize: '1.5rem', lineHeight: 1 }}>{d.casos}</div>
                    <div style={{ color: subText, fontSize: '0.72rem', marginTop: 3 }}>casos · <span style={{ color: theme === 'light' ? '#6b7280' : '#cbd5e1' }}>{sharePct}% del total</span></div>
                  </div>
                );
              };

              const CustomTooltipPie = ({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const d = payload[0];
                const c = (d.payload as any).color;
                const pct = totalCases > 0 ? Math.round((d.value / totalCases) * 100) : 0;
                const tooltipBg = theme === 'light' ? 'rgba(255,255,255,0.97)' : 'rgba(30,41,59,0.97)';
                const tooltipText = theme === 'light' ? '#111827' : '#f8fafc';
                const subText = theme === 'light' ? '#9ca3af' : '#94a3b8';

                return (
                  <div style={{ background: tooltipBg, border: `1px solid ${c}30`, borderRadius: '14px', padding: '0.85rem 1.1rem', boxShadow: `0 0 20px ${c}22, 0 8px 24px rgba(0,0,0,0.1)`, backdropFilter: 'blur(12px)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, boxShadow: `0 0 6px ${c}` }} />
                      <span style={{ color: tooltipText, fontWeight: 700, fontSize: '0.82rem' }}>{d.name}</span>
                    </div>
                    <div style={{ color: c, fontWeight: 900, fontSize: '1.5rem', lineHeight: 1 }}>{d.value}</div>
                    <div style={{ color: subText, fontSize: '0.72rem', marginTop: 3 }}>casos · <span style={{ color: theme === 'light' ? '#6b7280' : '#cbd5e1' }}>{pct}% del total</span></div>
                  </div>
                );
              };

              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>

                  {/* ── Bar Chart Panel ── */}
                  <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '1.5rem', backdropFilter: 'blur(12px)', boxShadow: '0 4px 20px rgba(0,0,0,0.05),inset 0 1px 0 rgba(255,255,255,0.8)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg,#da291c,#f07a50)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(218,41,28,0.35)' }}>
                          <Activity size={18} color="#fff" />
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-main)', fontWeight: 700, fontSize: '0.95rem' }}>Top Técnicos</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Código Razón Cliente</div>
                        </div>
                      </div>
                      <span style={{ background: 'rgba(218,41,28,0.08)', color: 'var(--primary-color)', fontSize: '0.72rem', fontWeight: 700, padding: '0.25rem 0.7rem', borderRadius: '999px', border: '1px solid rgba(218,41,28,0.2)' }}>
                        {barData.length} técnicos
                      </span>
                    </div>
                    {loadingRazones ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="spinner" size={32} color="var(--primary-color)" /></div>
                    ) : barData.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0', fontSize: '0.85rem' }}>Sin datos — visita el módulo Código Razón Cliente.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={290}>
                        <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 18, left: 118, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 6" stroke="rgba(0,0,0,0.05)" horizontal={false} />
                          <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={{ stroke: 'rgba(0,0,0,0.06)' }} tickLine={false} allowDecimals={false} />
                          <YAxis dataKey="name" type="category" width={0} tick={<CustomYTick />} axisLine={false} tickLine={false} />
                          <Tooltip content={<CustomTooltipBar />} cursor={{ fill: 'rgba(218,41,28,0.04)' }} />
                          <Bar dataKey="casos" maxBarSize={20}
                            shape={(props: any) => { const e = barData[props.index]; return <GradientBar {...props} color={e?.color} rank={e?.rank} />; }}
                          >
                            {barData.map((_, i) => <Cell key={i} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* ── Pie Chart Panel ── */}
                  <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '1.5rem', backdropFilter: 'blur(12px)', boxShadow: '0 4px 20px rgba(0,0,0,0.05),inset 0 1px 0 rgba(255,255,255,0.8)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg,#3a0ca3,#7b2ff7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(123,47,247,0.35)' }}>
                          <BookOpen size={18} color="#fff" />
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-main)', fontWeight: 700, fontSize: '0.95rem' }}>Distribución</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Casos por técnico</div>
                        </div>
                      </div>
                      <span style={{ background: 'rgba(123,47,247,0.08)', color: '#7b2ff7', fontSize: '0.72rem', fontWeight: 700, padding: '0.25rem 0.7rem', borderRadius: '999px', border: '1px solid rgba(123,47,247,0.2)' }}>
                        {totalCases} casos
                      </span>
                    </div>
                    {loadingRazones ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="spinner" size={32} color="var(--primary-color)" /></div>
                    ) : pieData.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0', fontSize: '0.85rem' }}>Sin datos disponibles.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={290}>
                        <PieChart>
                          <defs>
                            {pieData.map((d, i) => (
                              <radialGradient key={i} id={`pg-${i}`} cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor={d.color} stopOpacity={1} />
                                <stop offset="100%" stopColor={d.color} stopOpacity={0.65} />
                              </radialGradient>
                            ))}
                          </defs>
                          <Pie data={pieData} cx="50%" cy="43%" innerRadius={66} outerRadius={100} paddingAngle={2.5} dataKey="value" animationBegin={0} animationDuration={1000} strokeWidth={0}>
                            {pieData.map((_d, i) => (
                              <Cell key={i} fill={`url(#pg-${i})`} stroke="#fff" strokeWidth={2} />
                            ))}
                          </Pie>
                          <text x="50%" y="40%" textAnchor="middle">
                            <tspan x="50%" dy="-6" fontSize="22" fontWeight="900" fill={theme === 'light' ? '#111827' : '#f1f5f9'}>{totalCases}</tspan>
                            <tspan x="50%" dy="20" fontSize="9" fill={theme === 'light' ? '#9ca3af' : '#94a3b8'} letterSpacing="0.1em">TOTAL CASOS</tspan>
                          </text>
                          <Tooltip content={<CustomTooltipPie />} />
                          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: '0.71rem', paddingTop: '6px' }} formatter={(v) => <span style={{ color: 'var(--text-muted)' }}>{v}</span>} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                </div>
              );
            })()}
          </>
        )}




        {activeTab === 'tickets' && (
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
              <h3 style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FileText size={20} color="var(--primary-color)" /> Todos los Tickets</h3>
              {supervisorFilter && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(218, 41, 28, 0.05)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(218, 41, 28, 0.1)' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>Asignar pendientes a:</span>
                  <select 
                    className="assign-select"
                    value={bulkAssignInspector}
                    onChange={e => setBulkAssignInspector(e.target.value)}
                  >
                    <option value="" disabled>Seleccionar inspector...</option>
                    {inspectors.map(insp => <option key={insp.id} value={insp.id}>{insp.nombre}</option>)}
                  </select>
                  <button 
                    className="btn-primary" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                    disabled={!bulkAssignInspector}
                    onClick={async () => {
                      const inspector = inspectors.find(i => i.id === bulkAssignInspector);
                      if (!inspector) return;
                      const pendingCount = tickets.filter(t => t.supervisor === supervisorFilter && t.status === 'Pendiente').length;
                      if(pendingCount === 0) {
                        displayToast(`El supervisor ${supervisorFilter} no tiene tickets pendientes para asignar.`, 'error');
                        return;
                      }
                      setConfirmModal({
                        isOpen: true,
                        message: `¿Asignar ${pendingCount} tickets pendientes de ${supervisorFilter} a ${inspector.nombre}?`,
                        onConfirm: async () => {
                          const updated = await assignTicketsBySupervisor(supervisorFilter, inspector.id, inspector.nombre);
                          displayToast(`Se han asignado ${updated} tickets a ${inspector.nombre}.`, 'success');
                          loadTickets();
                          setConfirmModal(null);
                        }
                      });
                    }}
                  >
                    Asignar Todos
                  </button>
                </div>
              )}
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Técnico</th>
                    <th>Inspector</th>
                    <th>Asignar</th>
                    <th>Supervisor</th>
                    <th>Sector</th>
                    <th>Prioridad</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} style={{textAlign: 'center', padding: '2rem'}}><Loader2 className="spinner" /></td></tr>
                  ) : tickets.filter(t => {
                    const matchesSearch = t.ticket?.toString().toLowerCase().includes(searchTerm.toLowerCase()) || 
                                          t.tech_id?.toString().toLowerCase().includes(searchTerm.toLowerCase()) || 
                                          t.tech?.toString().toLowerCase().includes(searchTerm.toLowerCase());
                    const matchesSupervisor = supervisorFilter === '' || t.supervisor === supervisorFilter;
                    return matchesSearch && matchesSupervisor;
                  }).map((t, idx) => (
                    <tr key={t.id || t.ticket || idx}>
                      <td style={{ fontWeight: 500, color: 'var(--text-main)' }}>{t.ticket}</td>
                      <td>
                        <div>{t.tech || t.tech_id || '-'}</div>
                        {(t.tech || t.tech_id) && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {t.tech_id || t.tech}</div>}
                      </td>
                      <td>
                        <div>{t.inspector || t.inspector_id || <span style={{ color: 'var(--text-muted)' }}>Sin asignar</span>}</div>
                        {(t.inspector || t.inspector_id) && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {t.inspector_id || t.inspector}</div>}
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
                      <td>{t.supervisor}</td>
                      <td>{t.sector}</td>
                      <td>
                        <span className={`badge ${t.priority === 'Alta' ? 'danger' : t.priority === 'Media' ? 'warning' : 'success'}`}>
                          {t.priority}
                        </span>
                      </td>
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
                const sector = formData.get('sector') as string;
                const usuario = formData.get('usuario') as string;
                const password = formData.get('password') as string;
                
                let success;
                if (editingInspector) {
                  success = await updateInspector(editingInspector.id, { nombre, sector, usuario, password });
                } else {
                  success = await createInspector(nombre, sector, usuario, password);
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
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingInspectors ? (
                    <tr><td colSpan={5} style={{textAlign: 'center', padding: '2rem'}}><Loader2 className="spinner" /></td></tr>
                  ) : inspectors.length === 0 ? (
                    <tr><td colSpan={5} style={{textAlign: 'center', padding: '2rem', color: 'var(--text-muted)'}}>No hay inspectores registrados. Haz clic en "Añadir Inspector".</td></tr>
                  ) : inspectors.map((insp, idx) => (
                    <tr key={idx}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{insp.nombre}</div>
                      </td>
                      <td><span className="badge info">Inspector</span></td>
                      <td>
                        <div>ID: {insp.id}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{insp.usuario || 'Sin usuario'}</div>
                      </td>
                      <td>{insp.password ? '••••••••' : '***'}</td>
                      <td>{insp.sector}</td>
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

        {activeTab === 'codigos' && (
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
              <h3 style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BookOpen size={20} color="var(--primary-color)" /> Códigos de Razón de Cliente ({razones.length})
              </h3>
              
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <select 
                  className="input-control" 
                  value={razonesSupervisorFilter} 
                  onChange={(e) => setRazonesSupervisorFilter(e.target.value)}
                  style={{ width: 'auto', minWidth: '200px' }}
                >
                  <option value="">Todos los supervisores</option>
                  {Array.from(new Set(razones.map(r => r['Nombre del Supervisor']).filter(Boolean))).map(sup => (
                    <option key={sup} value={sup}>{sup}</option>
                  ))}
                </select>
                <div className="search-bar">
                  <Search size={18} />
                  <input 
                    type="text" 
                    placeholder="Buscar código o detalle..." 
                    value={razonesSearch}
                    onChange={(e) => setRazonesSearch(e.target.value)}
                  />
                </div>
              </div>
              
              {razonesSupervisorFilter && (
                <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginTop: '-0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(218, 41, 28, 0.05)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(218, 41, 28, 0.1)' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>Asignar filtrados a:</span>
                    <select 
                      className="assign-select"
                      value={razonesBulkAssignInspector}
                      onChange={e => setRazonesBulkAssignInspector(e.target.value)}
                    >
                      <option value="" disabled>Seleccionar inspector...</option>
                      {inspectors.map(insp => <option key={insp.id} value={insp.id}>{insp.nombre}</option>)}
                    </select>
                    <button 
                      className="btn-primary" 
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                      disabled={!razonesBulkAssignInspector}
                      onClick={async () => {
                        const inspector = inspectors.find(i => i.id === razonesBulkAssignInspector);
                        if (!inspector) return;
                        const count = filteredRazones.length;
                        if(count === 0) {
                          displayToast(`No hay registros filtrados para asignar.`, 'error');
                          return;
                        }
                        setConfirmModal({
                          isOpen: true,
                          message: `¿Asignar ${count} registros de ${razonesSupervisorFilter} a ${inspector.nombre}?`,
                          onConfirm: async () => {
                            const updated = await assignRazonesBySupervisor(razonesSupervisorFilter, inspector.id, inspector.nombre);
                            displayToast(`Se han asignado ${updated} registros a ${inspector.nombre}.`, 'success');
                            loadRazones();
                            setConfirmModal(null);
                          }
                        });
                      }}
                    >
                      Asignar Todos
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Casos</th>
                    <th>Técnico</th>
                    <th>Inspector</th>
                    <th>Asignar</th>
                    <th>Supervisor</th>
                    <th>Localidad</th>
                    <th>Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingRazones ? (
                    <tr><td colSpan={7} style={{textAlign: 'center', padding: '2rem'}}><Loader2 className="spinner" /></td></tr>
                  ) : filteredRazones.length === 0 ? (
                    <tr><td colSpan={7} style={{textAlign: 'center', padding: '2rem', color: 'var(--text-muted)'}}>No hay datos que coincidan con la búsqueda.</td></tr>
                  ) : filteredRazones.map((r, idx) => (
                    <tr key={idx}>
                      <td><span className="badge info">{r.Casos || '-'}</span></td>
                      <td style={{ fontWeight: 500 }}>
                        {r['Nombre del Ejecutor'] || '-'}
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {r['Tarjeta del Ejecutor'] || '-'}</div>
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {r['Nombre del Inspector'] || <span style={{ color: 'var(--text-muted)' }}>Sin asignar</span>}
                        {r['Inspector ID'] && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {r['Inspector ID']}</div>}
                      </td>
                      <td>
                        <select 
                          className="assign-select" 
                          value=""
                          onChange={async (e) => {
                            const inspector = inspectors.find(i => i.id === e.target.value);
                            if(inspector) {
                              const success = await assignRazonIndividual(r.Casos || '', inspector.id, inspector.nombre);
                              if(success) {
                                displayToast(`Caso ${r.Casos} asignado a ${inspector.nombre}`, 'success');
                                loadRazones();
                              } else {
                                displayToast('Error al asignar', 'error');
                              }
                            }
                          }}
                        >
                          <option value="" disabled>Asignar a...</option>
                          {inspectors.map(insp => (
                            <option key={insp.id} value={insp.id}>{insp.nombre}</option>
                          ))}
                        </select>
                      </td>
                      <td>{r['Nombre del Supervisor'] || '-'}</td>
                      <td>{r.Localidad || '-'}</td>
                      <td>{r.Descripcion || '-'}</td>
                    </tr>
                  ))}
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
