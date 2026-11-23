import apiClient from '../api/client';

export const careService = {
  async getPecList(params = {}) {
    const res = await apiClient.get('/care-management/', { params });
    return res.data.results || res.data;
  },

  async createPec(data) {
    const res = await apiClient.post('/care-management/', data);
    return res.data;
  },

  async takeCharge(patientId) {
    const res = await apiClient.post('/care-management/take-charge/', { patient_id: patientId });
    return res.data;
  },

  async closePec(id, motif) {
    const res = await apiClient.post(`/care-management/${id}/close/`, { motif });
    return res.data;
  },

  async getTransfers(params = {}) {
    const res = await apiClient.get('/transfers/', { params });
    return res.data.results || res.data;
  },

  async createTransfer(data) {
    const res = await apiClient.post('/transfers/', data);
    return res.data;
  },

  async acceptTransfer(id, motif) {
    const res = await apiClient.post(`/transfers/${id}/accept/`, { motif });
    return res.data;
  },

  async rejectTransfer(id, motif) {
    const res = await apiClient.post(`/transfers/${id}/reject/`, { motif });
    return res.data;
  }
};
