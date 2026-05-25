import type {
  ApiKey,
  ComplianceReport,
} from '@/components/dashboard/types';
import { apiFetch } from './tokenforge-api';

// Webhook endpoints live in a sibling module so this file stays under
// the 200L portfolio cap; re-exported here so callers do not have to
// chase the move.
export * from './tokenforge-api-webhooks';

export async function fetchApiKeys(
  token: string,
  signal?: AbortSignal,
): Promise<ApiKey[]> {
  const res = await apiFetch<{ data: ApiKey[] }>(
    '/v1/tenant/api-keys',
    token,
    { signal },
  );
  return res.data;
}

export async function generateApiKey(
  token: string,
  name: string,
  allowedDomains?: string[],
): Promise<{ key: string; entry: ApiKey }> {
  const body: { name: string; allowedDomains?: string[] } = { name };
  if (allowedDomains && allowedDomains.length > 0) {
    body.allowedDomains = allowedDomains;
  }
  const res = await apiFetch<{ data: { key: string; entry: ApiKey } }>(
    '/v1/tenant/api-keys',
    token,
    { method: 'POST', body },
  );
  return res.data;
}

export async function revokeApiKey(
  token: string,
  keyId: string,
): Promise<void> {
  await apiFetch(`/v1/tenant/api-keys/${keyId}`, token, {
    method: 'DELETE',
  });
}

export async function updateKeyDomains(
  token: string,
  keyId: string,
  allowedDomains: string[],
): Promise<{ id: string; allowedDomains: string[] }> {
  const res = await apiFetch<{ data: { id: string; allowedDomains: string[] } }>(
    `/v1/tenant/api-keys/${keyId}/domains`,
    token,
    { method: 'PUT', body: { allowedDomains } },
  );
  return res.data;
}

// --- Alert Rules ---

export interface AlertRuleInput {
  name: string;
  condition: string;
  threshold?: number;
  channel: 'email' | 'webhook';
  destination: string;
}

export async function fetchAlertRules(
  token: string,
  signal?: AbortSignal,
): Promise<{ id: string; name: string; condition: string; threshold?: number; channel: 'email' | 'webhook'; destination: string; createdAt: string }[]> {
  const res = await apiFetch<{ data: { id: string; name: string; condition: string; threshold?: number; channel: 'email' | 'webhook'; destination: string; createdAt: string }[] }>(
    '/v1/alerts/rules',
    token,
    { signal },
  );
  return res.data;
}

export async function createAlertRule(
  token: string,
  rule: AlertRuleInput,
): Promise<void> {
  await apiFetch('/v1/alerts/rules', token, {
    method: 'POST',
    body: rule,
  });
}

export async function deleteAlertRule(
  token: string,
  ruleId: string,
): Promise<void> {
  await apiFetch(`/v1/alerts/rules/${ruleId}`, token, {
    method: 'DELETE',
  });
}

export async function fetchTenantInfo(
  token: string,
  signal?: AbortSignal,
): Promise<{ id: string; plan: string; name: string; email: string; used: number; limit: number }> {
  const res = await apiFetch<{
    data: { id: string; plan: string; name: string; email: string; used: number; limit: number };
  }>('/v1/tenant', token, { signal });
  return res.data;
}

export async function fetchComplianceReport(
  token: string,
  signal?: AbortSignal,
): Promise<ComplianceReport> {
  const res = await apiFetch<{ data: ComplianceReport }>(
    '/v1/compliance/report',
    token,
    { signal },
  );
  return res.data;
}
