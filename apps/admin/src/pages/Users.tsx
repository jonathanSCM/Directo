import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getImageUrl } from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  city?: string;
  status: string;
  active_role?: string;
  is_verified?: boolean;
  created_at: string;
  _count?: { properties: number; subscriptions: number; payments: number };
}

interface UserDetail {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  city?: string;
  active_role: string;
  status: string;
  email_verified_at: string | null;
  is_verified: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  user_roles: { roles: { name: string } }[];
  properties: {
    id: string; title: string; slug: string; status: string; approval_status: string;
    price: string; currency: string; operation: string; views_count: number; created_at: string;
  }[];
  subscriptions: {
    id: string; status: string; start_date: string | null; end_date: string | null;
    property_count: number | null;
    subscription_plans: { name: string; slug: string; price: string; currency: string; included_properties: number };
  }[];
  payments: {
    id: string; amount: string; currency: string; method: string; status: string;
    paid_at: string | null; created_at: string;
  }[];
}

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  active: { cls: 'badge-green', label: 'Activo' },
  suspended: { cls: 'badge-red', label: 'Suspendido' },
  pending_verification: { cls: 'badge-yellow', label: 'Pendiente' },
};

const PROP_STATUS: Record<string, { cls: string; label: string }> = {
  draft: { cls: 'badge-gray', label: 'Borrador' },
  pending_approval: { cls: 'badge-yellow', label: 'Pendiente' },
  published: { cls: 'badge-green', label: 'Publicada' },
  rejected: { cls: 'badge-red', label: 'Rechazada' },
  taken_down: { cls: 'badge-red', label: 'Dada de baja' },
  sold_rented: { cls: 'badge-blue', label: 'Vendida' },
};

const SUB_STATUS: Record<string, { cls: string; label: string }> = {
  active: { cls: 'badge-green', label: 'Activa' },
  expired: { cls: 'badge-red', label: 'Vencida' },
  pending_payment: { cls: 'badge-yellow', label: 'Pendiente pago' },
  cancelled: { cls: 'badge-gray', label: 'Cancelada' },
};

const PAY_STATUS: Record<string, { cls: string; label: string }> = {
  pending: { cls: 'badge-yellow', label: 'Pendiente' },
  confirmed: { cls: 'badge-green', label: 'Confirmado' },
  rejected: { cls: 'badge-red', label: 'Rechazado' },
};

const OP_LABEL: Record<string, string> = { sale: 'Venta', rent: 'Alquiler', anticretico: 'Anticrético' };

type View = 'list' | 'detail';
type StatusFilter = '' | 'active' | 'suspended' | 'pending_verification';
type RoleFilter = '' | 'buyer' | 'owner';

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: 8,
  fontSize: 14, fontFamily: 'inherit', background: '#fff',
};

