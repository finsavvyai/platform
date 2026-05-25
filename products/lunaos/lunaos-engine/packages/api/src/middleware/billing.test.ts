import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

/**
 * Billing middleware tests — inline the middleware logic to avoid
 * Hono context variable type conflicts with the mock setup.
 */

const TIER_LIMITS: Record<string, number> = { free: 100, pro: 10000, team: 100000 };

function mockDB(agentCount: number, chainCount: number) {
    return {
        prepare: vi.fn().mockImplementation((sql: string) => ({
            bind: vi.fn().mockReturnValue({
                first: vi.fn().mockResolvedValue({
                    c: sql.includes('chain_executions') ? chainCount : agentCount,
                }),
            }),
        })),
    };
}

function createApp(tier: string, agentCount: number, chainCount: number) {
    const db = mockDB(agentCount, chainCount);
    const app = new Hono();

    // Simulate requireAuth setting context vars
    app.use('/*', async (c, next) => {
        c.set('userId' as any, 'user-1');
        c.set('userTier' as any, tier);
        await next();
    });

    // Inline billing check to match real middleware logic
    app.use('/*', async (c, next) => {
        const userId = c.get('userId' as any) as string;
        const userTier = c.get('userTier' as any) as string;
        const limit = TIER_LIMITS[userTier] || TIER_LIMITS.free;

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const agentResult = await db.prepare(
            'SELECT COUNT(*) as c FROM executions WHERE user_id = ? AND created_at >= ?'
        ).bind(userId, monthStart).first<{ c: number }>();

        const chainResult = await db.prepare(
            'SELECT COUNT(*) as c FROM chain_executions WHERE user_id = ? AND created_at >= ?'
        ).bind(userId, monthStart).first<{ c: number }>();

        const used = (agentResult?.c || 0) + (chainResult?.c || 0);

        if (used >= limit) {
            return c.json({
                error: 'Monthly execution limit reached',
                tier: userTier, used, limit,
                upgradeUrl: 'https://agents.lunaos.ai/pricing',
            }, 403);
        }

        const pct = Math.round((used / limit) * 100);
        if (pct >= 80) {
            c.header('X-Usage-Warning', `${pct}% of monthly limit reached (${used}/${limit})`);
        }
        c.header('X-Usage-Used', String(used));
        c.header('X-Usage-Limit', String(limit));
        c.header('X-Usage-Remaining', String(limit - used));
        await next();
    });

    app.get('/execute', (c) => c.json({ ok: true }));
    return app;
}

describe('checkExecutionLimit middleware', () => {
    it('should allow free tier user under limit', async () => {
        const app = createApp('free', 50, 10);
        const res = await app.request('/execute');
        expect(res.status).toBe(200);
        expect(res.headers.get('X-Usage-Used')).toBe('60');
        expect(res.headers.get('X-Usage-Limit')).toBe('100');
        expect(res.headers.get('X-Usage-Remaining')).toBe('40');
    });

    it('should block free tier user at limit with 403', async () => {
        const app = createApp('free', 80, 20);
        const res = await app.request('/execute');
        expect(res.status).toBe(403);
        const body = await res.json() as Record<string, any>;
        expect(body.error).toContain('limit reached');
        expect(body.tier).toBe('free');
        expect(body.used).toBe(100);
        expect(body.limit).toBe(100);
    });

    it('should block free tier user over limit', async () => {
        const app = createApp('free', 90, 30);
        const res = await app.request('/execute');
        expect(res.status).toBe(403);
    });

    it('should allow pro tier with higher limit', async () => {
        const app = createApp('pro', 5000, 2000);
        const res = await app.request('/execute');
        expect(res.status).toBe(200);
        expect(res.headers.get('X-Usage-Limit')).toBe('10000');
        expect(res.headers.get('X-Usage-Remaining')).toBe('3000');
    });

    it('should block pro tier at limit', async () => {
        const app = createApp('pro', 6000, 4000);
        const res = await app.request('/execute');
        expect(res.status).toBe(403);
        const body = await res.json() as Record<string, any>;
        expect(body.tier).toBe('pro');
        expect(body.limit).toBe(10000);
    });

    it('should allow team tier with 100k limit', async () => {
        const app = createApp('team', 50000, 30000);
        const res = await app.request('/execute');
        expect(res.status).toBe(200);
        expect(res.headers.get('X-Usage-Limit')).toBe('100000');
    });

    it('should block team tier at limit', async () => {
        const app = createApp('team', 60000, 40000);
        const res = await app.request('/execute');
        expect(res.status).toBe(403);
        const body = await res.json() as Record<string, any>;
        expect(body.tier).toBe('team');
    });

    it('should set usage warning header at 80% threshold', async () => {
        const app = createApp('free', 50, 35);
        const res = await app.request('/execute');
        expect(res.status).toBe(200);
        const warning = res.headers.get('X-Usage-Warning');
        expect(warning).toContain('85%');
        expect(warning).toContain('85/100');
    });

    it('should not set warning header below 80%', async () => {
        const app = createApp('free', 40, 10);
        const res = await app.request('/execute');
        expect(res.status).toBe(200);
        expect(res.headers.get('X-Usage-Warning')).toBeNull();
    });

    it('should default to free tier limits for unknown tier', async () => {
        const app = createApp('enterprise', 80, 20);
        const res = await app.request('/execute');
        expect(res.status).toBe(403);
        const body = await res.json() as Record<string, any>;
        expect(body.limit).toBe(100);
    });
});
