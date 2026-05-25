/**
 * API client for the LunaOS Engine at api.lunaos.ai.
 * Handles auth, workflow CRUD, execution, and billing.
 */

const API = 'https://api.lunaos.ai';
const TOKEN_KEY = 'lunaos_token';

// ── Token management ─────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  try {
    const part = token.split('.')[1];
    if (!part) return false;
    const payload = JSON.parse(atob(part));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function getTokenPayload(): { sub: string; email: string; tier: string } | null {
  const token = getToken();
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    return JSON.parse(atob(part));
  } catch {
    return null;
  }
}

// ── Request helper ───────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? res.statusText, body);
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Auth ─────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  tier: 'free' | 'pro' | 'team';
}

export async function login(email: string, password: string): Promise<User> {
  const res = await request<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(res.token);
  return res.user;
}

export async function signup(email: string, password: string, name: string): Promise<User> {
  const res = await request<{ token: string; user: User }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
  setToken(res.token);
  return res.user;
}

export async function getMe(): Promise<User> {
  const res = await request<{ user: User }>('/auth/me');
  return res.user;
}

export function logout(): void {
  clearToken();
}

// ── Workflows (chains) ──────────────────────────────

export interface SavedWorkflow {
  id: string;
  name: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export async function listWorkflows(): Promise<SavedWorkflow[]> {
  const res = await request<{ executions: SavedWorkflow[]; count: number }>('/chains/history?limit=50');
  return res.executions;
}

export async function getWorkflow(id: string): Promise<SavedWorkflow> {
  return request<SavedWorkflow>(`/chains/${id}/status`);
}

// ── Billing ──────────────────────────────────────────

export interface UsageInfo {
  tier: string;
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
}

export async function getUsage(): Promise<UsageInfo> {
  return request<UsageInfo>('/billing/usage');
}

export async function createCheckoutUrl(plan: 'pro' | 'team'): Promise<string> {
  const res = await request<{ checkoutUrl: string }>('/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan }),
  });
  return res.checkoutUrl;
}