export default function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('');
  const [editingCountId, setEditingCountId] = useState<string | null>(null);
  const [countDraft, setCountDraft] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/users');
      setUsers(data.data || data);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setView('detail');
    try {
      const { data } = await api.get(`/admin/users/${id}`);
      setDetail(data);
    } catch { alert('Error al cargar detalle'); setView('list'); }
    setDetailLoading(false);
  };

  const suspend = async (id: string) => {
    const reason = prompt('Motivo de la suspensión:');
    if (!reason) return;
    await api.patch(`/admin/users/${id}/suspend`, { reason });
    load();
    if (detail?.id === id) openDetail(id);
  };

  const activate = async (id: string) => {
    if (!confirm('¿Reactivar este usuario?')) return;
    await api.patch(`/admin/users/${id}/activate`);
    load();
    if (detail?.id === id) openDetail(id);
  };

  const toggleVerified = async (id: string, next: boolean) => {
    await api.patch(`/admin/users/${id}/verify`, { is_verified: next });
    load();
    if (detail?.id === id) openDetail(id);
  };

  const updatePropertyCount = async (subId: string, count: number) => {
    try {
      await api.patch(`/admin/subscriptions/${subId}/property-count`, { property_count: count });
      if (detail) openDetail(detail.id);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error al actualizar el cupo');
    }
  };

  const takeDownProperty = async (id: string) => {
    if (!confirm('¿Dar de baja esta propiedad?')) return;
    try {
      await api.patch(`/admin/properties/${id}/take-down`);
      if (detail) openDetail(detail.id);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error al dar de baja');
    }
  };

  const restoreProperty = async (id: string) => {
    try {
      await api.patch(`/admin/properties/${id}/restore`);
      if (detail) openDetail(detail.id);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error al restaurar');
    }
  };

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  // ── Detail View ─────────────────────────────────────────────────────────────
  if (view === 'detail') {
    if (detailLoading || !detail) {
      return <div className="loading"><div className="spinner" /><p>Cargando detalle...</p></div>;
    }
    const badge = STATUS_BADGE[detail.status] ?? { cls: 'badge-gray', label: detail.status };
    const roles = detail.user_roles.map((r) => r.roles.name).join(', ');

    return (
      <>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <button className="btn btn-outline" onClick={() => setView('list')} style={{ marginBottom: 12 }}>
              ← Volver
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Avatar name={detail.name} avatarUrl={detail.avatar_url} size={52} />
              <div>
                <h1>{detail.name}</h1>
                <p className="subtitle">{detail.email}</p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {detail.is_verified ? (
              <button className="btn btn-outline" onClick={() => toggleVerified(detail.id, false)}>Quitar verificación</button>
            ) : (
              <button className="btn btn-primary" onClick={() => toggleVerified(detail.id, true)}>Verificar usuario</button>
            )}
            {detail.status === 'active' && (
              <button className="btn btn-danger" onClick={() => suspend(detail.id)}>Suspender</button>
            )}
            {detail.status === 'suspended' && (
              <button className="btn btn-success" onClick={() => activate(detail.id)}>Activar</button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <span className={`badge ${badge.cls}`}>{badge.label}</span>
          <span className="badge badge-blue">{detail.active_role === 'owner' ? 'Propietario' : 'Comprador'}</span>
          {detail.is_verified && (
            <span className="badge badge-blue">✓ Verificado</span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          {/* User info card */}
          <div className="card">
            <div className="card-header"><h2>Información</h2></div>
            <div style={{ padding: 16 }}>
              <InfoRow label="Teléfono" value={detail.phone || '—'} />
              <InfoRow label="Ciudad" value={detail.city || '—'} />
              <InfoRow label="Roles" value={roles || '—'} />
              <InfoRow label="Email verificado" value={detail.email_verified_at ? fmt(detail.email_verified_at) : 'No'} />
              <InfoRow label="Último login" value={fmt(detail.last_login_at)} />
              <InfoRow label="Registrado" value={fmt(detail.created_at)} />
            </div>
          </div>

          {/* Stats card */}
          <div className="stats-grid" style={{ alignContent: 'start' }}>
            <div className="stat-card">
              <div className="stat-label">Propiedades</div>
              <div className="stat-value">{detail.properties.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Suscripciones</div>
              <div className="stat-value">{detail.subscriptions.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Pagos</div>
              <div className="stat-value">{detail.payments.length}</div>
            </div>
          </div>
        </div>

        {/* Properties table */}
        {detail.properties.length > 0 && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header"><h2>Propiedades</h2></div>
            <table>
              <thead>
                <tr><th>Título</th><th>Operación</th><th>Precio</th><th>Estado</th><th>Vistas</th><th>Fecha</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {detail.properties.map((p) => {
                  const ps = PROP_STATUS[p.approval_status === 'pending' ? 'pending_approval' : p.status] ?? { cls: 'badge-gray', label: p.status };
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong
                          style={{ cursor: 'pointer', color: '#2563EB' }}
                          onClick={() => navigate(`/properties?id=${p.id}`)}
                        >
                          {p.title}
                        </strong>
                      </td>
                      <td>{OP_LABEL[p.operation] ?? p.operation}</td>
                      <td>{p.currency === 'USD' ? '$' : 'Bs.'} {Number(p.price).toLocaleString()}</td>
                      <td><span className={`badge ${ps.cls}`}>{ps.label}</span></td>
                      <td>{p.views_count}</td>
                      <td>{fmt(p.created_at)}</td>
                      <td className="actions-cell">
                        <button className="btn btn-sm btn-outline" onClick={() => navigate(`/properties?id=${p.id}`)}>Ver</button>
                        {p.status !== 'taken_down' ? (
                          <button className="btn btn-sm btn-warning" onClick={() => takeDownProperty(p.id)}>Dar de baja</button>
                        ) : (
                          <button className="btn btn-sm btn-success" onClick={() => restoreProperty(p.id)}>↩ Restaurar</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Subscriptions table */}
        {detail.subscriptions.length > 0 && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header"><h2>Suscripciones</h2></div>
            <table>
              <thead>
                <tr><th>Plan</th><th>Precio</th><th>Propiedades</th><th>Estado</th><th>Inicio</th><th>Vencimiento</th></tr>
              </thead>
              <tbody>
                {detail.subscriptions.map((s) => {
                  const ss = SUB_STATUS[s.status] ?? { cls: 'badge-gray', label: s.status };
                  return (
                    <tr key={s.id}>
                      <td><strong>{s.subscription_plans.name}</strong></td>
                      <td>{Number(s.subscription_plans.price) === 0 ? 'Gratis' : `$${Number(s.subscription_plans.price).toFixed(2)}`}</td>
                      <td>
                        {editingCountId === s.id ? (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={countDraft}
                              onChange={(e) => setCountDraft(e.target.value)}
                              style={{ width: 56, padding: '2px 6px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                              autoFocus
                            />
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => {
                                const n = Number(countDraft);
                                if (Number.isInteger(n) && n >= 1 && n <= 100) {
                                  updatePropertyCount(s.id, n);
                                  setEditingCountId(null);
                                } else {
                                  alert('Cantidad inválida (1-100)');
                                }
                              }}
                            >
                              ✓
                            </button>
                            <button className="btn btn-sm btn-outline" onClick={() => setEditingCountId(null)}>✕</button>
                          </div>
                        ) : (
                          <span
                            style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
                            title="Clic para corregir el cupo de esta suscripción"
                            onClick={() => {
                              setEditingCountId(s.id);
                              setCountDraft(String(s.property_count ?? s.subscription_plans.included_properties ?? 1));
                            }}
                          >
                            {s.property_count ?? s.subscription_plans.included_properties ?? '—'}
                          </span>
                        )}
                      </td>
                      <td><span className={`badge ${ss.cls}`}>{ss.label}</span></td>
                      <td>{fmt(s.start_date)}</td>
                      <td>{fmt(s.end_date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Payments table */}
        {detail.payments.length > 0 && (
          <div className="card">
            <div className="card-header"><h2>Pagos</h2></div>
            <table>
              <thead>
                <tr><th>Monto</th><th>Método</th><th>Estado</th><th>Pagado</th><th>Creado</th></tr>
              </thead>
              <tbody>
                {detail.payments.map((p) => {
                  const pp = PAY_STATUS[p.status] ?? { cls: 'badge-gray', label: p.status };
                  return (
                    <tr key={p.id}>
                      <td><strong>{p.currency === 'USD' ? '$' : 'Bs.'} {Number(p.amount).toLocaleString()}</strong></td>
                      <td>{p.method}</td>
                      <td><span className={`badge ${pp.cls}`}>{pp.label}</span></td>
                      <td>{fmt(p.paid_at)}</td>
                      <td>{fmt(p.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  }

  const filtered = users.filter((u) => {
    if (statusFilter && u.status !== statusFilter) return false;
    if (roleFilter && u.active_role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const match =
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone || '').toLowerCase().includes(q) ||
        (u.city || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // ── List View ───────────────────────────────────────────────────────────────
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Usuarios</h1>
          <p className="subtitle">{filtered.length} de {users.length} usuarios registrados</p>
        </div>
      </div>

      {/* Search & filters bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 400 }}>
          <input
            type="text"
            placeholder="Buscar por nombre, email, teléfono, ciudad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, width: '100%', paddingLeft: 36 }}
          />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 14 }}>🔍</span>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} style={inputStyle}>
          <option value="">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="suspended">Suspendidos</option>
          <option value="pending_verification">Pendientes</option>
        </select>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as RoleFilter)} style={inputStyle}>
          <option value="">Todos los roles</option>
          <option value="buyer">Compradores</option>
          <option value="owner">Propietarios</option>
        </select>
        {(search || statusFilter || roleFilter) && (
          <button className="btn btn-sm btn-outline" onClick={() => { setSearch(''); setStatusFilter(''); setRoleFilter(''); }}>
            Limpiar filtros
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><p>Cargando...</p></div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Ciudad</th>
                <th>Propiedades</th>
                <th>Estado</th>
                <th>Registro</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="empty-row">No se encontraron usuarios</td></tr>
              )}
              {filtered.map((u) => {
                const badge = STATUS_BADGE[u.status] ?? { cls: 'badge-gray', label: u.status };
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => openDetail(u.id)}>
                        <Avatar name={u.name} avatarUrl={u.avatar_url} />
                        <strong style={{ color: '#2563EB' }}>
                          {u.name}
                        </strong>
                        {u.is_verified && (
                          <span title="Verificado" style={{ color: '#2563EB' }}>✓</span>
                        )}
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge ${u.active_role === 'owner' ? 'badge-blue' : 'badge-gray'}`}>
                        {u.active_role === 'owner' ? 'Propietario' : 'Comprador'}
                      </span>
                    </td>
                    <td>{u.city || '—'}</td>
                    <td>{u._count?.properties ?? 0}</td>
                    <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
                    <td>{new Date(u.created_at).toLocaleDateString('es-BO')}</td>
                    <td className="actions-cell">
                      <button className="btn btn-sm btn-outline" onClick={() => openDetail(u.id)}>Ver</button>
                      {u.status === 'active' && (
                        <button className="btn btn-sm btn-danger" onClick={() => suspend(u.id)}>Suspender</button>
                      )}
                      {u.status === 'suspended' && (
                        <button className="btn btn-sm btn-success" onClick={() => activate(u.id)}>Activar</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Avatar({ name, avatarUrl, size = 32 }: { name: string; avatarUrl?: string; size?: number }) {
  const initial = name?.charAt(0).toUpperCase() ?? '?';
  if (avatarUrl) {
    return (
      <img
        src={getImageUrl(avatarUrl)}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: 'var(--brand-tint)', color: 'var(--brand-ink)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: size * 0.42, fontFamily: 'var(--font-display)',
      }}
    >
      {initial}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
      <span style={{ fontSize: 13, color: '#64748B' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#1E293B' }}>{value}</span>
    </div>
  );
}
