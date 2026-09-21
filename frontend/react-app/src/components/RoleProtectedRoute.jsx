import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Role-based route protection.
 *
 * Usage:
 *   <RoleProtectedRoute allowedRoles={['SUPER_ADMIN']}>
 *     <AdminDashboardPage />
 *   </RoleProtectedRoute>
 */
const RoleProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, loading, role, getDashboardPath } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg, #0f1117)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40,
            border: '4px solid var(--color-primary, #6366f1)',
            borderTop: '4px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>Loading CivicPulse...</p>
        </div>
      </div>
    );
  }

  // Not logged in → redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Logged in but wrong role → redirect to their own dashboard
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to={getDashboardPath()} replace />;
  }

  return children;
};

export default RoleProtectedRoute;
