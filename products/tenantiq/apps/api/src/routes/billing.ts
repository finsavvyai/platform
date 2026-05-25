/** Billing Routes — LemonSqueezy checkout, webhooks, subscription management */

import { Hono } from 'hono';
import type { AppEnv, Env } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { createCheckout, verifyWebhookSignature, cancelSubscription, type LSConfig } from '../lib/lemonsqueezy';
import {
	parseLSEvent,
	handleSubscriptionCreated,
	handleSubscriptionUpdated,
	handleSubscriptionCancelled,
	handleSubscriptionExpired,
	handlePaymentFailed,
	handleSubscriptionActivated,
} from '../lib/billing-webhook-handlers';
import { AppError, billingRequired, validationError, notFound, internalError } from '../lib/errors';

export const billingRoutes = new Hono<AppEnv>();

function getLSConfig(env: Env): LSConfig {
	if (!env.LEMONSQUEEZY_API_KEY) throw new Error('LemonSqueezy is not configured');
	return {
		apiKey: env.LEMONSQUEEZY_API_KEY,
		storeId: env.LEMONSQUEEZY_STORE_ID || '',
		webhookSecret: env.LEMONSQUEEZY_WEBHOOK_SECRET || '',
		variantIds: {
			core: env.LEMONSQUEEZY_VARIANT_CORE || '',
			professional: env.LEMONSQUEEZY_VARIANT_PROFESSIONAL || '',
			security_suite: env.LEMONSQUEEZY_VARIANT_SECURITY_SUITE || '',
			enterprise: env.LEMONSQUEEZY_VARIANT_ENTERPRISE || '',
		},
		annualVariantIds: {
			core: env.LEMONSQUEEZY_VARIANT_CORE_ANNUAL || '',
			professional: env.LEMONSQUEEZY_VARIANT_PROFESSIONAL_ANNUAL || '',
			security_suite: env.LEMONSQUEEZY_VARIANT_SECURITY_SUITE_ANNUAL || '',
		},
	};
}

// --- POST /billing/checkout --------------------------------------------------

billingRoutes.post('/checkout', authMiddleware, async (c) => {
	const body = await c.req.json<{ plan?: string; cycle?: string }>();
	const plan = body.plan;
	// Reject unknown cycles rather than silently coercing to monthly.
	if (body.cycle && body.cycle !== 'annual' && body.cycle !== 'monthly') {
		throw validationError('Invalid cycle. Must be "annual" or "monthly".', { cycle: body.cycle });
	}
	const cycle = body.cycle === 'annual' ? 'annual' as const : 'monthly' as const;

	if (!plan || !['core', 'professional', 'security_suite', 'enterprise'].includes(plan)) {
		throw validationError('Invalid plan. Must be core, professional, security_suite, or enterprise', { plan });
	}

	const user = c.get('user');
	const orgId = user.orgId;
	const email = user.email || c.get('userEmail') || '';

	// Pre-flight: verify the variant for the chosen tier+cycle is configured.
	// Returns a tier-specific error so support can fix the missing secret without
	// users having to guess. Also keeps the error code stable for the frontend.
	const config = getLSConfig(c.env);
	const wantsAnnual = cycle === 'annual' && plan !== 'enterprise';
	const variantId = wantsAnnual
		? config.annualVariantIds?.[plan as 'core' | 'professional' | 'security_suite']
		: config.variantIds[plan as 'core' | 'professional' | 'security_suite' | 'enterprise'];
	if (!variantId) {
		const envKey = wantsAnnual
			? `LEMONSQUEEZY_VARIANT_${plan.toUpperCase()}_ANNUAL`
			: `LEMONSQUEEZY_VARIANT_${plan.toUpperCase()}`;
		console.error('[Billing] Missing variant secret:', envKey, { plan, cycle, orgId });
		throw billingRequired(
			`The ${plan.replace('_', ' ')} ${cycle} plan isn't available right now — contact support@tenantiq.app and we'll sort it within an hour.`,
		);
	}

	try {
		const result = await createCheckout(config, {
			orgId,
			email,
			tier: plan as 'core' | 'professional' | 'security_suite' | 'enterprise',
			cycle,
		});
		return c.json({ checkoutUrl: result.url });
	} catch (err) {
		if (err instanceof AppError) throw err;
		const msg = err instanceof Error ? err.message : String(err);
		console.error('[Billing] Checkout failed:', msg, { plan, cycle, orgId });
		const isConfig = msg.includes('not configured') || msg.includes('No variant');
		throw isConfig
			? billingRequired('Billing is not fully configured. Please contact support.')
			: internalError('Failed to create checkout. Please try again.');
	}
});

// --- POST /billing/webhook ---------------------------------------------------

