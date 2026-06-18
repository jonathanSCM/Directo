import { useEffect, useState } from 'react';
import api from '../services/api';

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
}

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
    </>
  );
}
