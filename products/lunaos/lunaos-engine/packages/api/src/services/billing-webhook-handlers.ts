/**
 * Billing Webhook Handlers — LemonSqueezy event processing
 *
 * Handles subscription lifecycle events from LemonSqueezy webhooks.
 */

import type { Env } from '../worker';
import { tierFromVariantId, type LSConfig } from './lemonsqueezy';
import { sendUpgradeEmail } from './email';

/** Parse LS webhook event into a normalized shape */
export function parseLSEvent(body: any) {
    return {
        eventName: body.meta?.event_name as string,
        customData: body.meta?.custom_data || {},
        data: body.data?.attributes || {},
        id: body.data?.id,
        subscriptionId: body.data?.id,
        customerId: body.data?.attributes?.customer_id?.toString(),
        variantId: body.data?.attributes?.variant_id?.toString(),
        status: body.data?.attributes?.status,
    };
}

/** Handle subscription_created — activate subscription */
export async function handleSubscriptionCreated(
    env: Env,
    event: ReturnType<typeof parseLSEvent>,
    config: LSConfig,
) {
    const userId = event.customData.user_id;
    if (!userId || !event.subscriptionId) {
        console.error('subscription_created missing userId or subscriptionId');
        return;
    }

    const tier = event.variantId ? tierFromVariantId(event.variantId, config) : 'pro';
    const now = new Date().toISOString();
    const renewsAt = event.data.renews_at || now;

    await env.DB.prepare(`
        INSERT INTO subscriptions (
            id, user_id, ls_customer_id, ls_subscription_id,
            tier, status, current_period_start, current_period_end,
            cancel_at_period_end, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, 0, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            ls_customer_id = excluded.ls_customer_id,
            ls_subscription_id = excluded.ls_subscription_id,
            tier = excluded.tier, status = 'active',
            cancel_at_period_end = 0, updated_at = excluded.updated_at
    `).bind(
        crypto.randomUUID(), userId, event.customerId || '',
        event.subscriptionId, tier, now, renewsAt, now, now,
    ).run();

    await env.DB.prepare(
        'UPDATE users SET tier = ?, updated_at = ? WHERE id = ?',
    ).bind(tier, now, userId).run();

    if (env.RESEND_API_KEY) {
        const user = await env.DB.prepare(
            'SELECT email, name FROM users WHERE id = ?',
        ).bind(userId).first<{ email: string; name: string }>();
        if (user) {
            sendUpgradeEmail(env.RESEND_API_KEY, {
                email: user.email, name: user.name || '', tier,
            }).catch(() => { /* non-critical */ });
        }
    }
}

/** Handle subscription_updated — sync tier, status, period */
export async function handleSubscriptionUpdated(
    env: Env,
    event: ReturnType<typeof parseLSEvent>,
    config: LSConfig,
) {
    const sub = await env.DB.prepare(
        'SELECT user_id FROM subscriptions WHERE ls_subscription_id = ?',
    ).bind(event.subscriptionId).first<{ user_id: string }>();
    if (!sub) return;

    const tier = event.variantId ? tierFromVariantId(event.variantId, config) : 'pro';
    const now = new Date().toISOString();
    const renewsAt = event.data.renews_at || now;
    const status = event.status || 'active';

    await env.DB.prepare(`
        UPDATE subscriptions SET
            tier = ?, status = ?, current_period_end = ?,
            cancel_at_period_end = ?, updated_at = ?
        WHERE ls_subscription_id = ?
    `).bind(
        tier, status, renewsAt,
        status === 'cancelled' ? 1 : 0, now,
        event.subscriptionId,
    ).run();

    const activeTier = ['active', 'on_trial'].includes(status) ? tier : 'free';
    await env.DB.prepare(
        'UPDATE users SET tier = ?, updated_at = ? WHERE id = ?',
    ).bind(activeTier, now, sub.user_id).run();
}

/** Handle subscription_cancelled — revert to free at period end */
export async function handleSubscriptionCancelled(env: Env, event: ReturnType<typeof parseLSEvent>) {
    const now = new Date().toISOString();

    await env.DB.prepare(
        "UPDATE subscriptions SET status = 'cancelled', cancel_at_period_end = 1, updated_at = ? WHERE ls_subscription_id = ?",
    ).bind(now, event.subscriptionId).run();
}

/** Handle subscription_expired — fully revert to free */
export async function handleSubscriptionExpired(env: Env, event: ReturnType<typeof parseLSEvent>) {
    const sub = await env.DB.prepare(
        'SELECT user_id FROM subscriptions WHERE ls_subscription_id = ?',
    ).bind(event.subscriptionId).first<{ user_id: string }>();

    const now = new Date().toISOString();
    await env.DB.prepare(
        "UPDATE subscriptions SET status = 'expired', updated_at = ? WHERE ls_subscription_id = ?",
    ).bind(now, event.subscriptionId).run();

    if (sub) {
        await env.DB.prepare(
            "UPDATE users SET tier = 'free', updated_at = ? WHERE id = ?",
        ).bind(now, sub.user_id).run();
    }
}

/** Handle subscription_payment_failed — mark past_due */
export async function handlePaymentFailed(env: Env, event: ReturnType<typeof parseLSEvent>) {
    await env.DB.prepare(
        "UPDATE subscriptions SET status = 'past_due', updated_at = ? WHERE ls_subscription_id = ?",
    ).bind(new Date().toISOString(), event.subscriptionId).run();
}
