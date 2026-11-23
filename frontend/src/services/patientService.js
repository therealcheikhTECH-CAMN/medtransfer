import apiClient from '../api/client';

export const patientService = {
  /**
   * Recherche de patients (avec support du debounce, pagination et annulation via signal).
   * Renvoie un tableau enrichi des métadonnées DRF (count, next, previous).
   */
  async search(queryOrParams = '', statusIdentite = '', scope = '', options = {}) {
    let params = {};
    let signal = options.signal;

    if (typeof queryOrParams === 'object' && queryOrParams !== null) {
      const { q, query, status_identite, scope: s, page, page_size, signal: sig } = queryOrParams;
      if (q || query) params.q = q || query;
      if (status_identite) params.status_identite = status_identite;
      if (s) params.scope = s;
      if (page) params.page = page;
      if (page_size) params.page_size = page_size;
      if (sig) signal = sig;
    } else {
      if (queryOrParams) params.q = queryOrParams;
      if (statusIdentite) params.status_identite = statusIdentite;
      if (scope) params.scope = scope;
      if (options.page) params.page = options.page;
      if (options.page_size) params.page_size = options.page_size;
    }

    const res = await apiClient.get('/patients/', { params, signal });
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
    const res = await apiClient.get(`/patients/${id}/`);
    return res.data;
  },

  async create(patientData) {
    const res = await apiClient.post('/patients/', patientData);
    return res.data;
  },

  async createProvisional(data) {
    const res = await apiClient.post('/patients/provisional/', data);
    return res.data;
  },

  async checkDuplicates(params, options = {}) {
    const res = await apiClient.get('/patients/check-duplicates/', {
      params,
      signal: options.signal,
    });
    return res.data;
  },

  async getActiveCare(id) {
    const res = await apiClient.get(`/patients/${id}/active-care/`);
    return res.data;
  },

  async reconcile(provisionalId, targetPatientId, motif) {
    const res = await apiClient.post(`/patients/${provisionalId}/reconcile/`, {
      target_patient_id: targetPatientId,
      motif,
    });
    return res.data;
  },

  async correctAdministrative(id, data) {
    const res = await apiClient.patch(`/patients/${id}/`, data);
    return res.data;
  },

  async getModificationHistory(id) {
    const res = await apiClient.get(`/patients/${id}/history/`);
    return res.data;
  },
};
