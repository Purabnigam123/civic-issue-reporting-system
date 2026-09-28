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

  // Default radius is 100 m to match the "Issues Near You" 100-metre requirement
  async getNearbyComplaints({ latitude, longitude, radius = 100, category = null, limit = 20 }) {
    const params = new URLSearchParams({ latitude, longitude, radius, limit });
    if (category) params.append('category', category);
    const response = await api.get(`/complaints/nearby?${params.toString()}`);
    return response.data;
  },

  async getMapData({ category, status, priority, district_id, limit = 500 } = {}) {
    const params = new URLSearchParams({ limit });
    if (category) params.append('category', category);
    if (status) params.append('status', status);
    if (priority) params.append('priority', priority);
    if (district_id) params.append('district_id', district_id);
    const response = await api.get(`/complaints/map?${params.toString()}`);
    return response.data;
  },

  async submitRating(complaintId, { rating, feedback }) {
    const response = await api.post(`/complaints/${encodeURIComponent(complaintId)}/rating`, {
      rating,
      feedback,
    });
    return response.data;
  },

  /**
   * Location-verified "Still Exists" confirmation.
   * The backend independently validates that the user is within 100 m of the complaint.
   * The frontend GPS position is NEVER trusted for authorization — backend decides.
   *
   * @param {string} complaintId  - CIV-xxxx or MongoDB ObjectId string
   * @param {{ latitude: number, longitude: number, fingerprint?: string }} coords
   */
  async confirmComplaint(complaintId, { latitude, longitude, fingerprint = '' }) {
    const response = await api.post(
      `/complaints/${encodeURIComponent(complaintId)}/confirm`,
      { latitude, longitude, fingerprint },
    );
    return response.data;
  },
};
