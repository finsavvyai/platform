import { apiFetch } from '../api-client';

export interface UserMe {
  plan?: string;
  ai_usage?: number;
  ai_limit?: number;
  login?: string;
  name?: string;
}

export const usersApi = {
  me: () => apiFetch<UserMe>('/api/user/me'),
};
