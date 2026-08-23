import api from './api';

export const authService = {
  async register(name, email, phone, password) {
    const response = await api.post('/auth/register', { name, email, phone, password });
    if (response.data && response.data.token) {
      localStorage.setItem('civic_token', response.data.token);
      localStorage.setItem('civic_user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  async login(email, password) {
    const response = await api.post('/auth/login', { email, password });
    if (response.data && response.data.token) {
      localStorage.setItem('civic_token', response.data.token);
      localStorage.setItem('civic_user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  async loginAsDemo() {
    return this.login('citizen@civic.local', 'Staff@123');
  },

  async getMe() {
    const response = await api.get('/auth/me');
    if (response.data && response.data.user) {
      localStorage.setItem('civic_user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  logout() {
    localStorage.removeItem('civic_token');
    localStorage.removeItem('civic_user');
  },

  getCurrentUser() {
    const userStr = localStorage.getItem('civic_user');
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },

  getToken() {
    return localStorage.getItem('civic_token');
  },

  isAuthenticated() {
    return !!localStorage.getItem('civic_token');
  },
};
