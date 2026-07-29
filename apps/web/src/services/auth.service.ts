import { apiClient } from './api-client';

export interface AuthResponse {
  accessToken: string;
  user: { id: string; email: string; name: string; role: string; companyId: string | null; language: string };
}

// Login is OAuth-only (Google / Microsoft 365). The browser is redirected to
// these backend endpoints, which redirect to the provider and back to
// /login#token=... — there is no password endpoint.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const authService = {
  oauthLoginUrl(provider: 'google' | 'microsoft') {
    return `${API_URL}/auth/oauth/${provider}`;
  },
  getProfile() {
    return apiClient.get('/auth/me').then((r) => r.data);
  },
};
