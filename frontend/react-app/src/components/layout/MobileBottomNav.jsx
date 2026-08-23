import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const MobileBottomNav = () => {
  const location = useLocation();

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

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
    { label: 'Report', path: '/report', icon: 'add_circle' },
    { label: 'History', path: '/complaints', icon: 'history' },
    { label: 'Profile', path: '/profile', icon: 'person' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-2 md:hidden bg-surface dark:bg-surface-container-low shadow-[0px_-4px_20px_rgba(15,23,42,0.05)] rounded-t-xl font-label-sm text-label-sm pb-safe">
      {navItems.map((item) => {
        const active = isActive(item.path);
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center justify-center px-4 py-1 rounded-full transition-all duration-150 ${
              active
                ? 'bg-secondary-container dark:bg-secondary text-on-secondary-container dark:text-on-secondary scale-95 font-semibold'
                : 'text-on-surface-variant dark:text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            <span
              className={`material-symbols-outlined mb-0.5 ${active ? 'filled' : ''}`}
              data-icon={item.icon}
            >
              {item.icon}
            </span>
            <span className="text-[11px] leading-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default MobileBottomNav;
