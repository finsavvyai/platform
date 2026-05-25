/**
 * Partner API Routes — register, list, manage API keys
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';

export const partnerRoutes = new Hono<AppEnv>();
partnerRoutes.use('*', authMiddleware);

const registerSchema = z.object({
	name: z.string().min(2).max(100),
	website: z.string().url(),
	contactEmail: z.string().email(),
});

// POST /api/partners/register — Register as partner
partnerRoutes.post('/register', async (c) => {
	const user = c.get('user');
	const orgId = user.orgId;
	if (!orgId) return c.json({ error: 'Missing organization' }, 400);

	let body: z.infer<typeof registerSchema>;
	try {
		body = registerSchema.parse(await c.req.json());
	} catch (e) {
		const msg = e instanceof z.ZodError ? e.errors[0]?.message : 'Invalid input';
		return c.json({ error: msg }, 400);
	}

	const id = crypto.randomUUID();
	const now = Date.now();

	await c.env.DB.prepare(
		`INSERT INTO partners (id, org_id, name, website, contact_email, status, created_at)
		 VALUES (?, ?, ?, ?, ?, 'active', ?)`,
	)
		.bind(id, orgId, body.name, body.website, body.contactEmail, now)
		.run();

	return c.json({ data: { id, name: body.name, status: 'active' } });
});

// GET /api/partners — List partners
partnerRoutes.get('/', async (c) => {
	const user = c.get('user');
	const orgId = user.orgId;
	if (!orgId) return c.json({ data: [] });

	const result = await c.env.DB.prepare(
		'SELECT id, org_id, name, website, contact_email, status, created_at FROM partners WHERE org_id = ? ORDER BY created_at DESC',
	)
		.bind(orgId)
		.all();

	return c.json({ data: result.results });
});

// POST /api/partners/api-keys — Generate API key for partner
partnerRoutes.post('/api-keys', async (c) => {
	const user = c.get('user');
	const orgId = user.orgId;
	if (!orgId) return c.json({ error: 'Missing organization' }, 400);

	const { partnerId } = await c.req.json<{ partnerId?: string }>();
	if (!partnerId) return c.json({ error: 'Missing partnerId' }, 400);

	const partner = await c.env.DB.prepare(
		'SELECT id FROM partners WHERE id = ? AND org_id = ?',
	)
		.bind(partnerId, orgId)
		.first();
	if (!partner) return c.json({ error: 'Partner not found' }, 404);

	const rawKey = `tiq_pk_${crypto.randomUUID().replace(/-/g, '')}`;
	const encoder = new TextEncoder();
	const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawKey));
	const hashHex = [...new Uint8Array(hashBuffer)]
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

	const keyId = crypto.randomUUID();
	const now = Date.now();

	await c.env.DB.prepare(
		`INSERT INTO partner_api_keys (id, partner_id, key_hash, key_prefix, created_at)
		 VALUES (?, ?, ?, ?, ?)`,
	)
		.bind(keyId, partnerId, hashHex, rawKey.slice(0, 12), now)
		.run();

	await c.env.DB.prepare(
		'UPDATE partners SET api_key_hash = ? WHERE id = ?',
	)
		.bind(hashHex, partnerId)
		.run();

	return c.json({ data: { id: keyId, key: rawKey, prefix: rawKey.slice(0, 12) } });
});

// DELETE /api/partners/api-keys/:id — Revoke API key
partnerRoutes.delete('/api-keys/:id', async (c) => {
	const user = c.get('user');
	const orgId = user.orgId;
	if (!orgId) return c.json({ error: 'Missing organization' }, 400);

	const keyId = c.req.param('id');

	await c.env.DB.prepare(
		`DELETE FROM partner_api_keys WHERE id = ? AND partner_id IN
		 (SELECT id FROM partners WHERE org_id = ?)`,
	)
		.bind(keyId, orgId)
		.run();

	return c.json({ success: true });
});
