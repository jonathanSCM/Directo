import { useEffect, useState, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import api, { getImageUrl } from '../services/api';

type Placement = 'banner' | 'popup' | 'both';

type AdStatus = 'active' | 'paused' | 'pending_review';

interface Ad {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  status: AdStatus;
  ends_at: string | null;
  placement: Placement;
  created_at: string;
  views_used: number;
  clicks_used: number;
  companies: { name: string; user_id: string };
}

const PLACEMENT_LABEL: Record<Placement, string> = {
  banner: 'Banner',
  popup: 'Popup',
  both: 'Banner + Popup',
};

const STATUS_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'pending_review', label: 'Pendientes' },
  { value: 'active', label: 'Activos' },
  { value: 'paused', label: 'Pausados' },
] as const;

const EMPTY_FORM = { title: '', link_url: '', ends_at: '', placement: 'both' as Placement };

export default function Ads() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]['value']>('all');

  const fetchAds = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/ads');
      setAds(data);
    } catch {
      alert('Error al cargar la publicidad');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAds(); }, [fetchAds]);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFile(null);
    setPreview(null);
    setModalOpen(true);
  };

  const openEdit = (ad: Ad) => {
    setEditingId(ad.id);
    setForm({
      title: ad.title,
      link_url: ad.link_url ?? '',
      ends_at: ad.ends_at ? ad.ends_at.slice(0, 10) : '',
      placement: ad.placement ?? 'both',
    });
    setFile(null);
    setPreview(null);
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) { alert('El título es obligatorio'); return; }
    if (!editingId && !file) { alert('La imagen del banner es obligatoria'); return; }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('title', form.title.trim());
      if (form.link_url.trim()) formData.append('link_url', form.link_url.trim());
      if (form.ends_at) formData.append('ends_at', new Date(form.ends_at).toISOString());
      formData.append('placement', form.placement);
      if (file) formData.append('image', file);
      if (editingId) {
        await api.patch(`/admin/ads/${editingId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.post('/admin/ads', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      setModalOpen(false);
      fetchAds();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'No se pudo guardar el anuncio');
    }
    setSaving(false);
  };

  const setStatus = async (ad: Ad, status: 'active' | 'paused') => {
    try {
      await api.patch(`/admin/ads/${ad.id}/status`, { status });
      fetchAds();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'No se pudo cambiar el estado');
    }
  };

  const filteredAds = statusFilter === 'all' ? ads : ads.filter((ad) => ad.status === statusFilter);

  const remove = async (ad: Ad) => {
    if (!confirm(`¿Eliminar el anuncio "${ad.title}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/admin/ads/${ad.id}`);
      fetchAds();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'No se pudo eliminar');
    }
  };

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin vencimiento';

  if (loading) return <div className="loading"><div className="spinner" /><p>Cargando...</p></div>;

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Publicidad</h1>
          <p className="subtitle">
            Banners de marcas que aparecen en el detalle de las propiedades. Se cargan a mano, sin costo para el anunciante por ahora.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Nuevo banner</button>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Banners ({filteredAds.length})</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                className={`btn btn-sm ${statusFilter === f.value ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setStatusFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Banner</th>
              <th>Título</th>
              <th>Empresa</th>
              <th>Link</th>
              <th>Tipo</th>
              <th>Vistas</th>
              <th>Clics</th>
              <th>CTR</th>
              <th>Vencimiento</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredAds.length === 0 && (
              <tr><td colSpan={11} className="empty-row">Nada para mostrar acá</td></tr>
            )}
            {filteredAds.map((ad) => {
              const expired = ad.status === 'paused' && ad.ends_at && new Date(ad.ends_at) < new Date();
              const ctr = ad.views_used > 0 ? ((ad.clicks_used / ad.views_used) * 100).toFixed(1) + '%' : '—';
              return (
                <tr key={ad.id} style={{ opacity: ad.status === 'active' ? 1 : 0.5 }}>
                  <td>
                    <img
                      src={getImageUrl(ad.image_url)}
                      alt={ad.title}
                      style={{ width: 72, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid #E2E8F0' }}
                    />
                  </td>
                  <td><strong>{ad.title}</strong></td>
                  <td>{ad.companies?.name ?? '—'}</td>
                  <td>
                    {ad.link_url
                      ? <a href={ad.link_url} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>{ad.link_url}</a>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td>{PLACEMENT_LABEL[ad.placement] ?? 'Banner + Popup'}</td>
                  <td>{ad.views_used.toLocaleString()}</td>
                  <td>{ad.clicks_used.toLocaleString()}</td>
                  <td>{ctr}</td>
                  <td>{fmt(ad.ends_at)}</td>
                  <td>
                    {ad.status === 'pending_review' ? (
                      <span className="badge badge-yellow">Pendiente</span>
                    ) : expired ? (
                      <span className="badge badge-gray">Vencido</span>
                    ) : (
                      <span className={`badge ${ad.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                        {ad.status === 'active' ? 'Activo' : 'Pausado'}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button className="btn btn-sm btn-outline" onClick={() => openEdit(ad)}>Editar</button>
                      {ad.status === 'pending_review' ? (
                        <>
                          <button className="btn btn-sm btn-success" onClick={() => setStatus(ad, 'active')}>Aprobar</button>
                          <button className="btn btn-sm btn-warning" onClick={() => setStatus(ad, 'paused')}>Rechazar</button>
                        </>
                      ) : (
                        <button
                          className={`btn btn-sm ${ad.status === 'active' ? 'btn-warning' : 'btn-success'}`}
                          onClick={() => setStatus(ad, ad.status === 'active' ? 'paused' : 'active')}
                        >
                          {ad.status === 'active' ? 'Pausar' : 'Activar'}
                        </button>
                      )}
                      <button className="btn btn-sm btn-danger" onClick={() => remove(ad)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Create/Edit Modal ─────────────────────────────────────────────── */}
      <div className={`modal-overlay ${modalOpen ? 'show' : ''}`} onClick={() => setModalOpen(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
          <h3>{editingId ? 'Editar banner' : 'Nuevo banner'}</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 20, marginTop: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Imagen</div>
              <div style={{
                width: 140, height: 90, border: '1px dashed #CBD5E1', borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#f8fafc',
              }}>
                {preview || (editingId && ads.find((a) => a.id === editingId)?.image_url) ? (
                  <img
                    src={preview ?? getImageUrl(ads.find((a) => a.id === editingId)?.image_url)}
                    alt="Banner"
                    style={{ maxWidth: '100%', maxHeight: '100%' }}
                  />
                ) : (
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>Sin imagen</span>
                )}
              </div>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} style={{ marginTop: 10, fontSize: 12, width: 140 }} />
              {editingId && (
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                  Opcional: subí una imagen nueva solo si querés reemplazar la actual.
                </p>
              )}
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                JPG, PNG o WEBP, máx. 5 MB.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label>Título</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ej. Constructora Andina — Preventa"
                />
              </div>
              <div className="form-group">
                <label>Link (opcional)</label>
                <input
                  value={form.link_url}
                  onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                  placeholder="https://miempresa.com/promo"
                />
              </div>
              <div className="form-group">
                <label>Vence el (opcional)</label>
                <input
                  type="date"
                  value={form.ends_at}
                  onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Dónde se muestra</label>
                <select
                  value={form.placement}
                  onChange={(e) => setForm({ ...form, placement: e.target.value as Placement })}
                >
                  <option value="both">Banner + Popup (ambos)</option>
                  <option value="banner">Solo banner (detalle de propiedad)</option>
                  <option value="popup">Solo popup (al entrar a Explorar)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear banner'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
