import type {
  Session,
  SecurityEvent,
  UsageDataPoint,
  DashboardStats,
} from '@/components/dashboard/types';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787';

interface FetchOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

export async function apiFetch<T>(
  path: string,
  token: string,
  opts: FetchOptions = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchDashboardStats(
  token: string,
  signal?: AbortSignal,
): Promise<DashboardStats> {
  const [usage, sessions] = await Promise.all([
    apiFetch<{ data: { used: number; limit: number; daily: UsageDataPoint[] } }>(
      '/v1/usage',
      token,
      { signal },
    ),
    apiFetch<{ data: { total: number } }>(
      '/v1/sessions?limit=0',
      token,
      { signal },
    ),
  ]);
  const { used, limit } = usage.data;
  return {
    activeSessions: sessions.data.total,
    verificationsToday: used,
    trustScoreAverage: 0,
    planUsagePercent: limit > 0 ? Math.round((used / limit) * 100) : 0,
    planLimit: limit,
    planUsed: used,
  };
}

export async function fetchSessions(
  token: string,
  signal?: AbortSignal,
): Promise<Session[]> {
  const res = await apiFetch<{ data: Session[] }>(
    '/v1/sessions',
    token,
    { signal },
  );
  return res.data;
}

export async function revokeSession(
  token: string,
  sessionId: string,
): Promise<void> {
  await apiFetch(`/v1/sessions/${sessionId}`, token, { method: 'DELETE' });
}

export async function fetchEvents(
  token: string,
  signal?: AbortSignal,
): Promise<SecurityEvent[]> {
  const res = await apiFetch<{ data: SecurityEvent[] }>(
    '/v1/events',
    token,
    { signal },
  );
  return res.data;
}

export async function fetchUsageDaily(
  token: string,
  signal?: AbortSignal,
): Promise<UsageDataPoint[]> {
  const res = await apiFetch<{ data: UsageDataPoint[] }>(
    '/v1/usage/daily',
    token,
    { signal },
  );
  return res.data;
}

export interface DeviceTelemetry {
  deviceId: string;
  keyClass: 'browser_software' | 'secure_enclave' | 'tpm2' | 'unknown';
  isAttested: boolean;
  channelBound: boolean;
  trustScore: number;
  anomalies: Array<{
    kind: string;
    confidence?: 'low' | 'medium' | 'high';
    capturedAt: string;
  }>;
  boundAt: string;
  lastVerifiedAt: string;
  revoked: boolean;
}

export async function fetchDeviceTelemetry(
  token: string,
  deviceId: string,
  signal?: AbortSignal,
): Promise<DeviceTelemetry> {
  const res = await apiFetch<{ data: DeviceTelemetry }>(
    `/v1/devices/${encodeURIComponent(deviceId)}/telemetry`,
    token,
    { signal },
  );
  return res.data;
}

// Settings functions (API keys, alerts, compliance, tenant)
// are in tokenforge-api-settings.ts

// Re-export settings functions for backward compatibility
export {
  fetchApiKeys,
  generateApiKey,
  revokeApiKey,
  updateKeyDomains,
  fetchAlertRules,
  createAlertRule,
  deleteAlertRule,
  fetchTenantInfo,
  fetchComplianceReport,
} from './tokenforge-api-settings';
export type { AlertRuleInput } from './tokenforge-api-settings';
