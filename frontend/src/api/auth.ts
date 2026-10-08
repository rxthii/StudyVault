import { apiGet, apiPost } from './client.ts';

export interface AccountUser {
  id: string;
  email: string;
  created_at: string;
}

export interface AuthSession {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  user: AccountUser;
}

export const register = (email: string, password: string) =>
  apiPost<AuthSession>('/api/auth/register', { email, password });

export const login = (email: string, password: string) =>
  apiPost<AuthSession>('/api/auth/login', { email, password });

export const getCurrentUser = () => apiGet<AccountUser>('/api/auth/me');
