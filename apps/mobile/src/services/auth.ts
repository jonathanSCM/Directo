import api from './api';

export const authService = {
  register(data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    city?: string;
  }) {
    return api.post('/auth/register', data);
  },

  login(data: { email: string; password: string }) {
    return api.post('/auth/login', data);
  },

  google(idToken: string) {
    return api.post('/auth/google', { idToken });
  },

  me() {
    return api.get('/auth/me');
  },

  switchRole(role: 'buyer' | 'owner') {
    return api.patch('/auth/switch-role', { role });
  },

  logout(refreshToken?: string) {
    return api.post('/auth/logout', { refreshToken });
  },
};
