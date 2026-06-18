import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  status: string;
  active_role?: string;
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
    subscription_plans: { name: string; slug: string; price: string; currency: string };
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

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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
            <h1>{detail.name}</h1>
            <p className="subtitle">{detail.email}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
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
                <tr><th>Título</th><th>Operación</th><th>Precio</th><th>Estado</th><th>Vistas</th><th>Fecha</th></tr>
              </thead>
              <tbody>
                {detail.properties.map((p) => {
                  const ps = PROP_STATUS[p.approval_status === 'pending' ? 'pending_approval' : p.status] ?? { cls: 'badge-gray', label: p.status };
                  return (
                    <tr key={p.id}>
                      <td><strong>{p.title}</strong></td>
                      <td>{OP_LABEL[p.operation] ?? p.operation}</td>
                      <td>{p.currency === 'USD' ? '$' : 'Bs.'} {Number(p.price).toLocaleString()}</td>
                      <td><span className={`badge ${ps.cls}`}>{ps.label}</span></td>
                      <td>{p.views_count}</td>
                      <td>{fmt(p.created_at)}</td>
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
                <tr><th>Plan</th><th>Precio</th><th>Estado</th><th>Inicio</th><th>Vencimiento</th></tr>
              </thead>
              <tbody>
                {detail.subscriptions.map((s) => {
                  const ss = SUB_STATUS[s.status] ?? { cls: 'badge-gray', label: s.status };
                  return (
                    <tr key={s.id}>
                      <td><strong>{s.subscription_plans.name}</strong></td>
                      <td>{Number(s.subscription_plans.price) === 0 ? 'Gratis' : `$${Number(s.subscription_plans.price).toFixed(2)}`}</td>
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

  // ── List View ───────────────────────────────────────────────────────────────
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Usuarios</h1>
          <p className="subtitle">{users.length} usuarios registrados</p>
        </div>
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
                <th>Ciudad</th>
                <th>Estado</th>
                <th>Registro</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const badge = STATUS_BADGE[u.status] ?? { cls: 'badge-gray', label: u.status };
                return (
                  <tr key={u.id}>
                    <td>
                      <strong
                        style={{ cursor: 'pointer', color: '#2563EB' }}
                        onClick={() => openDetail(u.id)}
                      >
                        {u.name}
                      </strong>
                    </td>
                    <td>{u.email}</td>
                    <td>{u.city || '—'}</td>
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
      <span style={{ fontSize: 13, color: '#64748B' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#1E293B' }}>{value}</span>
    </div>
  );
}
