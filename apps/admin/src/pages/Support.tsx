import { useEffect, useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import api from '../services/api';

const inputStyle: CSSProperties = {
  padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: 8,
  fontSize: 14, fontFamily: 'inherit', background: '#fff',
};

interface Ticket {
  id: string;
  type: string;
  status: string;
  metadata: any;
  created_at: string;
  updated_at: string;
  users: { id: string; name: string; email: string; phone?: string };
  properties?: { id: string; title: string; slug: string } | null;
  support_messages: { id: string; sender: string; content: string; created_at: string }[];
}

interface VisitRequest {
  id: string;
  preferred_date: string;
  preferred_time: string;
  message?: string;
  status: string;
  created_at: string;
  users_visit_requests_user_idTousers: { id: string; name: string; email: string; phone?: string };
  users_visit_requests_owner_idTousers: { id: string; name: string; email: string; phone?: string };
  properties: { id: string; title: string; slug: string };
}

interface Stats {
  totalTickets: number;
  activeTickets: number;
  totalVisits: number;
  pendingVisits: number;
}

const TYPE_LABELS: Record<string, string> = {
  visit: 'Visita',
  info_request: 'Info',
  report: 'Reporte',
  faq: 'FAQ',
  advisor_request: 'Asesoría',
};

const ADVISOR_NEED_LABELS: Record<string, string> = {
  sell: 'Vender su propiedad',
  rent: 'Alquilar su propiedad',
  anticretico: 'Poner en anticrético',
  full_service: 'No tiene tiempo, quiere que le gestionen todo',
  other: 'Otro',
};

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  active: { cls: 'badge-yellow', label: 'Activo' },
  resolved: { cls: 'badge-green', label: 'Resuelto' },
  cancelled: { cls: 'badge-gray', label: 'Cancelado' },
  pending: { cls: 'badge-yellow', label: 'Pendiente' },
  confirmed: { cls: 'badge-green', label: 'Confirmada' },
  rejected: { cls: 'badge-red', label: 'Rechazada' },
  completed: { cls: 'badge-blue', label: 'Completada' },
};

