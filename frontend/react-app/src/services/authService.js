import api from './api';

export const authService = {
  async register(name, email, phone, password) {
    try {
      const response = await api.post('/auth/register', { name, email, phone, password });
      const { token, user } = response.data;
      
      if (!token || !user) {
        throw new Error('Invalid response from server');
      }
      
      // Store token and user
      localStorage.setItem('civic_token', token);
      localStorage.setItem('civic_user', JSON.stringify(user));
      
      return { success: true, token, user, message: response.data.message };
    } catch (error) {
      const message = error.response?.data?.detail || error.response?.data?.message || error.message;
      throw new Error(message);
    }
  },

  async login(email, password) {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;
      
      if (!token || !user) {
        throw new Error('Invalid response from server');
      }
      
      // Store token and user
      localStorage.setItem('civic_token', token);
      localStorage.setItem('civic_user', JSON.stringify(user));
      
      return { success: true, token, user, message: response.data.message };
    } catch (error) {
      const message = error.response?.data?.detail || error.response?.data?.message || error.message;
      throw new Error(message);
    }
  },

  async getMe() {
    try {
      const response = await api.get('/auth/me');
      const { user } = response.data;
      
      if (user) {
        localStorage.setItem('civic_user', JSON.stringify(user));
      }
      
      return { success: true, user };
    } catch (error) {
      throw error;
    }
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
