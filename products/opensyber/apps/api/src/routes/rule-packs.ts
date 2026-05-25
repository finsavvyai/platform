import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { policyRulePacks, installedRulePacks, alertRules } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';
import { verifyInstanceAccess } from '../utils/instance-access.js';
import { installRulePackSchema } from './validation/rule-packs.js';
import { BUILT_IN_RULE_PACKS } from '@opensyber/shared';

const rulePackRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

rulePackRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

/** GET /rule-packs — list all available rule packs (built-in + custom) */
rulePackRoutes.get('/', async (c) => {
  const db = c.get('db');
  const customPacks = await db.select().from(policyRulePacks)
    .where(eq(policyRulePacks.isBuiltIn, false));

  const builtIn = BUILT_IN_RULE_PACKS.map((p) => ({
    ...p,
    rules: JSON.stringify(p.rules),
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
  }));

  return c.json({ packs: [...builtIn, ...customPacks] });
});

/** POST /rule-packs/install — install a pack for an instance */
rulePackRoutes.post('/install', requirePermission('policy.create'), async (c) => {
  const parsed = installRulePackSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Bad request', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }

  const { packId, instanceId } = parsed.data;
  const db = c.get('db');
  const instance = await verifyInstanceAccess(db as any, instanceId, c.get('userId'), c.get('orgId'));
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const pack = BUILT_IN_RULE_PACKS.find((p) => p.id === packId);
  if (!pack) {
    const [custom] = await db.select().from(policyRulePacks).where(eq(policyRulePacks.id, packId));
    if (!custom) return c.json({ error: 'Not found', message: 'Rule pack not found' }, 404);
  }

  const rules = pack ? pack.rules : JSON.parse(
    (await db.select().from(policyRulePacks).where(eq(policyRulePacks.id, packId)))[0]?.rules ?? '[]',
  );

  const now = new Date().toISOString();
  const installId = crypto.randomUUID();

  await db.insert(installedRulePacks).values({
    id: installId, instanceId, packId, installedAt: now, isActive: true,
  }).onConflictDoNothing();

  const createdRules = await createAlertRulesFromPack(db as any, instanceId, rules);

  return c.json({ installed: { id: installId, packId, instanceId }, rulesCreated: createdRules.length }, 201);
});

/** GET /instances/:instanceId/active-packs — list installed packs */
rulePackRoutes.get('/instances/:instanceId/active-packs', async (c) => {
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const instance = await verifyInstanceAccess(db as any, instanceId, c.get('userId'), c.get('orgId'));
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const installed = await db.select().from(installedRulePacks)
    .where(and(eq(installedRulePacks.instanceId, instanceId), eq(installedRulePacks.isActive, true)));

  const packs = installed.map((i) => {
    const builtIn = BUILT_IN_RULE_PACKS.find((p) => p.id === i.packId);
    return { ...i, pack: builtIn ?? null };
  });

  return c.json({ installedPacks: packs });
});

async function createAlertRulesFromPack(
  db: any, instanceId: string, rules: any[],
): Promise<any[]> {
  const created = [];
  for (const rule of rules) {
    const id = crypto.randomUUID();
    const eventType = rule.conditions?.[0]?.value ?? 'unknown';
    const severity = rule.actions?.[0]?.config?.severity ?? 'medium';
    const alertRule = {
      id, instanceId, name: rule.name,
      eventType: String(eventType), severityFilter: severity,
      threshold: 1, windowMinutes: 60, cooldownMinutes: 30,
      isActive: true, createdAt: new Date().toISOString(),
    };
    await db.insert(alertRules).values(alertRule);
    created.push(alertRule);
  }
  return created;
}

export { rulePackRoutes };
