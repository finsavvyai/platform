/**
 * Billing Webhook Handlers — LemonSqueezy event processing
 *
 * Handles subscription lifecycle events from LemonSqueezy webhooks.
 */

import type { Env } from '../app/types';
import { tierFromVariantId, type LSConfig } from './lemonsqueezy';

export interface LSEvent {
	eventName: string;
	customData: Record<string, string>;
	data: Record<string, any>;
	id: string;
	subscriptionId: string;
	customerId: string;
	variantId: string;
	status: string;
}

/** Parse LS webhook event into a normalized shape */
export function parseLSEvent(body: any): LSEvent {
	return {
		eventName: body.meta?.event_name as string,
		customData: body.meta?.custom_data || {},
		data: body.data?.attributes || {},
		id: body.data?.id,
		subscriptionId: body.data?.id,
		customerId: body.data?.attributes?.customer_id?.toString() ?? '',
		variantId: body.data?.attributes?.variant_id?.toString() ?? '',
		status: body.data?.attributes?.status ?? '',
	};
}

/** Handle subscription_created — activate subscription */
export async function handleSubscriptionCreated(env: Env, event: LSEvent, config: LSConfig) {
	const orgId = event.customData.org_id;
	if (!orgId || !event.subscriptionId) {
		console.error('subscription_created missing orgId or subscriptionId');
		return;
	}

	const tier = event.variantId ? tierFromVariantId(event.variantId, config) : 'core';
	const now = new Date().toISOString();
	const renewsAt = event.data.renews_at || now;

	await env.DB.prepare(`
		INSERT INTO subscriptions (
			id, organization_id, ls_customer_id, ls_subscription_id,
			tier, status, current_period_end, cancel_at_period_end, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, 'active', ?, 0, ?, ?)
		ON CONFLICT(ls_subscription_id) DO UPDATE SET
			tier = excluded.tier, status = 'active',
			current_period_end = excluded.current_period_end,
			cancel_at_period_end = 0, updated_at = excluded.updated_at
	`)
		.bind(crypto.randomUUID(), orgId, event.customerId, event.subscriptionId, tier, renewsAt, now, now)
		.run();

	await env.DB.prepare('UPDATE organizations SET billing_plan = ?, updated_at = ? WHERE id = ?')
		.bind(tier, now, orgId)
		.run();
}

/** Handle subscription_updated — sync tier, status, period */
export async function handleSubscriptionUpdated(env: Env, event: LSEvent, config: LSConfig) {
	const sub = await env.DB.prepare('SELECT organization_id FROM subscriptions WHERE ls_subscription_id = ?')
		.bind(event.subscriptionId)
		.first<{ organization_id: string }>();
	if (!sub) return;

	const tier = event.variantId ? tierFromVariantId(event.variantId, config) : 'core';
	const now = new Date().toISOString();
	const renewsAt = event.data.renews_at || now;
	const status = event.status || 'active';

	await env.DB.prepare(`
		UPDATE subscriptions SET tier = ?, status = ?, current_period_end = ?,
			cancel_at_period_end = ?, updated_at = ?
		WHERE ls_subscription_id = ?
	`)
		.bind(tier, status, renewsAt, status === 'cancelled' ? 1 : 0, now, event.subscriptionId)
		.run();

	const activeTier = ['active', 'on_trial'].includes(status) ? tier : 'free';
	await env.DB.prepare('UPDATE organizations SET billing_plan = ?, updated_at = ? WHERE id = ?')
		.bind(activeTier, now, sub.organization_id)
		.run();

	// If the customer reactivated within the 30-day grace window, clear the
	// pending-purge flag so the cron leaves them alone.
	if (['active', 'on_trial'].includes(status)) {
		await reinstateOrganization(env, sub.organization_id);
	}
}

/** Handle subscription_cancelled — revert to free at period end */
export async function handleSubscriptionCancelled(env: Env, event: LSEvent) {
	const now = new Date().toISOString();
	await env.DB.prepare(
		"UPDATE subscriptions SET status = 'cancelled', cancel_at_period_end = 1, updated_at = ? WHERE ls_subscription_id = ?",
	)
		.bind(now, event.subscriptionId)
		.run();
}

/** Handle subscription_expired — terminal. Mark org for soft-delete; the
 *  daily account-purge cron hard-deletes after 30 days unless reinstated. */
export async function handleSubscriptionExpired(env: Env, event: LSEvent) {
	const sub = await env.DB.prepare('SELECT organization_id FROM subscriptions WHERE ls_subscription_id = ?')
		.bind(event.subscriptionId)
		.first<{ organization_id: string }>();

	const now = new Date().toISOString();
	const nowMs = Date.now();
	await env.DB.prepare("UPDATE subscriptions SET status = 'expired', updated_at = ? WHERE ls_subscription_id = ?")
		.bind(now, event.subscriptionId)
		.run();

	if (sub) {
		// `deleted_at` triggers the 30-day grace cron in apps/api/src/cron/account-purge.ts.
		// `billing_plan='free'` keeps the UI working during grace so customer can reinstate.
		await env.DB.prepare(
			"UPDATE organizations SET billing_plan = 'free', deleted_at = ?, updated_at = ? WHERE id = ?",
		)
			.bind(nowMs, now, sub.organization_id)
			.run();
	}
}

/** Reinstate — clear deleted_at when a subscription comes back to life. */
export async function reinstateOrganization(env: Env, organizationId: string) {
	const now = new Date().toISOString();
	await env.DB.prepare(
		'UPDATE organizations SET deleted_at = NULL, updated_at = ? WHERE id = ?',
	)
		.bind(now, organizationId)
		.run();
}

/** Handle subscription_payment_failed — mark past_due, retain access during dunning */
export async function handlePaymentFailed(env: Env, event: LSEvent) {
	const now = new Date().toISOString();
	await env.DB.prepare("UPDATE subscriptions SET status = 'past_due', updated_at = ? WHERE ls_subscription_id = ?")
		.bind(now, event.subscriptionId)
		.run();
}

/** Handle subscription_activated — same as created, fired when trial/paused sub activates */
export async function handleSubscriptionActivated(env: Env, event: LSEvent, config: LSConfig) {
	return handleSubscriptionCreated(env, event, config);
}
