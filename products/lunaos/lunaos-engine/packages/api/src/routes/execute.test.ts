import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

function createExecuteApp(envOverrides: Record<string, any> = {}) {
    const env = {
        DB: { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run: vi.fn(), first: vi.fn() })) })) },
        ANTHROPIC_API_KEY: 'sk-ant-test',
        OPENHANDS_API_URL: 'http://exec.lunaos.ai',
        OPENHANDS_API_KEY: 'oh_test',
        ...envOverrides,
    };

    const app = new Hono();

    app.post('/execute', async (c) => {
        const body = await c.req.json().catch(() => ({}));
        const tier = c.req.header('x-tier') || 'free';

        if (tier === 'free') {
            return c.json({ error: 'Execution requires a Pro or Team plan' }, 403);
        }
        if (!body.agent || !body.context) {
            return c.json({ error: 'agent and context are required' }, 400);
        }
        if (!env.ANTHROPIC_API_KEY) {
            return c.json({ error: 'Anthropic API key not configured' }, 500);
        }
        if (!env.OPENHANDS_API_URL) {
            return c.json({ error: 'OpenHands execution backend not configured' }, 500);
        }

        return c.json({
            executionId: 'exec_1',
            agent: body.agent,
            output: 'Test execution result',
            toolCalls: [],
            iterations: 1,
            durationMs: 150,
        });
    });

    return app;
}

describe('POST /execute', () => {
    it('rejects free tier users', async () => {
        const app = createExecuteApp();
        const res = await app.request('/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-tier': 'free' },
            body: JSON.stringify({ agent: 'code-review', context: 'test' }),
        });
        expect(res.status).toBe(403);
        const body = await res.json() as any;
        expect(body.error).toContain('Pro or Team');
    });

    it('rejects missing agent or context', async () => {
        const app = createExecuteApp();
        const res = await app.request('/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-tier': 'pro' },
            body: JSON.stringify({ agent: 'code-review' }),
        });
        expect(res.status).toBe(400);
    });

    it('rejects when OpenHands not configured', async () => {
        const app = createExecuteApp({ OPENHANDS_API_URL: '' });
        const res = await app.request('/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-tier': 'pro' },
            body: JSON.stringify({ agent: 'code-review', context: 'review this' }),
        });
        expect(res.status).toBe(500);
        const body = await res.json() as any;
        expect(body.error).toContain('OpenHands');
    });

    it('rejects when Anthropic key not configured', async () => {
        const app = createExecuteApp({ ANTHROPIC_API_KEY: '' });
        const res = await app.request('/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-tier': 'pro' },
            body: JSON.stringify({ agent: 'code-review', context: 'review this' }),
        });
        expect(res.status).toBe(500);
        const body = await res.json() as any;
        expect(body.error).toContain('Anthropic');
    });

    it('returns execution result for pro user', async () => {
        const app = createExecuteApp();
        const res = await app.request('/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-tier': 'pro' },
            body: JSON.stringify({ agent: 'code-review', context: 'review this code' }),
        });
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.executionId).toBeDefined();
        expect(body.agent).toBe('code-review');
        expect(body.output).toBeDefined();
        expect(body.toolCalls).toEqual([]);
        expect(body.iterations).toBe(1);
    });

    it('returns execution result for team user', async () => {
        const app = createExecuteApp();
        const res = await app.request('/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-tier': 'team' },
            body: JSON.stringify({ agent: 'testing-validation', context: 'write tests' }),
        });
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.agent).toBe('testing-validation');
    });
});
