/**
 * Security Stack Configuration Actions — POST endpoints for applying and rolling back
 * security configurations. Supports dry-run mode to preview changes.
 *
 * Tenant queries are scoped to the authenticated user's organization to defend
 * against token-forgery / stale-membership attacks.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../app/types';
import { createGraphClient } from '../../lib/graph-client';
import { authMiddleware } from '../../middleware/auth';
import { actionMap, SECURITY_TEMPLATES } from '../../lib/security-stack/templates';

export const securityStackActionsRoutes = new Hono<AppEnv>();

// All security-stack endpoints require auth + a bound user/org context.
securityStackActionsRoutes.use('*', authMiddleware);

const configureSchema = z.object({
	product: z.string().optional(),
	action: z.string().optional(),
	productId: z.string().optional(),
	options: z.record(z.unknown()).optional(),
	dryRun: z.boolean().optional(),
});

const remediateSchema = z.object({
	findings: z.array(
		z.object({
			product: z.string(),
			action: z.string(),
			options: z.record(z.unknown()).optional(),
		}),
	),
});

async function loadTenantForOrg(c: Parameters<typeof authMiddleware>[0], tenantId: string) {
	const user = c.get('user');
	const tenant = await c.env.DB
		.prepare('SELECT id, azure_tenant_id, organization_id FROM tenants WHERE id = ? AND organization_id = ?')
		.bind(tenantId, user.orgId)
		.first<{ id: string; azure_tenant_id: string; organization_id: string }>();
	return tenant;
}

securityStackActionsRoutes.post('/:id/security/stack/configure', async (c) => {
	const id = c.req.param('id');
	const body = await c.req.json().catch(() => ({}));
	const parsed = configureSchema.safeParse(body);

	if (!parsed.success) {
		return c.json({ error: { code: 'BAD_REQUEST', message: 'Invalid request', details: parsed.error.errors } }, 400);
	}

	let { product, action, productId, options, dryRun } = parsed.data;
	const user = c.get('user');

	// If only productId is provided, map it to a default action.
	if (productId && !product && !action) {
		product = productId.includes('defender') ? 'conditional-access' : 'dlp';
		action = productId.includes('safe') ? 'basic-dlp' : 'mfa-enforcement';
	}

	const tenant = await loadTenantForOrg(c, id);
	if (!tenant) return c.json({ error: { code: 'NOT_FOUND', message: 'Tenant not found' } }, 404);

	const productActions = product ? actionMap[product] : undefined;
	const executor = productActions && action ? productActions[action] : undefined;
	if (!executor) {
		return c.json(
			{ error: { code: 'UNKNOWN_ACTION', message: `No executor for product='${product}' action='${action}'` } },
			400,
		);
	}

	if (dryRun) {
		return c.json({
			success: true,
			dryRun: true,
			preview: {
				product,
				action,
				estimatedChanges: `${action} will be configured with provided options`,
				options,
			},
		});
	}

	try {
		const graph = createGraphClient(c.env, tenant.azure_tenant_id);
		const result = await executor(graph, options);

		if (result.success && result.resourceId) {
			try {
				const logId = crypto.randomUUID();
				await c.env.DB.prepare(
					'INSERT INTO audit_logs (id, org_id, user_id, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
				)
					.bind(
						logId,
						user.orgId,
						user.sub,
						`${product}:${action}`,
						'security_stack',
						result.resourceId,
						JSON.stringify({ status: 'success', tenantId: id }),
						Date.now(),
					)
					.run();
			} catch (err) {
				console.error('[security-stack] audit log write failed', err);
			}
		}

		return c.json({ success: result.success, result });
	} catch (err) {
		return c.json(
			{
				success: false,
				error: { code: 'CONFIGURE_FAILED', message: err instanceof Error ? err.message : 'Unknown error' },
				product,
				action,
			},
			500,
		);
	}
});

securityStackActionsRoutes.post('/:id/security/stack/remediate', async (c) => {
	const id = c.req.param('id');
	const body = await c.req.json().catch(() => ({ findings: [] }));
	const parsed = remediateSchema.safeParse(body);

	if (!parsed.success) {
		return c.json({ error: { code: 'BAD_REQUEST', message: 'Invalid request', details: parsed.error.errors } }, 400);
	}

	const { findings } = parsed.data;
	const tenant = await loadTenantForOrg(c, id);
	if (!tenant) return c.json({ error: { code: 'NOT_FOUND', message: 'Tenant not found' } }, 404);

	const graph = createGraphClient(c.env, tenant.azure_tenant_id);
	const results: Array<{ action: string; success: boolean; details: string; rollbackInfo?: Record<string, unknown>; resourceId?: string }> = [];

	for (const finding of findings) {
		const executor = actionMap[finding.product]?.[finding.action];
		if (!executor) {
			results.push({ action: finding.action, success: false, details: 'Unknown action' });
			continue;
		}

		try {
			const result = await executor(graph, finding.options);
			results.push(result);
		} catch (err) {
			results.push({
				action: finding.action,
				success: false,
				details: err instanceof Error ? err.message : 'Unknown error',
			});
		}
	}

	const ok = results.filter((r) => r.success).length;
	return c.json({ results, totalSuccess: ok, totalFailed: results.length - ok });
});

securityStackActionsRoutes.get('/:id/security/stack/templates', async (c) => {
	const id = c.req.param('id');
	const tenant = await loadTenantForOrg(c, id);
	if (!tenant) return c.json({ error: { code: 'NOT_FOUND', message: 'Tenant not found' } }, 404);
	return c.json({ templates: SECURITY_TEMPLATES });
});
