import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../assets/images/logo.png';
import NotificationBell from '../notifications/NotificationBell';

const DashboardNavbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    if (path === '/report') {
      return location.pathname.startsWith('/report');
    }
    if (path === '/complaints') {
      return location.pathname.startsWith('/complaints');
    }
    if (path === '/profile') {
      return location.pathname === '/profile';
    }
    return location.pathname === path;
  };

  return (
    <header className="fixed top-0 left-0 right-0 w-full z-50 bg-surface dark:bg-surface-container shadow-sm border-b border-outline-variant/30 transition-all duration-150">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop h-16 flex justify-between items-center w-full">
        <div className="flex items-center gap-2">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img src={logoImg} alt="CivicPulse Logo" className="h-8 w-auto object-contain" />
            <span className="font-headline-md text-headline-md font-bold text-primary dark:text-primary-fixed tracking-tight">
              CivicPulse
            </span>
          </Link>
        </div>

      {/* Desktop Nav */}
      <nav className="hidden md:flex items-center gap-8 font-label-md text-label-md">
        <Link
          to="/dashboard"
          className={`h-full flex items-center transition-colors duration-200 ${
            isActive('/dashboard')
              ? 'text-primary font-bold border-b-2 border-primary pb-1'
              : 'text-on-surface-variant font-medium hover:text-primary'
          }`}
        >
          Dashboard
        </Link>
        <Link
          to="/report"
          className={`h-full flex items-center transition-colors duration-200 ${
            isActive('/report')
              ? 'text-primary font-bold border-b-2 border-primary pb-1'
              : 'text-on-surface-variant font-medium hover:text-primary'
          }`}
        >
          Report
        </Link>
        <Link
          to="/complaints"
          className={`h-full flex items-center transition-colors duration-200 ${
            isActive('/complaints')
              ? 'text-primary font-bold border-b-2 border-primary pb-1'
              : 'text-on-surface-variant font-medium hover:text-primary'
          }`}
        >
          History
        </Link>
        <Link
          to="/profile"
          className={`h-full flex items-center transition-colors duration-200 ${
            isActive('/profile')
              ? 'text-primary font-bold border-b-2 border-primary pb-1'
              : 'text-on-surface-variant font-medium hover:text-primary'
          }`}
        >
          Profile
        </Link>
      </nav>

      {/* Action Icons */}
      <div className="flex items-center gap-3">
        <NotificationBell />

        {/* Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            aria-label="User profile"
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-2 p-1.5 text-on-surface-variant hover:text-primary transition-colors duration-200 rounded-full hover:bg-surface-container-high"
          >
            <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-bold text-sm overflow-hidden border border-outline-variant/30">
              {user?.avatar ? (
                <img src={user.avatar} alt={user?.name || 'User Avatar'} className="w-full h-full object-cover" />
              ) : (
                user?.name ? user.name.charAt(0).toUpperCase() : 'C'
              )}
            </div>
            <span className="hidden lg:inline text-xs font-semibold text-on-surface">
              {user?.name || 'Citizen'}
            </span>
          </button>

          {profileDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-surface-container-lowest rounded-xl shadow-level-2 border border-outline-variant/30 py-2 z-50">
              <div className="px-4 py-2 border-b border-outline-variant/20 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-bold text-sm overflow-hidden shrink-0 border border-outline-variant/30">
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user?.name || 'User Avatar'} className="w-full h-full object-cover" />
                  ) : (
                    user?.name ? user.name.charAt(0).toUpperCase() : 'C'
                  )}
                </div>
                <div className="truncate min-w-0">
                  <p className="font-label-md text-on-surface font-bold truncate">{user?.name || 'Demo Citizen'}</p>
                  <p className="font-label-sm text-on-surface-variant text-xs truncate">{user?.email || 'citizen@civic.local'}</p>
                </div>
              </div>
              <Link
                to="/profile"
                onClick={() => setProfileDropdownOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-base">person</span>
                Profile Settings
              </Link>
              <Link
                to="/complaints"
                onClick={() => setProfileDropdownOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-base">history</span>
                My Reports Archive
              </Link>
              <div className="border-t border-outline-variant/20 my-1"></div>
              <button
                onClick={() => {
                  logout();
                  setProfileDropdownOpen(false);
                  navigate('/login');
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-error-container/20 transition-colors text-left"
              >
                <span className="material-symbols-outlined text-base">logout</span>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </header>
  );
};

export default DashboardNavbar;
