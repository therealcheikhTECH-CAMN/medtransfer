import apiClient from '../api/client';

export const aiService = {
  async generateSummary(patientId, motifConsultation, consultationId = null) {
    const res = await apiClient.post('/ai/summaries/generate/', {
      patient_id: patientId,
      motif_consultation: motifConsultation,
      consultation_id: consultationId
    });
    return res.data;
  },

  async validateSummary(id, texteFinal, motif) {
    const res = await apiClient.post(`/ai/summaries/${id}/validate/`, {
      texte_final: texteFinal,
      motif
    });
    return res.data;
  },

  async rejectSummary(id, motif) {
    const res = await apiClient.post(`/ai/summaries/${id}/reject/`, { motif });
    return res.data;
  }
};
