import apiClient from '../api/client';

export const notificationService = {
  async getList() {
    const res = await apiClient.get('/notifications/');
    return res.data.results || res.data;
  },

  async getUnreadCount() {
    const res = await apiClient.get('/notifications/unread-count/');
    return res.data.unread_count;
  },

  async markAsRead(id) {
    const res = await apiClient.post(`/notifications/${id}/mark-read/`);
    return res.data;
  },

  async markAllAsRead() {
    const res = await apiClient.post('/notifications/mark-all-read/');
    return res.data;
  }
};
