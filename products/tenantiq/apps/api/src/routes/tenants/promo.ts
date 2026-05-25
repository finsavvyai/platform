import { Hono } from 'hono';
import type { AppEnv } from '../../index';
import { authMiddleware } from '../../middleware/auth';

const VALID_CODES = ['ALLACCESS', 'ENTERPRISE2026', 'DEMO'];

export const promoRoutes = new Hono<AppEnv>();

promoRoutes.use('*', authMiddleware);

// POST /api/tenants/:id/promo
promoRoutes.post('/:id/promo', async (c) => {
	const id = c.req.param('id');
	const body = await c.req.json();
	const code = String(body.code || '').toUpperCase().trim();

	if (!VALID_CODES.includes(code)) {
		return c.json({ valid: false, error: 'Invalid promotion code' }, 400);
	}

	await c.env.KV.put(
		`promo:${id}`,
		JSON.stringify({ code, appliedAt: new Date().toISOString() }),
	);

	return c.json({
		valid: true,
		plan: 'Enterprise (All Access)',
		message: 'All skills unlocked!',
	});
});
