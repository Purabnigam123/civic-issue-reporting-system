import api from './api';

export const adminService = {
  async getMetrics() {
    const res = await api.get('/admin/metrics');
    return res.data;
  },

  async getComplaints(params = {}) {
    const res = await api.get('/admin/complaints', { params });
    return res.data;
  },

  async updateComplaintStatus(id, { status, comment, worker_id, worker_name }) {
    const res = await api.post(`/admin/complaints/${id}/status`, {
      status,
      comment,
      worker_id,
      worker_name,
    });
    return res.data;
  },

  async getSuspicious(params = {}) {
    const res = await api.get('/admin/suspicious', { params });
    return res.data;
  },

  async verifySuspicious(id) {
    const res = await api.post(`/admin/suspicious/${id}/verify`);
    return res.data;
  },

  async dismissSuspicious(id, reason = '') {
    const res = await api.post(`/admin/suspicious/${id}/dismiss`, { reason });
    return res.data;
  },

  async getUsers(params = {}) {
    const res = await api.get('/admin/users', { params });
    return res.data;
  },

  async banUser(userId, reason = '') {
    const res = await api.post(`/admin/users/${userId}/ban`, { reason });
    return res.data;
  },

  async unbanUser(userId) {
    const res = await api.post(`/admin/users/${userId}/unban`);
    return res.data;
  },

  async getAuditLogs(params = {}) {
    const res = await api.get('/admin/audit-logs', { params });
    return res.data;
  },

  async triggerSlaScan() {
    const res = await api.post('/admin/escalate/scan');
    return res.data;
  },

  async getHeatmapData(params = {}) {
    const res = await api.get('/admin/heatmap', { params });
    return res.data;
  },

  async getAnalytics() {
    const res = await api.get('/admin/analytics');
    return res.data;
  },

  async createZonalAdmin(payload) {
    const res = await api.post('/admin/users/create-zonal-admin', payload);
    return res.data;
  },
};

