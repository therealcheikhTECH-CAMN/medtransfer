import apiClient from '../api/client';

export const statsService = {
  async getDashboardStats() {
    const res = await apiClient.get('/stats/dashboard/');
    return res.data;
  }
};
