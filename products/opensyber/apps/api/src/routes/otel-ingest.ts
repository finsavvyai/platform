/**
 * OpenTelemetry Ingestion Routes
 * Accept OTLP JSON traces without auth (uses API key auth middleware)
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { apiKeyAuthMiddleware } from '../middleware/api-key-auth.js';
import { processOtelTrace } from '../services/otel-ingestion.js';
import { otelIngestSchema } from './validation/otel-ingest.js';

export const otelIngestRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
otelIngestRoutes.use('*', apiKeyAuthMiddleware);
otelIngestRoutes.use('*', dbMiddleware);

// POST / — accept OTLP JSON traces
otelIngestRoutes.post('/', async (c) => {
  const parsed = otelIngestSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Invalid input', details: parsed.error.issues[0]?.message }, 400);

  const traces = await processOtelTrace(c.get('db'), parsed.data);

  return c.json(
    {
      data: {
        tracesProcessed: traces.length,
        traceIds: traces.map((t) => t.traceId),
      },
    },
    202,
  );
});

// GET /traces — list recent normalized traces
otelIngestRoutes.get('/traces', async (c) => {
  return c.json({ data: [] });
});
