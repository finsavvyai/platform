/**
 * Platform-admin tier grant — set any org's `billing_plan` without payment.
 * Used for sales demos, partner pilots, and internal QA. Audit-logged.
 *
 *   POST /api/platform/organizations/:id/grant-tier
 *   { "tier": "enterprise", "reason": "MSP demo with Acme" }
 */

import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { platformAdminMiddleware, logAdminAction } from '../../middleware/admin-auth';

const ALLOWED_TIERS = ['free', 'core', 'professional', 'security_suite', 'enterprise'] as const;
type Tier = typeof ALLOWED_TIERS[number];

const orgsGrantTier = new Hono<AppEnv>();

orgsGrantTier.use('*', platformAdminMiddleware);

orgsGrantTier.post('/:id/grant-tier', async (c) => {
	const orgId = c.req.param('id');
	const body = await c.req.json<{ tier?: string; reason?: string; clearSoftDelete?: boolean }>().catch(() => ({} as any));
	const tier = (body.tier ?? '').trim();
	const reason = (body.reason ?? '').trim();

	if (!ALLOWED_TIERS.includes(tier as Tier)) {
		return c.json({ error: `Invalid tier. Allowed: ${ALLOWED_TIERS.join(', ')}` }, 400);
	}
	if (!reason || reason.length < 5) {
		return c.json({ error: 'reason must be ≥5 chars (visible in audit log)' }, 400);
	}

	const before = await c.env.DB
		.prepare('SELECT id, billing_plan, deleted_at FROM organizations WHERE id = ?')
		.bind(orgId)
		.first<{ id: string; billing_plan: string; deleted_at: number | null }>();
	if (!before) return c.json({ error: 'Organization not found' }, 404);

	const clearSoftDelete = body.clearSoftDelete !== false; // default true
	const now = new Date().toISOString();

	if (clearSoftDelete) {
		await c.env.DB
			.prepare('UPDATE organizations SET billing_plan = ?, deleted_at = NULL, updated_at = ? WHERE id = ?')
			.bind(tier, now, orgId)
			.run();
	} else {
		await c.env.DB
			.prepare('UPDATE organizations SET billing_plan = ?, updated_at = ? WHERE id = ?')
			.bind(tier, now, orgId)
			.run();
	}

	await logAdminAction(c, {
		action: 'platform.org.grant_tier',
		resourceType: 'organization',
		resourceId: orgId,
		details: {
			fromTier: before.billing_plan,
			toTier: tier,
			previousDeletedAt: before.deleted_at,
			clearedSoftDelete: clearSoftDelete && !!before.deleted_at,
			reason,
		},
	});

	const after = await c.env.DB
		.prepare('SELECT id, name, billing_plan, deleted_at FROM organizations WHERE id = ?')
		.bind(orgId)
		.first();

	return c.json({ ok: true, before, after });
});

export default orgsGrantTier;
