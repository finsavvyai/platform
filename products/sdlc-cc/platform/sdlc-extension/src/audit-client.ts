/**
 * Tiny client that POSTs redaction events to api.sdlc.cc/v1/audit.
 * Fire-and-forget; failures are logged but never bubble back to the user
 * because the redaction itself already succeeded locally.
 */

import type { Match } from './pii-scan';

export interface AuditEvent {
  source: 'chatgpt' | 'claude' | 'gemini' | 'copilot' | 'unknown';
  url: string;
  entityCounts: Partial<Record<Match['entity'], number>>;
  occurredAt: string;
}

export async function postAudit(
  apiKey: string | undefined,
  endpoint: string,
  event: AuditEvent
): Promise<void> {
  if (!apiKey) return;
  try {
    await fetch(`${endpoint.replace(/\/$/, '')}/v1/audit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        type: 'extension.pii.redacted',
        source: event.source,
        url: event.url,
        entity_counts: event.entityCounts,
        occurred_at: event.occurredAt,
      }),
    });
  } catch (err) {
    console.warn('[sdlc-guard] audit post failed', err);
  }
}

/**
 * countByEntity reduces a flat match list to a per-entity histogram suitable
 * for shipping to the audit log without leaking the redacted values.
 */
export function countByEntity(matches: Match[]): AuditEvent['entityCounts'] {
  const out: AuditEvent['entityCounts'] = {};
  for (const m of matches) {
    out[m.entity] = (out[m.entity] ?? 0) + 1;
  }
  return out;
}

/**
 * detectSource maps the current hostname onto the chat-surface enum so
 * downstream analytics can group by which model the user was talking to.
 */
export function detectSource(hostname: string): AuditEvent['source'] {
  if (hostname.endsWith('chatgpt.com') || hostname.endsWith('openai.com')) return 'chatgpt';
  if (hostname.endsWith('claude.ai')) return 'claude';
  if (hostname.endsWith('gemini.google.com')) return 'gemini';
  if (hostname.endsWith('copilot.microsoft.com')) return 'copilot';
  return 'unknown';
}
