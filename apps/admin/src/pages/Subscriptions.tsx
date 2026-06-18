import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  currency: string;
  duration_days: number;
  max_active_properties: number | null;
  max_images_per_property: number | null;
  allows_featured: boolean;
  includes_statistics: boolean;
  priority_in_results: boolean;
  publication_duration_days: number | null;
  is_active: boolean;
}

interface Subscription {
  id: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  users?: { id: string; name: string; email: string };
  subscription_plans?: { name: string };
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  active: { cls: 'badge-green', label: 'Activa' },
  expired: { cls: 'badge-red', label: 'Vencida' },
  pending_payment: { cls: 'badge-yellow', label: 'Pendiente pago' },
  cancelled: { cls: 'badge-gray', label: 'Cancelada' },
  in_review: { cls: 'badge-blue', label: 'En revisión' },
  renewed: { cls: 'badge-green', label: 'Renovada' },
};

const EMPTY_PLAN_FORM = {
  name: '',
  description: '',
  price: 0,
  currency: 'BOB',
  duration_days: 30,
  max_active_properties: '' as number | '',
  max_images_per_property: '' as number | '',
  allows_featured: false,
  includes_statistics: false,
  priority_in_results: false,
  publication_duration_days: '' as number | '',
  is_active: true,
};

type PlanForm = typeof EMPTY_PLAN_FORM;

