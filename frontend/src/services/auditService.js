import apiClient from '../api/client';

export const auditService = {
  async getLogs(params = {}, options = {}) {
    const res = await apiClient.get('/audit/', {
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

  async exportCsv(params = {}) {
    const res = await apiClient.get('/audit/export/', {
      params,
      responseType: 'blob',
    });
    return res.data;
  },
};
