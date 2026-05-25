/**
 * Push Notification API — manage web push subscriptions and preferences.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { authMiddleware } from '../middleware/auth';
import { TTL } from '../lib/constants';

export const pushNotificationRoutes = new Hono<AppEnv>();

// GET /api/push/vapid-key — PUBLIC. The browser fetches this BEFORE login to
// subscribe to push notifications. Safe to expose — VAPID public keys are
// designed to be public identifiers (analogous to TLS server certs).
// Mounted before the auth middleware below so it stays unauthenticated.
pushNotificationRoutes.get('/vapid-key', (c) => {
	const key = (c.env as { VAPID_PUBLIC_KEY?: string }).VAPID_PUBLIC_KEY;
	if (!key) return c.json({ error: 'push_not_configured' }, 503);
	return c.json({ publicKey: key });
});

// All other endpoints (subscribe/unsubscribe/preferences) require auth.
pushNotificationRoutes.use('*', authMiddleware);

const DEFAULT_PREFERENCES = {
	categories: {
		security: true,
		remediation: true,
		backup: true,
		workflow: true
	}
};

function hashSubscription(endpoint: string): string {
	let hash = 0;
	for (let i = 0; i < endpoint.length; i++) {
		hash = ((hash << 5) - hash + endpoint.charCodeAt(i)) | 0;
	}
	return Math.abs(hash).toString(36);
}

// POST /api/push/subscribe — Save a push subscription
pushNotificationRoutes.post('/subscribe', async (c) => {
	const user = c.get('user');
	const body = await c.req.json<{
		endpoint: string;
		keys: { p256dh: string; auth: string };
	}>();

	if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
		return c.json({ error: 'Missing endpoint or keys (p256dh, auth)' }, 400);
	}

	const subHash = hashSubscription(body.endpoint);
	const kvKey = `push:${user.sub}:${subHash}`;

	await c.env.KV.put(
		kvKey,
		JSON.stringify({
			endpoint: body.endpoint,
			keys: body.keys,
			createdAt: new Date().toISOString()
		}),
		{ expirationTtl: TTL.ONE_YEAR }
	);

	return c.json({ success: true, subscriptionId: subHash });
});

// DELETE /api/push/unsubscribe — Remove a push subscription
pushNotificationRoutes.delete('/unsubscribe', async (c) => {
	const user = c.get('user');
	const body = await c.req.json<{ endpoint: string }>();

	if (!body.endpoint) {
		return c.json({ error: 'Missing endpoint' }, 400);
	}

	const subHash = hashSubscription(body.endpoint);
	const kvKey = `push:${user.sub}:${subHash}`;

	await c.env.KV.delete(kvKey);
	return c.json({ success: true });
});

// GET /api/push/preferences — Get notification preferences
pushNotificationRoutes.get('/preferences', async (c) => {
	const user = c.get('user');
	const kvKey = `push-prefs:${user.sub}`;
	const stored = await c.env.KV.get(kvKey, 'json');

	return c.json(stored ?? DEFAULT_PREFERENCES);
});

// PATCH /api/push/preferences — Update notification preferences
pushNotificationRoutes.patch('/preferences', async (c) => {
	const user = c.get('user');
	const body = await c.req.json<{
		categories?: Partial<Record<string, boolean>>;
	}>();

	if (!body.categories || typeof body.categories !== 'object') {
		return c.json({ error: 'Missing categories object' }, 400);
	}

	const kvKey = `push-prefs:${user.sub}`;
	const existing = await c.env.KV.get(kvKey, 'json') as typeof DEFAULT_PREFERENCES | null;
	const current = existing ?? { ...DEFAULT_PREFERENCES };

	const validCategories = ['security', 'remediation', 'backup', 'workflow'];
	for (const [key, value] of Object.entries(body.categories)) {
		if (validCategories.includes(key) && typeof value === 'boolean') {
			(current.categories as Record<string, boolean>)[key] = value;
		}
	}

	await c.env.KV.put(kvKey, JSON.stringify(current), { expirationTtl: TTL.ONE_YEAR });
	return c.json(current);
});
