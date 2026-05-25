/**
 * Configuration-as-Code Export API Routes
 * Export M365 config as JSON, diff two exports.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { getSelectedTenant } from '../lib/tenant-selector';
import { ALL_CATEGORIES, type ConfigCategory, type ConfigExport } from '../lib/config-export/types';
import { diffConfigs, exportConfig } from '../lib/config-export/exporter';

export const configExportRoutes = new Hono<AppEnv>();
configExportRoutes.use('*', authMiddleware);

const exportSchema = z.object({
	categories: z.array(z.enum([
		'conditionalAccess', 'authMethods', 'securityDefaults', 'dlpPolicies', 'sharingSettings',
	])).optional().default([]),
});

const diffSchema = z.object({
	oldExport: z.object({
		version: z.string(),
		exportedAt: z.string(),
		tenant: z.object({ id: z.string(), displayName: z.string() }),
		categories: z.record(z.unknown()),
	}),
	newExport: z.object({
		version: z.string(),
		exportedAt: z.string(),
		tenant: z.object({ id: z.string(), displayName: z.string() }),
		categories: z.record(z.unknown()),
	}),
});

// POST /api/config/export — export current config as JSON
configExportRoutes.post('/export', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant selected' }, 400);

	const body = await c.req.json().catch(() => ({}));
	const parsed = exportSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 422);

	const categories = (parsed.data.categories.length > 0
		? parsed.data.categories
		: ALL_CATEGORIES) as ConfigCategory[];

	// Build a graphFetch stub — in production this calls the real Graph client
	const graphFetch = async (endpoint: string): Promise<unknown> => {
		const token = await c.env.KV.get(`graph-token:${tenantId}`);
		if (!token) return { error: 'No Graph token cached', endpoint };

		const res = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
			headers: { Authorization: `Bearer ${token}` },
		});
		if (!res.ok) return { error: `Graph API ${res.status}`, endpoint };
		return res.json();
	};

	const tenant = await c.env.DB.prepare(
		'SELECT id, display_name FROM tenants WHERE id = ?',
	).bind(tenantId).first<{ id: string; display_name: string }>().catch(() => null);

	const result = await exportConfig(graphFetch, categories, {
		id: tenantId,
		displayName: tenant?.display_name ?? tenantId,
	});

	return c.json({ export: result });
});

// POST /api/config/diff — diff two config exports
configExportRoutes.post('/diff', async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const parsed = diffSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 422);

	const diffs = diffConfigs(
		parsed.data.oldExport as ConfigExport,
		parsed.data.newExport as ConfigExport,
	);

	return c.json({ diffs, count: diffs.length });
});
