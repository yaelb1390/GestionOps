'use client';
import { useState, useMemo, useEffect } from 'react';
import { 
  Activity, LayoutDashboard, Upload, Users, FileText, 
  Settings, LogOut, Search, AlertTriangle, CheckCircle2, TrendingUp
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const initialTickets = [
  { id: 1, ticket: '53541154', tech_id: '601499', tech: 'Victor Manuel Martinez', supervisor: 'Jean Carlos Ramirez', sector: 'PUEBLO NUEVO', state: 'Activa', tech_type: 'ADSL2+,POTS', work_name: 'Reparacion Internet', inspector: '', inspected: false },
  { id: 2, ticket: '53544683', tech_id: '601504', tech: 'Henry Perez', supervisor: 'Jean Carlos Ramirez', sector: 'LOS PERALEJOS', state: 'Activa', tech_type: 'GPON', work_name: 'Reparacion Internet', inspector: '', inspected: false },
  { id: 3, ticket: '53541658', tech_id: '601158', tech: 'Aristides Silverio Encarnacion', supervisor: 'Evangelista Nuñez', sector: 'BAYONA', state: 'Activa', tech_type: 'GPON', work_name: 'Reparacion Internet', inspector: '', inspected: false },
  { id: 4, ticket: '53541574', tech_id: '601753', tech: 'Saul Antonio Pina Hernandez', supervisor: 'Evangelista Nuñez', sector: 'JUAN PABLO DUARTE', state: 'Iniciada', tech_type: 'ADSL2+,POTS', work_name: 'Reparacion Internet', inspector: '', inspected: false },
  { id: 5, ticket: '53542596', tech_id: '601228', tech: 'Yancarlos Vizcaino Acevedo', supervisor: 'Celinette Martinez villar', sector: 'RENACIMIENTO', state: 'Activa', tech_type: 'GPON', work_name: 'Reparacion Internet', inspector: '', inspected: true },
];

const mockInspectors: string[] = []; // Se llena dinámicamente desde el estado


export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tickets, setTickets] = useState(initialTickets);
  const [selectedSupervisor, setSelectedSupervisor] = useState('Todos');
  const [selectedTickets, setSelectedTickets] = useState<number[]>([]);
  const [selectedInspector, setSelectedInspector] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSector, setFilterSector] = useState('Todos');

  // OneDrive import state
  const [onedriveUrl, setOnedriveUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{type: 'success' | 'error', message: string} | null>(null);

  // Inspector users state - load from localStorage on mount
  const [inspectorUsers, setInspectorUsers] = useState<{id:number;nombre:string;apellido:string;usuario:string;password:string;activo:boolean;creado:string}[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('claro_inspectors');
      if (stored) return JSON.parse(stored);
    }
    return [
      { id: 1, nombre: 'Joel', apellido: 'Berroa', usuario: 'joel.berroa', password: 'claro123', activo: true, creado: '26/04/2026' },
      { id: 2, nombre: 'Maria', apellido: 'Lopez', usuario: 'maria.lopez', password: 'claro123', activo: true, creado: '26/04/2026' },
    ];
  });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({ nombre: '', apellido: '', password: '', confirmPassword: '' });
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!newUser.nombre.trim() || !newUser.apellido.trim()) {
      setFormError('El nombre y apellido son obligatorios.');
      return;
    }
    if (newUser.password.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newUser.password !== newUser.confirmPassword) {
      setFormError('Las contraseñas no coinciden.');
      return;
    }
    const usuario = `${newUser.nombre.toLowerCase()}.${newUser.apellido.toLowerCase()}`;
    const existe = inspectorUsers.find(u => u.usuario === usuario);
    if (existe) {
      setFormError('Ya existe un inspector con ese nombre y apellido.');
      return;
    }
    const today = new Date().toLocaleDateString('es-DO');
    setInspectorUsers(prev => [...prev, {
      id: prev.length + 1,
      nombre: newUser.nombre.trim(),
      apellido: newUser.apellido.trim(),
      usuario,
      password: newUser.password,
      activo: true,
      creado: today
    }]);
    setNewUser({ nombre: '', apellido: '', password: '', confirmPassword: '' });
    setShowCreateForm(false);
  };

  const handleToggleUser = (id: number) => {
    setInspectorUsers(prev => prev.map(u => u.id === id ? { ...u, activo: !u.activo } : u));
  };

  const handleCopyUser = (usuario: string, id: number) => {
    navigator.clipboard.writeText(usuario);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleImportOneDrive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onedriveUrl.trim()) return;

    setIsImporting(true);
    setImportStatus(null);

    try {
      const res = await fetch('/api/import-onedrive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: onedriveUrl.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al importar los datos');
      }

      setTickets(data.tickets.map((t: any) => ({ ...t, inspector: '', inspected: false })));
      setImportStatus({ type: 'success', message: `¡Éxito! Se importaron ${data.count} tickets correctamente.` });
      setOnedriveUrl('');
      // Redirect to tickets tab after 2 seconds
      setTimeout(() => {
        setActiveTab('tickets');
        setImportStatus(null);
      }, 2000);
    } catch (err: any) {
      setImportStatus({ type: 'error', message: err.message });
    } finally {
      setIsImporting(false);
    }
  };

  // Persist inspectors to localStorage whenever list changes
  useEffect(() => {
    localStorage.setItem('claro_inspectors', JSON.stringify(inspectorUsers));
  }, [inspectorUsers]);

  // Dynamic inspector list for assignment dropdown (only active users)
  const activeInspectorNames = inspectorUsers
    .filter(u => u.activo)
    .map(u => `${u.nombre} ${u.apellido}`);

  const supervisors = ['Todos', ...Array.from(new Set(tickets.map(t => t.supervisor)))];
  const sectors = ['Todos', ...Array.from(new Set(tickets.map(t => t.sector)))];

  // Inspector stats
  const inspectorStats = useMemo(() => {
    return mockInspectors.map(name => {
      const assigned = tickets.filter(t => t.inspector === name);
      const completed = assigned.filter(t => t.inspected).length;
      const pct = assigned.length > 0 ? Math.round((completed / assigned.length) * 100) : 0;
      return { name, total: assigned.length, completed, pct };
    });
  }, [tickets]);

  // Multi-filter: supervisor + search + sector
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchSupervisor = selectedSupervisor === 'Todos' || t.supervisor === selectedSupervisor;
      const matchSector = filterSector === 'Todos' || t.sector === filterSector;
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || 
        t.ticket.toLowerCase().includes(q) ||
        t.supervisor.toLowerCase().includes(q) ||
        t.sector.toLowerCase().includes(q) ||
        t.tech.toLowerCase().includes(q) ||
        t.inspector.toLowerCase().includes(q);
      return matchSupervisor && matchSector && matchSearch;
    });
  }, [tickets, selectedSupervisor, filterSector, searchQuery]);

  const toggleTicketSelection = (id: number) => {
    setSelectedTickets(prev => 
      prev.includes(id) ? prev.filter(tId => tId !== id) : [...prev, id]
    );
  };

  const toggleAllSelection = () => {
    if (selectedTickets.length === filteredTickets.length) {
      setSelectedTickets([]);
    } else {
      setSelectedTickets(filteredTickets.map(t => t.id));
    }
  };

  const handleAssignTickets = () => {
    if (!selectedInspector || selectedTickets.length === 0) {
      alert("Selecciona un inspector y al menos un ticket.");
      return;
    }
    setTickets(prev => prev.map(t => 
      selectedTickets.includes(t.id) ? { ...t, inspector: selectedInspector } : t
    ));
    setSelectedTickets([]);
    setSelectedInspector('');
  };
  
  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/claro-logo.png" alt="Claro" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} />
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button className={`nav-item ${activeTab === 'tickets' ? 'active' : ''}`} onClick={() => setActiveTab('tickets')}>
            <FileText size={20} /> Tickets
          </button>
          <button className={`nav-item ${activeTab === 'import' ? 'active' : ''}`} onClick={() => setActiveTab('import')}>
            <Upload size={20} /> Importar Datos
          </button>
          <button className={`nav-item ${activeTab === 'personal' ? 'active' : ''}`} onClick={() => setActiveTab('personal')}>
            <Users size={20} /> Personal
          </button>
          <button className={`nav-item ${activeTab === 'ajustes' ? 'active' : ''}`} onClick={() => setActiveTab('ajustes')}>
            <Settings size={20} /> Ajustes
          </button>
          <div style={{ flex: 1 }}></div>
          <button className="nav-item" onClick={() => router.push('/')} style={{ color: 'var(--danger-color)' }}>
            <LogOut size={20} /> Salir
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="header-actions">
          <div>
            <h1 className="title">
              {activeTab === 'dashboard' ? 'Resumen Operativo' : 
               activeTab === 'tickets' ? 'Gestión de Tickets' : 
               activeTab === 'import' ? 'Importación Excel' :
               activeTab === 'personal' ? 'Personal' : 'Configuraciones'}
            </h1>
            <p className="subtitle">Centro de control de averías de fibra óptica</p>
          </div>
          {activeTab === 'tickets' && (
            <div className="search-bar">
              <Search size={18} color="var(--text-muted)" />
              <input type="text" placeholder="Buscar ticket, técnico..." />
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
                  <p>1,248</p>
                </div>
              </div>
              <div className="glass-panel kpi-card">
                <div className="kpi-icon amber"><AlertTriangle /></div>
                <div className="kpi-info">
                  <h3>Pendientes Inspección</h3>
                  <p>342</p>
                </div>
              </div>
              <div className="glass-panel kpi-card">
                <div className="kpi-icon green"><CheckCircle2 /></div>
                <div className="kpi-info">
                  <h3>Inspeccionados</h3>
                  <p>890</p>
                </div>
              </div>
              <div className="glass-panel kpi-card">
                <div className="kpi-icon red"><Activity /></div>
                <div className="kpi-info">
                  <h3>Requieren Corrección</h3>
                  <p>16</p>
                </div>
              </div>
            </div>

            <div className="glass-panel">
              <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>Últimas Inspecciones</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Trabajo</th>
                      <th>Técnico</th>
                      <th>Supervisor</th>
                      <th>Sector</th>
                      <th>Tecnología</th>
                      <th>Tipo de Trabajo</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.slice(0, 5).map(t => (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{t.ticket}</td>
                        <td>
                          <div style={{ color: 'var(--text-main)' }}>{t.tech}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {t.tech_id}</div>
                        </td>
                        <td style={{ color: 'var(--text-main)' }}>{t.supervisor}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{t.sector}</td>
                        <td>
                          <span className={`badge ${t.tech_type.includes('GPON') ? 'success' : 'info'}`}>
                            {t.tech_type}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{t.work_name}</td>
                        <td>
                          <span className={`badge ${t.state === 'Activa' ? 'success' : 'warning'}`}>
                            {t.state}
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

        {activeTab === 'import' && (
          <div className="glass-panel" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', padding: '4rem 2rem' }}>
            <div style={{ width: '80px', height: '80px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: 'var(--primary-color)' }}>
              <Upload size={40} />
            </div>
            <h2 style={{ color: 'var(--text-main)', marginBottom: '1rem' }}>Importar desde OneDrive / SharePoint</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
              Pega el enlace de acceso público ("Cualquier persona con el enlace") del archivo Excel.
            </p>
            
            <form onSubmit={handleImportOneDrive} style={{ textAlign: 'left' }}>
              <div className="input-group">
                <label>URL del archivo Excel</label>
                <input 
                  type="url" 
                  className="input-control" 
                  placeholder="https://1drv.ms/x/s!..."
                  value={onedriveUrl}
                  onChange={(e) => setOnedriveUrl(e.target.value)}
                  required
                  disabled={isImporting}
                />
              </div>

              {importStatus && (
                <div style={{ 
                  background: importStatus.type === 'error' ? 'rgba(218,41,28,0.08)' : 'rgba(16,185,129,0.08)', 
                  border: `1px solid ${importStatus.type === 'error' ? 'rgba(218,41,28,0.3)' : 'rgba(16,185,129,0.3)'}`, 
                  borderRadius: '8px', padding: '0.8rem 1rem', marginBottom: '1.5rem', 
                  color: importStatus.type === 'error' ? 'var(--primary-color)' : 'var(--secondary-color)', 
                  fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' 
                }}>
                  {importStatus.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                  {importStatus.message}
                </div>
              )}

              <button 
                type="submit" 
                className="btn-primary" 
                style={{ width: '100%', justifyContent: 'center', padding: '1rem' }}
                disabled={isImporting || !onedriveUrl.trim()}
              >
                {isImporting ? 'Importando datos...' : 'Sincronizar Datos'}
              </button>
            </form>

            <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px dashed var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              O puedes <label htmlFor="excel-upload" style={{ color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 600 }}>subir un archivo manualmente</label>.
              <input type="file" id="excel-upload" hidden accept=".xlsx, .xls, .csv" />
            </div>
          </div>
        )}

        {activeTab === 'tickets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Inspector Progress Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
              {inspectorStats.map(ins => (
                <div key={ins.name} className="glass-panel" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>{ins.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '2px' }}>Inspector</div>
                    </div>
                    <div style={{ 
                      width: '40px', height: '40px', borderRadius: '50%', 
                      background: ins.total > 0 ? 'rgba(218,41,28,0.1)' : 'var(--border-color)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--primary-color)', fontWeight: 700, fontSize: '1rem'
                    }}>
                      {ins.total}
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{ marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>{ins.completed} completados</span>
                    <span style={{ fontWeight: 600, color: ins.pct === 100 ? 'var(--secondary-color)' : 'var(--primary-color)' }}>{ins.pct}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${ins.pct}%`, 
                      background: ins.pct === 100 ? 'var(--secondary-color)' : 'var(--primary-color)',
                      borderRadius: '99px',
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                  {ins.total === 0 && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin tickets asignados</div>
                  )}
                </div>
              ))}
            </div>

            {/* Filters + Assignment Toolbar */}
            <div className="glass-panel">
              {/* Search & Filter Row */}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
                {/* Search */}
                <div className="search-bar" style={{ flex: '1 1 220px', minWidth: '180px' }}>
                  <Search size={16} color="var(--text-muted)" />
                  <input 
                    type="text" 
                    placeholder="Buscar por ticket, supervisor, sector..."
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setSelectedTickets([]); }}
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 4px' }}>×</button>
                  )}
                </div>

                {/* Sector filter */}
                <select 
                  className="input-control" 
                  value={filterSector} 
                  onChange={e => { setFilterSector(e.target.value); setSelectedTickets([]); }}
                  style={{ minWidth: '160px', margin: 0 }}
                >
                  {sectors.map(s => <option key={s} value={s}>{s === 'Todos' ? 'Todos los Sectores' : s}</option>)}
                </select>

                {/* Supervisor filter */}
                <select 
                  className="input-control" 
                  value={selectedSupervisor} 
                  onChange={e => { setSelectedSupervisor(e.target.value); setSelectedTickets([]); }}
                  style={{ minWidth: '200px', margin: 0 }}
                >
                  {supervisors.map(s => <option key={s} value={s}>{s === 'Todos' ? 'Todos los Supervisores' : s}</option>)}
                </select>
              </div>

              {/* Assignment Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <strong style={{ color: 'var(--text-main)' }}>{filteredTickets.length}</strong> tickets encontrados
                  {selectedTickets.length > 0 && <span style={{ color: 'var(--primary-color)', marginLeft: '8px' }}>• {selectedTickets.length} seleccionados</span>}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <select 
                    className="input-control"
                    value={selectedInspector}
                    onChange={e => setSelectedInspector(e.target.value)}
                    style={{ margin: 0 }}
                  >
                    <option value="">Asignar a Inspector...</option>
                    {activeInspectorNames.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                  <button 
                    className="btn-primary" 
                    onClick={handleAssignTickets}
                    disabled={selectedTickets.length === 0 || !selectedInspector}
                    style={{ opacity: (selectedTickets.length === 0 || !selectedInspector) ? 0.5 : 1, whiteSpace: 'nowrap' }}
                  >
                    <TrendingUp size={15} /> Asignar ({selectedTickets.length})
                  </button>
                </div>
              </div>

              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <input 
                          type="checkbox" 
                          checked={selectedTickets.length > 0 && selectedTickets.length === filteredTickets.length}
                          onChange={toggleAllSelection}
                          style={{ cursor: 'pointer' }}
                        />
                      </th>
                      <th>Trabajo</th>
                      <th>Técnico</th>
                      <th>Supervisor</th>
                      <th>Sector</th>
                      <th>Tecnología</th>
                      <th>Inspector Asignado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map(t => (
                      <tr key={t.id} style={{ background: selectedTickets.includes(t.id) ? 'rgba(218, 41, 28, 0.05)' : 'transparent', transition: 'background 0.2s' }}>
                        <td>
                          <input 
                            type="checkbox" 
                            checked={selectedTickets.includes(t.id)}
                            onChange={() => toggleTicketSelection(t.id)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{t.ticket}</td>
                        <td>
                          <div style={{ color: 'var(--text-main)' }}>{t.tech}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {t.tech_id}</div>
                        </td>
                        <td style={{ color: 'var(--text-main)' }}>{t.supervisor}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{t.sector}</td>
                        <td>
                          <span className={`badge ${t.tech_type.includes('GPON') ? 'success' : 'info'}`}>
                            {t.tech_type}
                          </span>
                        </td>
                        <td>
                          {t.inspector ? (
                            <span className="badge" style={{ background: 'rgba(218,41,28,0.12)', color: 'var(--primary-color)' }}>
                              <Users size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }}/> 
                              {t.inspector}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>Sin asignar</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredTickets.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                          No se encontraron tickets con los filtros seleccionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
        )}

        {activeTab === 'personal' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '900px' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ color: 'var(--text-main)', fontSize: '1.4rem', fontWeight: 700 }}>Usuarios Inspectores</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>{inspectorUsers.length} inspector(es) registrado(s)</p>
              </div>
              <button 
                className="btn-primary" 
                onClick={() => { setShowCreateForm(!showCreateForm); setFormError(''); setNewUser({ nombre: '', apellido: '', password: '', confirmPassword: '' }); }}
              >
                <Users size={16} /> {showCreateForm ? 'Cancelar' : 'Crear Inspector'}
              </button>
            </div>

            {/* Create Form */}
            {showCreateForm && (
              <div className="glass-panel" style={{ border: '2px solid rgba(218,41,28,0.2)', padding: '1.75rem' }}>
                <h3 style={{ color: 'var(--text-main)', marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
                  Nuevo Usuario Inspector
                </h3>
                <form onSubmit={handleCreateUser}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div className="input-group" style={{ margin: 0 }}>
                      <label>Nombre</label>
                      <input 
                        className="input-control" 
                        type="text" 
                        placeholder="Ej: Joel"
                        value={newUser.nombre}
                        onChange={e => setNewUser(p => ({ ...p, nombre: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="input-group" style={{ margin: 0 }}>
                      <label>Primer Apellido</label>
                      <input 
                        className="input-control" 
                        type="text" 
                        placeholder="Ej: Berroa"
                        value={newUser.apellido}
                        onChange={e => setNewUser(p => ({ ...p, apellido: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  {newUser.nombre && newUser.apellido && (
                    <div style={{ background: 'rgba(218,41,28,0.05)', border: '1px solid rgba(218,41,28,0.15)', borderRadius: '8px', padding: '0.6rem 1rem', marginBottom: '1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      Usuario generado: <strong style={{ color: 'var(--primary-color)' }}>{newUser.nombre.toLowerCase()}.{newUser.apellido.toLowerCase()}</strong>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div className="input-group" style={{ margin: 0 }}>
                      <label>Contraseña</label>
                      <input 
                        className="input-control" 
                        type="password" 
                        placeholder="Mínimo 6 caracteres"
                        value={newUser.password}
                        onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="input-group" style={{ margin: 0 }}>
                      <label>Confirmar Contraseña</label>
                      <input 
                        className="input-control" 
                        type="password" 
                        placeholder="Repetir contraseña"
                        value={newUser.confirmPassword}
                        onChange={e => setNewUser(p => ({ ...p, confirmPassword: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  {formError && (
                    <div style={{ background: 'rgba(218,41,28,0.08)', border: '1px solid rgba(218,41,28,0.3)', borderRadius: '8px', padding: '0.6rem 1rem', marginBottom: '1rem', color: 'var(--primary-color)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <AlertTriangle size={15} /> {formError}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn-secondary" onClick={() => setShowCreateForm(false)}>Cancelar</button>
                    <button type="submit" className="btn-primary"><CheckCircle2 size={16} /> Crear Usuario</button>
                  </div>
                </form>
              </div>
            )}

            {/* Users Table */}
            <div className="glass-panel">
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Inspector</th>
                      <th>Usuario</th>
                      <th>Contraseña</th>
                      <th>Creado</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspectorUsers.map(u => (
                      <tr key={u.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(218,41,28,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary-color)', fontSize: '0.9rem', flexShrink: 0 }}>
                              {u.nombre[0]}{u.apellido[0]}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{u.nombre} {u.apellido}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Inspector de Campo</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <code style={{ background: 'var(--border-color)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.82rem' }}>{u.usuario}</code>
                            <button 
                              onClick={() => handleCopyUser(u.usuario, u.id)} 
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedId === u.id ? 'var(--secondary-color)' : 'var(--text-muted)', fontSize: '0.75rem', padding: '2px 6px' }}
                              title="Copiar usuario"
                            >
                              {copiedId === u.id ? '✓ Copiado' : 'Copiar'}
                            </button>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <code style={{ background: 'var(--border-color)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.82rem', letterSpacing: '2px' }}>
                              {showPassword === u.id ? u.password : '•'.repeat(Math.min(u.password.length, 8))}
                            </code>
                            <button 
                              onClick={() => setShowPassword(showPassword === u.id ? null : u.id)} 
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '2px 6px' }}
                            >
                              {showPassword === u.id ? 'Ocultar' : 'Ver'}
                            </button>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{u.creado}</td>
                        <td>
                          <span className={`badge ${u.activo ? 'success' : 'danger'}`}>
                            {u.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td>
                          <button 
                            onClick={() => handleToggleUser(u.id)}
                            style={{ 
                              background: u.activo ? 'rgba(218,41,28,0.08)' : 'rgba(16,185,129,0.08)',
                              color: u.activo ? 'var(--primary-color)' : 'var(--secondary-color)',
                              border: 'none', borderRadius: '8px', padding: '5px 12px',
                              fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                            }}
                          >
                            {u.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {inspectorUsers.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                          No hay inspectores registrados. Crea el primero con el botón de arriba.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ajustes' && (
          <div className="glass-panel" style={{ maxWidth: '800px' }}>
            <h3 style={{ color: 'var(--text-main)', marginBottom: '1.5rem' }}>Configuraciones del Sistema</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div>
                <h4 style={{ color: 'var(--text-main)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Preferencias de Importación</h4>
                <div className="input-group">
                  <label>Comportamiento de Tickets Duplicados</label>
                  <select className="input-control" defaultValue="update">
                    <option value="update">Actualizar ticket existente</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
