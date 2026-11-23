import apiClient from '../api/client';

export const authService = {
  async login(emailOrUsername, password) {
    const identifier = (emailOrUsername || '').trim();
    const res = await apiClient.post('/auth/login/', {
      email: identifier,
      username: identifier,
      password,
    });
    const { access, refresh, user } = res.data;
    localStorage.setItem('medtransfer_access_token', access);
    localStorage.setItem('medtransfer_refresh_token', refresh);
    localStorage.setItem('medtransfer_user', JSON.stringify(user));
    return user;
  },

  async register(payload) {
    const res = await apiClient.post('/auth/register/', payload);
    return res.data;
  },

  async registerDirector(payload) {
    const res = await apiClient.post('/auth/register-director/', payload);
    return res.data;
  },

  async changePassword({ current_password, new_password, new_password_confirm }) {
    const res = await apiClient.post('/auth/change-password/', {
      current_password,
      new_password,
      new_password_confirm,
    });
    if (res.data?.access) {
      localStorage.setItem('medtransfer_access_token', res.data.access);
    }
    if (res.data?.refresh) {
      localStorage.setItem('medtransfer_refresh_token', res.data.refresh);
    }
    return res.data;
  },

  async requestPasswordReset(email) {
    const res = await apiClient.post('/auth/password-reset/request/', { email });
    return res.data;
  },

  async confirmPasswordReset({ token, new_password, new_password_confirm }) {
    const res = await apiClient.post('/auth/password-reset/confirm/', {
      token,
      new_password,
      new_password_confirm,
    });
    return res.data;
  },

  async getCurrentUser() {
    const res = await apiClient.get('/auth/me/');
    return res.data;
  },

  logout() {
    localStorage.removeItem('medtransfer_access_token');
    localStorage.removeItem('medtransfer_refresh_token');
    localStorage.removeItem('medtransfer_user');
    window.location.href = '/login';
  },

  getUserFromStorage() {
    const u = localStorage.getItem('medtransfer_user');
    return u ? JSON.parse(u) : null;
  },

  isAuthenticated() {
    return !!localStorage.getItem('medtransfer_access_token');
  },
};
