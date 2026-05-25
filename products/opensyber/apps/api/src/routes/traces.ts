/**
 * Trace Retrieval Routes
 *
 * GET /api/admin/traces/:traceId       — Retrieve a trace by ID (Perfetto JSON)
 * GET /api/admin/traces/:traceId/otel  — Retrieve a trace in OpenTelemetry OTLP/JSON
 *
 * Traces are stored in KV with 1-hour TTL by the trace middleware.
 * Open Perfetto JSON in https://ui.perfetto.dev. The OTLP payload can be
 * forwarded to any OpenTelemetry-compatible collector (Jaeger, Tempo, etc.).
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';
import type { Permission } from '@opensyber/shared';
import { traceParamsSchema } from './validation/traces.js';
import { emitPlatformAudit } from '../lib/platform-audit.js';
import { eventsToOtelJson, type InternalTraceEvent } from '../services/trace-otel.js';

const traceRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// authMiddleware FIRST so anonymous callers short-circuit before any
// downstream middleware touches env bindings. dbMiddleware still runs
// for authenticated callers to preserve the `c.get('db')` contract the
// route handler depends on (though authMiddleware now self-provisions
// as a safety net). See middleware/auth.ts for the full rationale.
traceRoutes.use('*', authMiddleware, dbMiddleware, resolveOrgContext);

/**
 * Enforce that the requesting tenant owns the trace before returning its
 * contents. Legacy traces written before ownership tracking existed have
 * no owner sidecar — for those we return 410 Gone rather than risk
 * cross-tenant leakage.
 */
async function requireTraceOwnership(
  c: { env: Env; get: (k: 'orgId' | 'userId') => string | undefined },
  traceId: string,
): Promise<{ ok: true } | { ok: false; status: 404 | 410 | 403; message: string }> {
  const ownerRaw = await c.env.CACHE.get(`trace:${traceId}:owner`);
  if (!ownerRaw) {
    return { ok: false, status: 410, message: 'Trace ownership metadata missing — re-run request to regenerate' };
  }
  try {
    const owner = JSON.parse(ownerRaw) as { orgId: string | null; userId: string | null };
    const reqOrg = c.get('orgId') ?? null;
    const reqUser = c.get('userId') ?? null;
    const orgMatches = owner.orgId && reqOrg && owner.orgId === reqOrg;
    const userMatches = owner.userId && reqUser && owner.userId === reqUser;
    if (!orgMatches && !userMatches) {
      return { ok: false, status: 403, message: 'Trace belongs to a different tenant' };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 410, message: 'Trace ownership metadata corrupt' };
  }
}

/** Retrieve a stored trace by ID — admin only, tenant-scoped */
traceRoutes.get('/:traceId', requirePermission('audit.view' as Permission), async (c) => {
  const parsed = traceParamsSchema.safeParse({ traceId: c.req.param('traceId') });
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid trace ID format' }, 400);
  }
  const { traceId } = parsed.data;

  const ownership = await requireTraceOwnership(c, traceId);
  if (!ownership.ok) {
    return c.json({ error: ownership.message }, ownership.status);
  }

  const data = await c.env.CACHE.get(`trace:${traceId}`);
  if (!data) {
    return c.json({ error: 'Trace not found or expired' }, 404);
  }

  try {
    const traceData: unknown = JSON.parse(data);

    emitPlatformAudit({
      action: 'trace.retrieve',
      userId: c.get('userId'),
      orgId: c.get('orgId'),
      metadata: { traceId },
    });

    return c.json(traceData);
  } catch {
    return c.json({ error: 'Corrupt trace data' }, 500);
  }
});

/** Retrieve a stored trace by ID in OpenTelemetry OTLP/JSON format — admin only, tenant-scoped */
traceRoutes.get('/:traceId/otel', requirePermission('audit.view' as Permission), async (c) => {
  const parsed = traceParamsSchema.safeParse({ traceId: c.req.param('traceId') });
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid trace ID format' }, 400);
  }
  const { traceId } = parsed.data;

  const ownership = await requireTraceOwnership(c, traceId);
  if (!ownership.ok) {
    return c.json({ error: ownership.message }, ownership.status);
  }

  const data = await c.env.CACHE.get(`trace:${traceId}`);
  if (!data) {
    return c.json({ error: 'Trace not found or expired' }, 404);
  }

  try {
    const parsedPerfetto = JSON.parse(data) as { traceEvents: InternalTraceEvent[] };
    const events = Array.isArray(parsedPerfetto.traceEvents) ? parsedPerfetto.traceEvents : [];

    // Derive a stable 32-hex-char OTel traceId from the UUID by stripping dashes.
    const otelTraceId = traceId.replace(/-/g, '');
    const otlp = eventsToOtelJson(events, { traceId: otelTraceId });

    emitPlatformAudit({
      action: 'trace.retrieve.otel',
      userId: c.get('userId'),
      orgId: c.get('orgId'),
      metadata: { traceId },
    });

    return c.json(otlp);
  } catch {
    return c.json({ error: 'Corrupt trace data' }, 500);
  }
});

export { traceRoutes };
