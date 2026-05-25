/**
 * Feature Flag Admin API — CRUD for targeted feature flags.
 * Requires platform admin role.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../app/types';
import { authMiddleware } from '../../middleware/auth.middleware';
import { forbidden, notFound, validationError } from '../../lib/errors';
import {
	listTargetedFlags,
	getTargetedFlag,
	upsertTargetedFlag,
	deleteTargetedFlag,
	type FeatureFlagRule,
} from '../../lib/feature-flags';

export const featureFlagRoutes = new Hono<AppEnv>();
featureFlagRoutes.use('*', authMiddleware);

// Admin role check
featureFlagRoutes.use('*', async (c, next) => {
	const role = c.get('userRole') ?? '';
	if (!['admin', 'super_admin', 'platform_admin'].includes(role)) {
		throw forbidden('Platform admin access required');
	}
	await next();
});

const flagSchema = z.object({
	name: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
	enabled: z.boolean(),
	description: z.string().max(500).optional(),
	orgs: z.array(z.string()).optional(),
	plans: z.array(z.string()).optional(),
	percentage: z.number().int().min(0).max(100).optional(),
});

// GET /api/platform/admin/feature-flags — list all flags
featureFlagRoutes.get('/', async (c) => {
	const names = await listTargetedFlags(c.env.KV);
	const flags = await Promise.all(
		names.map(async (name) => {
			const rule = await getTargetedFlag(c.env.KV, name);
			return { name, ...rule };
		}),
	);
	return c.json({ flags });
});

// POST /api/platform/admin/feature-flags — create or update a flag
featureFlagRoutes.post('/', async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const parsed = flagSchema.safeParse(body);
	if (!parsed.success) {
		throw validationError('Invalid flag definition', { issues: parsed.error.issues });
	}

	const { name, ...rule } = parsed.data;
	await upsertTargetedFlag(c.env.KV, name, rule as FeatureFlagRule);

	const saved = await getTargetedFlag(c.env.KV, name);
	return c.json({ name, ...saved }, 201);
});

// DELETE /api/platform/admin/feature-flags/:name — delete a flag
featureFlagRoutes.delete('/:name', async (c) => {
	const name = c.req.param('name');
	const existing = await getTargetedFlag(c.env.KV, name);
	if (!existing) throw notFound('Feature flag');

	await deleteTargetedFlag(c.env.KV, name);
	return c.json({ success: true });
});
