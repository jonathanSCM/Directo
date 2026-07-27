import { useEffect, useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const inputStyle: CSSProperties = {
  padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: 8,
  fontSize: 14, fontFamily: 'inherit', background: '#fff',
};

interface Report {
  id: string;
  reason: string;
  message: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  properties: { id: string; title: string; slug: string; status: string };
  users: { id: string; name: string; email: string };
}

const REASON_LABEL: Record<string, string> = {
  fake: 'Propiedad falsa',
  misleading: 'Información engañosa',
  already_sold: 'Ya fue vendida/alquilada',
  inappropriate: 'Contenido inapropiado',
  spam: 'Spam',
  other: 'Otro',
};

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  pending: { cls: 'badge-yellow', label: 'Pendiente' },
  reviewed: { cls: 'badge-green', label: 'Revisado' },
  dismissed: { cls: 'badge-gray', label: 'Descartado' },
};

export default function Reports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [acting, setActing] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/reports', {
        params: statusFilter ? { status: statusFilter } : {},
      });
      setReports(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resolve = async (id: string, status: 'reviewed' | 'dismissed') => {
    setActing(id);
    try {
      await api.patch(`/admin/reports/${id}/resolve`, { status });
      fetchData();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'No se pudo actualizar el reporte');
    }
    setActing(null);
  };

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reportes</h1>
          <p className="subtitle">Propiedades reportadas por usuarios (falsas, engañosas, etc.)</p>
        </div>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 14, color: '#64748b' }}>Filtrar:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ ...inputStyle, width: 200 }}
        >
          <option value="pending">Pendientes</option>
          <option value="reviewed">Revisados</option>
          <option value="dismissed">Descartados</option>
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
                <th>Propiedad</th>
                <th>Motivo</th>
                <th>Reportado por</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr><td colSpan={6} className="empty-row">No hay reportes</td></tr>
              ) : (
                reports.map((r) => {
                  const st = STATUS_BADGE[r.status] ?? STATUS_BADGE.pending;
                  return (
                    <tr key={r.id}>
                      <td>
                        <strong
                          style={{ cursor: 'pointer', color: '#2563EB' }}
                          onClick={() => navigate(`/properties?id=${r.properties.id}`)}
                        >
                          {r.properties.title}
                        </strong>
                      </td>
                      <td>
                        {REASON_LABEL[r.reason] ?? r.reason}
                        {r.message && (
                          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, maxWidth: 280 }}>{r.message}</div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.users.name}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{r.users.email}</div>
                      </td>
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                      <td style={{ fontSize: 13 }}>{fmt(r.created_at)}</td>
                      <td>
                        <div className="actions-cell">
                          <button className="btn btn-sm btn-outline" onClick={() => navigate(`/properties?id=${r.properties.id}`)}>
                            Ver propiedad
                          </button>
                          {r.status === 'pending' && (
                            <>
                              <button
                                className="btn btn-sm btn-success"
                                disabled={acting === r.id}
                                onClick={() => resolve(r.id, 'reviewed')}
                              >
                                Marcar revisado
                              </button>
                              <button
                                className="btn btn-sm btn-outline"
                                disabled={acting === r.id}
                                onClick={() => resolve(r.id, 'dismissed')}
                              >
                                Descartar
                              </button>
                            </>
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
      )}
    </div>
  );
}
