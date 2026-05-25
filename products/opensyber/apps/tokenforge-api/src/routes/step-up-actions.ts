/**
 * Per-tenant step-up policy admin — /v1/step-up-actions (Sprint 39).
 *
 *   GET  /v1/step-up-actions   → returns the parsed policy array
 *                                (or `null` if column is unset)
 *   PUT  /v1/step-up-actions   → replaces the policy wholesale; body
 *                                must be a JSON array conforming to
 *                                `parseStepUpActions`
 *
 * Validation runs at write-time so a tenant cannot persist a malformed
 * config that would silently fall back to the default verdict at read
 * time. Pairs with `services/step-up/loader.ts` (read path) and
 * `routes/edge-verify.ts` (enforcement).
 */

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { tfTenants } from '@opensyber/db';
import { parseStepUpActions } from '@opensyber/tokenforge/server/internal';
import type { Env, Variables } from '../types.js';

export const stepUpActionsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

stepUpActionsRoutes.get('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const [tenant] = await db
    .select({ stepUpActions: tfTenants.stepUpActions })
    .from(tfTenants)
    .where(eq(tfTenants.id, tenantId))
    .limit(1);
  if (!tenant) return c.json({ error: 'tenant_not_found' }, 404);
  if (!tenant.stepUpActions) return c.json({ data: { actions: null } });
  const parsed = parseStepUpActions(tenant.stepUpActions);
  // If the stored blob was tampered with externally, surface it as null
  // rather than echoing invalid JSON back to the admin.
  return c.json({ data: { actions: parsed } });
});

stepUpActionsRoutes.put('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');

  const raw = await c.req.text();
  // Accept either a JSON array directly or `{ "actions": [...] }`.
  let actionsRaw: string;
  try {
    const body = JSON.parse(raw) as unknown;
    if (Array.isArray(body)) actionsRaw = JSON.stringify(body);
    else if (body && typeof body === 'object' && Array.isArray((body as { actions?: unknown }).actions)) {
      actionsRaw = JSON.stringify((body as { actions: unknown[] }).actions);
    } else {
      return c.json({ error: 'invalid_payload' }, 400);
    }
  } catch {
    return c.json({ error: 'invalid_payload' }, 400);
  }

  const parsed = parseStepUpActions(actionsRaw);
  if (!parsed) return c.json({ error: 'invalid_step_up_actions' }, 400);

  await db
    .update(tfTenants)
    .set({ stepUpActions: actionsRaw, updatedAt: new Date().toISOString() })
    .where(eq(tfTenants.id, tenantId));

  return c.json({ data: { actions: parsed, count: parsed.length } });
});
