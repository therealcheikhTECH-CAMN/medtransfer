import apiClient from '../api/client';

export const medicalRecordService = {
  async getByPatientId(patientId) {
    const res = await apiClient.get(`/medical-records/by-patient/${patientId}/`);
    return res.data;
  },

  async addAntecedent(data) {
    const res = await apiClient.post('/antecedents/', data);
    return res.data;
  },

  async addAllergie(data) {
    const res = await apiClient.post('/allergies/', data);
    return res.data;
  },

  async addTraitement(data) {
    const res = await apiClient.post('/traitements/', data);
    return res.data;
  },

  async updateTraitement(id, data) {
    const res = await apiClient.patch(`/traitements/${id}/`, data);
    return res.data;
  },

  async stopTraitement(id, motifArret = 'Arrêt médical') {
    const res = await apiClient.post(`/traitements/${id}/stop/`, {
      motif_arret: motifArret,
    });
    return res.data;
  },

  async addExamen(data) {
    const res = await apiClient.post('/examens/', data);
    return res.data;
  }
};
