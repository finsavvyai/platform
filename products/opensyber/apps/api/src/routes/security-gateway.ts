import { Hono } from 'hono';
import {
  securityEvents, auditLog, vulnerabilityScans, vulnerabilities,
} from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { gatewayAuthMiddleware } from '../middleware/gateway-auth.js';
import { evaluateAlerts } from '../services/alert-evaluation.js';
import { securityEventsSchema, auditEntriesSchema, vulnerabilityScanSchema } from './validation/security-gateway.js';

const gatewaySecurityRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

gatewaySecurityRoutes.use('*', dbMiddleware, gatewayAuthMiddleware);

function verifyGatewayInstance(c: any): { instanceId: string } | null {
  const instanceId = c.req.param('instanceId');
  const headerInstanceId = c.req.header('X-Instance-Id');
  if (instanceId !== headerInstanceId) return null;
  return { instanceId };
}

// Agent reports security events (with alert evaluation)
gatewaySecurityRoutes.post('/instances/:instanceId/events', async (c) => {
  const db = c.get('db');
  const verified = verifyGatewayInstance(c);
  if (!verified) return c.json({ error: 'Forbidden', message: 'Instance ID mismatch' }, 403);
  const { instanceId } = verified;

  const parsed = securityEventsSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Invalid input', details: parsed.error.issues[0]?.message }, 400);

  const validEventTypes = new Set([
    'skill_blocked', 'skill_installed', 'skill_removed', 'anomaly_detected',
    'credential_access', 'unauthorized_network', 'file_access_violation',
    'update_applied', 'instance_hardened', 'brute_force_attempt',
  ]);
  const validSeverities = new Set(['info', 'warning', 'critical']);

  for (const event of parsed.data.events) {
    await db.insert(securityEvents).values({
      id: crypto.randomUUID(),
      instanceId,
      eventType: validEventTypes.has(event.eventType)
        ? (event.eventType as typeof securityEvents.$inferInsert.eventType)
        : 'anomaly_detected',
      severity: validSeverities.has(event.severity)
        ? (event.severity as typeof securityEvents.$inferInsert.severity)
        : 'info',
      skillId: event.skillId || null,
      sourceIp: event.sourceIp || null,
      sourceCountry: event.sourceCountry || null,
      details: event.details || null,
      createdAt: new Date().toISOString(),
    });
  }

  try {
    await evaluateAlerts(db, instanceId, parsed.data.events, c.env);
  } catch (err) {
    console.error('[AlertEval] Error:', err);
  }

  return c.json({ received: parsed.data.events.length }, 201);
});

// Agent reports audit log entries
gatewaySecurityRoutes.post('/instances/:instanceId/audit', async (c) => {
  const db = c.get('db');
  const verified = verifyGatewayInstance(c);
  if (!verified) return c.json({ error: 'Forbidden', message: 'Instance ID mismatch' }, 403);
  const { instanceId } = verified;

  const parsedAudit = auditEntriesSchema.safeParse(await c.req.json());
  if (!parsedAudit.success) return c.json({ error: 'Invalid input', details: parsedAudit.error.issues[0]?.message }, 400);

  const validActions = new Set([
    'shell_exec', 'file_read', 'file_write', 'http_request',
    'credential_access', 'skill_install', 'skill_uninstall', 'config_change',
  ]);

  for (const entry of parsedAudit.data.entries) {
    await db.insert(auditLog).values({
      id: crypto.randomUUID(),
      instanceId,
      action: validActions.has(entry.action)
        ? (entry.action as typeof auditLog.$inferInsert.action)
        : 'config_change',
      skillId: entry.skillId || null,
      details: entry.details || null,
      createdAt: new Date().toISOString(),
    });
  }

  return c.json({ received: parsedAudit.data.entries.length }, 201);
});

// Agent reports vulnerability scan
gatewaySecurityRoutes.post('/instances/:instanceId/vulnerability-scans', async (c) => {
  const db = c.get('db');
  const verified = verifyGatewayInstance(c);
  if (!verified) return c.json({ error: 'Forbidden', message: 'Instance ID mismatch' }, 403);
  const { instanceId } = verified;

  const parsedVuln = vulnerabilityScanSchema.safeParse(await c.req.json());
  if (!parsedVuln.success) return c.json({ error: 'Invalid input', details: parsedVuln.error.issues[0]?.message }, 400);
  const vulnBody = parsedVuln.data;

  const validSeverities = new Set(['critical', 'high', 'medium', 'low']);
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  const scanId = crypto.randomUUID();
  const now = new Date().toISOString();

  for (const v of vulnBody.vulnerabilities) {
    const sev = validSeverities.has(v.severity) ? v.severity : 'medium';
    counts[sev as keyof typeof counts]++;

    await db.insert(vulnerabilities).values({
      id: crypto.randomUUID(),
      instanceId,
      scanId,
      cveId: v.cveId || null,
      packageName: v.packageName,
      packageVersion: v.packageVersion || null,
      fixedVersion: v.fixedVersion || null,
      severity: sev as typeof vulnerabilities.$inferInsert.severity,
      title: v.title || null,
      description: v.description || null,
      status: 'open',
      createdAt: now,
    });
  }

  await db.insert(vulnerabilityScans).values({
    id: scanId,
    instanceId,
    scanner: vulnBody.scanner,
    criticalCount: counts.critical,
    highCount: counts.high,
    mediumCount: counts.medium,
    lowCount: counts.low,
    scannedAt: now,
  });

  return c.json({ scanId, counts }, 201);
});

export { gatewaySecurityRoutes, verifyGatewayInstance };
