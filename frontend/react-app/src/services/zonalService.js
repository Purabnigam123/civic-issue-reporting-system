import api from './api';

export const zonalService = {
  async getMetrics() {
    const res = await api.get('/zonal/metrics');
    return res.data;
  },

  async getComplaints(params = {}) {
    const res = await api.get('/zonal/complaints', { params });
    return res.data;
  },

  async assignComplaint(complaintId, { worker_id, comment }) {
    const res = await api.post(`/zonal/complaints/${complaintId}/assign`, {
      worker_id,
      comment,
    });
    return res.data;
  },

  async updateStatus(complaintId, { status, comment, worker_id, worker_name }) {
    const res = await api.post(`/zonal/complaints/${complaintId}/status`, {
      status,
      comment,
      worker_id,
      worker_name,
    });
    return res.data;
  },

  async getWorkers() {
    const res = await api.get('/zonal/workers');
    return res.data;
  },

  async createWorker(workerData) {
    const res = await api.post('/zonal/workers', workerData);
    return res.data;
  },

  async updateWorkerStatus(workerId, status) {
    const res = await api.patch(`/zonal/workers/${workerId}/status`, { status });
    return res.data;
  },

  async deleteWorker(workerId) {
    const res = await api.delete(`/zonal/workers/${workerId}`);
    return res.data;
  },

  async getAnalytics() {
    const res = await api.get('/zonal/analytics');
    return res.data;
  },
};
