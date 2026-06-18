import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { getImageUrl } from '../services/api';

interface PropertyImage {
  id: string;
  url: string;
  is_main: boolean;
}

interface Property {
  id: string;
  title: string;
  slug: string;
  description: string;
  address: string;
  price: string;
  currency: string;
  operation: string;
  status: string;
  approval_status: string;
  rejection_reason: string | null;
  views_count: number;
  bedrooms: number | null;
  bathrooms: number | null;
  area_m2: string | null;
  whatsapp: string | null;
  latitude: string | null;
  longitude: string | null;
  created_at: string;
  published_at: string | null;
  property_images?: PropertyImage[];
  property_types?: { id: string; name: string; slug: string };
  zones?: { id: string; name: string; city: string };
  users?: { id: string; name: string; email: string; phone?: string };
}

const OP_LABEL: Record<string, string> = { sale: 'Venta', rent: 'Alquiler', anticretico: 'Anticrético' };

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  pending: { cls: 'badge-yellow', label: 'Pendiente' },
  pending_approval: { cls: 'badge-yellow', label: 'Pendiente' },
  published: { cls: 'badge-green', label: 'Publicada' },
  rejected: { cls: 'badge-red', label: 'Rechazada' },
  draft: { cls: 'badge-gray', label: 'Borrador' },
  taken_down: { cls: 'badge-red', label: 'Dada de baja' },
  sold_rented: { cls: 'badge-blue', label: 'Vendida/Alquilada' },
};

const APPROVAL_BADGE: Record<string, { cls: string; label: string }> = {
  pending: { cls: 'badge-yellow', label: 'Pendiente aprobación' },
  approved: { cls: 'badge-green', label: 'Aprobada' },
  rejected: { cls: 'badge-red', label: 'Rechazada' },
};

const REJECTION_REASONS = [
  'Fotos de baja calidad o no corresponden a la propiedad',
  'Información incompleta o inconsistente',
  'Precio no realista o sospechoso',
  'Dirección no válida o no verificable',
  'Contenido inapropiado o engañoso',
  'Propiedad duplicada',
  'Datos de contacto incorrectos',
  'No cumple con las políticas de publicación',
];

type Filter = '' | 'pending' | 'published' | 'draft' | 'rejected' | 'taken_down';
type View = 'list' | 'detail';

