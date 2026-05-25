/**
 * Unified Findings Feed
 *
 * GET /api/findings/unified
 *   Aggregates findings from:
 *   - CSPM (cspm_findings) — own cloud posture (AWS/Azure/GCP)
 *   - Integration events (integration_events) — pipewarden, tenantiq, sdlc.cc
 *
 *   Query params:
 *     limit      max 200 (default 50)
 *     offset     pagination
 *     severity   critical|high|medium|low|info
 *     source     cspm|pipewarden|tenantiq|sdlc
 *
 * GET /api/findings/unified/summary
 *   Counts by severity and source.
 */

import { Hono } from 'hono';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { cspmFindings, integrationConnections, integrationEvents } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext } from '../middleware/rbac.js';

export const unifiedFindingRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
unifiedFindingRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

type UnifiedSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface UnifiedFinding {
  id: string;
  source: 'cspm' | 'pipewarden' | 'tenantiq' | 'sdlc';
  severity: UnifiedSeverity;
  title: string;
  summary: string;
  createdAt: string;
  eventType: string | null;
  status: string | null;
}

const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'info']);
const VALID_SOURCES = new Set(['cspm', 'pipewarden', 'tenantiq', 'sdlc']);

function detectSource(slug: string): UnifiedFinding['source'] {
  if (slug.startsWith('pipewarden:')) return 'pipewarden';
  if (slug.startsWith('tenantiq:')) return 'tenantiq';
  if (slug.startsWith('sdlc:')) return 'sdlc';
  return 'pipewarden';
}

unifiedFindingRoutes.get('/unified', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 200);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);
  const severity = c.req.query('severity');
  const source = c.req.query('source');

  const wantSource = source && VALID_SOURCES.has(source) ? source : null;
  const wantSeverity = severity && VALID_SEVERITIES.has(severity) ? severity : null;

  const out: UnifiedFinding[] = [];

  // ─── CSPM findings ────────────────────────────────────────────────────────
  if (!wantSource || wantSource === 'cspm') {
    const cspmConditions = orgId
      ? [eq(cspmFindings.orgId, orgId)]
      : [eq(cspmFindings.cloudAccountId, userId)];
    if (wantSeverity && wantSeverity !== 'info') {
      cspmConditions.push(
        eq(cspmFindings.severity, wantSeverity as 'critical' | 'high' | 'medium' | 'low'),
      );
    }
    const rows = await db
      .select()
      .from(cspmFindings)
      .where(and(...cspmConditions))
      .orderBy(desc(cspmFindings.firstSeenAt))
      .limit(limit);

    for (const r of rows) {
      out.push({
        id: r.id,
        source: 'cspm',
        severity: r.severity as UnifiedSeverity,
        title: r.title,
        summary: r.description ?? r.title,
        createdAt: r.firstSeenAt,
        eventType: r.checkId,
        status: r.status,
      });
    }
  }

  // ─── Integration events (pipewarden/tenantiq/sdlc) ────────────────────────
  if (!wantSource || wantSource !== 'cspm') {
    const userConns = await db
      .select({ id: integrationConnections.id, slug: integrationConnections.integrationSlug })
      .from(integrationConnections)
      .where(eq(integrationConnections.userId, userId));

    const filtered = wantSource
      ? userConns.filter((cc: { slug: string }) => cc.slug.startsWith(`${wantSource}:`))
      : userConns;

    if (filtered.length > 0) {
      const ids = filtered.map((cc: { id: string }) => cc.id);
      const eventConditions = [inArray(integrationEvents.connectionId, ids)];
      if (wantSeverity) {
        eventConditions.push(
          eq(integrationEvents.severity, wantSeverity as UnifiedSeverity),
        );
      }
      const events = await db
        .select()
        .from(integrationEvents)
        .where(and(...eventConditions))
        .orderBy(desc(integrationEvents.createdAt))
        .limit(limit);

      const slugById = new Map(filtered.map((cc: { id: string; slug: string }) => [cc.id, cc.slug]));
      for (const e of events) {
        out.push({
          id: e.id,
          source: detectSource(slugById.get(e.connectionId) ?? ''),
          severity: e.severity as UnifiedSeverity,
          title: e.summary,
          summary: e.summary,
          createdAt: e.createdAt,
          eventType: e.eventType,
          status: null,
        });
      }
    }
  }

  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const page = out.slice(offset, offset + limit);

  return c.json({ data: page, hasMore: out.length > offset + limit, total: out.length });
});

unifiedFindingRoutes.get('/unified/summary', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId');

  const summary = {
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    bySource: { cspm: 0, pipewarden: 0, tenantiq: 0, sdlc: 0 },
    total: 0,
  };

  const cspmCond = orgId
    ? eq(cspmFindings.orgId, orgId)
    : eq(cspmFindings.cloudAccountId, userId);
  const cspmRows = await db.select().from(cspmFindings).where(cspmCond).limit(5000);
  for (const r of cspmRows) {
    summary.bySource.cspm++;
    summary.total++;
    const sev = r.severity as keyof typeof summary.bySeverity;
    if (sev in summary.bySeverity) summary.bySeverity[sev]++;
  }

  const conns = await db
    .select({ id: integrationConnections.id, slug: integrationConnections.integrationSlug })
    .from(integrationConnections)
    .where(eq(integrationConnections.userId, userId));

  if (conns.length > 0) {
    const ids = conns.map((cc: { id: string }) => cc.id);
    const events = await db
      .select()
      .from(integrationEvents)
      .where(inArray(integrationEvents.connectionId, ids))
      .limit(5000);

    const slugById = new Map(conns.map((cc: { id: string; slug: string }) => [cc.id, cc.slug]));
    for (const e of events) {
      const src = detectSource(slugById.get(e.connectionId) ?? '');
      summary.bySource[src]++;
      summary.total++;
      const sev = e.severity as keyof typeof summary.bySeverity;
      if (sev in summary.bySeverity) summary.bySeverity[sev]++;
    }
  }

  return c.json({ data: summary });
});
