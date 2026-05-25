import { apiFetch, setTokens, clearTokens } from './client';
import type { ApiResponse, User, LoginForm, SignupForm } from '../../types';

export async function login(data: LoginForm): Promise<ApiResponse<User>> {
  const res = await apiFetch<ApiResponse<User>>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (res.tokens) {
    await setTokens(res.tokens.accessToken, res.tokens.refreshToken);
  }
  return res;
}

export async function register(data: SignupForm): Promise<ApiResponse<User>> {
  const res = await apiFetch<ApiResponse<User>>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (res.tokens) {
    await setTokens(res.tokens.accessToken, res.tokens.refreshToken);
  }
  return res;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } finally {
    await clearTokens();
  }
}

export async function getMe(): Promise<ApiResponse<User>> {
  return apiFetch<ApiResponse<User>>('/api/auth/me');
}

export async function refreshToken(): Promise<ApiResponse<User>> {
  return apiFetch<ApiResponse<User>>('/api/auth/refresh', { method: 'POST' });
}
