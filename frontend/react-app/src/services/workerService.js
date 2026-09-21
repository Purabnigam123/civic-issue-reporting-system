import api from './api';

export const workerService = {
  async getTasks(statusFilter = '') {
    const res = await api.get('/worker/tasks', { params: { status_filter: statusFilter } });
    return res.data;
  },

  async getTaskDetail(taskId) {
    const res = await api.get(`/worker/tasks/${taskId}`);
    return res.data;
  },

  async startTask(taskId, comment = '') {
    const res = await api.post(`/worker/tasks/${taskId}/start`, { comment });
    return res.data;
  },

  async resolveTask(taskId, formData) {
    const res = await api.post(`/worker/tasks/${taskId}/resolve`, formData);
    return res.data;
  },

  async getStats() {
    const res = await api.get('/worker/stats');
    return res.data;
  },

  async getProfile() {
    const res = await api.get('/worker/profile');
    return res.data;
  },
};
