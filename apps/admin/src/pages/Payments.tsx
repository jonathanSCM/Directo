import { useEffect, useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import api, { getImageUrl } from '../services/api';

const inputStyle: CSSProperties = {
  padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: 8,
  fontSize: 14, fontFamily: 'inherit', background: '#fff',
};

interface Payment {
  id: string;
  amount: string;
  currency: string;
  method: string;
  status: string;
  proof_url: string | null;
  transaction_reference: string | null;
  paid_at: string | null;
  created_at: string;
  users: { id: string; name: string; email: string };
  subscriptions?: { id: string; subscription_plans: { name: string } } | null;
  properties?: { id: string; title: string; slug: string } | null;
}

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  pending: { cls: 'badge-gray', label: 'Pendiente (sin comprobante)' },
  in_review: { cls: 'badge-yellow', label: 'En revisión' },
  confirmed: { cls: 'badge-green', label: 'Confirmado' },
  rejected: { cls: 'badge-red', label: 'Rechazado' },
  cancelled: { cls: 'badge-gray', label: 'Cancelado' },
  refunded: { cls: 'badge-blue', label: 'Reembolsado' },
};

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('in_review');
  const [selected, setSelected] = useState<Payment | null>(null);
  const [acting, setActing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/payments', {
        params: statusFilter ? { status: statusFilter } : {},
      });
      setPayments(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(fetchData, 20000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const confirmPayment = async (id: string) => {
    setActing(true);
    try {
      await api.patch(`/admin/payments/${id}/confirm`);
      setSelected(null);
      fetchData();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'No se pudo confirmar el pago');
    }
    setActing(false);
  };

  const rejectPayment = async (id: string) => {
    setActing(true);
    try {
      await api.patch(`/admin/payments/${id}/reject`);
      setSelected(null);
      fetchData();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'No se pudo rechazar el pago');
    }
    setActing(false);
  };

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const conceptLabel = (p: Payment) => {
    if (p.properties) return `Propiedad extra: ${p.properties.title}`;
    if (p.subscriptions) return `Suscripción: ${p.subscriptions.subscription_plans.name}`;
    return '—';
  };

  return (
    <div>
      <div className="page-header">
        <h1>Pagos</h1>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 14, color: '#64748b' }}>Filtrar:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ ...inputStyle, width: 220 }}
        >
          <option value="in_review">En revisión (con comprobante)</option>
          <option value="pending">Pendientes (sin comprobante)</option>
          <option value="confirmed">Confirmados</option>
          <option value="rejected">Rechazados</option>
          <option value="">Todos</option>
        </select>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><p>Cargando...</p></div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Concepto</th>
                <th>Monto</th>
                <th>Método</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>No hay pagos</td></tr>
              ) : (
                payments.map((p) => {
                  const st = STATUS_BADGE[p.status] ?? STATUS_BADGE.pending;
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.users.name}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{p.users.email}</div>
                      </td>
                      <td style={{ fontSize: 13 }}>{conceptLabel(p)}</td>
                      <td><strong>{p.currency === 'USD' ? '$' : 'Bs.'} {Number(p.amount).toLocaleString()}</strong></td>
                      <td>{p.method}</td>
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                      <td style={{ fontSize: 13 }}>{fmt(p.created_at)}</td>
                      <td>
                        <button className="btn btn-sm btn-outline" onClick={() => setSelected(p)}>
                          Ver
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="modal-overlay show" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3>Detalle del pago</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Usuario</div>
                <div style={{ fontWeight: 600 }}>{selected.users.name}</div>
                <div style={{ fontSize: 13, color: '#64748b' }}>{selected.users.email}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Estado</div>
                <span className={`badge ${(STATUS_BADGE[selected.status] ?? STATUS_BADGE.pending).cls}`}>
                  {(STATUS_BADGE[selected.status] ?? STATUS_BADGE.pending).label}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Concepto</div>
              <div style={{ fontSize: 14 }}>{conceptLabel(selected)}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Monto</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  {selected.currency === 'USD' ? '$' : 'Bs.'} {Number(selected.amount).toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Referencia</div>
                <div style={{ fontSize: 13, fontFamily: 'monospace' }}>{selected.transaction_reference || '—'}</div>
              </div>
            </div>

            {selected.proof_url ? (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Comprobante</div>
                <a href={getImageUrl(selected.proof_url)} target="_blank" rel="noopener noreferrer">
                  <img
                    src={getImageUrl(selected.proof_url)}
                    alt="Comprobante de pago"
                    style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                </a>
              </div>
            ) : (
              <div style={{ marginBottom: 16, fontSize: 13, color: '#94a3b8' }}>
                Todavía no subió comprobante.
              </div>
            )}

            <div className="modal-actions">
              {(selected.status === 'in_review' || selected.status === 'pending') && (
                <>
                  <button
                    className="btn btn-primary"
                    onClick={() => confirmPayment(selected.id)}
                    disabled={acting || !selected.proof_url}
                    title={!selected.proof_url ? 'Todavía no subió comprobante' : ''}
                  >
                    {acting ? 'Procesando...' : 'Confirmar pago'}
                  </button>
                  <button
                    className="btn"
                    style={{ background: '#fee2e2', color: '#991b1b' }}
                    onClick={() => rejectPayment(selected.id)}
                    disabled={acting}
                  >
                    Rechazar
                  </button>
                </>
              )}
              <button className="btn btn-outline" onClick={() => setSelected(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
