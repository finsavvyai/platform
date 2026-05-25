/** Billing Routes — LemonSqueezy checkout, webhooks, subscription management */

import { Hono } from 'hono';
import type { Env } from '../worker';
import { requireAuth } from '../middleware/auth';
import {
    createCheckout,
    verifyWebhookSignature,
    cancelSubscription,
    type LSConfig,
} from '../services/lemonsqueezy';
import {
    parseLSEvent,
    handleSubscriptionCreated,
    handleSubscriptionUpdated,
    handleSubscriptionCancelled,
    handleSubscriptionExpired,
    handlePaymentFailed,
} from '../services/billing-webhook-handlers';
import { validateJson } from '../middleware/validation';
import { checkoutSchema } from '../schemas';

export const billingRoutes = new Hono<{ Bindings: Env }>();

function getLSConfig(env: Env): LSConfig {
    if (!env.LEMONSQUEEZY_API_KEY) throw new Error('LemonSqueezy is not configured');
    return {
        apiKey: env.LEMONSQUEEZY_API_KEY,
        storeId: env.LEMONSQUEEZY_STORE_ID || '',
        webhookSecret: env.LEMONSQUEEZY_WEBHOOK_SECRET || '',
        variantIds: {
            pro: env.LEMONSQUEEZY_VARIANT_PRO || '',
            team: env.LEMONSQUEEZY_VARIANT_TEAM || '',
        },
    };
}

// ─── GET /billing/plans ─────────────────────────────────────────────────────

billingRoutes.get('/plans', (c) => {
    const proVariant = c.env.LEMONSQUEEZY_VARIANT_PRO || '2';
    const teamVariant = c.env.LEMONSQUEEZY_VARIANT_TEAM || '3';
    return c.json({ plans: [
        { id: 'free', name: 'Free', price: 0, features: ['28 agents', 'CLI + Dashboard', 'Community support'] },
        { id: 'pro', name: 'Pro', price: 29, checkoutUrl: `https://lunaos.lemonsqueezy.com/buy/${proVariant}`, features: ['Unlimited runs', 'RAG search', 'Priority support'] },
        { id: 'team', name: 'Team', price: 79, checkoutUrl: `https://lunaos.lemonsqueezy.com/buy/${teamVariant}`, features: ['Everything in Pro', 'Team RBAC', 'Audit logs', 'SSO'] },
    ] });
});

// ─── POST /billing/checkout ──────────────────────────────────────────────────

billingRoutes.post('/checkout', requireAuth, validateJson(checkoutSchema), async (c) => {
    const { plan: tier } = c.req.valid('json');
    const userId = c.get('userId');
    const currentTier = c.get('userTier');

    if (currentTier === tier) return c.json({ error: `You are already on the ${tier} plan` }, 400);

    try {
        const config = getLSConfig(c.env);
        const result = await createCheckout(config, {
            userId, email: c.get('userEmail'), tier,
            redirectUrl: 'https://agents.lunaos.ai/dashboard/billing?success=true',
        });
        return c.json({ checkoutUrl: result.url });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

// ─── POST /billing/webhook ───────────────────────────────────────────────────

billingRoutes.post('/webhook', async (c) => {
    const signature = c.req.header('x-signature');
    if (!signature) return c.json({ error: 'Missing webhook signature' }, 400);

    const config = getLSConfig(c.env);
    const rawBody = await c.req.text();

    try {
        const valid = await verifyWebhookSignature(rawBody, signature, config.webhookSecret);
        if (!valid) return c.json({ error: 'Invalid webhook signature' }, 401);
    } catch (err: any) {
        return c.json({ error: err.message }, 401);
    }

    const body = JSON.parse(rawBody);
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
            case 'subscription_payment_failed':
                await handlePaymentFailed(c.env, event);
                break;
        }
    } catch (err: any) {
        // Acknowledge webhook even if processing fails
    }

    return c.json({ received: true });
});

// ─── GET /billing/subscription ───────────────────────────────────────────────

billingRoutes.get('/subscription', requireAuth, async (c) => {
    const sub = await c.env.DB.prepare(`
        SELECT id, user_id, ls_customer_id, ls_subscription_id, tier,
               status, current_period_start, current_period_end,
               cancel_at_period_end, created_at, updated_at
        FROM subscriptions WHERE user_id = ? AND status IN ('active', 'on_trial', 'past_due')
        ORDER BY created_at DESC LIMIT 1
    `).bind(c.get('userId')).first() as any;

    if (!sub) return c.json({ tier: 'free', status: 'active', subscription: null });

    return c.json({
        tier: sub.tier, status: sub.status,
        subscription: {
            id: sub.ls_subscription_id,
            currentPeriodStart: sub.current_period_start,
            currentPeriodEnd: sub.current_period_end,
            cancelAtPeriodEnd: sub.cancel_at_period_end === 1,
            createdAt: sub.created_at,
        },
    });
});

// ─── POST /billing/cancel ────────────────────────────────────────────────────

billingRoutes.post('/cancel', requireAuth, async (c) => {
    const userId = c.get('userId');
    const config = getLSConfig(c.env);

    const sub = await c.env.DB.prepare(
        "SELECT ls_subscription_id FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
    ).bind(userId).first<{ ls_subscription_id: string }>();

    if (!sub?.ls_subscription_id) return c.json({ error: 'No active subscription found' }, 404);

    try {
        await cancelSubscription(config.apiKey, sub.ls_subscription_id);
        await c.env.DB.prepare(
            'UPDATE subscriptions SET cancel_at_period_end = 1, updated_at = ? WHERE user_id = ? AND ls_subscription_id = ?',
        ).bind(new Date().toISOString(), userId, sub.ls_subscription_id).run();
        return c.json({ message: 'Subscription will be canceled at end of billing period' });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

// ─── GET /billing/usage ──────────────────────────────────────────────────────

billingRoutes.get('/usage', requireAuth, async (c) => {
    const userId = c.get('userId');
    const tier = c.get('userTier');
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const agentUsage = await c.env.DB.prepare(
        'SELECT COUNT(*) as count FROM executions WHERE user_id = ? AND created_at >= ? AND created_at <= ?',
    ).bind(userId, monthStart, monthEnd).first<{ count: number }>();

    const chainUsage = await c.env.DB.prepare(
        'SELECT COUNT(*) as count FROM chain_executions WHERE user_id = ? AND created_at >= ? AND created_at <= ?',
    ).bind(userId, monthStart, monthEnd).first<{ count: number }>();

    const limits: Record<string, number> = { free: 100, pro: 10000, team: 100000 };
    const used = (agentUsage?.count || 0) + (chainUsage?.count || 0);
    const limit = limits[tier] || 100;
    const percentUsed = Math.round((used / limit) * 100);

    return c.json({
        tier, used, limit, remaining: Math.max(0, limit - used), percentUsed,
        period: { start: monthStart, end: monthEnd },
        breakdown: { agentExecutions: agentUsage?.count || 0, chainExecutions: chainUsage?.count || 0 },
        warning: percentUsed >= 80 ? `${percentUsed}% of monthly limit reached` : undefined,
    });
});
