/**
 * LunaOS API — Extended Module Tests
 * Coverage for billing, api-keys, github, telemetry, chains, services, and kb
 */

import {
    billingApi,
    apiKeysApi,
    githubApi,
    telemetryApi,
    chainsApi,
    servicesApi,
    kbApi,
} from '../api';

// ── Helpers ──────────────────────────────────────────────

function mockFetch(data: unknown, ok = true, status = 200) {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok,
        status,
        json: () => Promise.resolve(data),
    });
}

function mockFetchRaw(overrides: Partial<Response>) {
    (global.fetch as jest.Mock).mockResolvedValueOnce(overrides);
}

function lastFetchUrl(): string {
    return (global.fetch as jest.Mock).mock.calls.at(-1)![0];
}

function lastFetchOptions(): RequestInit {
    return (global.fetch as jest.Mock).mock.calls.at(-1)![1];
}

// ═══════════════════════════════════════════════════════════
//  billingApi
// ═══════════════════════════════════════════════════════════

describe('billingApi', () => {
    test('checkout sends POST with tier', async () => {
        mockFetch({ checkoutUrl: 'https://lunaos.lemonsqueezy.com/checkout/buy/var_pro' });

        const result = await billingApi.checkout('pro');

        expect(lastFetchUrl()).toContain('/billing/checkout');
        expect(lastFetchOptions().method).toBe('POST');
        expect(JSON.parse(lastFetchOptions().body as string)).toEqual({ tier: 'pro' });
        expect(result.checkoutUrl).toContain('lemonsqueezy');
    });

    test('subscription fetches current plan', async () => {
        mockFetch({ tier: 'pro', status: 'active', subscription: { id: 'sub_1', currentPeriodStart: '2026-01-01', currentPeriodEnd: '2026-02-01', cancelAtPeriodEnd: false, createdAt: '2025-12-01' } });

        const result = await billingApi.subscription();

        expect(lastFetchUrl()).toContain('/billing/subscription');
        expect(result.tier).toBe('pro');
        expect(result.subscription?.id).toBe('sub_1');
    });

    test('usage returns consumption metrics', async () => {
        const usage = { tier: 'pro', used: 500, limit: 10000, remaining: 9500, percentUsed: 5, period: { start: '2026-01-01', end: '2026-02-01' } };
        mockFetch(usage);

        const result = await billingApi.usage();

        expect(lastFetchUrl()).toContain('/billing/usage');
        expect(result.remaining).toBe(9500);
    });

    test('cancel sends POST', async () => {
        mockFetch({ success: true });

        await billingApi.cancel();

        expect(lastFetchUrl()).toContain('/billing/cancel');
        expect(lastFetchOptions().method).toBe('POST');
    });
});

// ═══════════════════════════════════════════════════════════
//  apiKeysApi
// ═══════════════════════════════════════════════════════════

describe('apiKeysApi', () => {
    test('create sends POST with name and returns full key', async () => {
        mockFetch({ id: 'k_1', name: 'ci-key', key: 'luna_sk_abc123...', prefix: 'luna_sk_abc', createdAt: '2026-03-15' });

        const result = await apiKeysApi.create('ci-key');

        expect(lastFetchUrl()).toContain('/api-keys');
        expect(lastFetchOptions().method).toBe('POST');
        expect(JSON.parse(lastFetchOptions().body as string)).toEqual({ name: 'ci-key' });
        expect(result.key).toContain('luna_sk_');
    });

    test('list returns keys without secrets', async () => {
        mockFetch({ keys: [{ id: 'k_1', name: 'ci-key', prefix: 'luna_sk_abc', createdAt: '2026-03-15', lastUsedAt: null }] });

        const result = await apiKeysApi.list();

        expect(lastFetchUrl()).toContain('/api-keys');
        expect(result.keys).toHaveLength(1);
        expect(result.keys[0].name).toBe('ci-key');
    });

    test('revoke sends DELETE with key id', async () => {
        mockFetch({ success: true });

        await apiKeysApi.revoke('k_1');

        expect(lastFetchUrl()).toContain('/api-keys/k_1');
        expect(lastFetchOptions().method).toBe('DELETE');
    });
});

// ═══════════════════════════════════════════════════════════
//  githubApi
// ═══════════════════════════════════════════════════════════

