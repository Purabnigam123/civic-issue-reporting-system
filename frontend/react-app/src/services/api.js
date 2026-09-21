import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('civic_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Let browser set the correct multipart boundary for FormData
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // If token expired and not on login/register page, clear storage
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/register' && currentPath !== '/') {
        localStorage.removeItem('civic_token');
        localStorage.removeItem('civic_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