export default function Support() {
  const [tab, setTab] = useState<'tickets' | 'visits'>('tickets');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [visits, setVisits] = useState<VisitRequest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ticketsRes, visitsRes, statsRes] = await Promise.all([
        api.get('/admin/support/tickets', { params: filterStatus ? { status: filterStatus } : {} }),
        api.get('/admin/support/visit-requests', { params: filterStatus ? { status: filterStatus } : {} }),
        api.get('/admin/support/stats'),
      ]);
      setTickets(ticketsRes.data);
      setVisits(visitsRes.data);
      setStats(statsRes.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Refrescar lista periódicamente (sin spinner)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [ticketsRes, visitsRes] = await Promise.all([
          api.get('/admin/support/tickets', { params: filterStatus ? { status: filterStatus } : {} }),
          api.get('/admin/support/visit-requests', { params: filterStatus ? { status: filterStatus } : {} }),
        ]);
        setTickets(ticketsRes.data);
        setVisits(visitsRes.data);
      } catch {}
    }, 15000);
    return () => clearInterval(interval);
  }, [filterStatus]);

  const refreshTicketMessages = useCallback(async (ticketId: string) => {
    try {
      const { data } = await api.get(`/admin/support/tickets/${ticketId}/messages`);
      setSelectedTicket((prev) =>
        prev && prev.id === ticketId
          ? { ...prev, support_messages: data.messages, status: data.status ?? prev.status }
          : prev
      );
      // El status también puede haber cambiado en la tabla (ej. se reabrió solo).
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: data.status ?? t.status } : t))
      );
    } catch {}
  }, []);

  useEffect(() => {
    if (!selectedTicket) return;
    const interval = setInterval(() => refreshTicketMessages(selectedTicket.id), 5000);
    return () => clearInterval(interval);
  }, [selectedTicket?.id, refreshTicketMessages]);

  const sendReply = async () => {
    if (!selectedTicket || !replyText.trim() || sending) return;
    setSending(true);
    try {
      await api.post(`/admin/support/tickets/${selectedTicket.id}/messages`, {
        content: replyText.trim(),
      });
      setReplyText('');
      await refreshTicketMessages(selectedTicket.id);
    } catch {}
    setSending(false);
  };

  const resolveTicket = async (id: string) => {
    try {
      await api.patch(`/admin/support/tickets/${id}/resolve`);
      fetchData();
      setSelectedTicket(null);
    } catch {}
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-BO', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const fmtDateShort = (d: string) => new Date(d).toLocaleDateString('es-BO', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const whatsappUrl = (phone: string, name: string) => {
    if (!phone) return '';
    return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${name}, te contactamos desde DIRECTO.`)}`;
  };

  // El contacto siempre es el del perfil (no se le pide al usuario en el formulario).
  const ticketContact = (t: Ticket) => ({ name: t.users.name, phone: t.users.phone ?? '' });

  return (
    <div>
      <div className="page-header">
        <h1>Soporte & Visitas</h1>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-value">{stats.totalTickets}</div>
            <div className="stat-label">Tickets totales</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#d97706' }}>{stats.activeTickets}</div>
            <div className="stat-label">Tickets activos</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalVisits}</div>
            <div className="stat-label">Visitas totales</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#d97706' }}>{stats.pendingVisits}</div>
            <div className="stat-label">Visitas pendientes</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={`btn ${tab === 'tickets' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => { setTab('tickets'); setFilterStatus(''); }}
        >
          Tickets de soporte
        </button>
        <button
          className={`btn ${tab === 'visits' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => { setTab('visits'); setFilterStatus(''); }}
        >
          Solicitudes de visita
        </button>
      </div>

      {/* Filter */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 14, color: '#64748b' }}>Filtrar:</label>
        {tab === 'tickets' ? (
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ ...inputStyle, width: 160 }}
          >
            <option value="">Todos</option>
            <option value="active">Activos</option>
            <option value="resolved">Resueltos</option>
          </select>
        ) : (
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ ...inputStyle, width: 160 }}
          >
            <option value="">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="confirmed">Confirmadas</option>
            <option value="rejected">Rechazadas</option>
          </select>
        )}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><p>Cargando...</p></div>
      ) : tab === 'tickets' ? (
        <>
          {/* Tickets Table */}
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Usuario</th>
                  <th>Propiedad</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>No hay tickets</td></tr>
                ) : (
                  tickets.map((t) => {
                    const st = STATUS_BADGE[t.status] ?? STATUS_BADGE.active;
                    const contact = ticketContact(t);
                    return (
                      <tr key={t.id}>
                        <td>
                          <span className="badge badge-blue">{TYPE_LABELS[t.type] ?? t.type}</span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{t.users.name}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>{t.users.email}</div>
                          {contact.phone && (
                            <a
                              href={whatsappUrl(contact.phone, contact.name)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: 12, color: '#25D366', fontWeight: 600 }}
                            >
                              WhatsApp
                            </a>
                          )}
                        </td>
                        <td>{t.properties?.title ?? '—'}</td>
                        <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                        <td style={{ fontSize: 13 }}>{fmtDate(t.created_at)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-sm btn-outline" onClick={() => { setSelectedTicket(t); setReplyText(''); }}>
                              Ver
                            </button>
                            {t.status === 'active' && (
                              <button className="btn btn-sm btn-primary" onClick={() => resolveTicket(t.id)}>
                                Resolver
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Ticket detail modal */}
          {selectedTicket && (
            <div className="modal-overlay show" onClick={() => setSelectedTicket(null)}>
              <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
                <h3>Ticket de soporte</h3>
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Usuario</div>
                      <div style={{ fontWeight: 600 }}>{selectedTicket.users.name}</div>
                      <div style={{ fontSize: 13, color: '#64748b' }}>{selectedTicket.users.email}</div>
                      {ticketContact(selectedTicket).phone && (
                        <a
                          href={whatsappUrl(ticketContact(selectedTicket).phone, ticketContact(selectedTicket).name)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm"
                          style={{ marginTop: 8, background: '#25D366', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          Contactar por WhatsApp
                        </a>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Tipo / Estado</div>
                      <span className="badge badge-blue" style={{ marginRight: 6 }}>
                        {TYPE_LABELS[selectedTicket.type] ?? selectedTicket.type}
                      </span>
                      <span className={`badge ${(STATUS_BADGE[selectedTicket.status] ?? STATUS_BADGE.active).cls}`}>
                        {(STATUS_BADGE[selectedTicket.status] ?? STATUS_BADGE.active).label}
                      </span>
                      {selectedTicket.properties && (
                        <div style={{ marginTop: 8, fontSize: 13 }}>
                          <span style={{ color: '#94a3b8' }}>Propiedad:</span> {selectedTicket.properties.title}
                        </div>
                      )}
                      <div style={{ marginTop: 4, fontSize: 12, color: '#94a3b8' }}>{fmtDate(selectedTicket.created_at)}</div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Mensajes</div>
                  <div style={{ maxHeight: 300, overflowY: 'auto', background: '#f8fafc', borderRadius: 10, padding: 12 }}>
                    {selectedTicket.support_messages.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>Sin mensajes</div>
                    ) : (
                      selectedTicket.support_messages.map((m) => {
                        const isAdmin = m.sender === 'admin';
                        const isUser = m.sender === 'user';
                        return (
                          <div
                            key={m.id}
                            style={{
                              marginBottom: 8,
                              padding: '8px 12px',
                              borderRadius: 10,
                              maxWidth: '80%',
                              background: isAdmin ? '#7C3AED' : isUser ? '#2563eb' : '#fff',
                              color: isAdmin || isUser ? '#fff' : '#1e293b',
                              marginLeft: isAdmin ? 'auto' : 0,
                              border: !isAdmin && !isUser ? '1px solid #e2e8f0' : 'none',
                            }}
                          >
                            {isAdmin && (
                              <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.8, marginBottom: 2 }}>Admin</div>
                            )}
                            <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{m.content}</div>
                            <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: 'right' }}>
                              {new Date(m.created_at).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Reply input */}
                  {selectedTicket.status === 'active' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <input
                        style={{ ...inputStyle, flex: 1 }}
                        placeholder="Escribe una respuesta..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                        disabled={sending}
                      />
                      <button
                        className="btn btn-primary"
                        onClick={sendReply}
                        disabled={!replyText.trim() || sending}
                        style={{ background: '#7C3AED', borderColor: '#7C3AED' }}
                      >
                        {sending ? 'Enviando...' : 'Enviar'}
                      </button>
                    </div>
                  )}

                  {/* Metadata for advisor requests */}
                  {selectedTicket.type === 'advisor_request' && selectedTicket.metadata && typeof selectedTicket.metadata === 'object' && (
                    <div style={{ marginTop: 16, background: '#f5f3ff', padding: 12, borderRadius: 8, border: '1px solid #ddd6fe' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#5b21b6', marginBottom: 4 }}>Solicitud de asesoría</div>
                      {(selectedTicket.metadata as any).need && (
                        <div style={{ fontSize: 13 }}>
                          Necesita: <strong>{ADVISOR_NEED_LABELS[(selectedTicket.metadata as any).need] ?? (selectedTicket.metadata as any).need}</strong>
                        </div>
                      )}
                      {(selectedTicket.metadata as any).details && (
                        <div style={{ fontSize: 13, marginTop: 4 }}>{(selectedTicket.metadata as any).details}</div>
                      )}
                    </div>
                  )}

                  {/* Metadata for reports */}
                  {selectedTicket.type === 'report' && selectedTicket.metadata && typeof selectedTicket.metadata === 'object' && (
                    <div style={{ marginTop: 16, background: '#fef2f2', padding: 12, borderRadius: 8, border: '1px solid #fecaca' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#991b1b', marginBottom: 4 }}>Reporte</div>
                      {(selectedTicket.metadata as any).report_type && (
                        <div style={{ fontSize: 13 }}>Tipo: <strong>{(selectedTicket.metadata as any).report_type}</strong></div>
                      )}
                      {(selectedTicket.metadata as any).description && (
                        <div style={{ fontSize: 13, marginTop: 4 }}>{(selectedTicket.metadata as any).description}</div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="modal-actions">
                    {selectedTicket.status === 'active' && (
                      <button className="btn btn-primary" onClick={() => resolveTicket(selectedTicket.id)}>
                        Marcar como resuelto
                      </button>
                    )}
                    <button className="btn btn-outline" onClick={() => setSelectedTicket(null)}>Cerrar</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Visits Table */
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Propiedad</th>
                <th>Interesado</th>
                <th>Propietario</th>
                <th>Fecha / Hora</th>
                <th>Mensaje</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {visits.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>No hay solicitudes de visita</td></tr>
              ) : (
                visits.map((v) => {
                  const st = STATUS_BADGE[v.status] ?? STATUS_BADGE.pending;
                  const buyer = v.users_visit_requests_user_idTousers;
                  const owner = v.users_visit_requests_owner_idTousers;
                  return (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 600, maxWidth: 200 }}>{v.properties.title}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{buyer.name}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{buyer.email}</div>
                        {buyer.phone && (
                          <a
                            href={whatsappUrl(buyer.phone, buyer.name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 12, color: '#25D366', fontWeight: 600 }}
                          >
                            WhatsApp
                          </a>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{owner.name}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{owner.email}</div>
                        {owner.phone && (
                          <a
                            href={whatsappUrl(owner.phone, owner.name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 12, color: '#25D366', fontWeight: 600 }}
                          >
                            WhatsApp
                          </a>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{fmtDateShort(v.preferred_date)}</div>
                        <div style={{ fontSize: 13, color: '#64748b' }}>{v.preferred_time}</div>
                      </td>
                      <td style={{ fontSize: 13, maxWidth: 200, color: '#64748b' }}>
                        {v.message || '—'}
                      </td>
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
