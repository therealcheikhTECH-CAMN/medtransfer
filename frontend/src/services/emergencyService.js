import apiClient from '../api/client';

export const emergencyService = {
  async createIntervention(data) {
    const res = await apiClient.post('/emergencies/', data);
    return res.data;
  },

  async getList() {
    const res = await apiClient.get('/emergencies/');
    return res.data.results || res.data;
  },

  async requestAccess(data) {
    const res = await apiClient.post('/emergencies/request-access/', data);
    return res.data;
  },

  async getActiveAccess(patientId) {
    const res = await apiClient.get('/emergencies/active-access/', {
      params: { patient: patientId }
    });
    return res.data;
  },

  async revokeAccess(data) {
    const res = await apiClient.post('/emergencies/revoke-access/', data);
    return res.data;
  }
};
