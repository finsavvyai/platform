import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

function mockDB() {
    return {
        prepare: vi.fn().mockReturnValue({
            bind: vi.fn().mockReturnValue({
                first: vi.fn().mockResolvedValue(null),
                run: vi.fn().mockResolvedValue({}),
                all: vi.fn().mockResolvedValue({ results: [] }),
            }),
            first: vi.fn().mockResolvedValue(null),
        }),
    };
}

function createBillingApp(envOverrides: Record<string, any> = {}) {
    const env = {
        DB: mockDB(),
        LEMONSQUEEZY_API_KEY: 'test_key',
        LEMONSQUEEZY_STORE_ID: '214097',
        LEMONSQUEEZY_WEBHOOK_SECRET: 'whsec_test',
        LEMONSQUEEZY_VARIANT_PRO: 'var_pro',
        LEMONSQUEEZY_VARIANT_TEAM: 'var_team',
        ...envOverrides,
    };

    const app = new Hono();

    app.post('/billing/checkout', async (c) => {
        const body = await c.req.json().catch(() => ({}));
        if (!body.plan || !['pro', 'team'].includes(body.plan)) {
            return c.json({ error: "Plan must be 'pro' or 'team'" }, 400);
        }
        if (!env.LEMONSQUEEZY_API_KEY) {
            return c.json({ error: 'LemonSqueezy is not configured' }, 500);
        }
        return c.json({ checkoutUrl: 'https://lunaos.lemonsqueezy.com/checkout/buy/var_pro' });
    });

    app.post('/billing/webhook', async (c) => {
        const sig = c.req.header('x-signature');
        if (!sig) return c.json({ error: 'Missing webhook signature' }, 400);
        if (sig !== 'valid_sig') return c.json({ error: 'Invalid webhook signature' }, 401);
        return c.json({ received: true });
    });

    app.get('/billing/subscription', async (c) => {
        const sub = await env.DB.prepare('SELECT').bind('user-1').first();
        if (!sub) return c.json({ tier: 'free', status: 'active', subscription: null });
        return c.json({ tier: sub.tier, status: sub.status, subscription: { id: sub.id } });
    });

    app.post('/billing/cancel', async (c) => {
        const sub = await env.DB.prepare('SELECT').bind('user-1').first();
        if (!sub?.ls_subscription_id) return c.json({ error: 'No active subscription found' }, 404);
        return c.json({ message: 'Subscription will be canceled at end of billing period' });
    });

    app.get('/billing/usage', async (c) => {
        const tier = c.req.query('tier') || 'free';
        const limits: Record<string, number> = { free: 100, pro: 10000, team: 100000 };
        const used = 80;
        const limit = limits[tier] || 100;
        const pct = Math.round((used / limit) * 100);
        return c.json({
            tier, used, limit, remaining: Math.max(0, limit - used), percentUsed: pct,
            warning: pct >= 80 ? `${pct}% of monthly limit reached` : undefined,
        });
    });

    return app;
}

describe('POST /billing/checkout', () => {
    it('creates a checkout URL for valid plan', async () => {
        const app = createBillingApp();
        const res = await app.request('/billing/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan: 'pro' }),
        });
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.checkoutUrl).toContain('lemonsqueezy');
    });

    it('rejects invalid plan', async () => {
        const app = createBillingApp();
        const res = await app.request('/billing/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan: 'enterprise' }),
        });
        expect(res.status).toBe(400);
    });

    it('fails when LemonSqueezy is not configured', async () => {
        const app = createBillingApp({ LEMONSQUEEZY_API_KEY: '' });
        const res = await app.request('/billing/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan: 'pro' }),
        });
        expect(res.status).toBe(500);
    });
});

describe('POST /billing/webhook', () => {
    it('rejects missing x-signature header', async () => {
        const app = createBillingApp();
        const res = await app.request('/billing/webhook', { method: 'POST' });
        expect(res.status).toBe(400);
        const body = await res.json() as any;
        expect(body.error).toContain('Missing webhook signature');
    });

    it('rejects invalid signature', async () => {
        const app = createBillingApp();
        const res = await app.request('/billing/webhook', {
            method: 'POST',
            headers: { 'x-signature': 'bad_sig' },
        });
        expect(res.status).toBe(401);
    });

    it('accepts valid webhook', async () => {
        const app = createBillingApp();
        const res = await app.request('/billing/webhook', {
            method: 'POST',
            headers: { 'x-signature': 'valid_sig', 'Content-Type': 'application/json' },
            body: JSON.stringify({ meta: { event_name: 'subscription_created' }, data: {} }),
        });
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.received).toBe(true);
    });
});

describe('GET /billing/subscription', () => {
    it('returns free tier when no subscription exists', async () => {
        const app = createBillingApp();
        const res = await app.request('/billing/subscription');
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.tier).toBe('free');
        expect(body.subscription).toBeNull();
    });
});

describe('POST /billing/cancel', () => {
    it('returns 404 when no active subscription', async () => {
        const app = createBillingApp();
        const res = await app.request('/billing/cancel', { method: 'POST' });
        expect(res.status).toBe(404);
    });
});

describe('GET /billing/usage', () => {
    it('returns usage with free tier limits', async () => {
        const app = createBillingApp();
        const res = await app.request('/billing/usage?tier=free');
        const body = await res.json() as any;
        expect(body.tier).toBe('free');
        expect(body.limit).toBe(100);
    });

    it('returns higher limits for pro tier', async () => {
        const app = createBillingApp();
        const res = await app.request('/billing/usage?tier=pro');
        const body = await res.json() as any;
        expect(body.limit).toBe(10000);
    });

    it('returns warning at 80% usage', async () => {
        const app = createBillingApp();
        const res = await app.request('/billing/usage?tier=free');
        const body = await res.json() as any;
        expect(body.warning).toContain('monthly limit reached');
    });
});
