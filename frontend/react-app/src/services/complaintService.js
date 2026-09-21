import api from './api';

export const complaintService = {
  async createComplaint(formData) {
    const response = await api.post('/complaints', formData);
    const resData = response.data;
    const complaint = resData?.complaint || resData?.data?.complaint;
    return {
      ...resData,
      complaint,
    };
  },

  async verifyIssueImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post('/ai/verify-issue', formData);
    return response.data;
  },

  async checkDuplicate({ category, latitude, longitude, radiusMeters = 100 }) {
    const response = await api.post('/complaints/check-duplicate', {
      category,
      latitude,
      longitude,
      radiusMeters,
    });
    return response.data;
  },

  async upvoteComplaint(complaintId, phone = '') {
    const response = await api.post(`/complaints/${encodeURIComponent(complaintId)}/upvote`, { phone });
    return response.data;
  },

  async getMyComplaints() {
    const response = await api.get('/complaints/my');
    return response.data;
  },

  async getComplaintById(id) {
    const response = await api.get(`/complaints/${id}`);
    return response.data;
  },

  async trackComplaintPublic(complaintId) {
    const response = await api.get(`/complaints/track/${encodeURIComponent(complaintId)}`);
    return response.data;
  },

  async updateStatus(id, { status, comment, evidence, worker_id, worker_name }) {
    const response = await api.post(`/complaints/${id}/status`, {
      status,
      comment,
      evidence,
      worker_id,
      worker_name,
    });
    return response.data;
  },

  async getPublicStats() {
    const response = await api.get('/complaints/public-stats');
    return response.data;
  },
};
