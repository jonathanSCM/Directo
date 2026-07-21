import { useEffect, useState, useCallback } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
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

interface QrSettings {
  qrImageUrl?: string;
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  instructions?: string;
}

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('in_review');
  const [selected, setSelected] = useState<Payment | null>(null);
  const [acting, setActing] = useState(false);

  const [qrSettings, setQrSettings] = useState<QrSettings>({});
  const [qrForm, setQrForm] = useState({ bank_name: '', account_holder: '', account_number: '', instructions: '' });
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [savingQr, setSavingQr] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const fetchQrSettings = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/payments/qr-settings');
      setQrSettings(data);
      setQrForm({
        bank_name: data.bankName ?? '',
        account_holder: data.accountHolder ?? '',
        account_number: data.accountNumber ?? '',
        instructions: data.instructions ?? '',
      });
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => { fetchQrSettings(); }, [fetchQrSettings]);

  const onQrFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setQrFile(f);
    setQrPreview(f ? URL.createObjectURL(f) : null);
  };

  const saveQrSettings = async () => {
    setSavingQr(true);
    try {
      const formData = new FormData();
      formData.append('bank_name', qrForm.bank_name);
      formData.append('account_holder', qrForm.account_holder);
      formData.append('account_number', qrForm.account_number);
      formData.append('instructions', qrForm.instructions);
      if (qrFile) formData.append('qr_image', qrFile);
      const { data } = await api.put('/admin/payments/qr-settings', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setQrSettings(data);
      setQrFile(null);
      setQrPreview(null);
      alert('Configuración de QR guardada');
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'No se pudo guardar la configuración');
    }
    setSavingQr(false);
  };

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

      <div className="card" style={{ marginBottom: 20, padding: 20 }}>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setQrOpen((v) => !v)}
        >
          <div>
            <h3 style={{ margin: 0 }}>Configuración del QR bancario</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
              {qrSettings.qrImageUrl
                ? 'QR configurado — se muestra a los usuarios al pagar.'
                : 'Sin configurar — los usuarios ven un QR de ejemplo hasta que subas uno real.'}
            </p>
          </div>
          <button className="btn btn-outline" onClick={(e) => { e.stopPropagation(); setQrOpen((v) => !v); }}>
            {qrOpen ? 'Ocultar' : 'Editar'}
          </button>
        </div>

        {qrOpen && (
          <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24 }}>
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Imagen del QR</div>
              <div style={{
                width: 200, height: 200, border: '1px dashed #CBD5E1', borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#f8fafc',
              }}>
                {qrPreview || qrSettings.qrImageUrl ? (
                  <img
                    src={qrPreview ?? getImageUrl(qrSettings.qrImageUrl)}
                    alt="QR bancario"
                    style={{ maxWidth: '100%', maxHeight: '100%' }}
                  />
                ) : (
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>Sin imagen</span>
                )}
              </div>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onQrFileChange} style={{ marginTop: 10, fontSize: 13 }} />
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                Genera el QR desde tu app bancaria (monto libre o fijo) y sube la captura aquí.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Banco</div>
                <input
                  value={qrForm.bank_name}
                  onChange={(e) => setQrForm({ ...qrForm, bank_name: e.target.value })}
                  placeholder="Ej. Banco Unión"
                  style={{ ...inputStyle, width: '100%' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Titular de la cuenta</div>
                <input
                  value={qrForm.account_holder}
                  onChange={(e) => setQrForm({ ...qrForm, account_holder: e.target.value })}
                  placeholder="Nombre del titular"
                  style={{ ...inputStyle, width: '100%' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Número de cuenta</div>
                <input
                  value={qrForm.account_number}
                  onChange={(e) => setQrForm({ ...qrForm, account_number: e.target.value })}
                  placeholder="Nro. de cuenta (opcional)"
                  style={{ ...inputStyle, width: '100%' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Instrucciones para el usuario</div>
                <textarea
                  value={qrForm.instructions}
                  onChange={(e) => setQrForm({ ...qrForm, instructions: e.target.value })}
                  placeholder="Ej. Escanea el QR con tu app bancaria y sube el comprobante. El pago se confirma en menos de 24h."
                  rows={3}
                  style={{ ...inputStyle, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
              <button className="btn btn-primary" onClick={saveQrSettings} disabled={savingQr} style={{ alignSelf: 'flex-start' }}>
                {savingQr ? 'Guardando...' : 'Guardar configuración'}
              </button>
            </div>
          </div>
        )}
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
