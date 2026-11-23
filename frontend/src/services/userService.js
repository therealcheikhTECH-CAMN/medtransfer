import apiClient from '../api/client';

export const userService = {
  async getList(params = {}, options = {}) {
    const res = await apiClient.get('/accounts/users/', {
      params,
      signal: options.signal,
    });
    const items = res.data.results || res.data;
    if (Array.isArray(items)) {
      items.count = res.data.count !== undefined ? res.data.count : items.length;
      items.next = res.data.next || null;
      items.previous = res.data.previous || null;
      items.totalPages = res.data.count !== undefined ? Math.ceil(res.data.count / 20) : 1;
    }
    return items;
  },

  async create(data) {
    const res = await apiClient.post('/accounts/users/', data);
    return res.data;
  },

  async update(id, data) {
    const res = await apiClient.patch(`/accounts/users/${id}/`, data);
    return res.data;
  },

  async approve(id, data = {}) {
    const res = await apiClient.post(`/accounts/users/${id}/approve/`, data);
    return res.data;
  },

  async revokeDirector(id, motif) {
    const res = await apiClient.post(`/accounts/users/${id}/revoke-director/`, { motif });
    return res.data;
  },

  async resendValidationEmail(id) {
    const res = await apiClient.post(`/accounts/users/${id}/resend-validation-email/`);
    return res.data;
  },

  async reject(id, motif) {
    const res = await apiClient.post(`/accounts/users/${id}/reject/`, { motif });
    return res.data;
  },

  async suspend(id, motif = '') {
    const res = await apiClient.post(`/accounts/users/${id}/suspend/`, { motif });
    return res.data;
  },

  async reactivate(id) {
    const res = await apiClient.post(`/accounts/users/${id}/reactivate/`);
    return res.data;
  },

  async deactivate(id, motif = '') {
    const res = await apiClient.post(`/accounts/users/${id}/deactivate/`, { motif });
    return res.data;
  },

  async getStatusHistory(id) {
    const res = await apiClient.get(`/accounts/users/${id}/status-history/`);
    return res.data;
  },
};
