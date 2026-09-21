import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user, token, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState(null);
  const [lastEvent, setLastEvent] = useState(null);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api.get('/notifications');
      if (res.data && res.data.notifications) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unread_count || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    fetchNotifications();

    // Setup WebSocket
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.hostname}:5000/ws?token=${token || ''}`;

    let ws;
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Connected to CivicPulse real-time WebSocket');
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          setLastEvent(payload);

          if (payload.type === 'NOTIFICATION' || payload.type === 'COMPLAINT_STATUS_CHANGED') {
            fetchNotifications();
          }
        } catch (e) {
          // ignore non-json messages
        }
      };

      ws.onerror = (err) => {
        console.warn('WebSocket connection warning:', err);
      };

      setSocket(ws);
    } catch (e) {
      console.warn('Could not establish WebSocket connection', e);
    }

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [isAuthenticated, token, fetchNotifications]);

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(prev - 1, 0));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markRead,
        markAllRead,
        refreshNotifications: fetchNotifications,
        lastEvent,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    return {
      notifications: [],
      unreadCount: 0,
      markRead: () => {},
      markAllRead: () => {},
      refreshNotifications: () => {},
      lastEvent: null,
    };
  }
  return context;
};
