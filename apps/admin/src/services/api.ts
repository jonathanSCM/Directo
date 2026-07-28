import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// La sesión vive en cookies httpOnly que pone la API (ver auth.controller.ts
// del backend) — invisibles para JS, así que acá no se guarda ni se manda
// ningún token a mano. `withCredentials` es lo que hace que el navegador
// adjunte esas cookies en cada request.
const api = axios.create({
  baseURL: API_BASE,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

let refreshing: Promise<void> | null = null;

async function refreshSession(): Promise<void> {
  // Sin body: el refresh token va en la cookie httpOnly, no en JS.
  await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const isAuthCall = original?.url?.includes('/auth/login') || original?.url?.includes('/auth/refresh');
    if (error.response?.status === 401 && !isAuthCall && !original._retried) {
      original._retried = true;
      try {
        refreshing = refreshing ?? refreshSession();
        await refreshing;
        refreshing = null;
        return api(original);
      } catch {
        refreshing = null;
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  },
);

export default api;

const SERVER_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api$/, '');
export function getImageUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${SERVER_BASE}${path}`;
}

