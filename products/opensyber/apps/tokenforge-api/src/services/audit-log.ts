import type { Env } from '../types.js';

export type AuditAction =
  | 'api_key.created'
  | 'api_key.revoked'
  | 'alert_rule.created'
  | 'alert_rule.deleted'
  | 'proxy.configured'
  | 'proxy.removed'
  | 'session.revoked'
  | 'plan.upgraded'
  | 'plan.downgraded'
  | 'plan.cancelled'
  | 'api_key.domains_updated'
  | 'webhook.created'
  | 'webhook.updated'
  | 'webhook.deleted'
  | 'webhook.secret_rotated';

interface AuditEntry {
  action: AuditAction;
  tenantId: string;
  metadata: Record<string, unknown>;
  ip?: string;
  timestamp: string;
}

/**
 * Log an audit event to KV for compliance and forensics.
 * Entries persist for 90 days (SOC2 retention requirement).
 */
export async function logAudit(
  env: Env,
  action: AuditAction,
  tenantId: string,
  metadata: Record<string, unknown> = {},
  ip?: string,
): Promise<void> {
  const entry: AuditEntry = {
    action,
    tenantId,
    metadata,
    ip,
    timestamp: new Date().toISOString(),
  };

  const key = `audit:${tenantId}:${Date.now()}:${crypto.randomUUID().slice(0, 8)}`;

  await env.CACHE.put(key, JSON.stringify(entry), {
    expirationTtl: 7776000, // 90 days
  });

  console.log(JSON.stringify({ type: 'audit', ...entry }));
}
