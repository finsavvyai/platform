/**
 * SaaS OAuth App Discovery Routes
 *
 * GET /api/saas/oauth-apps — List discovered OAuth apps
 * GET /api/saas/oauth-apps/agents — Filter for AI agent OAuth apps only
 * POST /api/saas/oauth-apps — Register an OAuth app discovery
 */
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createDb } from '../lib/db.js';
import { saasOauthApps } from '@opensyber/db';
import { eq, and } from 'drizzle-orm';
import { assessOAuthRisk } from '../services/saas-oauth-risk.js';
import { createOauthAppSchema } from './validation/saas-oauth.js';

const saasOauthRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

saasOauthRoutes.get('/oauth-apps', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ error: 'Org context required' }, 400);

  const db = createDb(c.env.DB);
  const apps = await db.select().from(saasOauthApps).where(eq(saasOauthApps.orgId, orgId));
  return c.json({ data: apps });
});

saasOauthRoutes.get('/oauth-apps/agents', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ error: 'Org context required' }, 400);

  const db = createDb(c.env.DB);
  const apps = await db.select().from(saasOauthApps)
    .where(and(eq(saasOauthApps.orgId, orgId), eq(saasOauthApps.isAiAgent, true)));
  return c.json({ data: apps });
});

/**
 * GET /oauth-risk — Scan all stored OAuth apps and return risk assessments.
 * Re-evaluates risk scores for every app in the org.
 */
saasOauthRoutes.get('/oauth-risk', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ error: 'Org context required' }, 400);

  const db = createDb(c.env.DB);
  const apps = await db.select().from(saasOauthApps).where(eq(saasOauthApps.orgId, orgId));

  const assessments = apps.map((app) => {
    const scopes: string[] = parseScopes(app.scopes);
    const risk = assessOAuthRisk(app.appName, app.provider, scopes);
    return {
      id: app.id,
      appName: app.appName,
      appId: app.appId,
      provider: app.provider,
      ...risk,
    };
  });

  const summary = {
    total: assessments.length,
    critical: assessments.filter((a) => a.riskLevel === 'critical').length,
    high: assessments.filter((a) => a.riskLevel === 'high').length,
    medium: assessments.filter((a) => a.riskLevel === 'medium').length,
    low: assessments.filter((a) => a.riskLevel === 'low').length,
    aiAgents: assessments.filter((a) => a.isAiAgent).length,
  };

  return c.json({ data: { assessments, summary } });
});

saasOauthRoutes.post('/oauth-apps', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ error: 'Org context required' }, 400);

  const parsed = createOauthAppSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Invalid input', details: parsed.error.issues[0]?.message }, 400);
  const body = parsed.data;

  const risk = assessOAuthRisk(body.appName, body.provider, body.scopes);
  const db = createDb(c.env.DB);
  const id = crypto.randomUUID();

  await db.insert(saasOauthApps).values({
    id, orgId, appName: body.appName, appId: body.appId, provider: body.provider,
    scopes: JSON.stringify(body.scopes ?? []),
    riskScore: risk.riskScore, riskLevel: risk.riskLevel,
    isAiAgent: risk.isAiAgent, grantedBy: body.grantedBy ?? null,
  });

  return c.json({ data: { id, ...risk } }, 201);
});

/** Parse scopes from JSON string or return as-is if already an array */
function parseScopes(scopes: unknown): string[] {
  if (Array.isArray(scopes)) return scopes as string[];
  if (typeof scopes === 'string') {
    try { return JSON.parse(scopes) as string[]; } catch { return []; }
  }
  return [];
}

export { saasOauthRoutes };
