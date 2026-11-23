import apiClient from '../api/client';

export const establishmentService = {
  async getPublicList() {
    const res = await apiClient.get('/establishments/public/');
    const data = res.data?.results || res.data;
    return Array.isArray(data) ? data.filter((e) => e.is_active !== false) : [];
  },

  async getDirectory(params = {}, options = {}) {
    const res = await apiClient.get('/establishments/directory/', {
      params,
      signal: options.signal,
    });
    const data = res.data?.results || res.data;
    return Array.isArray(data) ? data : [];
  },

  async getList(params = {}, options = {}) {
    const res = await apiClient.get('/establishments/', {
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

  async getById(id) {
    const res = await apiClient.get(`/establishments/${id}/`);
    return res.data;
  },

  async create(data) {
    const res = await apiClient.post('/establishments/', data);
    return res.data;
  },

  async update(id, data) {
    const res = await apiClient.put(`/establishments/${id}/`, data);
    return res.data;
  },

  async partialUpdate(id, data) {
    const res = await apiClient.patch(`/establishments/${id}/`, data);
    return res.data;
  },

  async toggleActive(id, isActive) {
    const payload = isActive !== undefined ? { is_active: isActive } : {  async getMyEstablishment() {
    const res = await apiClient.get('/establishments/my-establishment/');
    return res.data;
  },

  async updateMyEstablishment(data) {
    const res = await apiClient.patch('/establishments/my-establishment/', data);
    return res.data;
  },
};
    const res = await apiClient.post(`/establishments/${id}/toggle-active/`, payload);
    return res.data;
  },

  async assignDirector(id, data) {
    const res = await apiClient.post(`/establishments/${id}/assign-director/`, data);
    return res.data;
  },
  async getMyEstablishment() {
    const res = await apiClient.get('/establishments/my-establishment/');
    return res.data;
  },

  async updateMyEstablishment(data) {
    const res = await apiClient.patch('/establishments/my-establishment/', data);
    return res.data;
  },
};
