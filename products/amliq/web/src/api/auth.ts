import { api } from './client';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SignupPayload {
  email: string;
  password: string;
  org_name: string;
  country: string;
}

export interface AuthResponse {
  token: string;
  user: { id: string; email: string; role: string; tenant_id: string };
}

export const authApi = {
  login: (data: LoginPayload) =>
    api.post<AuthResponse>('/auth/login', data),
  signup: (data: SignupPayload) =>
    api.post<AuthResponse>('/auth/signup', data),
  me: () => api.get<AuthResponse['user']>('/auth/me'),
};
