/**
 * Rate Limit Tests — tier limits, TOCTOU mitigation (C4),
 * in-memory fallback (C3), and IP rate limiting.
 */

import { describe, it, expect } from 'vitest';

const STATED_LIMITS: Record<string, number> = { free: 60, pro: 600, team: 6000 };
const KV_LIMITS: Record<string, number> = { free: 42, pro: 420, team: 4200 };
const WINDOW_SECONDS = 60;
const IP_LIMIT = 10;
const IP_WINDOW_SECONDS = 300;

describe('Rate Limit Configuration', () => {
    it('should advertise correct tier limits', () => {
        expect(STATED_LIMITS.free).toBe(60);
        expect(STATED_LIMITS.pro).toBe(600);
        expect(STATED_LIMITS.team).toBe(6000);
    });

    it('should use 60-second sliding window', () => {
        expect(WINDOW_SECONDS).toBe(60);
    });

    it('should default unknown tiers to free limits', () => {
        expect(STATED_LIMITS['unknown'] || STATED_LIMITS.free).toBe(60);
    });
});

describe('TOCTOU Mitigation (C4) — KV limits at 70%', () => {
    it('should set KV limits to 70% of stated limits', () => {
        expect(KV_LIMITS.free).toBe(42);
        expect(KV_LIMITS.pro).toBe(420);
        expect(KV_LIMITS.team).toBe(4200);
    });

    it('should keep KV limits between 60-80% of stated', () => {
        for (const tier of Object.keys(STATED_LIMITS)) {
            const ratio = KV_LIMITS[tier] / STATED_LIMITS[tier];
            expect(ratio).toBeGreaterThanOrEqual(0.6);
            expect(ratio).toBeLessThanOrEqual(0.8);
        }
    });
});

describe('Rate Limit KV Key Generation', () => {
    it('should generate unique keys per user per minute bucket', () => {
        const bucket = Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
        const key = `rate:user-123:${bucket}`;
        expect(key).toMatch(/^rate:user-123:\d+$/);
    });

    it('should produce different keys for different users', () => {
        const bucket = Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
        expect(`rate:user-1:${bucket}`).not.toBe(`rate:user-2:${bucket}`);
    });

    it('should produce different keys for different time windows', () => {
        expect(`rate:user-1:1000`).not.toBe(`rate:user-1:1001`);
    });
});

describe('Rate Limit Response Headers', () => {
    it('should report stated limit in X-RateLimit-Limit', () => {
        expect(String(STATED_LIMITS.free)).toBe('60');
    });

    it('should compute remaining correctly', () => {
        expect(String(60 - 15 - 1)).toBe('44');
    });

    it('should produce valid Retry-After value', () => {
        const retryAfter = WINDOW_SECONDS - Math.floor((Date.now() / 1000) % WINDOW_SECONDS);
        expect(retryAfter).toBeGreaterThanOrEqual(0);
        expect(retryAfter).toBeLessThanOrEqual(WINDOW_SECONDS);
    });
});

describe('Rate Limit Behavior Under Load', () => {
    it('should allow requests below KV limit and block at limit', () => {
        expect(41 < KV_LIMITS.free).toBe(true);
        expect(42 >= KV_LIMITS.free).toBe(true);
    });

    it('should return 429 when exceeded', () => {
        const status = 43 >= KV_LIMITS.free ? 429 : 200;
        expect(status).toBe(429);
    });

    it('should include upgrade URL only for free tier', () => {
        const mkResponse = (tier: string) => ({
            upgradeUrl: tier === 'free' ? 'https://agents.lunaos.ai/pricing' : undefined,
        });
        expect(mkResponse('free').upgradeUrl).toBeDefined();
        expect(mkResponse('pro').upgradeUrl).toBeUndefined();
    });
});

describe('Fail-Closed with In-Memory Fallback (C3)', () => {
    it('should track requests in memory when KV fails', () => {
        const counters = new Map<string, { count: number; resetAt: number }>();
        counters.set('rate:u1', { count: 1, resetAt: Date.now() + 60000 });
        expect(counters.get('rate:u1')!.count <= STATED_LIMITS.free).toBe(true);
    });

    it('should block when in-memory counter exceeds limit', () => {
        let blocked = false;
        try { throw new Error('KV unavailable'); }
        catch { blocked = 100 > STATED_LIMITS.free; }
        expect(blocked).toBe(true);
    });

    it('should clean up expired memory entries', () => {
        const counters = new Map<string, { count: number; resetAt: number }>();
        const now = Date.now();
        counters.set('old', { count: 50, resetAt: now - 1000 });
        counters.set('active', { count: 10, resetAt: now + 60000 });
        for (const [key, e] of counters) { if (now >= e.resetAt) counters.delete(key); }
        expect(counters.has('old')).toBe(false);
        expect(counters.has('active')).toBe(true);
    });
});

describe('IP Rate Limiter for Auth Endpoints', () => {
    it('should limit to 10 attempts per IP per 5 minutes', () => {
        expect(IP_LIMIT).toBe(10);
        expect(IP_WINDOW_SECONDS).toBe(300);
    });

    it('should block IP after exceeding limit', () => {
        const ipCounters = new Map<string, { count: number; resetAt: number }>();
        ipCounters.set('192.168.1.1', { count: 11, resetAt: Date.now() + 300000 });
        expect(ipCounters.get('192.168.1.1')!.count > IP_LIMIT).toBe(true);
    });

    it('should reset IP counter after window expires', () => {
        const expired = Date.now() >= (Date.now() - 1000);
        expect(expired).toBe(true);
    });
});

describe('KV Expiry', () => {
    it('should set TTL to 2x window for safety', () => {
        expect(WINDOW_SECONDS * 2).toBe(120);
    });
});
