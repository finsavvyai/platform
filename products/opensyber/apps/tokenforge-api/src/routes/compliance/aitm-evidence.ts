/**
 * Compliance evidence export — GET /v1/compliance/aitm.csv (Sprint 39 Task 12).
 *
 * Returns AitM-relevant events from `tf_security_events` as the 15-column
 * CSV defined in `services/compliance/aitm-csv.ts`. Filterable by an
 * optional `from`/`to` ISO-date window. Designed for SOC2 / PCI DSS
 * auditors who need a normalized evidence pack without cracking
 * metadata JSON.
 */

import { Hono } from 'hono';
import { eq, and, gte, lte, like, or } from 'drizzle-orm';
import { tfSecurityEvents } from '@opensyber/db';
import type { Env, Variables } from '../../types.js';
import { buildAitmCsv } from '../../services/compliance/aitm-csv.js';

export const aitmEvidenceRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

const MAX_ROWS = 10_000;

aitmEvidenceRoutes.get('/aitm.csv', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const from = c.req.query('from');
  const to = c.req.query('to');

  const filters = [
    eq(tfSecurityEvents.tenantId, tenantId),
    or(
      like(tfSecurityEvents.eventType, 'aitm.%'),
      like(tfSecurityEvents.eventType, 'trust.%'),
      like(tfSecurityEvents.eventType, 'dbsc.%'),
    )!,
  ];
  if (from) filters.push(gte(tfSecurityEvents.createdAt, from));
  if (to) filters.push(lte(tfSecurityEvents.createdAt, to));

  const rows = await db
    .select()
    .from(tfSecurityEvents)
    .where(and(...filters))
    .limit(MAX_ROWS);

  const csv = await buildAitmCsv(rows);

  const filename = `aitm-evidence-${tenantId}-${Date.now()}.csv`;
  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header('Content-Disposition', `attachment; filename="${filename}"`);
  c.header('Cache-Control', 'no-store');
  return c.body(csv);
});
