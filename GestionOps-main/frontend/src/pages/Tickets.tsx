import { useEffect, useState } from 'react';
import { FileText, Search, Loader2, AlertTriangle, Users } from 'lucide-react';
import { fetchTickets, type Ticket, fetchInspectors, assignTicketsBySupervisor, assignTicket } from '../services/api';
import type { Inspector } from '../services/api';

export default function TicketsPanel() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [supervisorFilter, setSupervisorFilter] = useState('');
  const [bulkAssignInspector, setBulkAssignInspector] = useState('');
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'} | null>(null);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, message: string, onConfirm: () => void} | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const data = await fetchTickets();
    setTickets(data || []);
    setLoading(false);
  };

  const filtered = tickets.filter(t => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [t.ticket, t.tech, t.tech_id, t.supervisor, t.status, t.sector]
      .some(v => String(v || '').toLowerCase().includes(q));
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  useEffect(() => { setPage(1); }, [search]);

  const getField = (item: any, keys: string[]) => {
    if (!item) return '-';
    for (const k of keys) {
      if (k in item && item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') return item[k];
      const found = Object.keys(item).find(ok => ok.toLowerCase().replace(/\s+/g, '_') === k.toLowerCase().replace(/\s+/g, '_'));
      if (found && item[found] !== undefined && item[found] !== null && String(item[found]).trim() !== '') return item[found];
    }
    return '-';
  };

  const loadInspectors = async () => {
    try {
      const data = await fetchInspectors();
      setInspectors(data || []);
    } catch {
      setInspectors([]);
    }
  };

  useEffect(() => {
    loadInspectors();
  }, []);

  const showToast = (msg: string, type: 'success'|'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <>
    <div className="glass-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}><FileText size={18} color="var(--primary-color)" /> Tickets</h3>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-bar" style={{ minWidth: '260px' }}>
            <Search size={14} />
            <input placeholder="Buscar por cualquier columna..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="bulk-assign-panel">
        <div className="bulk-assign-description">
          <div className="bulk-assign-icon"><Users size={18} color="var(--primary-color)" /></div>
          <div>
            <div className="bulk-assign-title">Asignación Masiva:</div>
            <div className="bulk-assign-note">* Selecciona un supervisor primero para habilitar la asignación masiva.</div>
          </div>
        </div>
        <div className="bulk-assign-controls">
          <select value={supervisorFilter} onChange={e => setSupervisorFilter(e.target.value)}>
            <option value="">1. Seleccionar Supervisor...</option>
            {Array.from(new Set(tickets.map(t => String(getField(t, ['supervisor', 'nombre supervisor', 'supervisor_actual']))).filter(s => s && s !== '-'))).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select value={bulkAssignInspector} onChange={e => setBulkAssignInspector(e.target.value)}>
            <option value="">2. Seleccionar Gestor...</option>
            {inspectors.map(i => (<option key={i.id} value={i.id}>{i.nombre}</option>))}
          </select>

          <button className="btn-primary" onClick={() => {
            if (!supervisorFilter || !bulkAssignInspector) return showToast('Seleccione supervisor y gestor', 'error');
            const insp = inspectors.find(i => String(i.id) === String(bulkAssignInspector));
            const inspName = insp?.nombre || String(bulkAssignInspector);
            setConfirmModal({
              isOpen: true,
              message: `¿Deseas asignar TODOS los tickets del supervisor "${supervisorFilter}" al gestor "${inspName}"?`,
              onConfirm: async () => {
                try {
                  const updated = await assignTicketsBySupervisor(supervisorFilter, bulkAssignInspector, inspName);
                  if (updated > 0) {
                    showToast(`Se asignaron ${updated} tickets a ${inspName}`, 'success');
                    load();
                    setBulkAssignInspector('');
                    setSupervisorFilter('');
                  } else {
                    showToast('No se encontraron registros para asignar o hubo un error', 'error');
                  }
                } catch (err: any) {
                  showToast(err?.message || 'Error en asignación masiva', 'error');
                }
                setConfirmModal(null);
              }
            });
          }}>Asignar Masivo</button>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Trabajo</th>
              <th>Orden Externa</th>
              <th>Cliente</th>
              <th>Tipo de Prioridad</th>
              <th>Asignado A</th>
              <th>Supervisor</th>
              <th>Sintoma</th>
              <th>Sector</th>
              <th>Terminal</th>
              <th>Gestor Asignado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: '2rem' }}><Loader2 className="spinner" /></td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No se encontraron tickets.</td></tr>
            ) : paginated.map((t, idx) => (
              <tr key={idx}>
                <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{getField(t, ['ticket', 'trabajo', 'work_name', 'work name', 'orden_externa_id', 'orden_servicio', 'orden externa', 'orden'])}</td>
                <td style={{ color: 'var(--text-main)' }}>{getField(t, ['orden_servicio', 'orden_externa_id', 'orden externa', 'order_external', 'orden'])}</td>
                <td>{getField(t, ['cliente', 'customer', 'subscriber'])}</td>
                <td>{getField(t, ['priority', 'prioridad', 'tipo_prioridad', 'priority_type'])}</td>
                <td>{getField(t, ['tech', 'tech_name', 'asignado a', 'asignado_a', 'nombre tecnico'])}</td>
                <td>{getField(t, ['supervisor', 'nombre supervisor', 'nombre_del_supervisor'])}</td>
                <td>{getField(t, ['sintoma', 'motivo', 'reason', 'descripcion', 'symptom'])}</td>
                <td>{getField(t, ['sector', 'zona', 'barrio', 'localidad', 'ciudad'])}</td>
                <td>{getField(t, ['terminal', 'terminal_id'])}</td>
                <td>
                  {(t as any).inspector ? (
                    <span className="badge info">{(t as any).inspector}</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{(t as any).inspector_id ? `ID: ${(t as any).inspector_id}` : '-'}</span>
                  )}
                </td>
                <td>
                  <select
                    className="assign-select"
                    style={{ padding: '0.25rem 1.5rem 0.25rem 0.5rem', fontSize: '0.7rem' }}
                    value=""
                    onChange={async (e) => {
                      const inspectorId = e.target.value;
                      const inspector = inspectors.find(i => String(i.id) === String(inspectorId));
                      const idValue = getField(t, ['id', 'ID', 'Id', 'orden_externa_id', 'orden_servicio', 'orden externa', 'order_external', 'orden']);
                      const ticketValue = getField(t, ['ticket', 'trabajo', 'work_name', 'work name', 'orden_externa_id', 'orden_servicio', 'orden externa', 'order_external', 'orden']);
                      const ticketKey = idValue && idValue !== '-' ? idValue : (ticketValue && ticketValue !== '-' ? ticketValue : '');
                      if (!ticketKey) {
                        showToast('No se encontró identificador de ticket válido', 'error');
                        return;
                      }
                      if (inspector) {
                        try {
                          const res = await assignTicket(ticketKey, inspector.id, inspector.nombre, ticketValue && ticketValue !== ticketKey ? ticketValue : undefined);
                          if (res.status) {
                            showToast(`Ticket ${ticketKey} asignado a ${inspector.nombre}`, 'success');
                            load();
                          } else {
                            showToast(res.message || 'Error al asignar ticket', 'error');
                            console.error('assignTicket failed:', res.raw || res.message);
                          }
                        } catch (err: any) {
                          showToast(err?.message || 'Error en asignación', 'error');
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
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
        <button className="btn-secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Anterior</button>
        <span style={{ color: 'var(--text-muted)' }}>{page} / {totalPages}</span>
        <button className="btn-secondary" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Siguiente</button>
      </div>
    </div>

      {confirmModal?.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel" style={{ width: '420px', background: 'var(--surface-color)', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--text-main)' }}>
              <AlertTriangle size={20} color="var(--warning-color)" />
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Confirmar Acción</h3>
            </div>
            <p style={{ marginBottom: '1.25rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{confirmModal.message}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn-secondary" onClick={() => setConfirmModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={confirmModal.onConfirm}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', background: toast.type === 'success' ? 'rgba(22, 163, 74, 0.9)' : 'rgba(217, 70, 74, 0.95)', color: '#fff', padding: '0.9rem 1.25rem', borderRadius: '999px', boxShadow: '0 12px 28px rgba(0,0,0,0.18)', zIndex: 10000, minWidth: '220px', fontWeight: 600 }}>
          {toast.msg}
        </div>
      )}
    </>
  );
}
