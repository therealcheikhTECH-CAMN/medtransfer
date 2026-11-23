import apiClient from '../api/client';

export const consultationService = {
  async getList(params = {}) {
    const res = await apiClient.get('/consultations/', { params });
    return res.data.results || res.data;
  },

  async create(data) {
    const res = await apiClient.post('/consultations/', data);
    return res.data;
  },

  async amend(id, data) {
    const res = await apiClient.post(`/consultations/${id}/amend/`, data);
    return res.data;
  },

  async getById(id) {
    const res = await apiClient.get(`/consultations/${id}/`);
    return res.data;
  }
};
