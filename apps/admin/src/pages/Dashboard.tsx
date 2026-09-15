import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../services/api';

interface TimeSeriesPoint {
  date: string;
  newUsers: number;
  newProperties: number;
  revenue: number;
}

interface NamedCount {
  count: number;
  [key: string]: string | number;
}

interface DashboardAnalytics {
  timeSeries: TimeSeriesPoint[];
  propertiesByZone: NamedCount[];
  propertiesByType: NamedCount[];
  propertiesByOperation: { operation: string; count: number }[];
  topViewedProperties: { id: string; title: string; slug: string; views_count: number }[];
  subscriptionsByPlan: { plan: string; count: number }[];
  revenueByPlan: { plan: string; total: number }[];
  ads: { viewsUsed: number; clicksUsed: number; ctr: number };
  search: {
    total: number;
    topZones: { zone: string; count: number }[];
    byOperation: { operation: string; count: number }[];
    zeroResult: { zone: string; city: string | null; operation: string | null; created_at: string }[];
  };
}

interface DashboardResponse {
  users: {
    total: number;
    newLast30Days: number;
    byStatus: { active: number; suspended: number; pending_verification: number };
  };
  properties: {
    total: number;
    byStatus: { published: number; pending_approval: number; draft: number };
  };
  subscriptions: { active: number };
  payments: { totalRevenue: number; revenueLast30Days: number; pending: number };
  analytics: DashboardAnalytics;
}

const OPERATION_LABEL: Record<string, string> = {
  sale: 'Venta',
  rent: 'Alquiler',
  anticretico: 'Anticrético',
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get('/admin/dashboard')
      .then((r) => setData(r.data))
      .catch(() => setError(true));
  }, []);

  if (error) return (
    <div className="loading">
      <p style={{ color: '#EF4444' }}>Error al cargar estadísticas. Verificá que la API esté corriendo.</p>
    </div>
  );

  if (!data) return <div className="loading"><div className="spinner" /><p>Cargando...</p></div>;

  const stats = [
    {
      label: 'Usuarios totales',
      value: data.users.total,
      sub: `+${data.users.newLast30Days} últimos 30 días`,
      color: 'blue',
    },
    {
      label: 'Propiedades publicadas',
      value: data.properties.byStatus.published,
      sub: `${data.properties.total} en total`,
      color: 'green',
    },
    {
      label: 'Pendientes aprobación',
      value: data.properties.byStatus.pending_approval,
      color: 'yellow',
    },
    {
      label: 'Suscripciones activas',
      value: data.subscriptions.active,
      color: '',
    },
    {
      label: 'Ingresos totales',
      value: `$${Number(data.payments.totalRevenue || 0).toLocaleString()}`,
      sub: `$${Number(data.payments.revenueLast30Days || 0).toLocaleString()} últimos 30 días`,
      color: 'green',
    },
    {
      label: 'Pagos pendientes',
      value: data.payments.pending,
      color: 'red',
    },
    {
      label: 'Usuarios activos',
      value: data.users.byStatus.active,
      color: '',
    },
    {
      label: 'Borradores',
      value: data.properties.byStatus.draft,
      color: '',
    },
  ];

  const a = data.analytics;
  const timeSeries = a.timeSeries.map((p) => ({
    ...p,
    date: new Date(p.date).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' }),
  }));
  const byOperation = a.propertiesByOperation.map((r) => ({
    operation: OPERATION_LABEL[r.operation] ?? r.operation,
    count: r.count,
  }));

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="subtitle">Resumen general de DIRECTO</p>
        </div>
      </div>

      <div className="stats-grid">
        {stats.map((s) => (
          <div key={s.label} className={`stat-card ${s.color}`}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            {s.sub && <div className="stat-sub">{s.sub}</div>}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header"><h2>Últimos 30 días</h2></div>
        <div style={{ padding: 16, height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="newUsers" name="Usuarios nuevos" stroke="#2563EB" dot={false} />
              <Line type="monotone" dataKey="newProperties" name="Propiedades publicadas" stroke="#22C55E" dot={false} />
              <Line type="monotone" dataKey="revenue" name="Ingresos ($)" stroke="#F59E0B" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
        <div className="card">
          <div className="card-header"><h2>Propiedades por zona (top 10)</h2></div>
          <div style={{ padding: 16, height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a.propertiesByZone} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" fontSize={12} allowDecimals={false} />
                <YAxis type="category" dataKey="zone" fontSize={12} width={100} />
                <Tooltip />
                <Bar dataKey="count" name="Propiedades" fill="#2563EB" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2>Zonas más buscadas (top 10)</h2></div>
          <div style={{ padding: 16, height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a.search.topZones} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" fontSize={12} allowDecimals={false} />
                <YAxis type="category" dataKey="zone" fontSize={12} width={100} />
                <Tooltip />
                <Bar dataKey="count" name="Búsquedas" fill="#7C3AED" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2>Propiedades por tipo</h2></div>
          <div style={{ padding: 16, height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a.propertiesByType}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Propiedades" fill="#22C55E" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2>Por operación (publicadas vs. buscadas)</h2></div>
          <div style={{ padding: 16, height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byOperation}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="operation" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Publicadas" fill="#F59E0B" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="stats-grid" style={{ marginTop: 24 }}>
        <div className="stat-card blue">
          <div className="stat-label">Búsquedas totales</div>
          <div className="stat-value">{a.search.total.toLocaleString()}</div>
          <div className="stat-sub">{a.search.zeroResult.length} sin resultados (últimas 20)</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
        <div className="card">
          <div className="card-header"><h2>Suscripciones por plan</h2></div>
          <table>
            <thead><tr><th>Plan</th><th>Activas</th><th>Ingresos confirmados</th></tr></thead>
            <tbody>
              {a.subscriptionsByPlan.map((p) => (
                <tr key={p.plan}>
                  <td>{p.plan}</td>
                  <td>{p.count}</td>
                  <td>${(a.revenueByPlan.find((r) => r.plan === p.plan)?.total ?? 0).toLocaleString()}</td>
                </tr>
              ))}
              {a.subscriptionsByPlan.length === 0 && (
                <tr><td colSpan={3} className="empty-row">Sin suscripciones activas</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-header"><h2>Propiedades más vistas</h2></div>
          <table>
            <thead><tr><th>Título</th><th>Vistas</th></tr></thead>
            <tbody>
              {a.topViewedProperties.map((p) => (
                <tr key={p.id}><td>{p.title}</td><td>{p.views_count}</td></tr>
              ))}
              {a.topViewedProperties.length === 0 && (
                <tr><td colSpan={2} className="empty-row">Sin datos todavía</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {a.search.zeroResult.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <h2>Búsquedas sin resultados (demanda no satisfecha)</h2>
          </div>
          <table>
            <thead><tr><th>Zona</th><th>Ciudad</th><th>Operación</th><th>Cuándo</th></tr></thead>
            <tbody>
              {a.search.zeroResult.map((s, i) => (
                <tr key={i}>
                  <td>{s.zone}</td>
                  <td>{s.city ?? '—'}</td>
                  <td>{s.operation ? OPERATION_LABEL[s.operation] ?? s.operation : '—'}</td>
                  <td>{new Date(s.created_at).toLocaleString('es-BO')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
