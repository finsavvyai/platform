import { Hono } from 'hono';
import { z } from 'zod';
import { integrationEvents, integrationConnections } from '@opensyber/db';
import { generateId } from '@opensyber/shared';
import { and, eq } from 'drizzle-orm';
import type { Env, Variables } from '../types.js';
import type { ApiKeyContext } from '../middleware/api-key-auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { apiKeyAuthMiddleware } from '../middleware/api-key-auth.js';
import { ingestRateLimitMiddleware } from '../middleware/ingest-rate-limit.js';

type IngestVars = Variables & ApiKeyContext;

const ingestRoutes = new Hono<{ Bindings: Env; Variables: IngestVars }>();

ingestRoutes.use('*', dbMiddleware, apiKeyAuthMiddleware, ingestRateLimitMiddleware);

const severityEnum = z.enum(['info', 'low', 'medium', 'high', 'critical']);

const ingestEventSchema = z.object({
  source: z.string().min(1).max(128),
  eventType: z.string().min(1).max(128),
  severity: severityEnum,
  summary: z.string().min(1).max(1024),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime().optional(),
});

const batchSchema = z.object({
  events: z.array(ingestEventSchema).min(1).max(50),
});

/** Ensure an integration connection exists for the API key user + source */
async function resolveConnectionId(
  db: IngestVars['db'],
  userId: string,
  instanceId: string | null,
  source: string,
): Promise<string> {
  if (!instanceId) {
    return createConnectionId(db, userId, source);
  }

  const [existing] = await db
    .select({ id: integrationConnections.id })
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.userId, userId),
        eq(integrationConnections.instanceId, instanceId),
        eq(integrationConnections.integrationSlug, `api:${source}`),
      ),
    )
    .limit(1);

  if (existing) return existing.id;
  return createConnectionId(db, userId, source, instanceId);
}

async function createConnectionId(
  db: IngestVars['db'],
  userId: string,
  source: string,
  instanceId?: string,
): Promise<string> {
  const id = generateId();
  await db.insert(integrationConnections).values({
    id,
    userId,
    instanceId: instanceId ?? 'none',
    integrationSlug: `api:${source}`,
    status: 'connected',
    lastSyncAt: new Date().toISOString(),
  });
  return id;
}

/** POST /api/ingest — Single event ingestion */
ingestRoutes.post('/', async (c) => {
  const parsed = ingestEventSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Bad request', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }
  const body = parsed.data;
  const db = c.get('db');
  const userId = c.get('apiKeyUserId');
  const instanceId = c.get('apiKeyInstanceId');

  const connectionId = await resolveConnectionId(db, userId, instanceId, body.source);
  const eventId = generateId();

  await db.insert(integrationEvents).values({
    id: eventId,
    connectionId,
    eventType: `${body.source}.${body.eventType}`,
    severity: body.severity,
    summary: body.summary,
    rawPayload: body.metadata ? JSON.stringify(body.metadata).slice(0, 4096) : null,
    processedAt: body.timestamp ?? new Date().toISOString(),
    latencyMs: 0,
  });

  return c.json({ id: eventId, status: 'accepted' as const }, 201);
});

/** POST /api/ingest/batch — Batch event ingestion (up to 50) */
ingestRoutes.post('/batch', async (c) => {
  const batchParsed = batchSchema.safeParse(await c.req.json());
  if (!batchParsed.success) {
    return c.json({ error: 'Bad request', message: batchParsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }
  const { events } = batchParsed.data;
  const db = c.get('db');
  const userId = c.get('apiKeyUserId');
  const instanceId = c.get('apiKeyInstanceId');

  const results: Array<{ id: string; status: 'accepted' | 'rejected'; error?: string }> = [];
  const errors: Array<{ index: number; error: string }> = [];
  let accepted = 0;
  let rejected = 0;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (!event) continue;
    try {
      const connectionId = await resolveConnectionId(db, userId, instanceId, event.source);
      const eventId = generateId();
      await db.insert(integrationEvents).values({
        id: eventId,
        connectionId,
        eventType: `${event.source}.${event.eventType}`,
        severity: event.severity,
        summary: event.summary,
        rawPayload: event.metadata ? JSON.stringify(event.metadata).slice(0, 4096) : null,
        processedAt: event.timestamp ?? new Date().toISOString(),
        latencyMs: 0,
      });
      results.push({ id: eventId, status: 'accepted' });
      accepted++;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      results.push({ id: '', status: 'rejected', error: message });
      errors.push({ index: i, error: message });
      rejected++;
    }
  }

  return c.json({ accepted, rejected, errors, results });
});

export { ingestRoutes };
