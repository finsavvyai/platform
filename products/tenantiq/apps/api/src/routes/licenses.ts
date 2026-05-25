import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { getDb } from '../lib/db';
import { getLicensesByTenant, getLicenseWaste, createAuditEntry } from '@tenantiq/db';

export const licenseRoutes = new Hono<AppEnv>();

licenseRoutes.use('*', authMiddleware);
licenseRoutes.use('*', tenantMiddleware);

// GET / — License summary
licenseRoutes.get('/', async (c) => {
	const tenantId = c.get('tenantId') as string;
	const db = getDb(c.env);
	const licenses = await getLicensesByTenant(db, tenantId);

	const totalSpend = licenses.reduce(
		(sum, l) => sum + l.assigned * Number(l.costPerUnit ?? 0),
		0
	);

	return c.json({ licenses, totalSpend: Math.round(totalSpend) });
});

// GET /waste — Waste analysis
licenseRoutes.get('/waste', async (c) => {
	const tenantId = c.get('tenantId') as string;
	const db = getDb(c.env);
	const wasteItems = await getLicenseWaste(db, tenantId);
	const totalMonthlyWaste = wasteItems.reduce((sum, w) => sum + w.monthlyCost, 0);

	return c.json({
		wasteItems,
		totalMonthlyWaste: Math.round(totalMonthlyWaste * 100) / 100
	});
});

// POST /optimize — Execute license optimization
licenseRoutes.post('/optimize', async (c) => {
	const tenantId = c.get('tenantId') as string;
	const user = c.get('user');
	const body = await c.req.json<{
		userIds: string[];
		action: 'downgrade' | 'remove';
		targetSku?: string;
	}>();

	if (!body.userIds?.length) {
		return c.json({ error: 'userIds required' }, 400);
	}

	// Enqueue bulk remediation
	await c.env.REMEDIATION_QUEUE.send({
		type: 'bulk_license_optimization',
		tenantId,
		userIds: body.userIds,
		action: body.action,
		targetSku: body.targetSku,
		executedBy: user.email
	});

	const db = getDb(c.env);
	await createAuditEntry(db, {
		tenantId,
		actor: user.email,
		action: 'license.optimization.queued',
		resourceType: 'license',
		details: { userCount: body.userIds.length, action: body.action }
	});

	return c.json({
		queued: true,
		message: `License optimization queued for ${body.userIds.length} users`
	});
});

// GET /export — CSV export
licenseRoutes.get('/export', async (c) => {
	const tenantId = c.get('tenantId') as string;
	const db = getDb(c.env);
	const licenses = await getLicensesByTenant(db, tenantId);

	const csv = [
		'SKU Name,SKU ID,Total,Assigned,Unused,Cost Per Unit,Monthly Spend,Monthly Waste',
		...licenses.map((l) => {
			const unused = l.total - l.assigned;
			const cost = Number(l.costPerUnit ?? 0);
			return `"${l.skuName}","${l.skuId}",${l.total},${l.assigned},${unused},${cost},${l.assigned * cost},${unused * cost}`;
		})
	].join('\n');

	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv',
			'Content-Disposition': `attachment; filename="licenses-${tenantId}.csv"`
		}
	});
});
