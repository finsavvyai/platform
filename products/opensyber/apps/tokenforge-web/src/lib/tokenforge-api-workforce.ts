import { apiFetch } from './tokenforge-api';

// ── Policies ────────────────────────────────────────────────────────────────

export interface Policy {
  id: string;
  tenantId: string;
  name: string;
  rules: string;
  priority: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePolicyInput {
  name: string;
  rules: string;
  priority?: number;
  enabled?: boolean;
}

export async function fetchPolicies(
  token: string,
  signal?: AbortSignal,
): Promise<Policy[]> {
  const res = await apiFetch<{ data: Policy[] }>('/v1/policies', token, { signal });
  return res.data;
}

export async function createPolicy(
  token: string,
  input: CreatePolicyInput,
): Promise<{ id: string }> {
  const res = await apiFetch<{ data: { id: string } }>('/v1/policies', token, {
    method: 'POST',
    body: input,
  });
  return res.data;
}

export async function updatePolicy(
  token: string,
  id: string,
  patch: Partial<CreatePolicyInput>,
): Promise<void> {
  await apiFetch(`/v1/policies/${encodeURIComponent(id)}`, token, {
    method: 'PATCH',
    body: patch,
  });
}

export async function deletePolicy(
  token: string,
  id: string,
): Promise<void> {
  await apiFetch(`/v1/policies/${encodeURIComponent(id)}`, token, {
    method: 'DELETE',
  });
}

// ── Workforce Apps ──────────────────────────────────────────────────────────

export interface WorkforceApp {
  id: string;
  tenantId: string;
  name: string;
  idpType: string;
  issuer: string;
  audience: string;
  jwksUri: string;
  tokenEndpoint: string | null;
  allowedOrigins: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkforceAppInput {
  name: string;
  idpType: string;
  issuer: string;
  audience: string;
  jwksUri: string;
  tokenEndpoint?: string;
  allowedOrigins?: string;
  enabled?: boolean;
}

export async function fetchWorkforceApps(
  token: string,
  signal?: AbortSignal,
): Promise<WorkforceApp[]> {
  const res = await apiFetch<{ data: WorkforceApp[] }>(
    '/v1/workforce/apps',
    token,
    { signal },
  );
  return res.data;
}

export async function createWorkforceApp(
  token: string,
  input: CreateWorkforceAppInput,
): Promise<{ id: string }> {
  const res = await apiFetch<{ data: { id: string } }>(
    '/v1/workforce/apps',
    token,
    { method: 'POST', body: input },
  );
  return res.data;
}

export async function deleteWorkforceApp(
  token: string,
  id: string,
): Promise<void> {
  await apiFetch(`/v1/workforce/apps/${encodeURIComponent(id)}`, token, {
    method: 'DELETE',
  });
}

// ── Subjects (workforce users) ──────────────────────────────────────────────

export interface Subject {
  id: string;
  tenantId: string;
  workforceAppId: string;
  externalSubject: string;
  email: string | null;
  name: string | null;
  metadata: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

export async function fetchSubjects(
  token: string,
  signal?: AbortSignal,
): Promise<Subject[]> {
  const res = await apiFetch<{ data: Subject[] }>(
    '/v1/workforce/subjects',
    token,
    { signal },
  );
  return res.data;
}

// ── DBSC Sessions (workforce bound devices) ─────────────────────────────────

export interface DbscSession {
  id: string;
  tenantId: string;
  deviceId: string;
  origin: string;
  alg: string;
  revoked: boolean;
  revokedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchDbscSessions(
  token: string,
  signal?: AbortSignal,
): Promise<DbscSession[]> {
  const res = await apiFetch<{ data: DbscSession[] }>(
    '/v1/dbsc/sessions',
    token,
    { signal },
  );
  return res.data;
}

export async function revokeDbscSession(
  token: string,
  sessionId: string,
  reason?: string,
): Promise<void> {
  await apiFetch(`/v1/dbsc/sessions/${encodeURIComponent(sessionId)}/revoke`, token, {
    method: 'POST',
    body: { reason },
  });
}

// ── Compliance export ───────────────────────────────────────────────────────

export async function exportComplianceJson(
  token: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>('/v1/compliance', token, { signal });
}
