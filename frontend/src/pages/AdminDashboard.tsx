import { useState, useEffect } from 'react';
import { 
  Activity, LayoutDashboard, Users, FileText, BookOpen,
  LogOut, Search, Filter, AlertTriangle, CheckCircle2, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchTickets, type Ticket, fetchInspectors, createInspector, updateInspector, deleteInspector, autoAssignTickets, assignTicket, type Inspector, fetchRazones, type RazonCliente } from '../services/api';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [supervisorFilter, setSupervisorFilter] = useState('');

  // Estados de Inspectores
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [loadingInspectors, setLoadingInspectors] = useState(false);
  const [showAddInspector, setShowAddInspector] = useState(false);
  const [editingInspector, setEditingInspector] = useState<Inspector | null>(null);

  // Estados de Razones
  const [razones, setRazones] = useState<RazonCliente[]>([]);
  const [loadingRazones, setLoadingRazones] = useState(false);

  useEffect(() => {
    loadTickets();
    loadInspectors();
  }, []);

  useEffect(() => {
    if (activeTab === 'personal') {
      loadInspectors();
    }
    if (activeTab === 'codigos' && razones.length === 0) {
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
        alert(`Ticket asignado a ${inspector.nombre}`);
        loadTickets();
      } else {
        alert('Error al asignar el ticket');
      }
    }
  };

  const loadTickets = async () => {
    setLoading(true);
    const data = await fetchTickets();
    setTickets(data);
    setLoading(false);
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
            <FileText size={20} /> Tickets
          </button>
          <button className={`nav-item ${activeTab === 'personal' ? 'active' : ''}`} onClick={() => setActiveTab('personal')}>
            <Users size={20} /> Personal
          </button>
          <button className={`nav-item ${activeTab === 'codigos' ? 'active' : ''}`} onClick={() => setActiveTab('codigos')}>
            <BookOpen size={20} /> Código Razón Cliente
          </button>
          <div style={{ flex: 1 }}></div>
          <button className="nav-item" onClick={() => navigate('/login')} style={{ color: 'var(--danger-color)' }}>
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
               activeTab === 'tickets' ? <><FileText size={28} color="var(--primary-color)" /> Gestión de Tickets</> : 
               activeTab === 'codigos' ? <><BookOpen size={28} color="var(--primary-color)" /> Código Razón Cliente</> :
               <><Users size={28} color="var(--primary-color)" /> Directorio de Personal</>}
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

            <div className="glass-panel">
              <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle2 size={20} color="var(--primary-color)" /> Últimas Inspecciones</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Ticket</th>
                      <th>Técnico</th>
                      <th>Supervisor</th>
                      <th>Sector</th>
                      <th>Prioridad</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} style={{textAlign: 'center', padding: '2rem'}}><Loader2 className="spinner" /></td></tr>
                    ) : tickets.slice(0, 5).map(t => (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 500, color: 'var(--text-main)' }}>{t.ticket}</td>
                        <td>
                          <div>{t.tech_id || t.tech}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {t.tech || t.tech_id}</div>
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
          </>
        )}



        {activeTab === 'tickets' && (
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FileText size={20} color="var(--primary-color)" /> Todos los Tickets</h3>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Técnico</th>
                    <th>Supervisor</th>
                    <th>Sector</th>
                    <th>Prioridad</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} style={{textAlign: 'center', padding: '2rem'}}><Loader2 className="spinner" /></td></tr>
                  ) : tickets.filter(t => {
                    const matchesSearch = t.ticket?.toString().toLowerCase().includes(searchTerm.toLowerCase()) || 
                                          t.tech_id?.toString().toLowerCase().includes(searchTerm.toLowerCase()) || 
                                          t.tech?.toString().toLowerCase().includes(searchTerm.toLowerCase());
                    const matchesSupervisor = supervisorFilter === '' || t.supervisor === supervisorFilter;
                    return matchesSearch && matchesSupervisor;
                  }).map(t => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 500, color: 'var(--text-main)' }}>{t.ticket}</td>
                      <td>
                        {t.status === 'Pendiente' ? (
                          <select 
                            className="assign-select" 
                            value={inspectors.find(i => i.id == t.tech || i.nombre == t.tech_id)?.id || ''}
                            onChange={(e) => handleAssign(t.id, e.target.value)}
                          >
                            <option value="" disabled>Sin asignar</option>
                            {inspectors.map(insp => (
                              <option key={insp.id} value={insp.id}>{insp.nombre}</option>
                            ))}
                          </select>
                        ) : (
                          <>
                            <div>{t.tech_id || t.tech}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {t.tech || t.tech_id}</div>
                          </>
                        )}
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
                    alert(`¡Carga balanceada! Se asignaron ${res.updated} tickets.`);
                    loadTickets();
                  } else {
                    alert('Error al auto-asignar tickets. Asegúrate de tener la pestaña "Inspectores" en tu Google Sheet.');
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
                  alert('Error al guardar inspector');
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
                       // Use a custom inline confirmation to prevent browser blocks on window.confirm
                       if (e.currentTarget.textContent === '¿Seguro?') {
                         e.currentTarget.textContent = 'Eliminando...';
                         const success = await deleteInspector(editingInspector.id);
                         if (success) {
                           setShowAddInspector(false);
                           setEditingInspector(null);
                           loadInspectors();
                         } else {
                           alert('Error al eliminar inspector');
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
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
              <h3 style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BookOpen size={20} color="var(--primary-color)" /> Códigos de Razón de Cliente
              </h3>
            </div>
            
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Caso</th>
                    <th>Ejecutor</th>
                    <th>Supervisor</th>
                    <th>Localidad</th>
                    <th>Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingRazones ? (
                    <tr><td colSpan={5} style={{textAlign: 'center', padding: '2rem'}}><Loader2 className="spinner" /></td></tr>
                  ) : razones.length === 0 ? (
                    <tr><td colSpan={5} style={{textAlign: 'center', padding: '2rem', color: 'var(--text-muted)'}}>No hay datos en esta hoja de cálculo.</td></tr>
                  ) : razones.map((r, idx) => (
                    <tr key={idx}>
                      <td><span className="badge info">{r.Caso || '-'}</span></td>
                      <td style={{ color: 'var(--text-main)', fontWeight: 500 }}>{r['Nombre del Ejecutor'] || '-'}</td>
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
    </div>
  );
}