describe('githubApi', () => {
    test('status returns connection info', async () => {
        mockFetch({ connected: true, username: 'shahar', githubId: '12345', scopes: 'repo,read:org' });

        const result = await githubApi.status();

        expect(lastFetchUrl()).toContain('/github/status');
        expect(result.connected).toBe(true);
        expect(result.username).toBe('shahar');
    });

    test('getAuthUrl returns OAuth URL', async () => {
        mockFetch({ url: 'https://github.com/login/oauth/authorize?client_id=abc' });

        const result = await githubApi.getAuthUrl();

        expect(lastFetchUrl()).toContain('/github/auth');
        expect(result.url).toContain('github.com');
    });

    test('repos paginates with page param', async () => {
        mockFetch({ repos: [{ id: 1, name: 'lunaos', fullName: 'shahar/lunaos' }], page: 2, perPage: 30, total: 50 });

        const result = await githubApi.repos(2);

        expect(lastFetchUrl()).toContain('page=2');
        expect(result.repos).toHaveLength(1);
        expect(result.total).toBe(50);
    });

    test('indexRepo sends POST to correct path', async () => {
        mockFetch({ success: true, repo: 'shahar/lunaos', totalSourceFiles: 100, indexedFiles: 95, processed: 95, failed: 5, processingTime: 3200, skipped: 0 });

        const result = await githubApi.indexRepo('shahar', 'lunaos');

        expect(lastFetchUrl()).toContain('/github/repos/shahar/lunaos/index');
        expect(lastFetchOptions().method).toBe('POST');
        expect(result.success).toBe(true);
    });

    test('indexed lists indexed repos', async () => {
        mockFetch({ repos: [{ fullName: 'shahar/lunaos', fileCount: 95, indexedAt: '2026-03-15' }] });

        const result = await githubApi.indexed();

        expect(lastFetchUrl()).toContain('/github/indexed');
        expect(result.repos).toHaveLength(1);
    });

    test('disconnect sends DELETE', async () => {
        mockFetch({ success: true });

        const result = await githubApi.disconnect();

        expect(lastFetchUrl()).toContain('/github/disconnect');
        expect(lastFetchOptions().method).toBe('DELETE');
        expect(result.success).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════
//  telemetryApi
// ═══════════════════════════════════════════════════════════

describe('telemetryApi', () => {
    test('overview fetches aggregate metrics', async () => {
        const metrics = {
            data: {
                totalExecutions: 1200,
                uniqueUsers: 42,
                avgDurationMs: 2500,
                errorRate: 0.03,
                topAgents: [],
                topProviders: [],
                dailyActiveUsers: 15,
                weeklyActiveUsers: 38,
            },
        };
        mockFetch(metrics);

        const result = await telemetryApi.overview();

        expect(lastFetchUrl()).toContain('/telemetry/overview');
        expect(result.totalExecutions).toBe(1200);
        expect(result.errorRate).toBe(0.03);
    });

    test('overview passes since query param', async () => {
        mockFetch({ data: { totalExecutions: 0, uniqueUsers: 0, avgDurationMs: 0, errorRate: 0, topAgents: [], topProviders: [], dailyActiveUsers: 0, weeklyActiveUsers: 0 } });

        await telemetryApi.overview('2026-03-01');

        expect(lastFetchUrl()).toContain('since=2026-03-01');
    });

    test('agents returns per-agent stats', async () => {
        mockFetch({ data: [{ agent: 'code-review', totalExecutions: 300, avgDurationMs: 1800, errorRate: 0.01, lastUsed: '2026-03-15' }] });

        const result = await telemetryApi.agents();

        expect(lastFetchUrl()).toContain('/telemetry/agents');
        expect(result).toHaveLength(1);
        expect(result[0].agent).toBe('code-review');
    });

    test('agents defaults to empty array when data is null', async () => {
        mockFetch({ data: null });

        const result = await telemetryApi.agents();

        expect(result).toEqual([]);
    });

    test('providers returns per-provider stats', async () => {
        mockFetch({ data: [{ provider: 'deepseek', model: 'deepseek-chat', totalCalls: 800, avgDurationMs: 2200, totalInputTokens: 50000, totalOutputTokens: 30000 }] });

        const result = await telemetryApi.providers();

        expect(lastFetchUrl()).toContain('/telemetry/providers');
        expect(result[0].totalCalls).toBe(800);
    });
});

// ═══════════════════════════════════════════════════════════
//  chainsApi
// ═══════════════════════════════════════════════════════════

describe('chainsApi', () => {
    test('listPresets fetches available chains', async () => {
        mockFetch({ presets: [{ slug: 'full-review', name: 'Full Review', description: 'Review + test', nodeCount: 3, agents: ['code-review', 'test-gen', 'security-scan'] }], total: 1 });

        const result = await chainsApi.listPresets();

        expect(lastFetchUrl()).toContain('/chains');
        expect(result.presets).toHaveLength(1);
        expect(result.presets[0].agents).toContain('code-review');
    });

    test('execute sends POST with preset and context', async () => {
        mockFetchRaw({ ok: true, body: null } as any);

        const result = await chainsApi.execute('full-review', 'function sum(a,b){return a+b}');

        expect(lastFetchUrl()).toContain('/chains/execute');
        expect(lastFetchOptions().method).toBe('POST');
        const body = JSON.parse(lastFetchOptions().body as string);
        expect(body.preset).toBe('full-review');
        expect(body.context).toContain('sum');
    });

    test('execute includes optional provider/model', async () => {
        mockFetchRaw({ ok: true, body: null } as any);

        await chainsApi.execute('full-review', 'ctx', { provider: 'anthropic', model: 'claude-3-opus' });

        const body = JSON.parse(lastFetchOptions().body as string);
        expect(body.provider).toBe('anthropic');
        expect(body.model).toBe('claude-3-opus');
    });

    test('resume sends POST to chain id', async () => {
        mockFetchRaw({ ok: true, body: null } as any);

        await chainsApi.resume('exec-abc', 'additional context');

        expect(lastFetchUrl()).toContain('/chains/exec-abc/resume');
        expect(lastFetchOptions().method).toBe('POST');
    });

    test('history fetches with pagination', async () => {
        mockFetch({ executions: [], count: 0 });

        await chainsApi.history(10, 5);

        expect(lastFetchUrl()).toContain('limit=10');
        expect(lastFetchUrl()).toContain('offset=5');
    });

    test('status fetches chain execution status', async () => {
        mockFetch({ id: 'exec-1', status: 'running', currentNode: 2, totalNodes: 4 });

        const result = await chainsApi.status('exec-1');

        expect(lastFetchUrl()).toContain('/chains/exec-1/status');
        expect(result.status).toBe('running');
    });
});

// ═══════════════════════════════════════════════════════════
//  servicesApi
// ═══════════════════════════════════════════════════════════

describe('servicesApi', () => {
    test('catalog fetches all services', async () => {
        mockFetch({ services: [{ id: 's1', name: 'GitHub', tier: 'core', status: 'active' }], total: 1, byTier: { core: 1, integration: 0, premium: 0 }, timestamp: '2026-03-15' });

        const result = await servicesApi.catalog();

        expect(lastFetchUrl()).toContain('/openclaw/services');
        expect(result.total).toBe(1);
    });

    test('detail fetches single service', async () => {
        mockFetch({ service: { id: 's1', name: 'GitHub' }, detail: { repos: 5 } });

        const result = await servicesApi.detail('github');

        expect(lastFetchUrl()).toContain('/openclaw/services/github');
        expect(result.service.name).toBe('GitHub');
    });

    test('updatePreferences sends PATCH', async () => {
        mockFetch({ success: true });

        await servicesApi.updatePreferences('github', { autoIndex: true });

        expect(lastFetchUrl()).toContain('/openclaw/services/github');
        expect(lastFetchOptions().method).toBe('PATCH');
        expect(JSON.parse(lastFetchOptions().body as string)).toEqual({ autoIndex: true });
    });

    test('test sends POST to service test endpoint', async () => {
        mockFetch({ service: 'github', healthy: true, checks: {}, totalLatency: '120ms' });

        const result = await servicesApi.test('github');

        expect(lastFetchUrl()).toContain('/openclaw/services/github/test');
        expect(lastFetchOptions().method).toBe('POST');
        expect(result.healthy).toBe(true);
    });

    test('health returns aggregate health', async () => {
        mockFetch({ status: 'healthy', latency: '45ms', checks: {}, serviceCount: 5, timestamp: '2026-03-15' });

        const result = await servicesApi.health();

        expect(lastFetchUrl()).toContain('/openclaw/services/health');
        expect(result.status).toBe('healthy');
    });

    describe('channels', () => {
        test('types fetches channel types', async () => {
            mockFetch({ types: ['slack', 'discord', 'email'] });

            await servicesApi.channels.types();

            expect(lastFetchUrl()).toContain('/openclaw/services/channels/types');
        });

        test('connections lists active connections', async () => {
            mockFetch({ connections: [{ id: 'c1', channel_type: 'slack', label: 'Team', status: 'active' }] });

            const result = await servicesApi.channels.connections();

            expect(result.connections).toHaveLength(1);
        });

        test('connect sends POST with channel config', async () => {
            mockFetch({ success: true, connectionId: 'c2' });

            await servicesApi.channels.connect('slack', { webhookUrl: 'https://hooks.slack.com/...' });

            expect(lastFetchUrl()).toContain('/openclaw/services/channels/connect');
            expect(lastFetchOptions().method).toBe('POST');
            const body = JSON.parse(lastFetchOptions().body as string);
            expect(body.channelType).toBe('slack');
            expect(body.webhookUrl).toBeDefined();
        });

        test('disconnect sends DELETE', async () => {
            mockFetch({ success: true });

            await servicesApi.channels.disconnect('c1');

            expect(lastFetchUrl()).toContain('/openclaw/services/channels/c1');
            expect(lastFetchOptions().method).toBe('DELETE');
        });

        test('test sends POST to connection', async () => {
            mockFetch({ success: true, latency: '200ms' });

            await servicesApi.channels.test('c1');

            expect(lastFetchUrl()).toContain('/openclaw/services/channels/c1/test');
            expect(lastFetchOptions().method).toBe('POST');
        });

        test('stats fetches connection metrics', async () => {
            mockFetch({ messageCount: 150, lastMessageAt: '2026-03-15' });

            await servicesApi.channels.stats('c1');

            expect(lastFetchUrl()).toContain('/openclaw/services/channels/c1/stats');
        });
    });

    test('providers returns provider status', async () => {
        mockFetch({ providers: [{ id: 'p1', name: 'DeepSeek', model: 'deepseek-chat', configured: true }], defaultProvider: 'deepseek' });

        const result = await servicesApi.providers();

        expect(lastFetchUrl()).toContain('/openclaw/services/providers/status');
        expect(result.defaultProvider).toBe('deepseek');
    });
});

// ═══════════════════════════════════════════════════════════
//  kbApi
// ═══════════════════════════════════════════════════════════

describe('kbApi', () => {
    test('list returns documents', async () => {
        mockFetch({ documents: [{ id: 'd1', title: 'Architecture Guide', created_at: '2026-03-10' }] });

        const result = await kbApi.list();

        expect(lastFetchUrl()).toContain('/kb');
        expect(result.documents).toHaveLength(1);
        expect(result.documents[0].title).toBe('Architecture Guide');
    });

    test('upload sends POST with content and optional tags', async () => {
        mockFetch({ id: 'd2', success: true });

        await kbApi.upload('API Reference', '# API\nEndpoints...', ['api', 'docs']);

        expect(lastFetchUrl()).toContain('/kb/upload');
        expect(lastFetchOptions().method).toBe('POST');
        const body = JSON.parse(lastFetchOptions().body as string);
        expect(body.title).toBe('API Reference');
        expect(body.content).toContain('# API');
        expect(body.tags).toEqual(['api', 'docs']);
    });

    test('upload works without tags', async () => {
        mockFetch({ id: 'd3', success: true });

        await kbApi.upload('Quick Note', 'Some content');

        const body = JSON.parse(lastFetchOptions().body as string);
        expect(body.tags).toBeUndefined();
    });

    test('delete sends DELETE with document id', async () => {
        mockFetch({ success: true });

        await kbApi.delete('d1');

        expect(lastFetchUrl()).toContain('/kb/d1');
        expect(lastFetchOptions().method).toBe('DELETE');
    });
});
