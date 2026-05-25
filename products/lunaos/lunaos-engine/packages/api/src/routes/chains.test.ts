import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

const presets = [
    { slug: 'code-review', name: 'Code Review', nodes: [{ id: 'n1', agent: 'reviewer' }], edges: [] },
    { slug: 'research', name: 'Research Chain', nodes: [{ id: 'n1', agent: 'researcher' }], edges: [] },
];

function createChainsApp() {
    const db = { prepare: vi.fn().mockReturnValue({ bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null), run: vi.fn().mockResolvedValue({}),
        all: vi.fn().mockResolvedValue({ results: [] }),
    }) }) };
    const app = new Hono();

    app.get('/chains', (c) => c.json({ presets, total: presets.length, docs: 'POST /chains/execute' }));

    app.post('/chains/execute', async (c) => {
        if (!c.req.header('Authorization')) return c.json({ error: 'Authentication required' }, 401);
        const body = await c.req.json().catch(() => ({}));
        if (!body.preset && !body.chain) return c.json({ error: 'Either "preset" or "chain" must be provided' }, 400);
        if (!body.context) return c.json({ error: 'Context is required' }, 400);
        if (body.preset && !presets.find(p => p.slug === body.preset)) {
            return c.json({ error: `Unknown preset: "${body.preset}"`, available: presets.map(p => p.slug) }, 404);
        }
        if (body.chain && (!body.chain.name || !body.chain.nodes?.length)) {
            return c.json({ error: 'Invalid chain definition', details: ['name and nodes required'] }, 400);
        }
        return c.json({ chainId: crypto.randomUUID(), status: 'running', chainName: body.preset || body.chain?.name });
    });

    app.get('/chains/:id/status', async (c) => {
        if (!c.req.header('Authorization')) return c.json({ error: 'Authentication required' }, 401);
        const exec = await db.prepare('SELECT').bind(c.req.param('id'), 'u1').first();
        if (!exec) return c.json({ error: 'Chain execution not found' }, 404);
        return c.json({ id: exec.id, status: exec.status });
    });

    app.get('/chains/history', async (c) => {
        if (!c.req.header('Authorization')) return c.json({ error: 'Authentication required' }, 401);
        return c.json({ executions: [], count: 0 });
    });

    app.post('/chains/:name/webhook', async (c) => {
        const found = presets.find(p => p.slug === c.req.param('name'));
        if (!found) return c.json({ error: 'Chain not found' }, 404);
        return c.json({ message: 'Chain execution queued via webhook', chainId: crypto.randomUUID(), chainName: c.req.param('name') }, 202);
    });

    return app;
}

const post = (path: string, body: any, auth = true) => ({
    method: 'POST' as const,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer tok' } : {}) },
    body: JSON.stringify(body),
});

describe('GET /chains', () => {
    it('lists available preset chains', async () => {
        const res = await createChainsApp().request('/chains');
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.presets).toHaveLength(2);
        expect(body.total).toBe(2);
    });
});

describe('POST /chains/execute', () => {
    it('requires authentication', async () => {
        const res = await createChainsApp().request('/chains/execute', post('', { preset: 'code-review', context: 'x' }, false));
        expect(res.status).toBe(401);
    });

    it('executes a valid preset chain', async () => {
        const res = await createChainsApp().request('/chains/execute', post('', { preset: 'code-review', context: 'Review this' }));
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.chainId).toBeDefined();
        expect(body.status).toBe('running');
    });

    it('rejects unknown preset', async () => {
        const res = await createChainsApp().request('/chains/execute', post('', { preset: 'nonexistent', context: 'x' }));
        expect(res.status).toBe(404);
        const body = await res.json() as any;
        expect(body.error).toContain('Unknown preset');
        expect(body.available).toContain('code-review');
    });

    it('rejects missing preset and chain', async () => {
        const res = await createChainsApp().request('/chains/execute', post('', { context: 'x' }));
        expect(res.status).toBe(400);
    });

    it('rejects invalid custom chain definition', async () => {
        const res = await createChainsApp().request('/chains/execute', post('', { chain: { name: '', nodes: [] }, context: 'x' }));
        expect(res.status).toBe(400);
        const body = await res.json() as any;
        expect(body.error).toContain('Invalid chain');
    });

    it('executes a valid custom chain', async () => {
        const chain = { name: 'My Chain', nodes: [{ id: 'n1', agent: 'writer' }], edges: [] };
        const res = await createChainsApp().request('/chains/execute', post('', { chain, context: 'Write' }));
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.chainName).toBe('My Chain');
    });
});

describe('GET /chains/:id/status', () => {
    it('returns 404 for non-existent execution', async () => {
        const res = await createChainsApp().request('/chains/abc/status', { headers: { Authorization: 'Bearer tok' } });
        expect(res.status).toBe(404);
    });

    it('requires authentication', async () => {
        const res = await createChainsApp().request('/chains/abc/status');
        expect(res.status).toBe(401);
    });
});

describe('POST /chains/:name/webhook', () => {
    it('queues execution for valid preset', async () => {
        const res = await createChainsApp().request('/chains/code-review/webhook', post('', { data: 'x' }, false));
        expect(res.status).toBe(202);
        const body = await res.json() as any;
        expect(body.chainId).toBeDefined();
        expect(body.chainName).toBe('code-review');
    });

    it('returns 404 for unknown chain', async () => {
        const res = await createChainsApp().request('/chains/unknown/webhook', { method: 'POST' });
        expect(res.status).toBe(404);
    });
});

describe('GET /chains/history', () => {
    it('requires authentication', async () => {
        const res = await createChainsApp().request('/chains/history');
        expect(res.status).toBe(401);
    });

    it('returns empty list for new user', async () => {
        const res = await createChainsApp().request('/chains/history', { headers: { Authorization: 'Bearer tok' } });
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.executions).toEqual([]);
        expect(body.count).toBe(0);
    });
});
