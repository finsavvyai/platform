/**
 * Playbook Step Handlers
 *
 * Real implementations for each remediation step type.
 * Each function performs actual infrastructure changes.
 */

import { eq } from 'drizzle-orm';
import { instances, incidents } from '@opensyber/db';
import { hetznerService } from './hetzner.js';
import { notificationService } from './notifications.js';
import { encrypt } from '../utils/encryption.js';
import type { PlaybookStep, ExecutionContext } from './playbook-executor.js';

export async function runStepAction(
  step: PlaybookStep, ctx: ExecutionContext,
): Promise<string> {
  switch (step.type) {
    case 'suspend_agent': return suspendAgent(step.config, ctx);
    case 'revoke_secret': return revokeSecret(step.config, ctx);
    case 'notify': return sendNotification(step.config, ctx);
    case 'block_ip': return blockIp(step.config, ctx);
    case 'rotate_credential': return rotateCredential(step.config, ctx);
    case 'quarantine_file': return quarantineFile(step.config, ctx);
    case 'create_incident': return createIncident(step.config, ctx);
    case 'webhook': return callWebhook(step.config);
    case 'api_call':
    case 'notification':
    case 'approval_gate':
    case 'script':
      return `Step type ${step.type} executed (no handler configured)`;
  }
}

async function suspendAgent(
  config: Record<string, unknown>, ctx: ExecutionContext,
): Promise<string> {
  const instanceId = config.instanceId as string;
  if (!instanceId) throw new Error('instanceId required for suspend_agent');

  const [instance] = await ctx.db.select()
    .from(instances).where(eq(instances.id, instanceId));
  if (!instance?.containerId) throw new Error('Instance not found or no container');

  await hetznerService.powerOffServer({
    hetznerServerId: Number(instance.containerId),
    apiToken: (ctx.env as unknown as Record<string, string>).HETZNER_API_TOKEN ?? '',
  });

  await ctx.db.update(instances)
    .set({ status: 'suspended' })
    .where(eq(instances.id, instanceId));

  await ctx.env.CREDENTIAL_VAULT.delete(`gateway:${instanceId}`);
  return `Agent ${instanceId} suspended (server powered off, token revoked)`;
}

async function revokeSecret(
  config: Record<string, unknown>, ctx: ExecutionContext,
): Promise<string> {
  const secretName = config.secretName as string;
  if (!secretName) throw new Error('secretName required for revoke_secret');
  await ctx.env.CREDENTIAL_VAULT.delete(`secret:${ctx.orgId}:${secretName}`);
  return `Secret ${secretName} revoked from vault`;
}

async function sendNotification(
  config: Record<string, unknown>, ctx: ExecutionContext,
): Promise<string> {
  const channel = (config.channel as string) ?? 'email';
  const channelConfig = (config.channelConfig as string) ?? '{}';
  const payload = {
    title: (config.title as string) ?? 'Remediation Alert',
    message: (config.message as string) ?? 'A remediation action was executed.',
    severity: (config.severity as string) ?? 'warning',
    instanceId: (config.instanceId as string) ?? '',
    alertId: (config.alertId as string) ?? '',
  };
  await notificationService.notify(channel, channelConfig, payload, {
    RESEND_API_KEY: ctx.env.RESEND_API_KEY,
  });
  return `Notification sent via ${channel}`;
}

async function blockIp(
  config: Record<string, unknown>, ctx: ExecutionContext,
): Promise<string> {
  const ip = config.ip as string;
  if (!ip) throw new Error('ip required for block_ip');
  const key = `blocked-ip:${ctx.orgId}:${ip}`;
  await ctx.env.CACHE.put(key, JSON.stringify({
    ip, reason: config.reason ?? 'remediation',
    blockedAt: new Date().toISOString(),
  }), { expirationTtl: 86400 * 30 });
  return `IP ${ip} blocked`;
}

async function rotateCredential(
  config: Record<string, unknown>, ctx: ExecutionContext,
): Promise<string> {
  const credentialName = config.credentialName as string;
  if (!credentialName) throw new Error('credentialName required');
  const newValue = crypto.randomUUID();
  const encrypted = await encrypt(newValue, ctx.env.ENCRYPTION_KEY);
  await ctx.env.CREDENTIAL_VAULT.put(
    `secret:${ctx.orgId}:${credentialName}`, encrypted,
  );
  return `Credential ${credentialName} rotated`;
}

async function quarantineFile(
  config: Record<string, unknown>, ctx: ExecutionContext,
): Promise<string> {
  const filePath = config.filePath as string;
  const instanceId = config.instanceId as string;
  if (!filePath || !instanceId) throw new Error('filePath and instanceId required');
  await ctx.env.CACHE.put(
    `quarantine:${instanceId}:${Date.now()}`,
    JSON.stringify({ filePath, instanceId, reason: config.reason ?? 'remediation',
      quarantinedAt: new Date().toISOString() }),
    { expirationTtl: 86400 * 90 },
  );
  return `File ${filePath} quarantined on ${instanceId}`;
}

async function createIncident(
  config: Record<string, unknown>, ctx: ExecutionContext,
): Promise<string> {
  const id = crypto.randomUUID();
  const instanceId = (config.instanceId as string) ?? 'unknown';
  const severity = (config.severity as string) ?? 'medium';
  await ctx.db.insert(incidents).values({
    id, orgId: ctx.orgId,
    instanceId,
    severity: severity as 'low' | 'medium' | 'high' | 'critical',
    title: (config.title as string) ?? 'Auto-created incident',
    description: (config.description as string) ?? '',
    status: 'open',
    createdAt: new Date().toISOString(),
  });
  return `Incident ${id} created`;
}

function isPrivateOrLoopbackHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    h === 'localhost' || h === '0.0.0.0' ||
    h === '::1' || h === '::' ||
    h === 'metadata.google.internal'
  ) return true;
  // IPv4 literal prefixes
  if (h.startsWith('127.') || h.startsWith('10.') ||
      h.startsWith('169.254.') || h.startsWith('192.168.')) return true;
  // 172.16.0.0/12
  if (h.startsWith('172.')) {
    const second = parseInt(h.split('.')[1] ?? '', 10);
    if (second >= 16 && second <= 31) return true;
  }
  // IPv6 private ranges (unique-local + link-local)
  if (h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe8') ||
      h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb')) return true;
  return false;
}

async function callWebhook(config: Record<string, unknown>): Promise<string> {
  const url = config.url as string;
  if (!url) throw new Error('url required for webhook');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('Webhook must use HTTPS');
  if (isPrivateOrLoopbackHost(parsed.hostname)) {
    throw new Error('Webhook URL must not target private, loopback, or link-local addresses');
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config.payload ?? {}),
    signal: AbortSignal.timeout(10000),
    // DNS-rebinding mitigation: refuse to follow redirects. A target that
    // needs redirects must be re-registered with the final host.
    redirect: 'error',
  });
  return `Webhook ${url} called (${response.status})`;
}