export default function Properties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [filter, setFilter] = useState<Filter>('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [detail, setDetail] = useState<Property | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Reject modal
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/properties?limit=100');
      setProperties(data.data || data);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setView('detail');
    try {
      const { data } = await api.get(`/admin/properties/${id}`);
      setDetail(data);
    } catch { alert('Error al cargar detalle'); setView('list'); }
    setDetailLoading(false);
  };

  const filtered = filter
    ? properties.filter((p) => {
        if (filter === 'pending') return p.approval_status === 'pending';
        if (filter === 'rejected') return p.status === 'rejected' || p.approval_status === 'rejected';
        if (filter === 'taken_down') return p.status === 'taken_down';
        return p.status === filter;
      })
    : properties;

  const getStatusKey = (p: Property) => {
    if (p.approval_status === 'pending') return 'pending';
    return p.status;
  };

  const approve = async (id: string) => {
    if (!confirm('¿Aprobar esta propiedad?')) return;
    await api.patch(`/admin/properties/${id}/approve`);
    load();
    if (detail?.id === id) openDetail(id);
  };

  const openReject = (id: string) => {
    setRejectId(id);
    setSelectedReason('');
    setCustomReason('');
  };

  const getRejectMessage = () => {
    const parts: string[] = [];
    if (selectedReason) parts.push(selectedReason);
    if (customReason.trim()) parts.push(customReason.trim());
    return parts.join('. ');
  };

  const submitReject = async () => {
    const reason = getRejectMessage();
    if (!reason) return alert('Selecciona o escribe un motivo');
    await api.patch(`/admin/properties/${rejectId}/reject`, { reason });
    setRejectId(null);
    load();
    if (detail?.id === rejectId) openDetail(rejectId!);
  };

  const takeDown = async (id: string) => {
    if (!confirm('¿Dar de baja esta propiedad? La propiedad dejará de ser visible pero podrá restaurarse.')) return;
    await api.patch(`/admin/properties/${id}/take-down`);
    load();
    if (detail?.id === id) openDetail(id);
  };

  const restore = async (id: string) => {
    if (!confirm('¿Restaurar esta propiedad? Volverá a estar publicada y visible.')) return;
    await api.patch(`/admin/properties/${id}/restore`);
    load();
    if (detail?.id === id) openDetail(id);
  };

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const tabs: { key: Filter; label: string }[] = [
    { key: '', label: 'Todas' },
    { key: 'pending', label: 'Pendientes' },
    { key: 'published', label: 'Publicadas' },
    { key: 'rejected', label: 'Rechazadas' },
    { key: 'draft', label: 'Borradores' },
    { key: 'taken_down', label: 'Dadas de baja' },
  ];

  // ── Detail View ─────────────────────────────────────────────────────────────
  if (view === 'detail') {
    if (detailLoading || !detail) {
      return <div className="loading"><div className="spinner" /><p>Cargando detalle...</p></div>;
    }

    const sk = getStatusKey(detail);
    const sBadge = STATUS_BADGE[sk] ?? { cls: 'badge-gray', label: sk };
    const aBadge = APPROVAL_BADGE[detail.approval_status] ?? { cls: 'badge-gray', label: detail.approval_status };
    const isPending = detail.approval_status === 'pending';
    const isPublished = detail.status === 'published';
    const isTakenDown = detail.status === 'taken_down';

    return (
      <>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <button className="btn btn-outline" onClick={() => setView('list')} style={{ marginBottom: 12 }}>
              ← Volver
            </button>
            <h1>{detail.title}</h1>
            <p className="subtitle">{detail.address || 'Sin dirección'}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isPending && (
              <>
                <button className="btn btn-success" onClick={() => approve(detail.id)}>Aprobar</button>
                <button className="btn btn-danger" onClick={() => openReject(detail.id)}>Rechazar</button>
              </>
            )}
            {isPublished && (
              <button className="btn btn-warning" onClick={() => takeDown(detail.id)}>Dar de baja</button>
            )}
            {isTakenDown && (
              <button className="btn btn-success" onClick={() => restore(detail.id)}>↩ Restaurar</button>
            )}
          </div>
        </div>

        {isTakenDown && (
          <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 600, color: '#92400E', fontSize: 14 }}>Propiedad dada de baja</div>
              <div style={{ color: '#78350F', fontSize: 13, marginTop: 2 }}>
                Esta propiedad fue retirada de la plataforma por un administrador y no es visible para el público.
                Podés restaurarla para publicarla nuevamente.
              </div>
            </div>
          </div>
        )}

        {/* Status badges */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <span className={`badge ${sBadge.cls}`}>{sBadge.label}</span>
          <span className={`badge ${aBadge.cls}`}>{aBadge.label}</span>
          <span className="badge badge-blue">{OP_LABEL[detail.operation] ?? detail.operation}</span>
        </div>

        {/* Rejection reason banner */}
        {detail.rejection_reason && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
            <div style={{ fontWeight: 600, color: '#991B1B', marginBottom: 4, fontSize: 14 }}>Motivo de rechazo</div>
            <div style={{ color: '#7F1D1D', fontSize: 14 }}>{detail.rejection_reason}</div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          {/* Left: images + description */}
          <div>
            {/* Images */}
            {detail.property_images && detail.property_images.length > 0 && (
              <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header"><h2>Imágenes ({detail.property_images.length})</h2></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, padding: 16 }}>
                  {detail.property_images.map((img) => (
                    <div key={img.id} style={{ position: 'relative' }}>
                      <img
                        src={getImageUrl(img.url)}
                        alt=""
                        style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8 }}
                      />
                      {img.is_main && (
                        <span className="badge badge-blue" style={{ position: 'absolute', top: 4, left: 4 }}>Principal</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header"><h2>Descripción</h2></div>
              <div style={{ padding: '16px 24px', fontSize: 14, lineHeight: 1.6, color: '#475569', whiteSpace: 'pre-wrap' }}>
                {detail.description || 'Sin descripción'}
              </div>
            </div>
          </div>

          {/* Right: info cards */}
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header"><h2>Información</h2></div>
              <div style={{ padding: 16 }}>
                <InfoRow label="Precio" value={`${detail.currency === 'USD' ? '$' : 'Bs.'} ${Number(detail.price).toLocaleString()}`} />
                <InfoRow label="Tipo" value={detail.property_types?.name || '—'} />
                <InfoRow label="Zona" value={detail.zones ? `${detail.zones.name}, ${detail.zones.city}` : '—'} />
                <InfoRow label="Dormitorios" value={detail.bedrooms?.toString() || '—'} />
                <InfoRow label="Baños" value={detail.bathrooms?.toString() || '—'} />
                <InfoRow label="Área" value={detail.area_m2 ? `${detail.area_m2} m²` : '—'} />
                <InfoRow label="WhatsApp" value={detail.whatsapp || '—'} />
                <InfoRow label="Vistas" value={detail.views_count.toString()} />
                <InfoRow label="Publicada" value={fmt(detail.published_at)} />
                <InfoRow label="Creada" value={fmt(detail.created_at)} />
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h2>Propietario</h2></div>
              <div style={{ padding: 16 }}>
                <InfoRow label="Nombre" value={detail.users?.name || '—'} />
                <InfoRow label="Email" value={detail.users?.email || '—'} />
                <InfoRow label="Teléfono" value={detail.users?.phone || '—'} />
              </div>
            </div>
          </div>
        </div>

        {/* Reject modal (shared) */}
        <RejectModal
          show={!!rejectId}
          onClose={() => setRejectId(null)}
          selectedReason={selectedReason}
          setSelectedReason={setSelectedReason}
          customReason={customReason}
          setCustomReason={setCustomReason}
          onSubmit={submitReject}
        />
      </>
    );
  }

  // ── List View ───────────────────────────────────────────────────────────────
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Propiedades</h1>
          <p className="subtitle">{filtered.length} propiedades</p>
        </div>
      </div>

      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.key} className={`tab ${filter === t.key ? 'active' : ''}`} onClick={() => setFilter(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><p>Cargando...</p></div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Título</th>
                <th>Operación</th>
                <th>Precio</th>
                <th>Propietario</th>
                <th>Vistas</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="empty-row">No hay propiedades</td></tr>
              )}
              {filtered.map((p) => {
                const sk = getStatusKey(p);
                const badge = STATUS_BADGE[sk] ?? { cls: 'badge-gray', label: sk };
                return (
                  <tr key={p.id}>
                    <td>
                      <strong
                        style={{ cursor: 'pointer', color: '#2563EB' }}
                        onClick={() => openDetail(p.id)}
                      >
                        {p.title}
                      </strong>
                      <br /><span className="text-muted">{p.address || '—'}</span>
                    </td>
                    <td>{OP_LABEL[p.operation] ?? p.operation}</td>
                    <td>{p.currency === 'USD' ? '$' : 'Bs.'} {Number(p.price).toLocaleString()}</td>
                    <td>{p.users?.name || '—'}</td>
                    <td>{p.views_count}</td>
                    <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
                    <td className="actions-cell">
                      <button className="btn btn-sm btn-outline" onClick={() => openDetail(p.id)}>Ver</button>
                      {sk === 'pending' && (
                        <>
                          <button className="btn btn-sm btn-success" onClick={() => approve(p.id)}>Aprobar</button>
                          <button className="btn btn-sm btn-danger" onClick={() => openReject(p.id)}>Rechazar</button>
                        </>
                      )}
                      {sk === 'published' && (
                        <button className="btn btn-sm btn-warning" onClick={() => takeDown(p.id)}>Dar de baja</button>
                      )}
                      {sk === 'taken_down' && (
                        <button className="btn btn-sm btn-success" onClick={() => restore(p.id)}>↩ Restaurar</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject modal */}
      <RejectModal
        show={!!rejectId}
        onClose={() => setRejectId(null)}
        selectedReason={selectedReason}
        setSelectedReason={setSelectedReason}
        customReason={customReason}
        setCustomReason={setCustomReason}
        onSubmit={submitReject}
      />
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

function RejectModal({
  show, onClose, selectedReason, setSelectedReason, customReason, setCustomReason, onSubmit,
}: {
  show: boolean;
  onClose: () => void;
  selectedReason: string;
  setSelectedReason: (v: string) => void;
  customReason: string;
  setCustomReason: (v: string) => void;
  onSubmit: () => void;
}) {
  if (!show) return null;
  return (
    <div className="modal-overlay show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <h3>Rechazar propiedad</h3>

        <div className="form-group">
          <label>Motivo predeterminado</label>
          <select
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 14, fontFamily: 'inherit' }}
          >
            <option value="">Seleccionar motivo...</option>
            {REJECTION_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Mensaje adicional (opcional)</label>
          <textarea
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="Agrega detalles específicos sobre el rechazo..."
            style={{ minHeight: 80 }}
          />
        </div>

        {(selectedReason || customReason) && (
          <div style={{ background: '#FEF2F2', borderRadius: 8, padding: 12, marginBottom: 8, fontSize: 13, color: '#991B1B' }}>
            <strong>Vista previa del motivo:</strong><br />
            {[selectedReason, customReason.trim()].filter(Boolean).join('. ')}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-danger" onClick={onSubmit} disabled={!selectedReason && !customReason.trim()}>
            Rechazar
          </button>
        </div>
      </div>
    </div>
  );
}
