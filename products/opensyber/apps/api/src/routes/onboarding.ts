/**
 * Adaptive onboarding orchestrator.
 *  POST /api/onboarding/auto-deploy — instance + skill install + profile persist.
 *  GET  /api/onboarding/profile     — read the persisted persona profile.
 * Instance-creation logic duplicates instances.ts; refactor to a shared
 * `createInstanceForUser()` service when this stabilizes.
 */

import { Hono } from 'hono';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { instances, skills, skillInstallations, users } from '@opensyber/db';
import {
  generateId,
  PLAN_INSTANCE_LIMITS,
  DEFAULT_AGENT_IMAGE,
  LATEST_AGENT_VERSION,
} from '@opensyber/shared';
import type { Region } from '@opensyber/shared';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContextAutoDetect, requirePermission } from '../middleware/rbac.js';
import { agentRuntime } from '../services/agent-runtime.js';
import { buildCloudInit } from '../services/cloud-init.js';
import { encrypt } from '../utils/encryption.js';
import { storeGatewayToken } from '../lib/gateway-token.js';
import { tryCreateTailscaleKey } from '../utils/instance-provisioning.js';
import { listInstancesScoped } from '../utils/instance-access.js';
import { enforceResidency } from '../utils/data-residency.js';

const onboardingRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
onboardingRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContextAutoDetect);

const autoDeployBody = z.object({
  region: z.string().min(1),
  name: z.string().min(1).optional(),
  persona: z.string().optional(),
  skill_slugs: z.array(z.string()).max(5).optional(),
  signals: z.record(z.unknown()).optional(),
});

type SkillInstallResult = { slug: string; status: 'installed' | 'not_found' | 'duplicate' | 'error'; message?: string };

onboardingRoutes.post('/auto-deploy', requirePermission('instance.create'), async (c) => {
  const userId = c.get('userId');
  const orgId = c.get('orgId');
  const db = c.get('db');

  const parsed = autoDeployBody.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }
  const body = parsed.data;

  // Plan + limit + residency gates (same contracts as POST /api/instances).
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return c.json({ ok: false, message: 'User not found' }, 404);
  if (user.plan === 'free') {
    return c.json({
      ok: false,
      message: 'Free tier is sandbox-only. Upgrade to deploy a running agent.',
      upgradeUrl: '/pricing',
    }, 402);
  }

  const existing = await listInstancesScoped(db as any, userId, orgId);
  const limit = PLAN_INSTANCE_LIMITS[user.plan] || 1;
  if (existing.length >= limit) {
    return c.json({ ok: false, message: `Your ${user.plan} plan allows ${limit} instance(s).` }, 403);
  }

  const residency = await enforceResidency(db as any, orgId, body.region);
  if (!residency.allowed) {
    return c.json({ ok: false, message: residency.reason ?? 'Region restricted' }, 403);
  }

  // ── 1. Create instance row + container ───────────────────────────────
  const instanceId = generateId();
  const gatewayToken = generateId();
  const apiBaseUrl = c.env.OPENSYBER_API_URL ?? c.env.API_BASE_URL ?? 'https://api.opensyber.cloud';
  const agentImage = `${DEFAULT_AGENT_IMAGE}:${LATEST_AGENT_VERSION}`;

  await db.insert(instances).values({
    id: instanceId, userId, orgId,
    name: body.name ?? 'My Agent',
    region: body.region as Region,
    status: 'provisioning' as const,
    createdAt: new Date().toISOString(),
  });

  try {
    const tailscaleAuthKey = await tryCreateTailscaleKey(c.env, instanceId, orgId ?? userId);
    buildCloudInit({ instanceId, gatewayToken, apiBaseUrl, agentImage, tailscaleAuthKey });
    const container = await agentRuntime.createInstance({
      instanceId, region: body.region, plan: user.plan,
      doNamespace: c.env.AGENT_DO,
      envVars: {
        OPENSYBER_INSTANCE_ID: instanceId,
        OPENSYBER_GATEWAY_TOKEN: gatewayToken,
        OPENSYBER_API_URL: apiBaseUrl,
        OPENSYBER_REGION: body.region,
      },
    });

    await storeGatewayToken(c.env.CREDENTIAL_VAULT, instanceId, gatewayToken);
    const encryptedToken = await encrypt(gatewayToken, c.env.ENCRYPTION_KEY);
    await db.update(instances).set({
      containerId: container.containerId,
      hostname: container.hostname,
      gatewayTokenEncrypted: encryptedToken,
      status: 'running',
    }).where(eq(instances.id, instanceId));
  } catch (err) {
    await db.update(instances).set({ status: 'error' }).where(eq(instances.id, instanceId));
    const message = err instanceof Error ? err.message : 'Container creation failed';
    return c.json({ ok: false, message, instance_id: instanceId }, 500);
  }

  // ── 2. Install requested skills by slug (best-effort) ───────────────
  const slugs = body.skill_slugs ?? [];
  const skillResults: SkillInstallResult[] = [];
  if (slugs.length > 0) {
    const found = await db.select().from(skills).where(inArray(skills.slug, slugs));
    const foundBySlug = new Map(found.map((s) => [s.slug, s]));
    for (const slug of slugs) {
      const skill = foundBySlug.get(slug);
      if (!skill) {
        skillResults.push({ slug, status: 'not_found' });
        continue;
      }
      try {
        await db.insert(skillInstallations).values({
          id: generateId(),
          instanceId,
          skillId: skill.id,
          version: skill.currentVersion ?? '0.0.0',
          installedAt: new Date().toISOString(),
          isActive: true,
        });
        skillResults.push({ slug, status: 'installed' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'install failed';
        skillResults.push({
          slug,
          status: /unique|already/i.test(msg) ? 'duplicate' : 'error',
          message: msg,
        });
      }
    }
  }

  // ── 3. Persist the persona profile so the dashboard can adapt later ──
  if (body.persona) {
    const profile = {
      persona: body.persona,
      signals: body.signals ?? {},
      inferred_region: body.region,
      suggested_skill_ids: slugs,
      created_at: new Date().toISOString(),
    };
    try {
      await db.update(users)
        .set({ onboardingProfile: JSON.stringify(profile) })
        .where(eq(users.id, userId));
    } catch (err) {
      // Persistence failure is non-fatal — onboarding still succeeded.
      console.error('[Onboarding] Failed to persist profile:', err);
    }
  }

  return c.json({
    ok: true,
    instance_id: instanceId,
    instance_status: 'running',
    skills: skillResults,
    persona: body.persona ?? null,
  });
});

// Read the persisted persona profile. Returns null if never set.
onboardingRoutes.get('/profile', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const [user] = await db.select({ profile: users.onboardingProfile })
    .from(users).where(eq(users.id, userId));
  if (!user?.profile) return c.json({ profile: null });
  try {
    return c.json({ profile: JSON.parse(user.profile) });
  } catch {
    return c.json({ profile: null });
  }
});

export { onboardingRoutes };
