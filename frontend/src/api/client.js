import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 20000,
});

// Intercepteur de requête : injection automatique du token JWT
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('medtransfer_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercepteur de réponse : renouvellement automatique du token en cas d'expiration (401)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const isPublicAuthEndpoint =
      originalRequest?.url?.includes('/auth/login/') ||
      originalRequest?.url?.includes('/auth/register/') ||
      originalRequest?.url?.includes('/auth/password-reset/') ||
      originalRequest?.url?.includes('/establishments/public/');

    if (error.response?.status === 401 && !originalRequest._retry && !isPublicAuthEndpoint) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('medtransfer_refresh_token');

      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
            refresh: refreshToken,
          });
          const newAccess = res.data.access;
          localStorage.setItem('medtransfer_access_token', newAccess);
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
          return apiClient(originalRequest);
        } catch (refreshErr) {
          // Token de rafraîchissement invalide ou expiré -> Déconnexion
          localStorage.removeItem('medtransfer_access_token');
          localStorage.removeItem('medtransfer_refresh_token');
          localStorage.removeItem('medtransfer_user');
          window.location.href = '/login?session_expired=true';
        }
      } else {
        localStorage.removeItem('medtransfer_access_token');
        localStorage.removeItem('medtransfer_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
