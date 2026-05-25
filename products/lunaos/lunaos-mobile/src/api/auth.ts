/**
 * Auth API — signup, login, me
 * Maps to POST /auth/signup, POST /auth/login, GET /auth/me
 */

import { apiFetch } from './client';
import type { AuthResponse, AuthUser } from '../types/api';

interface SignupParams {
  email: string;
  password: string;
  name?: string;
}

interface LoginParams {
  email: string;
  password: string;
}

export async function signup(params: SignupParams): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/signup', {
    method: 'POST',
    body: params,
    skipAuth: true,
  });
}

export async function login(params: LoginParams): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: params,
    skipAuth: true,
  });
}

export async function getMe(): Promise<{ user: AuthUser }> {
  return apiFetch<{ user: AuthUser }>('/auth/me');
}
