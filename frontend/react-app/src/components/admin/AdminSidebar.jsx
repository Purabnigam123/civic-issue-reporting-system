import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../assets/images/logo.png';

const AdminSidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { to: '/admin', label: 'City Overview', icon: 'dashboard', end: true },
    { to: '/admin/complaints', label: 'All Complaints', icon: 'list_alt' },
    { to: '/admin/suspicious', label: 'Suspicious Queue', icon: 'security_update_warning' },
    { to: '/admin/users', label: 'Citizen & Personnel', icon: 'group' },
    { to: '/admin/audit-logs', label: 'System Audit Logs', icon: 'history' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-64 bg-surface-container-lowest border-r border-outline-variant/30 min-h-screen flex flex-col justify-between p-4 text-on-surface shadow-sm">
      <div>
        {/* Brand */}
        <div className="flex items-center gap-3 px-3 py-4 mb-6 border-b border-outline-variant/20">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/20 overflow-hidden shrink-0">
            <img src={logoImg} alt="CivicPulse" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-on-surface">
              Civic<span className="text-primary">Pulse</span>
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-widest text-primary bg-primary-fixed/60 px-2 py-0.5 rounded-full border border-primary/20">
              Super Admin
            </span>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="space-y-1.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all ${
                  isActive
                    ? 'bg-primary text-on-primary shadow-md shadow-primary/20'
                    : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low'
                }`
              }
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* User info & Logout */}
      <div className="pt-4 border-t border-outline-variant/20">
        <div className="flex items-center gap-3 px-3 py-2.5 mb-2 bg-surface-container-low rounded-xl border border-outline-variant/20">
          <div className="w-9 h-9 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20">
            {(user?.name || 'A')[0].toUpperCase()}
          </div>
          <div className="overflow-hidden min-w-0">
            <p className="text-xs font-bold text-on-surface truncate">{user?.name || 'Super Admin'}</p>
            <p className="text-[11px] text-on-surface-variant truncate">{user?.email}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-error hover:bg-error-container/30 rounded-xl transition-colors"
        >
          <span className="material-symbols-outlined text-base">logout</span>
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
