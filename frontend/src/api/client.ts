import axios from 'axios';

// All API calls go through this instance.
// VITE_API_URL is set in .env for local dev, and to the deployed backend URL in production.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
});

// Attach the JWT (if we have one) to every outgoing request automatically,
// so individual components never have to think about auth headers.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If the backend ever says the token is invalid/expired, log the user out
// automatically instead of leaving them stuck on a broken page.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
