/**
 * OpenClaw Integration Tests — comprehensive tests for all /openclaw/* routes
 *
 * Tests: tool registry, tool routes (run/chain/search/index),
 *        analytics, gateway management, service layer, schemas
 *
 * Uses Hono's app.fetch() for in-process testing (no server needed)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/worker';

// --- Mock Cloudflare D1 with OpenClaw tables ---

function createMockD1() {
    const users: any[] = [];
    const executions: any[] = [];
    const ocGateways: any[] = [];
    const ocSessions: any[] = [];
    const ocSkillExecs: any[] = [];
    const chunks: any[] = [];

    function makeStatement(sql: string, boundArgs: any[] = []) {
        return {
            bind: (...args: any[]) => makeStatement(sql, args),
            first: async <T = any>(): Promise<T | null> => {
                if (sql.includes('SELECT 1')) return { ok: 1 } as any;
                if (sql.includes('FROM users WHERE email')) {
                    return (users.find(u => u.email === boundArgs[0]) || null) as T | null;
                }
                if (sql.includes('FROM users WHERE id')) {
                    return (users.find(u => u.id === boundArgs[0]) || null) as T | null;
                }
                if (sql.includes('SELECT id FROM users')) {
                    return (users.find(u => u.email === boundArgs[0]) || null) as T | null;
                }
                if (sql.includes('COUNT(*)') && sql.includes('openclaw_skill_executions')) {
                    const userId = boundArgs[0];
                    const filtered = ocSkillExecs.filter(e => e.user_id === userId);
                    return { count: filtered.length } as any;
                }
                if (sql.includes('AVG(duration_ms)') && sql.includes('openclaw_skill_executions')) {
                    return { avg_ms: 500 } as any;
                }
                return null;
            },
            run: async () => {
                if (sql.includes('INSERT INTO users')) {
                    users.push({
                        id: boundArgs[0], email: boundArgs[1], name: boundArgs[2],
                        password_hash: boundArgs[3], tier: boundArgs[4] || 'free',
                        created_at: boundArgs[5], updated_at: boundArgs[6],
                    });
                }
                if (sql.includes('INSERT INTO executions')) {
                    executions.push({
                        id: boundArgs[0], user_id: boundArgs[1], agent: boundArgs[2],
                        provider: boundArgs[3], model: boundArgs[4],
                    });
                }
                if (sql.includes('INSERT INTO openclaw_gateways') || sql.includes('INTO openclaw_gateways')) {
                    ocGateways.push({
                        id: boundArgs[0], user_id: boundArgs[1], gateway_url: boundArgs[2],
                        label: boundArgs[3], status: boundArgs[4], health_status: boundArgs[5],
                        metadata: boundArgs[6],
                    });
                }
                if (sql.includes('INSERT INTO openclaw_sessions') || sql.includes('INTO openclaw_sessions')) {
                    ocSessions.push({
                        id: boundArgs[0], user_id: boundArgs[1], gateway_id: boundArgs[2],
                        session_key: boundArgs[3], run_id: boundArgs[4],
                        agent: boundArgs[5], agent_name: boundArgs[6],
                        model: boundArgs[7], task_summary: boundArgs[8],
                        status: 'spawned',
                    });
                }
                if (sql.includes('INSERT INTO openclaw_skill_executions') || sql.includes('INTO openclaw_skill_executions')) {
                    ocSkillExecs.push({
                        id: boundArgs[0], user_id: boundArgs[1], skill_name: boundArgs[2],
                        agent_slug: boundArgs[3], provider: boundArgs[4],
                        input_length: boundArgs[5], output_length: boundArgs[6],
                        duration_ms: boundArgs[7], status: boundArgs[8],
                        error: boundArgs[9], source: boundArgs[10],
                    });
                }
                if (sql.includes('UPDATE openclaw_gateways') && sql.includes('deleted')) {
                    const idx = ocGateways.findIndex(g => g.id === boundArgs[0] && g.user_id === boundArgs[1]);
                    if (idx >= 0) ocGateways[idx].status = 'deleted';
                    return { meta: { changes: idx >= 0 ? 1 : 0 } };
                }
                if (sql.includes('UPDATE executions SET')) {
                    // token tracking update - non-critical
                }
                return { success: true, meta: { changes: 1 } };
            },
            all: async () => {
                if (sql.includes('FROM executions')) {
                    const filtered = executions.filter(e => e.user_id === boundArgs[0]);
                    return { results: filtered };
                }
                if (sql.includes('FROM openclaw_gateways')) {
                    const filtered = ocGateways.filter(g => g.user_id === boundArgs[0] && g.status !== 'deleted');
                    return { results: filtered };
                }
                if (sql.includes('FROM openclaw_sessions')) {
                    const filtered = ocSessions.filter(s => s.user_id === boundArgs[0]);
                    return { results: filtered };
                }
                if (sql.includes('FROM openclaw_skill_executions') && sql.includes('GROUP BY skill_name')) {
                    const bySkill: Record<string, number> = {};
                    ocSkillExecs.filter(e => e.user_id === boundArgs[0]).forEach(e => {
                        bySkill[e.skill_name] = (bySkill[e.skill_name] || 0) + 1;
                    });
                    return { results: Object.entries(bySkill).map(([skill_name, count]) => ({ skill_name, count })) };
                }
                if (sql.includes('FROM openclaw_skill_executions') && sql.includes('GROUP BY agent_slug')) {
                    const byAgent: Record<string, number> = {};
                    ocSkillExecs.filter(e => e.user_id === boundArgs[0] && e.agent_slug).forEach(e => {
                        byAgent[e.agent_slug] = (byAgent[e.agent_slug] || 0) + 1;
                    });
                    return { results: Object.entries(byAgent).map(([agent_slug, count]) => ({ agent_slug, count })) };
                }
                if (sql.includes('FROM openclaw_skill_executions') && sql.includes('GROUP BY provider')) {
                    const byProvider: Record<string, number> = {};
                    ocSkillExecs.filter(e => e.user_id === boundArgs[0]).forEach(e => {
                        byProvider[e.provider] = (byProvider[e.provider] || 0) + 1;
                    });
                    return { results: Object.entries(byProvider).map(([provider, count]) => ({ provider, count })) };
                }
                if (sql.includes('FROM chunks')) {
                    return { results: [] };
                }
                return { results: [] };
            },
        };
    }

    return {
        prepare: (sql: string) => makeStatement(sql),
        _users: users,
        _executions: executions,
        _ocGateways: ocGateways,
        _ocSessions: ocSessions,
        _ocSkillExecs: ocSkillExecs,
    };
}

function createMockKV() {
    const store = new Map<string, string>();
    return {
        get: async (key: string) => store.get(key) || null,
        put: async (key: string, value: string, _opts?: any) => { store.set(key, value); },
        delete: async (key: string) => { store.delete(key); },
        _store: store,
    };
}

function createEnv(overrides: Record<string, any> = {}) {
    return {
        DB: createMockD1() as any,
        KV: createMockKV() as any,
        JWT_SECRET: 'test-jwt-secret-for-testing-only-32chars!!',
        ENVIRONMENT: 'development',
        DEEPSEEK_API_KEY: 'test-deepseek-key',
        ...overrides,
    };
}

function request(method: string, path: string, body?: any, headers?: Record<string, string>) {
    const opts: RequestInit = {
        method,
        headers: { ...headers },
    };
    if (body) {
        (opts.headers as Record<string, string>)['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    }
    return new Request(`http://localhost${path}`, opts);
}

async function getToken(env: any, email = 'user@test.com') {
    const res = await app.fetch(
        request('POST', '/auth/signup', { email, password: 'password123', name: 'Test' }),
        env,
    );
    const data = await res.json() as any;
    return data.token;
}

// =============================================================
// OPENCLAW TOOLS — LIST
// =============================================================
describe('GET /openclaw/tools — Tool Registry', () => {
    it('returns list of all available tools', async () => {
        const env = createEnv();
        const res = await app.fetch(request('GET', '/openclaw/tools'), env);
        expect(res.status).toBe(200);

        const data = await res.json() as any;
        expect(data.tools).toBeInstanceOf(Array);
        expect(data.total).toBeGreaterThanOrEqual(4);
        expect(data.protocol).toBe('openclaw-compatible');
        expect(data.version).toBeDefined();

        // Verify core tools exist
        const toolNames = data.tools.map((t: any) => t.name);
        expect(toolNames).toContain('luna_run');
        expect(toolNames).toContain('luna_chain');
        expect(toolNames).toContain('luna_search');
        expect(toolNames).toContain('luna_index');
        expect(toolNames).toContain('luna_status');
        expect(toolNames).toContain('luna_agents');
    });

    it('tool definitions have required structure', async () => {
        const env = createEnv();
        const res = await app.fetch(request('GET', '/openclaw/tools'), env);
        const data = await res.json() as any;

        for (const tool of data.tools) {
            expect(tool.name).toBeDefined();
            expect(typeof tool.name).toBe('string');
            expect(tool.description).toBeDefined();
            expect(typeof tool.description).toBe('string');
            expect(tool.parameters).toBeDefined();
        }
    });

    it('luna_run tool has correct agent enum', async () => {
        const env = createEnv();
        const res = await app.fetch(request('GET', '/openclaw/tools'), env);
        const data = await res.json() as any;

        const lunaRun = data.tools.find((t: any) => t.name === 'luna_run');
        expect(lunaRun).toBeDefined();
        expect(lunaRun.parameters.agent).toBeDefined();
        expect(lunaRun.parameters.agent.required).toBe(true);
        expect(lunaRun.parameters.agent.enum).toContain('code-review');
        expect(lunaRun.parameters.agent.enum).toContain('365-security');
    });
});

// =============================================================
// OPENCLAW TOOLS — AGENTS LIST
// =============================================================
describe('GET /openclaw/tools/agents — Agent catalog', () => {
    it('returns list of all agents with tiers', async () => {
        const env = createEnv();
        const res = await app.fetch(request('GET', '/openclaw/tools/agents'), env);
        expect(res.status).toBe(200);

        const data = await res.json() as any;
        expect(data.agents).toBeInstanceOf(Array);
        expect(data.total).toBe(28);
        expect(data.free).toBe(6);
        expect(data.pro).toBe(22);
    });

    it('each agent has slug, name, category, tier', async () => {
        const env = createEnv();
        const res = await app.fetch(request('GET', '/openclaw/tools/agents'), env);
        const data = await res.json() as any;

        for (const agent of data.agents) {
            expect(agent.slug).toBeDefined();
            expect(agent.name).toBeDefined();
            expect(agent.category).toBeDefined();
            expect(agent.tier).toMatch(/^(free|pro)$/);
        }
    });
});

// =============================================================
// OPENCLAW TOOLS — CHAINS LIST
// =============================================================
describe('GET /openclaw/tools/chains — Chain catalog', () => {
    it('returns list of chain presets', async () => {
        const env = createEnv();
        const res = await app.fetch(request('GET', '/openclaw/tools/chains'), env);
        expect(res.status).toBe(200);

        const data = await res.json() as any;
        expect(data.presets).toBeInstanceOf(Array);
        expect(data.total).toBe(5);
    });

    it('presets have correct structure', async () => {
        const env = createEnv();
        const res = await app.fetch(request('GET', '/openclaw/tools/chains'), env);
        const data = await res.json() as any;

        const slugs = data.presets.map((p: any) => p.slug);
        expect(slugs).toContain('full-review');
        expect(slugs).toContain('security-audit');
        expect(slugs).toContain('deploy');
        expect(slugs).toContain('new-feature');
        expect(slugs).toContain('api-design');

        for (const preset of data.presets) {
            expect(preset.slug).toBeDefined();
            expect(preset.name).toBeDefined();
            expect(preset.description).toBeDefined();
            expect(preset.nodeCount).toBeGreaterThanOrEqual(2);
            expect(preset.agents).toBeInstanceOf(Array);
        }
    });
});

// =============================================================
// OPENCLAW TOOLS — RUN (POST)
// =============================================================
describe('POST /openclaw/tools/run — Agent execution', () => {
    let env: any;
    beforeEach(() => { env = createEnv(); });

    it('requires auth → 401 without token', async () => {
        const res = await app.fetch(
            request('POST', '/openclaw/tools/run', { agent: 'code-review', context: 'test' }),
            env,
        );
        expect(res.status).toBe(401);
    });

    it('rejects missing agent → 400', async () => {
        const token = await getToken(env);
        const res = await app.fetch(
            request('POST', '/openclaw/tools/run',
                { context: 'test' },
                { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(400);
    });

    it('rejects missing context → 400', async () => {
        const token = await getToken(env);
        const res = await app.fetch(
            request('POST', '/openclaw/tools/run',
                { agent: 'code-review' },
                { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(400);
    });

    it('rejects unknown agent → 404', async () => {
        const token = await getToken(env);
        const res = await app.fetch(
            request('POST', '/openclaw/tools/run',
                { agent: 'nonexistent-agent', context: 'test' },
                { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(404);

        const data = await res.json() as any;
        expect(data.error).toContain('Unknown agent');
        expect(data.available).toBeInstanceOf(Array);
    });

    it('blocks pro agent for free user → 403', async () => {
        const token = await getToken(env);
        const res = await app.fetch(
            request('POST', '/openclaw/tools/run',
                { agent: 'auth', context: 'test' },
                { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(403);

        const data = await res.json() as any;
        expect(data.error).toContain('Pro');
        expect(data.upgradeUrl).toBeDefined();
    });

    it('returns 500 when no API key for provider', async () => {
        const noKeyEnv = createEnv({
            DEEPSEEK_API_KEY: undefined,
            OPENAI_API_KEY: undefined,
            ANTHROPIC_API_KEY: undefined,
        });
        const token = await getToken(noKeyEnv);
        const res = await app.fetch(
            request('POST', '/openclaw/tools/run',
                { agent: 'code-review', context: 'test' },
                { Authorization: `Bearer ${token}` }),
            noKeyEnv,
        );
        expect(res.status).toBe(500);
        const data = await res.json() as any;
        expect(data.error).toContain('No API key');
    });
});

// =============================================================
// OPENCLAW TOOLS — CHAIN (POST)
// =============================================================
describe('POST /openclaw/tools/chain — Chain execution', () => {
    let env: any;
    beforeEach(() => { env = createEnv(); });

    it('requires auth → 401 without token', async () => {
        const res = await app.fetch(
            request('POST', '/openclaw/tools/chain', { preset: 'full-review', context: 'test' }),
            env,
        );
        expect(res.status).toBe(401);
    });

    it('rejects missing preset → 400', async () => {
        const token = await getToken(env);
        const res = await app.fetch(
            request('POST', '/openclaw/tools/chain',
                { context: 'test' },
                { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(400);
    });

    it('rejects unknown preset → 404', async () => {
        const token = await getToken(env);
        const res = await app.fetch(
            request('POST', '/openclaw/tools/chain',
                { preset: 'nonexistent-chain', context: 'test' },
                { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(404);

        const data = await res.json() as any;
        expect(data.error).toContain('Unknown chain preset');
        expect(data.available).toBeDefined();
    });
});

// =============================================================
// OPENCLAW TOOLS — SEARCH (POST)
// =============================================================
describe('POST /openclaw/tools/search — RAG search', () => {
    let env: any;
    beforeEach(() => { env = createEnv(); });

    it('requires auth → 401 without token', async () => {
        const res = await app.fetch(
            request('POST', '/openclaw/tools/search', { query: 'test' }),
            env,
        );
        expect(res.status).toBe(401);
    });

    it('rejects missing query → 400', async () => {
        const token = await getToken(env);
        const res = await app.fetch(
            request('POST', '/openclaw/tools/search',
                {},
                { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(400);
    });

    it('returns 503 when RAG not configured', async () => {
        const token = await getToken(env);
        const res = await app.fetch(
            request('POST', '/openclaw/tools/search',
                { query: 'authentication middleware' },
                { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(503);

        const data = await res.json() as any;
        expect(data.error).toContain('RAG not configured');
    });
});

// =============================================================
// OPENCLAW TOOLS — INDEX (POST)
// =============================================================
describe('POST /openclaw/tools/index — File indexing', () => {
    let env: any;
    beforeEach(() => { env = createEnv(); });

    it('requires auth → 401 without token', async () => {
        const res = await app.fetch(
            request('POST', '/openclaw/tools/index', {
                files: [{ path: 'test.ts', content: 'export const x = 1;' }],
            }),
            env,
        );
        expect(res.status).toBe(401);
    });

    it('rejects empty files array → 400', async () => {
        const token = await getToken(env);
        const res = await app.fetch(
            request('POST', '/openclaw/tools/index',
                { files: [] },
                { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(400);
    });

    it('returns 503 when RAG not configured', async () => {
        const token = await getToken(env);
        const res = await app.fetch(
            request('POST', '/openclaw/tools/index',
                {
                    files: [{ path: 'test.ts', content: 'export const x = 1;' }],
                    repoName: 'test-repo',
                },
                { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(503);

        const data = await res.json() as any;
        expect(data.error).toContain('RAG not configured');
    });
});

// =============================================================
// OPENCLAW ANALYTICS — OVERVIEW
// =============================================================
describe('GET /openclaw/analytics/overview — Dashboard', () => {
    let env: any;
    beforeEach(() => { env = createEnv(); });

    it('requires auth → 401 without token', async () => {
        const res = await app.fetch(
            request('GET', '/openclaw/analytics/overview'),
            env,
        );
        expect(res.status).toBe(401);
    });

    it('returns analytics overview for authenticated user', async () => {
        const token = await getToken(env);
        const res = await app.fetch(
            request('GET', '/openclaw/analytics/overview', undefined,
                { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(200);

        const data = await res.json() as any;
        expect(data.period).toBe('30d');
        expect(data.gateways).toBeDefined();
        expect(data.gateways.total).toBe(0);
        expect(data.sessions).toBeDefined();
        expect(data.skills).toBeDefined();
        expect(data.skills.totalExecutions).toBeDefined();
    });

    it('supports custom date range', async () => {
        const token = await getToken(env);
        const res = await app.fetch(
            request('GET', '/openclaw/analytics/overview?days=7', undefined,
                { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(200);

        const data = await res.json() as any;
        expect(data.period).toBe('7d');
    });
});

// =============================================================
// OPENCLAW ANALYTICS — GATEWAYS
// =============================================================
describe('GET /openclaw/analytics/gateways — Gateway list', () => {
    let env: any;
    beforeEach(() => { env = createEnv(); });

    it('requires auth → 401', async () => {
        const res = await app.fetch(
            request('GET', '/openclaw/analytics/gateways'),
            env,
        );
        expect(res.status).toBe(401);
    });

    it('returns empty list for new user', async () => {
        const token = await getToken(env);
        const res = await app.fetch(
            request('GET', '/openclaw/analytics/gateways', undefined,
                { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(200);

        const data = await res.json() as any;
        expect(data.gateways).toEqual([]);
        expect(data.total).toBe(0);
    });
});

// =============================================================
// OPENCLAW ANALYTICS — SESSIONS
// =============================================================
describe('GET /openclaw/analytics/sessions — Session history', () => {
    let env: any;
    beforeEach(() => { env = createEnv(); });

    it('requires auth → 401', async () => {
        const res = await app.fetch(
            request('GET', '/openclaw/analytics/sessions'),
            env,
        );
        expect(res.status).toBe(401);
    });

    it('returns empty list for new user', async () => {
        const token = await getToken(env);
        const res = await app.fetch(
            request('GET', '/openclaw/analytics/sessions', undefined,
                { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(200);

        const data = await res.json() as any;
        expect(data.sessions).toEqual([]);
        expect(data.count).toBe(0);
    });

    it('accepts pagination params', async () => {
        const token = await getToken(env);
        const res = await app.fetch(
            request('GET', '/openclaw/analytics/sessions?limit=5&offset=0', undefined,
                { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(200);

        const data = await res.json() as any;
        expect(data.limit).toBe(5);
        expect(data.offset).toBe(0);
    });
});

// =============================================================
// OPENCLAW ANALYTICS — SKILLS
// =============================================================
describe('GET /openclaw/analytics/skills — Skill breakdown', () => {
    let env: any;
    beforeEach(() => { env = createEnv(); });

    it('requires auth → 401', async () => {
        const res = await app.fetch(
            request('GET', '/openclaw/analytics/skills'),
            env,
        );
        expect(res.status).toBe(401);
    });

    it('returns skill analytics for authenticated user', async () => {
        const token = await getToken(env);
        const res = await app.fetch(
            request('GET', '/openclaw/analytics/skills', undefined,
                { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(200);

        const data = await res.json() as any;
        expect(data.period).toBe('30d');
        expect(data.totalExecutions).toBeDefined();
        expect(data.bySkill).toBeDefined();
        expect(data.byAgent).toBeDefined();
        expect(data.byProvider).toBeDefined();
        expect(data.avgDurationMs).toBeDefined();
        expect(data.successRate).toBeDefined();
    });
});

// =============================================================
// OPENCLAW SERVICE — Unit Tests
// =============================================================
describe('OpenClaw Service Layer', () => {
    it('getToolRegistry returns correct tool count', async () => {
        const { getToolRegistry } = await import('../src/services/openclaw-service');
        const tools = getToolRegistry();
        expect(tools.length).toBe(6); // run, chain, search, index, status, agents
    });

    it('each tool has name, description, parameters', async () => {
        const { getToolRegistry } = await import('../src/services/openclaw-service');
        const tools = getToolRegistry();

        for (const tool of tools) {
            expect(tool.name).toBeDefined();
            expect(tool.name.length).toBeGreaterThan(0);
            expect(tool.description).toBeDefined();
            expect(tool.description.length).toBeGreaterThan(10);
            expect(tool.parameters).toBeDefined();
        }
    });

    it('LUNA_AGENTS contains 53 agents', async () => {
        const { LUNA_AGENTS } = await import('../src/services/openclaw-service');
        expect(LUNA_AGENTS.length).toBe(53);
    });

    it('CHAIN_PRESETS contains 5 presets', async () => {
        const { CHAIN_PRESETS } = await import('../src/services/openclaw-service');
        expect(CHAIN_PRESETS.length).toBe(5);
    });

    it('buildLunaAgentTask formats prompt correctly', async () => {
        const { buildLunaAgentTask } = await import('../src/services/openclaw-service');
        const persona = {
            name: 'Code Review',
            slug: 'code-review',
            systemPrompt: 'You are a senior code reviewer.\nFocus on bugs and anti-patterns.',
        };

        const task = buildLunaAgentTask(persona, 'Review my auth middleware');
        expect(task).toContain('Code Review');
        expect(task).toContain('Review my auth middleware');
        expect(task).toContain('You are acting as the');
        expect(task).toContain('senior code reviewer');
    });

    it('saveGateway persists to D1', async () => {
        const { saveGateway, listGateways } = await import('../src/services/openclaw-service');
        const db = createMockD1() as any;
        const userId = 'test-user-123';

        await saveGateway(db, userId, {
            id: 'gw-1',
            gatewayUrl: 'wss://my-machine.ts.net:18789',
            label: 'Home Mac',
            status: 'active',
            healthStatus: 'healthy',
        });

        const gateways = await listGateways(db, userId);
        expect(gateways.length).toBe(1);
        expect(gateways[0].id).toBe('gw-1');
        expect(gateways[0].label).toBe('Home Mac');
        expect(gateways[0].gatewayUrl).toBe('wss://my-machine.ts.net:18789');
    });

    it('deleteGateway soft-deletes', async () => {
        const { saveGateway, deleteGateway, listGateways } = await import('../src/services/openclaw-service');
        const db = createMockD1() as any;
        const userId = 'test-user-123';

        await saveGateway(db, userId, {
            id: 'gw-del',
            gatewayUrl: 'wss://del.ts.net:18789',
            label: 'To Delete',
        });

        const before = await listGateways(db, userId);
        expect(before.length).toBe(1);

        const deleted = await deleteGateway(db, userId, 'gw-del');
        expect(deleted).toBe(true);

        const after = await listGateways(db, userId);
        expect(after.length).toBe(0);
    });

    it('trackSkillExecution records and returns ID', async () => {
        const { trackSkillExecution } = await import('../src/services/openclaw-service');
        const db = createMockD1() as any;

        const id = await trackSkillExecution(db, {
            userId: 'test-user',
            skillName: 'luna_run',
            agentSlug: 'code-review',
            provider: 'deepseek',
            inputLength: 1000,
            outputLength: 2000,
            durationMs: 1500,
            status: 'completed',
            source: 'openclaw-tools',
        });

        expect(id).toBeDefined();
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
    });
});

// =============================================================
// OPENCLAW SCHEMAS — Zod Validation
// =============================================================
describe('OpenClaw Zod Schemas', () => {
    it('openclawToolRunSchema validates correctly', async () => {
        const { openclawToolRunSchema } = await import('../src/schemas/index');

        const valid = openclawToolRunSchema.safeParse({
            agent: 'code-review',
            context: 'Review this code',
            useRag: true,
            provider: 'deepseek',
        });
        expect(valid.success).toBe(true);

        const invalid = openclawToolRunSchema.safeParse({
            agent: '',
            context: '',
        });
        expect(invalid.success).toBe(false);
    });

    it('openclawToolChainSchema validates correctly', async () => {
        const { openclawToolChainSchema } = await import('../src/schemas/index');

        const valid = openclawToolChainSchema.safeParse({
            preset: 'full-review',
            context: 'Review this code',
        });
        expect(valid.success).toBe(true);

        const invalid = openclawToolChainSchema.safeParse({});
        expect(invalid.success).toBe(false);
    });

    it('openclawToolSearchSchema validates correctly', async () => {
        const { openclawToolSearchSchema } = await import('../src/schemas/index');

        const valid = openclawToolSearchSchema.safeParse({
            query: 'authentication middleware',
            topK: 10,
        });
        expect(valid.success).toBe(true);

        const invalid = openclawToolSearchSchema.safeParse({ query: '' });
        expect(invalid.success).toBe(false);
    });

    it('openclawGatewayRegisterSchema validates URL format', async () => {
        const { openclawGatewayRegisterSchema } = await import('../src/schemas/index');

        const valid = openclawGatewayRegisterSchema.safeParse({
            gatewayUrl: 'wss://my-machine.ts.net:18789',
            token: 'my-secret-token',
            label: 'Home Mac',
        });
        expect(valid.success).toBe(true);

        const invalidUrl = openclawGatewayRegisterSchema.safeParse({
            gatewayUrl: 'https://not-websocket.com',
            token: 'token',
        });
        expect(invalidUrl.success).toBe(false);
    });

    it('openclawToolIndexSchema validates files array', async () => {
        const { openclawToolIndexSchema } = await import('../src/schemas/index');

        const valid = openclawToolIndexSchema.safeParse({
            files: [
                { path: 'src/index.ts', content: 'export const x = 1;' },
                { path: 'src/utils.ts', content: 'export function add(a: number, b: number) { return a + b; }' },
            ],
            repoName: 'my-repo',
        });
        expect(valid.success).toBe(true);

        const emptyFiles = openclawToolIndexSchema.safeParse({ files: [] });
        expect(emptyFiles.success).toBe(false);
    });
});

// =============================================================
// INTEGRATION — Root endpoint includes OpenClaw tools
// =============================================================
describe('Root endpoint — OpenClaw integration', () => {
    it('GET / lists openclaw tool endpoints', async () => {
        const env = createEnv();
        const res = await app.fetch(request('GET', '/'), env);
        expect(res.status).toBe(200);

        const data = await res.json() as any;
        expect(data.endpoints).toContain('/openclaw/tools');
        expect(data.endpoints).toContain('/openclaw/tools/run');
        expect(data.endpoints).toContain('/openclaw/tools/chain');
        expect(data.endpoints).toContain('/openclaw/tools/search');
        expect(data.endpoints).toContain('/openclaw/tools/index');
        expect(data.endpoints).toContain('/openclaw/analytics/overview');
    });
});
