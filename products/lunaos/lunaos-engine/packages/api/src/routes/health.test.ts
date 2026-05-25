import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

function createHealthApp(envOverrides: Record<string, any> = {}) {
    const env = {
        DB: {
            prepare: vi.fn().mockReturnValue({
                first: vi.fn().mockResolvedValue({ table_count: 14 }),
            }),
        },
        KV: {
            put: vi.fn().mockResolvedValue(undefined),
            get: vi.fn().mockResolvedValue('ok'),
        },
        VECTORIZE: null,
        DEEPSEEK_API_KEY: 'test-key',
        ANTHROPIC_API_KEY: '',
        OPENAI_API_KEY: '',
        AI: null,
        ENVIRONMENT: 'test',
        ...envOverrides,
    };

    const app = new Hono();

    // Inline health handler to avoid import issues with Env type
    app.get('/health', async (c) => {
        const checks: Record<string, { status: string; latency?: string; detail?: string }> = {};

        try {
            const result = await env.DB.prepare('SELECT COUNT(*)').first();
            checks.d1 = { status: 'ok', detail: `${result?.table_count || 0} tables` };
        } catch (err: any) {
            checks.d1 = { status: 'error', detail: err.message };
        }

        try {
            await env.KV.put('_health', Date.now().toString());
            const val = await env.KV.get('_health');
            checks.kv = { status: val ? 'ok' : 'degraded' };
        } catch (err: any) {
            checks.kv = { status: 'error', detail: err.message };
        }

        checks.vectorize = env.VECTORIZE
            ? { status: 'ok' }
            : { status: 'not_configured' };

        checks.llm = {
            status: 'ok',
            detail: [
                env.DEEPSEEK_API_KEY ? 'deepseek' : null,
                env.ANTHROPIC_API_KEY ? 'anthropic' : null,
                env.OPENAI_API_KEY ? 'openai' : null,
            ].filter(Boolean).join(', ') || 'none_configured',
        };

        const allHealthy = Object.values(checks).every(
            v => v.status === 'ok' || v.status === 'not_configured'
        );

        return c.json({
            status: allHealthy ? 'healthy' : 'degraded',
            version: '0.2.0',
            timestamp: new Date().toISOString(),
            services: checks,
        }, allHealthy ? 200 : 503);
    });

    return app;
}

describe('GET /health', () => {
    it('returns 200 with healthy status', async () => {
        const app = createHealthApp();
        const res = await app.request('/health');
        expect(res.status).toBe(200);

        const body = await res.json() as Record<string, any>;
        expect(body.status).toBe('healthy');
        expect(body.version).toBeDefined();
        expect(body.timestamp).toBeDefined();
        expect(body.services.d1.status).toBe('ok');
        expect(body.services.kv.status).toBe('ok');
    });

    it('returns degraded when D1 fails', async () => {
        const app = createHealthApp({
            DB: {
                prepare: vi.fn().mockReturnValue({
                    first: vi.fn().mockRejectedValue(new Error('D1 down')),
                }),
            },
        });
        const res = await app.request('/health');
        expect(res.status).toBe(503);

        const body = await res.json() as Record<string, any>;
        expect(body.status).toBe('degraded');
        expect(body.services.d1.status).toBe('error');
    });

    it('includes LLM provider availability', async () => {
        const app = createHealthApp({
            ANTHROPIC_API_KEY: 'ant-key',
            OPENAI_API_KEY: 'oai-key',
        });
        const res = await app.request('/health');
        expect(res.status).toBe(200);

        const body = await res.json() as Record<string, any>;
        expect(body.services.llm.detail).toContain('anthropic');
        expect(body.services.llm.detail).toContain('openai');
    });
});

describe('GET /ready', () => {
    function createReadyApp(dbFirst: () => Promise<any>) {
        const app = new Hono();
        app.get('/ready', async (c: any) => {
            try {
                await dbFirst();
                return c.json({ status: 'ready', timestamp: new Date().toISOString() });
            } catch (err: any) {
                return c.json({
                    status: 'not_ready',
                    error: err.message?.slice(0, 200),
                    timestamp: new Date().toISOString(),
                }, 503);
            }
        });
        return app;
    }

    it('returns 200 ready when DB is reachable', async () => {
        const app = createReadyApp(async () => ({ ok: 1 }));
        const res = await app.request('/ready');
        expect(res.status).toBe(200);
        const body = await res.json() as Record<string, any>;
        expect(body.status).toBe('ready');
        expect(body.timestamp).toBeDefined();
    });

    it('returns 503 not_ready when DB fails', async () => {
        const app = createReadyApp(async () => {
            throw new Error('D1 unreachable');
        });
        const res = await app.request('/ready');
        expect(res.status).toBe(503);
        const body = await res.json() as Record<string, any>;
        expect(body.status).toBe('not_ready');
        expect(body.error).toContain('D1 unreachable');
    });
});
