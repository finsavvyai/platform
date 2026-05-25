/**
 * Platform Audit Logger
 *
 * Emits structured audit entries for security-sensitive user actions.
 * Uses the structured logger (Cloudflare logpush) so entries are
 * immutable, non-blocking, and queryable via Log Analytics.
 *
 * For agent-level audit (instanceId-scoped), use the auditLog table instead.
 */

import { logger } from './logger.js';

/** Maximum metadata value length to prevent PII leakage. */
const MAX_META_LEN = 80;

export interface PlatformAuditEntry {
  action: string;
  userId: string;
  orgId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Truncate a string value to avoid logging PII or oversized payloads. */
function truncate(value: unknown): unknown {
  if (typeof value === 'string' && value.length > MAX_META_LEN) {
    return `${value.slice(0, MAX_META_LEN)}…`;
  }
  return value;
}

/** Sanitize metadata — truncate string values, drop undefined. */
function sanitizeMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v !== undefined) clean[k] = truncate(v);
  }
  return clean;
}

/**
 * Emit a platform-level audit log entry.
 *
 * Non-blocking — uses structured console output picked up by logpush.
 * Call directly; no waitUntil needed since console.log is synchronous.
 */
export function emitPlatformAudit(entry: PlatformAuditEntry): void {
  logger.info('[PlatformAudit]', {
    audit: true,
    action: entry.action,
    userId: entry.userId,
    orgId: entry.orgId ?? null,
    ...sanitizeMeta(entry.metadata),
  });
}
