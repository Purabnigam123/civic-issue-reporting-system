import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(authService.getCurrentUser());
  const [token, setToken] = useState(authService.getToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = authService.getToken();
      if (storedToken) {
        try {
          const data = await authService.getMe();
          if (data && data.user) {
            setUser(data.user);
            setToken(storedToken);
          }
        } catch (err) {
          console.error('Failed to restore session:', err);
          authService.logout();
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (email, password) => {
    const data = await authService.login(email, password);
    if (data && data.token) {
      setToken(data.token);
      setUser(data.user);
    }
    return data;
  };

  const register = async (name, email, phone, password) => {
    const data = await authService.register(name, email, phone, password);
    if (data && data.token) {
      setToken(data.token);
      setUser(data.user);
    }
    return data;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setToken(null);
  };

  const updateUser = (updatedFields) => {
    setUser((prevUser) => {
      const newUser = { ...(prevUser || {}), ...updatedFields };
      localStorage.setItem('civic_user', JSON.stringify(newUser));
      return newUser;
    });
  };

  // ── Role helpers ─────────────────────────────────────────────
  const role = user?.role || 'CITIZEN';
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isZonalAdmin = role === 'ZONAL_ADMIN';
  const isWorker = role === 'WORKER';
  const isCitizen = role === 'CITIZEN';

  /** Returns the dashboard path for a role or current user's role */
  const getDashboardPath = (targetRole) => {
    const r = targetRole || role;
    switch (r) {
      case 'SUPER_ADMIN': return '/admin';
      case 'ZONAL_ADMIN': return '/zonal';
      case 'WORKER': return '/worker';
      default: return '/dashboard';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!token,
        login,
        register,
        logout,
        updateUser,
        // Role helpers
        role,
        isSuperAdmin,
        isZonalAdmin,
        isWorker,
        isCitizen,
        getDashboardPath,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
