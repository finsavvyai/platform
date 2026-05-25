/**
 * POST /api/integrations/audit
 *
 * Stores audit events (from PipeWarden or in-product flows) in the audit log
 * with tamper-proof hashes.
 *
 * Authorization: verified OpenSyber JWT (authMiddleware). tenantId is taken
 * from the resolved org context — NEVER from unverified claim decoding.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env, Variables } from '../../types.js';
import { authMiddleware } from '../../middleware/auth.js';
import { resolveOrgContext, requirePermission } from '../../middleware/rbac.js';
import { dbMiddleware } from '../../middleware/db.js';

const MAX_DETAILS_BYTES = 8 * 1024;

const auditEventSchema = z.object({
  source: z.string().min(1).max(64),
  action: z.string().min(1).max(128),
  actor: z.string().min(1).max(128),
  resource: z.string().min(1).max(256),
  resourceType: z.enum(['connection', 'finding', 'scan', 'remediation']),
  details: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime(),
});

export type AuditEvent = z.infer<typeof auditEventSchema>;

export interface AuditLogRecord {
  id: string;
  tenantId: string;
  source: string;
  action: string;
  actor: string;
  resource: string;
  resourceType: string;
  details: Record<string, unknown>;
  timestamp: string;
  receivedAt: string;
  hash: string;
}

async function generateTamperProofHash(event: AuditEvent, tenantId: string): Promise<string> {
  const data = JSON.stringify({
    tenantId,
    source: event.source,
    action: event.action,
    actor: event.actor,
    resource: event.resource,
    timestamp: event.timestamp,
  });
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data)));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function storeAuditLog(db: { prepare: (q: string) => { bind: (...p: unknown[]) => { run: () => Promise<unknown> } } }, record: AuditLogRecord): Promise<void> {
  const query = `
    INSERT INTO audit_logs (
      id, tenant_id, source, action, actor, resource, resource_type,
      details, timestamp, received_at, hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  await db.prepare(query).bind(
    record.id,
    record.tenantId,
    record.source,
    record.action,
    record.actor,
    record.resource,
    record.resourceType,
    JSON.stringify(record.details),
    record.timestamp,
    record.receivedAt,
    record.hash,
  ).run();
}

async function emitAuditEvent(env: Env, record: AuditLogRecord): Promise<void> {
  const queue = (env as unknown as { AUDIT_QUEUE?: { send: (msg: unknown) => Promise<void> } }).AUDIT_QUEUE;
  if (queue) {
    await queue.send({ type: 'audit.event.received', data: record, timestamp: Date.now() });
  }
}

export default (app: Hono<{ Bindings: Env; Variables: Variables }>) => {
  app.post(
    '/api/integrations/audit',
    dbMiddleware,
    authMiddleware,
    resolveOrgContext,
    requirePermission('audit.write'),
    async (c) => {
      const tenantId = c.get('orgId') ?? c.get('userId');
      if (!tenantId) {
        return c.json({ error: 'Forbidden', message: 'No tenant context' }, 403);
      }

      const raw = await c.req.json().catch(() => null);
      if (!raw || typeof raw !== 'object') {
        return c.json({ error: 'Bad request', message: 'Invalid JSON body' }, 400);
      }
      const parsed = auditEventSchema.safeParse(raw);
      if (!parsed.success) {
        return c.json({ error: 'Bad request', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
      }

      const details = parsed.data.details ?? {};
      if (JSON.stringify(details).length > MAX_DETAILS_BYTES) {
        return c.json({ error: 'Bad request', message: 'details payload exceeds size limit' }, 400);
      }

      const record: AuditLogRecord = {
        id: crypto.randomUUID(),
        tenantId,
        source: parsed.data.source,
        action: parsed.data.action,
        actor: parsed.data.actor,
        resource: parsed.data.resource,
        resourceType: parsed.data.resourceType,
        details,
        timestamp: parsed.data.timestamp,
        receivedAt: new Date().toISOString(),
        hash: await generateTamperProofHash(parsed.data, tenantId),
      };

      const db = c.get('db') as unknown as { prepare: (q: string) => { bind: (...p: unknown[]) => { run: () => Promise<unknown> } } };
      try {
        await storeAuditLog(db, record);
        await emitAuditEvent(c.env, record);
      } catch (err) {
        console.error('[audit] store error:', err instanceof Error ? err.message : err);
        return c.json({ error: 'Internal server error' }, 500);
      }

      return c.json({ success: true, id: record.id, hash: record.hash }, 201);
    },
  );
};
