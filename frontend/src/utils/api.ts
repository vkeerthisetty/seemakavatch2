import axios from 'axios';

const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

const api = axios.create({ baseURL: BASE });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('ibms_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ibms_token');
      localStorage.removeItem('ibms_user');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export default api;

export const login = (role: string, user_id: string, password: string) =>
  api.post('/auth/login', { role, user_id, password });

export const submitApplication = (data: object) =>
  api.post('/travellers/apply', data);

export const runVerification = (passport: string) =>
  api.post(`/travellers/verify/${passport}`, {});

export const getMyStatus = () =>
  api.get('/travellers/my-status');

export const getDashboard = () =>
  api.get('/officers/dashboard');

export const getAllTravellers = () =>
  api.get('/officers/travellers');

export const getAlerts = () =>
  api.get('/officers/alerts');

export const getOfficerProfile = () =>
  api.get('/officers/profile');

export const getBorderStatistics = () =>
  api.get('/officers/border-statistics');

export const scanQR = (border_id: string) =>
  api.post('/scan/qr', { border_id });

export const getScanLogs = () =>
  api.get('/scan/logs');

export const getNGODashboard = () =>
  api.get('/ngo/dashboard');

export const getNGORequests = () =>
  api.get('/ngo/requests');

export const acceptNGORequest = (req_id: number) =>
  api.post(`/ngo/accept/${req_id}`);

export const rejectNGORequest = (req_id: number, reason?: string) =>
  api.post(`/ngo/reject/${req_id}`, { reason });

export const getNGOStatistics = () =>
  api.get('/ngo/statistics');

export const getRefugees = () =>
  api.get('/refugees/');

export const registerRefugee = (data: object) =>
  api.post('/refugees/register', data);

export const sendBSFAlert = (temp_id: string) =>
  api.post(`/refugees/bsf-alert/${temp_id}`, {});

export const syncOfflineData = (payload: {
  scan_logs?: object[];
  refugees?: object[];
  ngo_requests?: object[];
  verification_results?: object[];
}) => api.post('/sync/offline', payload);

export const getActiveEmergencies = () =>
  api.get('/emergency/active');

export const toggleEmergency = (region_name: string, activate: boolean) =>
  api.post('/emergency/toggle', { region_name, activate });

export const declareEmergency = (region_name: string, notes?: string) =>
  api.post('/emergency/declare', { region_name, notes });

export const resolveEmergency = (region_name: string) =>
  api.post('/emergency/resolve', { region_name });
