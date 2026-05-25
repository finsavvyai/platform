import { Hono } from 'hono';
import { z } from 'zod';
import { securityEvents } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { timingSafeCompare } from '../lib/timing-safe.js';

/**
 * User-facing event ingestion route.
 *
 * Allows a CLI/IDE running on the user's machine to push events directly to
 * the OpenSyber API, bypassing the agent VM. The caller authenticates with the
 * same gateway token pair used by the agent daemon:
 *   - X-Gateway-Token: the bearer token generated at instance creation
 *   - X-Instance-Id:   the target instance id (must match the :id in the URL)
 *
 * Events land in the `security_events` table. Because the schema enum is
 * fixed (see packages/db/src/schema/security.ts), the raw user-supplied
 * eventType label is preserved inside the JSON `details` column alongside
 * `source: 'user_cli'`, while the stored `eventType` is coerced to the closest
 * schema value (`anomaly_detected` by default).
 */

const severityEnum = z.enum(['info', 'warning', 'critical', 'ok', 'blocked']);

const eventSchema = z.object({
  eventType: z.string().min(1).max(64),
  severity: severityEnum,
  details: z.string().max(2000).optional(),
  timestamp: z.string().datetime().optional(),
});

const bodySchema = z.union([eventSchema, z.array(eventSchema).min(1).max(100)]);

type IncomingEvent = z.infer<typeof eventSchema>;
type StoredSeverity = 'info' | 'warning' | 'critical';
type StoredEventType = typeof securityEvents.$inferInsert.eventType;

/**
 * Map any user severity to a severity that is valid in the DB enum.
 * `ok` -> `info`, `blocked` -> `warning`.
 */
function coerceSeverity(severity: IncomingEvent['severity']): StoredSeverity {
  if (severity === 'info' || severity === 'warning' || severity === 'critical') {
    return severity;
  }
  if (severity === 'blocked') return 'warning';
  return 'info';
}

const SCHEMA_EVENT_TYPES = new Set<StoredEventType>([
  'skill_blocked',
  'skill_installed',
  'skill_removed',
  'anomaly_detected',
  'credential_access',
  'unauthorized_network',
  'file_access_violation',
  'update_applied',
  'instance_hardened',
  'brute_force_attempt',
]);

function coerceEventType(eventType: string): StoredEventType {
  return SCHEMA_EVENT_TYPES.has(eventType as StoredEventType)
    ? (eventType as StoredEventType)
    : 'anomaly_detected';
}

function buildDetails(event: IncomingEvent): string {
  return JSON.stringify({
    source: 'user_cli',
    reportedEventType: event.eventType,
    reportedSeverity: event.severity,
    message: event.details ?? null,
  });
}

const instanceEventRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

instanceEventRoutes.use(
  '/:id/events',
  dbMiddleware,
  rateLimitMiddleware('instance-events'),
);

instanceEventRoutes.post('/:id/events', async (c) => {
  const pathInstanceId = c.req.param('id');
  const headerInstanceId = c.req.header('X-Instance-Id');
  const token = c.req.header('X-Gateway-Token');

  if (!token || !headerInstanceId) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Missing X-Gateway-Token or X-Instance-Id header',
      },
      401,
    );
  }

  if (headerInstanceId !== pathInstanceId) {
    return c.json(
      { error: 'Forbidden', message: 'Instance ID mismatch' },
      403,
    );
  }

  const storedToken = await c.env.CREDENTIAL_VAULT.get(
    `gateway:${pathInstanceId}`,
  );
  const tokensMatch = storedToken !== null
    && storedToken.length === token.length
    && timingSafeCompare(storedToken, token);

  if (!storedToken || !tokensMatch) {
    console.warn(`[InstanceEvents] Token mismatch for instance ${pathInstanceId}`);
    return c.json(
      { error: 'Forbidden', message: 'Invalid gateway token for instance' },
      403,
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return c.json({ error: 'Bad request', message: 'Invalid JSON body' }, 400);
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json(
      {
        error: 'Bad request',
        message: parsed.error.issues[0]?.message ?? 'Invalid event payload',
      },
      400,
    );
  }

  const events: IncomingEvent[] = Array.isArray(parsed.data)
    ? parsed.data
    : [parsed.data];

  const db = c.get('db');
  const eventIds: string[] = [];

  for (const event of events) {
    const id = crypto.randomUUID();
    eventIds.push(id);
    await db.insert(securityEvents).values({
      id,
      instanceId: pathInstanceId,
      eventType: coerceEventType(event.eventType),
      severity: coerceSeverity(event.severity),
      skillId: null,
      sourceIp: c.req.header('cf-connecting-ip') ?? null,
      sourceCountry: c.req.header('cf-ipcountry') ?? null,
      details: buildDetails(event),
      createdAt: event.timestamp ?? new Date().toISOString(),
    });
  }

  return c.json({ inserted: events.length, eventIds }, 201);
});

export { instanceEventRoutes };
