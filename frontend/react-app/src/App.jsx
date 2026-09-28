import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleProtectedRoute from "./components/RoleProtectedRoute";
import { useAuth } from "./context/AuthContext";

// Citizen Pages
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import ReportIssuePage from "./pages/ReportIssuePage";
import ComplaintsPage from "./pages/ComplaintsPage";
import ComplaintDetailPage from "./pages/ComplaintDetailPage";
import ProfilePage from "./pages/ProfilePage";
import CivicMapPage from "./pages/CivicMapPage";

// Super Admin Pages
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminEscalatedPage from "./pages/admin/AdminEscalatedPage";
import AdminComplaintsPage from "./pages/admin/AdminComplaintsPage";
import AdminSuspiciousPage from "./pages/admin/AdminSuspiciousPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminAuditLogsPage from "./pages/admin/AdminAuditLogsPage";

// Zonal Admin Pages
import ZonalDashboardPage from "./pages/zonal/ZonalDashboardPage";
import ZonalComplaintsPage from "./pages/zonal/ZonalComplaintsPage";
import ZonalVerificationsPage from "./pages/zonal/ZonalVerificationsPage";
import ZonalWorkersPage from "./pages/zonal/ZonalWorkersPage";

// Field Worker Pages
import WorkerDashboardPage from "./pages/worker/WorkerDashboardPage";

function PublicAuthRoute({ children }) {
  const { isAuthenticated, loading, getDashboardPath } = useAuth();
  if (loading) return null;
  if (isAuthenticated) {
    return <Navigate to={getDashboardPath()} replace />;
  }
  return children;
}

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/login"
        element={
          <PublicAuthRoute>
            <LoginPage />
          </PublicAuthRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicAuthRoute>
            <RegisterPage />
          </PublicAuthRoute>
        }
      />
      <Route path="/map" element={<CivicMapPage />} />

      {/* Citizen Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="/report" element={<ReportIssuePage />} />
      <Route
        path="/complaints"
        element={
          <ProtectedRoute>
            <ComplaintsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/complaints/:id"
        element={
          <ProtectedRoute>
            <ComplaintDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      {/* Super Admin Routes */}
      <Route
        path="/admin"
        element={
          <RoleProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
            <AdminDashboardPage />
          </RoleProtectedRoute>
        }
      />
      <Route
        path="/admin/escalations"
        element={
          <RoleProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
            <AdminEscalatedPage />
          </RoleProtectedRoute>
        }
      />
      <Route
        path="/admin/complaints"
        element={
          <RoleProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
            <AdminComplaintsPage />
          </RoleProtectedRoute>
        }
      />
      <Route
        path="/admin/suspicious"
        element={
          <RoleProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
            <AdminSuspiciousPage />
          </RoleProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RoleProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
            <AdminUsersPage />
          </RoleProtectedRoute>
        }
      />
      <Route
        path="/admin/audit-logs"
        element={
          <RoleProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
            <AdminAuditLogsPage />
          </RoleProtectedRoute>
        }
      />

      {/* Zonal Admin Routes */}
      <Route
        path="/zonal"
        element={
          <RoleProtectedRoute allowedRoles={["ZONAL_ADMIN"]}>
            <ZonalDashboardPage />
          </RoleProtectedRoute>
        }
      />
      <Route
        path="/zonal/complaints"
        element={
          <RoleProtectedRoute allowedRoles={["ZONAL_ADMIN"]}>
            <ZonalComplaintsPage />
          </RoleProtectedRoute>
        }
      />
      <Route
        path="/zonal/verifications"
        element={
          <RoleProtectedRoute allowedRoles={["ZONAL_ADMIN"]}>
            <ZonalVerificationsPage />
          </RoleProtectedRoute>
        }
      />
      <Route
        path="/zonal/workers"
        element={
          <RoleProtectedRoute allowedRoles={["ZONAL_ADMIN"]}>
            <ZonalWorkersPage />
          </RoleProtectedRoute>
        }
      />

      {/* Field Worker Routes */}
      <Route
        path="/worker"
        element={
          <RoleProtectedRoute allowedRoles={["WORKER"]}>
            <WorkerDashboardPage />
          </RoleProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
