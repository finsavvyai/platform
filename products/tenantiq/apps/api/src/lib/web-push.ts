/**
 * Web Push notification sender — delivers push notifications via the Web Push protocol.
 */

import type { Env } from '../app/types';

interface PushNotification {
	title: string;
	body: string;
	url?: string;
	category: string;
}

interface PushSubscription {
	endpoint: string;
	keys: { p256dh: string; auth: string };
	createdAt: string;
}

interface PushPreferences {
	categories: Record<string, boolean>;
}

const DEFAULT_PREFERENCES: PushPreferences = {
	categories: { security: true, remediation: true, backup: true, workflow: true }
};

/**
 * Send a push notification to all of a user's registered push subscriptions.
 * Returns true if at least one notification was sent successfully.
 */
export async function sendPushNotification(
	env: Env,
	userId: string,
	notification: PushNotification
): Promise<boolean> {
	const preferences = await getUserPreferences(env, userId);
	if (!preferences.categories[notification.category]) {
		console.log(`[WebPush] Category "${notification.category}" disabled for user ${userId}`);
		return false;
	}

	const subscriptions = await getUserSubscriptions(env, userId);
	if (subscriptions.length === 0) {
		console.log(`[WebPush] No subscriptions found for user ${userId}`);
		return false;
	}

	if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
		console.log('[WebPush] VAPID keys not configured — skipping push delivery');
		return false;
	}

	const payload = JSON.stringify({
		title: notification.title,
		body: notification.body,
		url: notification.url,
		category: notification.category,
		timestamp: new Date().toISOString()
	});

	let anySuccess = false;

	for (const sub of subscriptions) {
		try {
			const sent = await deliverPush(env, sub, payload);
			if (sent) anySuccess = true;
		} catch (error) {
			console.error(`[WebPush] Failed to deliver to ${sub.endpoint}:`, error);
		}
	}

	return anySuccess;
}

async function getUserSubscriptions(env: Env, userId: string): Promise<PushSubscription[]> {
	const prefix = `push:${userId}:`;
	const listed = await env.KV.list({ prefix });
	const subscriptions: PushSubscription[] = [];

	for (const key of listed.keys) {
		const value = await env.KV.get(key.name, 'json');
		if (value) subscriptions.push(value as PushSubscription);
	}

	return subscriptions;
}

async function getUserPreferences(env: Env, userId: string): Promise<PushPreferences> {
	const prefs = await env.KV.get(`push-prefs:${userId}`, 'json');
	return (prefs as PushPreferences) ?? DEFAULT_PREFERENCES;
}

/**
 * Deliver a push notification via the Web Push protocol with proper VAPID
 * JWT signing + AES128-GCM payload encryption (RFC 8291).
 *
 * Uses @pushforge/builder for Cloudflare Workers compatibility — it builds
 * the signed request with WebCrypto only, no Node.js deps.
 *
 * Setup: VAPID_PRIVATE_KEY must be the private key in JWK JSON format, e.g.
 *   { "kty": "EC", "crv": "P-256", "d": "...", "x": "...", "y": "..." }
 * Generate via `npx web-push generate-vapid-keys --json` or pushforge equivalent.
 */
async function deliverPush(
	env: Env,
	subscription: PushSubscription,
	payload: string
): Promise<boolean> {
	if (!env.VAPID_PRIVATE_KEY) {
		console.error('[WebPush] VAPID_PRIVATE_KEY not configured');
		return false;
	}

	let privateJWK: JsonWebKey;
	try {
		privateJWK = JSON.parse(env.VAPID_PRIVATE_KEY);
	} catch {
		console.error('[WebPush] VAPID_PRIVATE_KEY must be a JWK JSON string');
		return false;
	}

	try {
		const { buildPushHTTPRequest } = await import('@pushforge/builder');
		const { endpoint, headers, body } = await buildPushHTTPRequest({
			privateJWK,
			subscription: {
				endpoint: subscription.endpoint,
				keys: subscription.keys,
			},
			message: {
				payload: JSON.parse(payload),
				adminContact: env.VAPID_CONTACT ?? 'mailto:support@tenantiq.app',
				options: { ttl: 86400, urgency: 'high' },
			},
		});

		const response = await fetch(endpoint, { method: 'POST', headers, body });

		if (response.status === 410 || response.status === 404) {
			console.log(`[WebPush] Subscription expired (${response.status}): ${subscription.endpoint}`);
			return false;
		}
		if (!response.ok) {
			console.error(`[WebPush] Push endpoint returned ${response.status}`);
			return false;
		}
		return true;
	} catch (err) {
		console.error('[WebPush] Delivery failed:', err);
		return false;
	}
}
