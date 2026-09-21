import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';

const NotificationBell = () => {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (notif) => {
    if (!notif.isRead) {
      markRead(notif.id);
    }
    setIsOpen(false);
    if (notif.complaintId) {
      navigate(`/complaints/${notif.complaintId}`);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
        title="Notifications"
      >
        <span className="material-symbols-outlined text-2xl">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-primary text-on-primary text-[10px] font-extrabold rounded-full flex items-center justify-center animate-pulse shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-2xl z-50 overflow-hidden civic-glow-shadow">
          {/* Header */}
          <div className="p-4 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-on-surface">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-outline-variant/10">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant text-xs">
                <span className="material-symbols-outlined text-3xl text-outline mb-1 block">
                  notifications_paused
                </span>
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3.5 hover:bg-surface-container-high/60 cursor-pointer transition-colors flex items-start gap-3 text-left ${
                    !n.isRead ? 'bg-primary-fixed/20' : ''
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    !n.isRead ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
                  }`}>
                    <span className="material-symbols-outlined text-base">
                      {n.type === 'STATUS_UPDATE' ? 'published_with_changes' : 'info'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="font-bold text-xs text-on-surface truncate">{n.title}</p>
                      <span className="text-[10px] text-outline shrink-0">{formatDate(n.createdAt)}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">{n.message}</p>
                  </div>
                  {!n.isRead && (
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 self-center"></div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
