/**
 * Tenant Settings API — per-tenant configurable thresholds stored in KV.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { notFound, validationError, forbidden } from '../lib/errors';

export const tenantSettingsRoutes = new Hono<AppEnv>();
tenantSettingsRoutes.use('*', authMiddleware);

const PRESET_DAYS = [30, 60, 90] as const;

const settingsSchema = z.object({
	inactivityDays: z.union([z.literal(30), z.literal(60), z.literal(90), z.literal('custom')]),
	customDays: z.number().int().min(1).max(365).optional(),
});

export type TenantSettings = z.infer<typeof settingsSchema>;

const DEFAULT_SETTINGS: TenantSettings = { inactivityDays: 90 };

function kvKey(tenantId: string): string {
	return `tenant-settings:${tenantId}`;
}

function verifyAccess(c: any, tenantId: string): boolean {
	const user = c.get('user');
	return Array.isArray(user.tenantIds) && user.tenantIds.includes(tenantId);
}

// GET /api/tenants/:id/settings — Get tenant settings
tenantSettingsRoutes.get('/:id/settings', async (c) => {
	const tenantId = c.req.param('id');
	if (!verifyAccess(c, tenantId)) throw forbidden('You do not have access to this tenant');

	const raw = await c.env.KV.get(kvKey(tenantId), 'json') as TenantSettings | null;
	return c.json({ settings: raw ?? DEFAULT_SETTINGS });
});

// PATCH /api/tenants/:id/settings — Update tenant settings
tenantSettingsRoutes.patch('/:id/settings', async (c) => {
	const tenantId = c.req.param('id');
	if (!verifyAccess(c, tenantId)) throw forbidden('You do not have access to this tenant');

	const user = c.get('user');
	if (!['admin', 'tenant_admin', 'super_admin', 'platform_admin'].includes(user.role)) {
		throw forbidden('Admin role required to update settings');
	}

	const body = await c.req.json().catch(() => ({}));
	const parsed = settingsSchema.safeParse(body);
	if (!parsed.success) {
		throw validationError('Invalid settings', { issues: parsed.error.issues });
	}

	const data = parsed.data;
	if (data.inactivityDays === 'custom' && !data.customDays) {
		throw validationError('customDays is required when inactivityDays is "custom"');
	}
	if (data.inactivityDays !== 'custom') {
		delete data.customDays;
	}

	const current = await c.env.KV.get(kvKey(tenantId), 'json') as TenantSettings | null;
	const merged = { ...(current ?? DEFAULT_SETTINGS), ...data };

	await c.env.KV.put(kvKey(tenantId), JSON.stringify(merged));
	return c.json({ settings: merged });
});
