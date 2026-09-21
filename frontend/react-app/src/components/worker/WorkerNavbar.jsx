import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../assets/images/logo.png';
import NotificationBell from '../notifications/NotificationBell';

const WorkerNavbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-surface-container-lowest border-b border-outline-variant/30 px-4 py-3 sticky top-0 z-40 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center overflow-hidden shadow-sm shadow-primary/20 shrink-0">
          <img src={logoImg} alt="CivicPulse" className="w-full h-full object-cover" />
        </div>
        <div>
          <h1 className="font-extrabold text-sm text-on-surface leading-tight">
            Civic<span className="text-primary">Pulse</span>
          </h1>
          <span className="text-[10px] uppercase font-bold text-primary font-mono">
            {user?.worker_id || 'Field Worker'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />
        <span className="text-xs font-bold text-on-surface hidden sm:inline">{user?.name}</span>
        <button
          type="button"
          onClick={handleLogout}
          className="p-1.5 bg-surface-container-low hover:bg-error-container text-outline hover:text-on-error-container rounded-xl text-xs flex items-center gap-1 transition-colors border border-outline-variant/30"
          title="Sign Out"
        >
          <span className="material-symbols-outlined text-base">logout</span>
          <span className="text-[11px] font-bold hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
};

export default WorkerNavbar;