/** Hex-encode a buffer. */
function toHex(buf: ArrayBuffer): string {
	return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

billingRoutes.post('/webhook', async (c) => {
	const signature = c.req.header('x-signature');
	if (!signature) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing webhook signature' } }, 400);

	const config = getLSConfig(c.env);
	const rawBody = await c.req.text();

	try {
		const valid = await verifyWebhookSignature(rawBody, signature, config.webhookSecret);
		if (!valid) return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid webhook signature' } }, 401);
	} catch (err: any) {
		console.error('[Billing] Webhook verification failed:', err);
		return c.json({ error: { code: 'UNAUTHORIZED', message: 'Webhook verification failed' } }, 401);
	}

	// Idempotency: hash the signed body. 7-day TTL covers LS retry window.
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawBody));
	const seenKey = `ls-webhook-seen:${toHex(digest)}`;
	if (await c.env.KV.get(seenKey)) {
		return c.json({ received: true, duplicate: true });
	}
	await c.env.KV.put(seenKey, '1', { expirationTtl: 7 * 86400 });

	let body: Record<string, unknown>;
	try {
		body = JSON.parse(rawBody);
	} catch {
		return c.json({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON payload' } }, 400);
	}

	const storeId = c.env.LEMONSQUEEZY_STORE_ID;
	if (storeId && (body as any).meta?.custom_data?.store_id && (body as any).meta.custom_data.store_id !== storeId) {
		return c.json({ error: 'Store ID mismatch' }, 401);
	}

	const event = parseLSEvent(body);

	try {
		switch (event.eventName) {
			case 'subscription_created':
				await handleSubscriptionCreated(c.env, event, config);
				break;
			case 'subscription_updated':
				await handleSubscriptionUpdated(c.env, event, config);
				break;
			case 'subscription_cancelled':
				await handleSubscriptionCancelled(c.env, event);
				break;
			case 'subscription_expired':
				await handleSubscriptionExpired(c.env, event);
				break;
			case 'subscription_activated':
				await handleSubscriptionActivated(c.env, event, config);
				break;
			case 'subscription_payment_failed':
				await handlePaymentFailed(c.env, event);
				break;
		}
	} catch (err: any) {
		console.error(`Webhook handler error (${event.eventName}):`, err.message);
		// Delete idempotency key so a manual retry can reprocess, but still return 200
		// to prevent LemonSqueezy from entering infinite retry loops.
		await c.env.KV.delete(seenKey).catch(() => {});
	}

	return c.json({ received: true });
});

// --- GET /billing/subscription -----------------------------------------------

billingRoutes.get('/subscription', authMiddleware, async (c) => {
	const user = c.get('user');
	if (!user?.orgId) return c.json({ tier: 'free', status: 'active', subscription: null });

	try {
		const sub = (await c.env.DB.prepare(`
			SELECT id, organization_id, ls_customer_id, ls_subscription_id, tier,
				status, current_period_end, cancel_at_period_end, created_at, updated_at
			FROM subscriptions
			WHERE organization_id = ? AND status IN ('active', 'on_trial', 'past_due')
			ORDER BY created_at DESC LIMIT 1
		`)
			.bind(user.orgId)
			.first()) as any;

		if (!sub) return c.json({ tier: 'free', status: 'active', subscription: null });

		return c.json({
			tier: sub.tier,
			status: sub.status,
			subscription: {
				id: sub.ls_subscription_id,
				currentPeriodEnd: sub.current_period_end,
				cancelAtPeriodEnd: sub.cancel_at_period_end === 1,
				createdAt: sub.created_at,
			},
		});
	} catch (err: any) {
		console.error('[Billing] subscription query failed:', err.message);
		return c.json({ tier: 'free', status: 'active', subscription: null });
	}
});

// --- POST /billing/cancel ----------------------------------------------------

billingRoutes.post('/cancel', authMiddleware, async (c) => {
	const orgId = c.get('user').orgId;
	const config = getLSConfig(c.env);

	const sub = await c.env.DB.prepare(
		"SELECT ls_subscription_id FROM subscriptions WHERE organization_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
	)
		.bind(orgId)
		.first<{ ls_subscription_id: string }>();

	if (!sub?.ls_subscription_id) {
		throw notFound('Active subscription');
	}

	try {
		await cancelSubscription(config.apiKey, sub.ls_subscription_id);
		await c.env.DB.prepare(
			'UPDATE subscriptions SET cancel_at_period_end = 1, updated_at = ? WHERE organization_id = ? AND ls_subscription_id = ?',
		)
			.bind(new Date().toISOString(), orgId, sub.ls_subscription_id)
			.run();
		return c.json({ message: 'Subscription will be canceled at end of billing period' });
	} catch (err: any) {
		console.error('[Billing] Cancel failed:', err.message);
		return c.json({ error: 'Failed to cancel subscription' }, 500);
	}
});
