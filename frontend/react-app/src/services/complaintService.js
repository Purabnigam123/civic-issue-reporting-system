import api from './api';

export const complaintService = {
  async createComplaint(formData) {
    const response = await api.post('/complaints', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
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
};
