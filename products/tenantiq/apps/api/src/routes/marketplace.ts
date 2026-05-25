import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import {
	resolveMarketplacePlan,
	mapSubscriptionStatus,
	isValidAction,
} from '../lib/marketplace-config';
import {
	resolveMarketplaceToken,
	verifyWebhookOperation,
	acknowledgeOperation,
	type MicrosoftEnv,
} from '../lib/marketplace/microsoft-api';

export const marketplaceRoutes = new Hono<AppEnv>();

interface WebhookPayload {
	action: string;
	subscriptionId: string;
	planId?: string;
	quantity?: number;
	operationId?: string;
}

interface ActivatePayload {
	subscriptionId: string;
	planId: string;
	quantity?: number;
}

function asMicrosoftEnv(env: AppEnv['Bindings']): MicrosoftEnv {
	const r = env as unknown as Record<string, unknown>;
	return {
		KV: env.KV,
		MARKETPLACE_PUBLISHER_TENANT_ID: r['MARKETPLACE_PUBLISHER_TENANT_ID'] as string | undefined,
		MARKETPLACE_AAD_APP_ID: r['MARKETPLACE_AAD_APP_ID'] as string | undefined,
		MARKETPLACE_AAD_APP_SECRET: r['MARKETPLACE_AAD_APP_SECRET'] as string | undefined,
	};
}

// --- Webhook (Microsoft calls this directly; verified via marketplaceapi roundtrip) ---

marketplaceRoutes.post('/webhook', async (c) => {
	let body: WebhookPayload;
	try {
		body = await c.req.json<WebhookPayload>();
	} catch {
		return c.json({ error: 'Invalid JSON body' }, 400);
	}

	const { action, subscriptionId, planId, quantity, operationId } = body;
	if (!action || !subscriptionId) return c.json({ error: 'Missing action or subscriptionId' }, 400);
	if (!isValidAction(action)) return c.json({ error: `Unknown action: ${action}` }, 400);

	// Verify the operation actually exists in Microsoft's records — this is the
	// authoritative check; spoofed webhooks fail because Microsoft won't know the operation.
	if (operationId) {
		const verified = await verifyWebhookOperation(asMicrosoftEnv(c.env), subscriptionId, operationId);
		if (!verified) return c.json({ error: 'Operation not verified by Microsoft' }, 401);
	}

	const subKey = `marketplace-sub:${subscriptionId}`;
	const existingRaw = await c.env.KV.get(subKey);
	if (!existingRaw) return c.json({ error: 'Subscription not found' }, 404);

	const existing = JSON.parse(existingRaw) as Record<string, unknown>;
	const orgId = existing.orgId as string;
	const newStatus = mapSubscriptionStatus(action);

	const updatedSub = {
		...existing, status: newStatus,
		planId: planId ?? existing.planId,
		quantity: quantity ?? existing.quantity,
		updatedAt: new Date().toISOString(),
	};
	await c.env.KV.put(subKey, JSON.stringify(updatedSub));

	const billingPlan = planId
		? (resolveMarketplacePlan(planId)?.billingPlan ?? (existing.billingPlan as string))
		: (existing.billingPlan as string);

	await c.env.DB.prepare('UPDATE organizations SET billing_plan = ? WHERE id = ?')
		.bind(billingPlan, orgId).run();

	const eventId = operationId ?? crypto.randomUUID();
	await c.env.KV.put(
		`marketplace-event:${orgId}:${eventId}`,
		JSON.stringify({ action, subscriptionId, planId, quantity, status: newStatus, timestamp: new Date().toISOString() }),
		{ expirationTtl: 90 * 86400 },
	);

	// Acknowledge the operation back to Microsoft so it's no longer pending.
	if (operationId) {
		await acknowledgeOperation(
			asMicrosoftEnv(c.env), subscriptionId, operationId,
			(planId ?? existing.planId) as string,
			(quantity ?? existing.quantity ?? 1) as number,
			'Success',
		);
	}

	return c.json({ success: true });
});

// --- Resolve marketplace token → subscription via Microsoft API ---

marketplaceRoutes.post('/resolve', async (c) => {
	const tokenFromHeader = c.req.header('x-ms-marketplace-token');
	let tokenFromBody: string | undefined;
	try {
		const body = await c.req.json<{ token?: string }>();
		tokenFromBody = body.token;
	} catch { /* no body */ }

	const userToken = tokenFromHeader ?? tokenFromBody;
	if (!userToken) return c.json({ error: 'Missing marketplace token' }, 400);

	const subscription = await resolveMarketplaceToken(asMicrosoftEnv(c.env), userToken);
	if (!subscription) return c.json({ error: 'Token rejected by Microsoft' }, 401);

	// Cache resolution short-term so the landing page can re-fetch without a second AAD round-trip.
	await c.env.KV.put(`marketplace-resolve:${userToken}`, JSON.stringify(subscription), { expirationTtl: 600 });

	return c.json({ data: subscription });
});

// --- Activate subscription (called from the landing page after user accepts) ---

marketplaceRoutes.post('/activate', async (c) => {
	let body: ActivatePayload;
	try {
		body = await c.req.json<ActivatePayload>();
	} catch {
		return c.json({ error: 'Invalid JSON body' }, 400);
	}

	const { subscriptionId, planId, quantity } = body;
	if (!subscriptionId || !planId) return c.json({ error: 'Missing subscriptionId or planId' }, 400);

	const plan = resolveMarketplacePlan(planId);
	if (!plan) return c.json({ error: `Unknown plan: ${planId}` }, 400);

	const orgId = crypto.randomUUID().replace(/-/g, '');
	await c.env.DB.prepare(
		'INSERT OR IGNORE INTO organizations (id, name, billing_plan, type) VALUES (?, ?, ?, ?)',
	).bind(orgId, `Marketplace Org (${subscriptionId})`, plan.billingPlan, 'marketplace').run();

	const subRecord = {
		subscriptionId, planId, billingPlan: plan.billingPlan, planName: plan.name,
		quantity: quantity ?? 1, orgId, status: 'active',
		createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
	};
	await c.env.KV.put(`marketplace-sub:${subscriptionId}`, JSON.stringify(subRecord));

	return c.json({ data: { orgId, plan: plan.name, status: 'active' } });
});

// --- List subscriptions (admin only, requires auth) ---

marketplaceRoutes.get('/subscriptions', authMiddleware, async (c) => {
	const user = c.get('user');
	if (user.role !== 'admin' && user.role !== 'super_admin') {
		return c.json({ error: 'Forbidden' }, 403);
	}

	const listResult = await c.env.KV.list({ prefix: 'marketplace-sub:' });
	const subscriptions: unknown[] = [];
	for (const key of listResult.keys) {
		const raw = await c.env.KV.get(key.name);
		if (raw) subscriptions.push(JSON.parse(raw));
	}

	return c.json({ data: subscriptions });
});