export default function Subscriptions() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'plans' | 'subs'>('plans');

  // Plan modal
  const [planModal, setPlanModal] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState<PlanForm>({ ...EMPTY_PLAN_FORM });
  const [planSaving, setPlanSaving] = useState(false);

  // Assign modal
  const [assignModal, setAssignModal] = useState(false);
  const [assignPlanId, setAssignPlanId] = useState('');
  const [assignUserId, setAssignUserId] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [assignSaving, setAssignSaving] = useState(false);

  // Subscription filter
  const [statusFilter, setStatusFilter] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, subsRes] = await Promise.all([
        api.get('/admin/subscription-plans'),
        api.get('/admin/subscriptions'),
      ]);
      setPlans(plansRes.data);
      setSubs(Array.isArray(subsRes.data) ? subsRes.data : subsRes.data.data || []);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Search users for assign modal
  useEffect(() => {
    if (!userSearch || userSearch.length < 2) { setUserOptions([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/admin/users', { params: { q: userSearch, limit: 10 } });
        setUserOptions((data.data || data).map((u: UserOption) => ({ id: u.id, name: u.name, email: u.email })));
      } catch { /* */ }
    }, 300);
    return () => clearTimeout(t);
  }, [userSearch]);

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('es-BO') : '—';

  // ── Plan CRUD ───────────────────────────────────────────────────────────────

  const openCreatePlan = () => {
    setEditingPlanId(null);
    setPlanForm({ ...EMPTY_PLAN_FORM });
    setPlanModal(true);
  };

  const openEditPlan = (p: Plan) => {
    setEditingPlanId(p.id);
    setPlanForm({
      name: p.name,
      description: p.description || '',
      price: Number(p.price),
      currency: p.currency,
      duration_days: p.duration_days,
      max_active_properties: p.max_active_properties ?? '',
      max_images_per_property: p.max_images_per_property ?? '',
      allows_featured: p.allows_featured,
      includes_statistics: p.includes_statistics,
      priority_in_results: p.priority_in_results,
      publication_duration_days: p.publication_duration_days ?? '',
      is_active: p.is_active,
    });
    setPlanModal(true);
  };

  const savePlan = async () => {
    setPlanSaving(true);
    try {
      const body = {
        ...planForm,
        max_active_properties: planForm.max_active_properties === '' ? null : Number(planForm.max_active_properties),
        max_images_per_property: planForm.max_images_per_property === '' ? null : Number(planForm.max_images_per_property),
        publication_duration_days: planForm.publication_duration_days === '' ? null : Number(planForm.publication_duration_days),
        price: Number(planForm.price),
      };
      if (editingPlanId) {
        await api.patch(`/admin/subscription-plans/${editingPlanId}`, body);
      } else {
        await api.post('/admin/subscription-plans', body);
      }
      setPlanModal(false);
      loadData();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error al guardar');
    }
    setPlanSaving(false);
  };

  const togglePlanActive = async (p: Plan) => {
    if (p.is_active) {
      if (!confirm(`¿Desactivar el plan "${p.name}"? Los usuarios actuales lo conservan hasta que venza.`)) return;
      try {
        await api.delete(`/admin/subscription-plans/${p.id}`);
        loadData();
      } catch (e: any) {
        alert(e.response?.data?.message || 'Error');
      }
    } else {
      try {
        await api.patch(`/admin/subscription-plans/${p.id}`, { is_active: true });
        loadData();
      } catch (e: any) {
        alert(e.response?.data?.message || 'Error');
      }
    }
  };

  // ── Subscriptions actions ───────────────────────────────────────────────────

  const activateSub = async (id: string) => {
    if (!confirm('¿Activar esta suscripción?')) return;
    try {
      await api.patch(`/admin/subscriptions/${id}/activate`);
      loadData();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error al activar');
    }
  };

  const cancelSub = async (id: string) => {
    if (!confirm('¿Cancelar esta suscripción?')) return;
    try {
      await api.patch(`/admin/subscriptions/${id}/cancel`);
      loadData();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error al cancelar');
    }
  };

  const assignSubscription = async () => {
    if (!assignUserId || !assignPlanId) return;
    setAssignSaving(true);
    try {
      await api.post('/admin/subscriptions', { user_id: assignUserId, plan_id: assignPlanId });
      setAssignModal(false);
      setAssignUserId('');
      setAssignPlanId('');
      setUserSearch('');
      loadData();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error al asignar');
    }
    setAssignSaving(false);
  };

  const filteredSubs = statusFilter
    ? subs.filter((s) => s.status === statusFilter)
    : subs;

  const activePlans = plans.filter((p) => p.is_active);

  if (loading) return <div className="loading"><div className="spinner" /><p>Cargando...</p></div>;

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Suscripciones</h1>
          <p className="subtitle">Administra planes y suscripciones de usuarios</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={openCreatePlan}>+ Nuevo plan</button>
          <button className="btn btn-success" onClick={() => { setAssignModal(true); setAssignPlanId(''); setAssignUserId(''); setUserSearch(''); }}>
            Asignar suscripción
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'plans' ? 'active' : ''}`} onClick={() => setTab('plans')}>
          Planes ({plans.length})
        </button>
        <button className={`tab ${tab === 'subs' ? 'active' : ''}`} onClick={() => setTab('subs')}>
          Suscripciones ({subs.length})
        </button>
      </div>

      {/* ── Plans Tab ──────────────────────────────────────────────────────── */}
      {tab === 'plans' && (
        <div className="card">
          <div className="card-header">
            <h2>Planes de suscripción</h2>
          </div>
          <table>
            <thead>
              <tr>
                <th>Plan</th>
                <th>Precio</th>
                <th>Duración</th>
                <th>Máx. propiedades</th>
                <th>Máx. imágenes</th>
                <th>Características</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {plans.length === 0 && (
                <tr><td colSpan={8} className="empty-row">No hay planes</td></tr>
              )}
              {plans.map((p) => (
                <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.5 }}>
                  <td>
                    <strong>{p.name}</strong>
                    {p.description && <><br /><span className="text-muted">{p.description}</span></>}
                  </td>
                  <td>
                    {Number(p.price) === 0
                      ? <span className="badge badge-green">Gratis</span>
                      : <strong>${Number(p.price).toFixed(2)} {p.currency}</strong>
                    }
                  </td>
                  <td>{p.duration_days} días</td>
                  <td>{p.max_active_properties ?? '∞'}</td>
                  <td>{p.max_images_per_property ?? '∞'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {p.allows_featured && <span className="badge badge-blue">Destacadas</span>}
                      {p.includes_statistics && <span className="badge badge-blue">Estadísticas</span>}
                      {p.priority_in_results && <span className="badge badge-blue">Prioridad</span>}
                      {!p.allows_featured && !p.includes_statistics && !p.priority_in_results && (
                        <span className="text-muted">Básico</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${p.is_active ? 'badge-green' : 'badge-red'}`}>
                      {p.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button className="btn btn-sm btn-outline" onClick={() => openEditPlan(p)}>Editar</button>
                      <button
                        className={`btn btn-sm ${p.is_active ? 'btn-warning' : 'btn-success'}`}
                        onClick={() => togglePlanActive(p)}
                      >
                        {p.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Subscriptions Tab ──────────────────────────────────────────────── */}
      {tab === 'subs' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Suscripciones de usuarios</h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
            >
              <option value="">Todos los estados</option>
              <option value="active">Activas</option>
              <option value="pending_payment">Pendiente pago</option>
              <option value="expired">Vencidas</option>
              <option value="cancelled">Canceladas</option>
            </select>
          </div>
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Plan</th>
                <th>Estado</th>
                <th>Inicio</th>
                <th>Vencimiento</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubs.length === 0 && (
                <tr><td colSpan={6} className="empty-row">No hay suscripciones</td></tr>
              )}
              {filteredSubs.map((s) => {
                const badge = STATUS_BADGE[s.status] ?? { cls: 'badge-gray', label: s.status };
                const canActivate = ['pending_payment', 'in_review', 'expired'].includes(s.status);
                const canCancel = ['active', 'pending_payment'].includes(s.status);
                return (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.users?.name || '—'}</strong>
                      <br /><span className="text-muted">{s.users?.email}</span>
                    </td>
                    <td>{s.subscription_plans?.name || '—'}</td>
                    <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
                    <td>{fmt(s.start_date)}</td>
                    <td>{fmt(s.end_date)}</td>
                    <td>
                      <div className="actions-cell">
                        {canActivate && (
                          <button className="btn btn-sm btn-success" onClick={() => activateSub(s.id)}>
                            Activar
                          </button>
                        )}
                        {canCancel && (
                          <button className="btn btn-sm btn-danger" onClick={() => cancelSub(s.id)}>
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Plan Create/Edit Modal ─────────────────────────────────────────── */}
      <div className={`modal-overlay ${planModal ? 'show' : ''}`} onClick={() => setPlanModal(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
          <h3>{editingPlanId ? 'Editar plan' : 'Nuevo plan'}</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Nombre</label>
              <input value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} placeholder="Ej: Premium" />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Descripción</label>
              <input value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} placeholder="Descripción corta del plan" />
            </div>
            <div className="form-group">
              <label>Precio</label>
              <input type="number" min="0" step="0.01" value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Moneda</label>
              <input value={planForm.currency} onChange={(e) => setPlanForm({ ...planForm, currency: e.target.value.toUpperCase() })} maxLength={3} />
            </div>
            <div className="form-group">
              <label>Duración (días)</label>
              <input type="number" min="1" value={planForm.duration_days} onChange={(e) => setPlanForm({ ...planForm, duration_days: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Máx. propiedades activas</label>
              <input type="number" min="1" value={planForm.max_active_properties} onChange={(e) => setPlanForm({ ...planForm, max_active_properties: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="Vacío = ilimitado" />
            </div>
            <div className="form-group">
              <label>Máx. imágenes por propiedad</label>
              <input type="number" min="1" value={planForm.max_images_per_property} onChange={(e) => setPlanForm({ ...planForm, max_images_per_property: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="Vacío = ilimitado" />
            </div>
            <div className="form-group">
              <label>Duración publicación (días)</label>
              <input type="number" min="1" value={planForm.publication_duration_days} onChange={(e) => setPlanForm({ ...planForm, publication_duration_days: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="Vacío = ilimitado" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={planForm.allows_featured} onChange={(e) => setPlanForm({ ...planForm, allows_featured: e.target.checked })} />
              Permite destacadas
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={planForm.includes_statistics} onChange={(e) => setPlanForm({ ...planForm, includes_statistics: e.target.checked })} />
              Incluye estadísticas
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={planForm.priority_in_results} onChange={(e) => setPlanForm({ ...planForm, priority_in_results: e.target.checked })} />
              Prioridad en resultados
            </label>
          </div>

          {editingPlanId && (
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                <input type="checkbox" checked={planForm.is_active} onChange={(e) => setPlanForm({ ...planForm, is_active: e.target.checked })} />
                Plan activo
              </label>
            </div>
          )}

          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setPlanModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={savePlan} disabled={planSaving || !planForm.name}>
              {planSaving ? 'Guardando...' : editingPlanId ? 'Guardar cambios' : 'Crear plan'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Assign Subscription Modal ──────────────────────────────────────── */}
      <div className={`modal-overlay ${assignModal ? 'show' : ''}`} onClick={() => setAssignModal(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h3>Asignar suscripción</h3>
          <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>
            Activa un plan directamente para un usuario. La suscripción comienza de inmediato.
          </p>

          <div className="form-group">
            <label>Buscar usuario</label>
            <input
              value={userSearch}
              onChange={(e) => { setUserSearch(e.target.value); setAssignUserId(''); }}
              placeholder="Nombre o email del usuario..."
            />
            {userOptions.length > 0 && !assignUserId && (
              <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, marginTop: 4, maxHeight: 160, overflow: 'auto' }}>
                {userOptions.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => { setAssignUserId(u.id); setUserSearch(`${u.name} (${u.email})`); setUserOptions([]); }}
                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #F1F5F9' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <strong>{u.name}</strong>
                    <span className="text-muted" style={{ marginLeft: 8 }}>{u.email}</span>
                  </div>
                ))}
              </div>
            )}
            {assignUserId && (
              <div style={{ marginTop: 4, fontSize: 12, color: '#22C55E' }}>Usuario seleccionado</div>
            )}
          </div>

          <div className="form-group">
            <label>Plan</label>
            <select
              value={assignPlanId}
              onChange={(e) => setAssignPlanId(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 14, fontFamily: 'inherit' }}
            >
              <option value="">Seleccionar plan...</option>
              {activePlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {Number(p.price) === 0 ? 'Gratis' : `$${Number(p.price).toFixed(2)}`} / {p.duration_days} días
                </option>
              ))}
            </select>
          </div>

          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setAssignModal(false)}>Cancelar</button>
            <button
              className="btn btn-success"
              onClick={assignSubscription}
              disabled={assignSaving || !assignUserId || !assignPlanId}
            >
              {assignSaving ? 'Asignando...' : 'Asignar y activar'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
