import type { Env } from '../types.js';

interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold?: number;
  channel: 'email' | 'webhook';
  destination: string;
}

interface AlertEvent {
  type: string;
  reason?: string;
  trustScore?: number;
  deviceId?: string;
  ip?: string;
  country?: string;
}

/** Maps edge-verify reasons to alert conditions */
function matchesCondition(rule: AlertRule, event: AlertEvent): boolean {
  switch (rule.condition) {
    case 'hijack_attempt':
      return event.reason === 'nonce_replay' || event.type === 'session.hijack_attempt';
    case 'trust_drop':
      return (
        event.trustScore !== undefined &&
        rule.threshold !== undefined &&
        event.trustScore < rule.threshold
      );
    case 'ip_change':
      return event.reason === 'ip_mismatch' || event.type === 'ip_change';
    case 'geo_anomaly':
      return event.reason === 'geo_anomaly' || event.type === 'geo_anomaly';
    case 'session_revoked':
      return event.reason === 'session_revoked';
    default:
      return false;
  }
}

async function sendEmail(
  apiKey: string,
  to: string,
  subject: string,
  body: string,
): Promise<void> {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'TokenForge Alerts <alerts@opensyber.cloud>',
      to: [to],
      subject,
      text: body,
    }),
  });
}

/** Severity mapping for SIEM/SOC integration */
function eventSeverity(event: AlertEvent): number {
  if (event.reason === 'nonce_replay' || event.type === 'session.hijack_attempt') return 9;
  if (event.trustScore !== undefined && event.trustScore < 40) return 8;
  if (event.reason === 'session_revoked') return 7;
  if (event.trustScore !== undefined && event.trustScore < 80) return 5;
  return 3;
}

/** Build SIEM-ready payload with structured fields */
function buildSiemPayload(
  event: AlertEvent,
  tenantId: string,
  ruleName: string,
): Record<string, unknown> {
  const severity = eventSeverity(event);
  return {
    source: 'tokenforge',
    version: '1.0',
    timestamp: new Date().toISOString(),
    severity,
    severityLabel: severity >= 8 ? 'critical' : severity >= 6 ? 'high' : severity >= 4 ? 'medium' : 'low',
    category: 'session_security',
    tenantId,
    ruleName,
    event: {
      type: event.type,
      reason: event.reason ?? null,
      trustScore: event.trustScore ?? null,
      deviceId: event.deviceId ?? null,
      ip: event.ip ?? null,
      country: event.country ?? null,
    },
    cef: `CEF:0|OpenSyber|TokenForge|1.0|${event.type}|${event.reason ?? event.type}|${severity}|src=${event.ip ?? ''} dvc=${event.deviceId ?? ''} cs1=${tenantId} cs1Label=tenantId cn1=${event.trustScore ?? 0} cn1Label=trustScore`,
  };
}

async function sendWebhook(
  url: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    console.error(`[Alert] Webhook delivery failed to ${url}:`, err);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Dispatch alerts for a tenant based on their configured rules.
 * Called from edge-verify when status is block or step_up.
 */
export async function dispatchAlerts(
  tenantId: string,
  event: AlertEvent,
  env: Env,
): Promise<void> {
  const raw = await env.CACHE.get(`alert_rules:${tenantId}`);
  if (!raw) return;

  let rules: AlertRule[];
  try {
    rules = JSON.parse(raw);
  } catch {
    return;
  }

  const matched = rules.filter((r) => matchesCondition(r, event));
  const now = new Date().toISOString();

  await Promise.allSettled(
    matched.map((rule) => {
      if (rule.channel === 'email') {
        return sendEmail(
          env.RESEND_API_KEY,
          rule.destination,
          `[TokenForge Alert] ${rule.name}`,
          `Alert: ${rule.name}\nEvent: ${event.type}\nReason: ${event.reason ?? 'N/A'}\nTrust Score: ${event.trustScore ?? 'N/A'}\nTime: ${now}`,
        );
      }
      return sendWebhook(rule.destination, buildSiemPayload(event, tenantId, rule.name));
    }),
  );
}
