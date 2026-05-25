/**
 * Engine API Tests — comprehensive tests for all routes
 *
 * Tests: health, auth (signup/login/me), agents (list/execute/executions)
 * Uses Hono's app.fetch() for in-process testing (no server needed)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/worker';

// --- Mock Cloudflare D1 ---
// The mock stores data in-memory and routes SQL queries to the right handler

function createMockD1() {
    const users: any[] = [];
    const executions: any[] = [];

    function makeStatement(sql: string, boundArgs: any[] = []) {
        return {
            bind: (...args: any[]) => makeStatement(sql, args),
            first: async () => {
                if (sql.includes('SELECT 1')) return { ok: 1 };
                if (sql.includes('FROM users WHERE email')) {
                    return users.find(u => u.email === boundArgs[0]) || null;
                }
                if (sql.includes('FROM users WHERE id')) {
                    return users.find(u => u.id === boundArgs[0]) || null;
                }
                if (sql.includes('SELECT id FROM users')) {
                    return users.find(u => u.email === boundArgs[0]) || null;
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
                return { success: true };
            },
            all: async () => {
                if (sql.includes('FROM executions')) {
                    const filtered = executions.filter(e => e.user_id === boundArgs[0]);
                    return { results: filtered };
                }
                return { results: [] };
            },
        };
    }

    return {
        prepare: (sql: string) => makeStatement(sql),
        _users: users,
        _executions: executions,
    };
}

function createMockKV() {
    const store = new Map<string, string>();
    return {
        get: async (key: string) => store.get(key) || null,
        put: async (key: string, value: string) => { store.set(key, value); },
        delete: async (key: string) => { store.delete(key); },
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

function req(method: string, path: string, body?: any, headers?: Record<string, string>) {
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

// Helper: sign up and return token
async function getToken(env: any, email = 'user@test.com') {
    const res = await app.fetch(
        req('POST', '/auth/signup', { email, password: 'password123', name: 'Test' }),
        env,
    );
    const data = await res.json() as any;
    return data.token;
}

// =============================================================
// ROOT & 404
// =============================================================
describe('Root & 404', () => {
    it('GET / → 200 with API info', async () => {
        const env = createEnv();
        const res = await app.fetch(req('GET', '/'), env);
        expect(res.status).toBe(200);

        const data = await res.json() as any;
        expect(data.name).toBe('LunaOS Engine API');
        expect(data.version).toBe('0.2.0');
        expect(data.endpoints).toBeInstanceOf(Array);
    });

    it('GET /nonexistent → 404', async () => {
        const res = await app.fetch(req('GET', '/nonexistent'), createEnv());
        expect(res.status).toBe(404);
        const data = await res.json() as any;
        expect(data.error).toBe('Not Found');
    });
});

// =============================================================
// HEALTH
// =============================================================
describe('GET /health', () => {
    it('returns 200 with ok status', async () => {
        const env = createEnv();
        const res = await app.fetch(req('GET', '/health'), env);
        expect(res.status).toBe(200);

        const data = await res.json() as any;
        expect(data.status).toBe('ok');
        expect(data.version).toBe('0.2.0');
        expect(data.services.d1.status).toBe('ok');
        expect(data.services.kv.status).toBe('ok');
        expect(data.latency).toBeDefined();
    });
});

// =============================================================
// AUTH — SIGNUP
// =============================================================
describe('POST /auth/signup', () => {
    let env: any;
    beforeEach(() => { env = createEnv(); });

    it('creates user and returns JWT', async () => {
        const res = await app.fetch(
            req('POST', '/auth/signup', {
                email: 'new@test.com', password: 'password123', name: 'Alice',
            }),
            env,
        );
        expect(res.status).toBe(201);

        const data = await res.json() as any;
        expect(data.token).toBeDefined();
        expect(data.token.split('.').length).toBe(3); // valid JWT format
        expect(data.user.email).toBe('new@test.com');
        expect(data.user.name).toBe('Alice');
        expect(data.user.tier).toBe('free');
        expect(data.user.password).toBeUndefined();
        expect(data.user.password_hash).toBeUndefined();
    });

    it('rejects missing email → 400', async () => {
        const res = await app.fetch(
            req('POST', '/auth/signup', { password: 'password123' }),
            env,
        );
        expect(res.status).toBe(400);
    });

    it('rejects missing password → 400', async () => {
        const res = await app.fetch(
            req('POST', '/auth/signup', { email: 'x@test.com' }),
            env,
        );
        expect(res.status).toBe(400);
    });

    it('rejects short password → 400', async () => {
        const res = await app.fetch(
            req('POST', '/auth/signup', { email: 'x@test.com', password: '123' }),
            env,
        );
        expect(res.status).toBe(400);
    });

    it('rejects invalid email → 400', async () => {
        const res = await app.fetch(
            req('POST', '/auth/signup', { email: 'notanemail', password: 'password123' }),
            env,
        );
        expect(res.status).toBe(400);
    });

    it('rejects duplicate email → 409', async () => {
        await app.fetch(
            req('POST', '/auth/signup', { email: 'dupe@test.com', password: 'password123' }),
            env,
        );
        const res = await app.fetch(
            req('POST', '/auth/signup', { email: 'dupe@test.com', password: 'other12345' }),
            env,
        );
        expect(res.status).toBe(409);
    });
});

// =============================================================
// AUTH — LOGIN
// =============================================================
describe('POST /auth/login', () => {
    let env: any;
    beforeEach(async () => {
        env = createEnv();
        await app.fetch(
            req('POST', '/auth/signup', { email: 'login@test.com', password: 'password123' }),
            env,
        );
    });

    it('logs in with valid credentials → 200 + JWT', async () => {
        const res = await app.fetch(
            req('POST', '/auth/login', { email: 'login@test.com', password: 'password123' }),
            env,
        );
        expect(res.status).toBe(200);

        const data = await res.json() as any;
        expect(data.token).toBeDefined();
        expect(data.user.email).toBe('login@test.com');
    });

    it('rejects wrong password → 401', async () => {
        const res = await app.fetch(
            req('POST', '/auth/login', { email: 'login@test.com', password: 'wrongpass1' }),
            env,
        );
        expect(res.status).toBe(401);
    });

    it('rejects unknown email → 401', async () => {
        const res = await app.fetch(
            req('POST', '/auth/login', { email: 'nobody@test.com', password: 'password123' }),
            env,
        );
        expect(res.status).toBe(401);
    });

    it('rejects empty body → 400', async () => {
        const res = await app.fetch(
            req('POST', '/auth/login', {}),
            env,
        );
        expect(res.status).toBe(400);
    });
});

// =============================================================
// AUTH — /me
// =============================================================
describe('GET /auth/me', () => {
    let env: any;
    beforeEach(() => { env = createEnv(); });

    it('returns user info with valid token', async () => {
        const token = await getToken(env, 'me@test.com');

        const res = await app.fetch(
            req('GET', '/auth/me', undefined, { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.user.email).toBe('me@test.com');
    });

    it('rejects no token → 401', async () => {
        const res = await app.fetch(req('GET', '/auth/me'), env);
        expect(res.status).toBe(401);
    });

    it('rejects invalid token → 401', async () => {
        const res = await app.fetch(
            req('GET', '/auth/me', undefined, { Authorization: 'Bearer bad.token.here' }),
            env,
        );
        expect(res.status).toBe(401);
    });
});

// =============================================================
// AGENTS — LIST
// =============================================================
describe('GET /agents/list', () => {
    it('returns catalog (no auth needed)', async () => {
        const res = await app.fetch(req('GET', '/agents/list'), createEnv());
        expect(res.status).toBe(200);

        const data = await res.json() as any;
        expect(data.total).toBe(28);
        expect(data.free).toBe(6);
        expect(data.pro).toBe(22);
        expect(data.agents).toBeInstanceOf(Array);
    });

    it('agents have correct structure', async () => {
        const res = await app.fetch(req('GET', '/agents/list'), createEnv());
        const data = await res.json() as any;

        for (const agent of data.agents) {
            expect(agent.slug).toBeDefined();
            expect(agent.name).toBeDefined();
            expect(agent.category).toBeDefined();
            expect(agent.tier).toMatch(/^(free|pro)$/);
            expect(typeof agent.hasSystemPrompt).toBe('boolean');
        }
    });

    it('free agents include code-review, docs, deployment', async () => {
        const res = await app.fetch(req('GET', '/agents/list'), createEnv());
        const data = await res.json() as any;

        const freeSlugs = data.agents.filter((a: any) => a.tier === 'free').map((a: any) => a.slug);
        expect(freeSlugs).toContain('code-review');
        expect(freeSlugs).toContain('documentation');
        expect(freeSlugs).toContain('deployment');
    });
});

// =============================================================
// AGENTS — EXECUTE
// =============================================================
describe('POST /agents/execute', () => {
    let env: any;
    beforeEach(() => { env = createEnv(); });

    it('requires auth → 401 without token', async () => {
        const res = await app.fetch(
            req('POST', '/agents/execute', { agent: 'code-review', context: 'test' }),
            env,
        );
        expect(res.status).toBe(401);
    });

    it('rejects unknown agent → 404', async () => {
        const token = await getToken(env);
        const res = await app.fetch(
            req('POST', '/agents/execute',
                { agent: 'nonexistent-xyz', context: 'test' },
                { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(404);
    });

    it('blocks pro agents for free user → 403', async () => {
        const token = await getToken(env);
        const res = await app.fetch(
            req('POST', '/agents/execute',
                { agent: 'auth', context: 'test' },
                { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(403);

        const data = await res.json() as any;
        expect(data.error).toContain('Pro');
        expect(data.upgradeUrl).toBeDefined();
    });

    it('rejects missing context → 400', async () => {
        const token = await getToken(env);
        const res = await app.fetch(
            req('POST', '/agents/execute',
                { agent: 'code-review' },
                { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(400);
    });
});

// =============================================================
// AGENTS — EXECUTIONS
// =============================================================
describe('GET /agents/executions', () => {
    let env: any;
    beforeEach(() => { env = createEnv(); });

    it('requires auth → 401', async () => {
        const res = await app.fetch(req('GET', '/agents/executions'), env);
        expect(res.status).toBe(401);
    });

    it('returns empty list for new user', async () => {
        const token = await getToken(env);
        const res = await app.fetch(
            req('GET', '/agents/executions', undefined, { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.executions).toEqual([]);
        expect(data.count).toBe(0);
    });
});

// =============================================================
// JWT UTILS
// =============================================================
describe('JWT Utils', () => {
    it('signs and verifies tokens', async () => {
        const { signJWT, verifyJWT } = await import('../src/utils/jwt');
        const token = await signJWT({ sub: 'u-1', email: 'j@t.com', tier: 'free' }, 'secret123456789012345678901234');
        expect(token.split('.').length).toBe(3);

        const payload = await verifyJWT(token, 'secret123456789012345678901234');
        expect(payload.sub).toBe('u-1');
        expect(payload.email).toBe('j@t.com');
    });

    it('rejects malformed token', async () => {
        const { verifyJWT } = await import('../src/utils/jwt');
        await expect(verifyJWT('invalid', 'secret')).rejects.toThrow();
    });

    it('rejects wrong secret', async () => {
        const { signJWT, verifyJWT } = await import('../src/utils/jwt');
        const token = await signJWT({ sub: 'x', email: 'x@t.com', tier: 'free' }, 'secret-a-long-enough-key-123456');
        await expect(verifyJWT(token, 'secret-b-long-enough-key-123456')).rejects.toThrow();
    });
});

// =============================================================
// CORS
// =============================================================
describe('CORS', () => {
    it('allows agents.lunaos.ai origin', async () => {
        const res = await app.fetch(
            new Request('http://localhost/', {
                method: 'OPTIONS',
                headers: { Origin: 'https://agents.lunaos.ai' },
            }),
            createEnv(),
        );
        expect(res.headers.get('access-control-allow-origin')).toBe('https://agents.lunaos.ai');
    });

    it('allows localhost:3000 origin', async () => {
        const res = await app.fetch(
            new Request('http://localhost/', {
                method: 'OPTIONS',
                headers: { Origin: 'http://localhost:3000' },
            }),
            createEnv(),
        );
        expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    });
});

// =============================================================
// PERSONAS DATA
// =============================================================
describe('Personas Data', () => {
    it('has 28 personas', async () => {
        const { PERSONAS } = await import('../src/data/personas');
        expect(PERSONAS.length).toBe(28);
    });

    it('all personas have slug, name, category, systemPrompt', async () => {
        const { PERSONAS } = await import('../src/data/personas');
        for (const p of PERSONAS) {
            expect(p.slug.length).toBeGreaterThan(0);
            expect(p.name.length).toBeGreaterThan(0);
            expect(p.category.length).toBeGreaterThan(0);
            expect(p.systemPrompt.length).toBeGreaterThan(100);
        }
    });

    it('getPersona finds code-review', async () => {
        const { getPersona } = await import('../src/data/personas');
        const p = getPersona('code-review');
        expect(p).toBeDefined();
        expect(p!.name).toContain('Code Review');
    });

    it('getPersona returns undefined for unknown', async () => {
        const { getPersona } = await import('../src/data/personas');
        expect(getPersona('nope')).toBeUndefined();
    });

    it('listPersonas returns all personas', async () => {
        const { listPersonas, PERSONAS } = await import('../src/data/personas');
        const list = listPersonas();
        expect(list).toBe(PERSONAS);
        expect(list.length).toBe(28);
    });
});

// =============================================================
// HEALTH — DEGRADED / 503 STATES
// =============================================================
describe('GET /health — degraded states', () => {
    it('returns 503 with degraded status when D1 fails', async () => {
        const env = createEnv({
            DB: {
                prepare: () => ({
                    bind: () => ({ first: () => { throw new Error('D1 down'); }, run: async () => ({}) }),
                    first: () => { throw new Error('D1 down'); },
                    run: async () => ({}),
                }),
            },
        });
        const res = await app.fetch(req('GET', '/health'), env);
        expect(res.status).toBe(503);

        const data = await res.json() as any;
        expect(data.status).toBe('degraded');
        expect(data.services.d1.status).toBe('error');
        expect(data.services.kv.status).toBe('ok');
    });

    it('returns 503 when KV fails', async () => {
        const env = createEnv({
            KV: {
                get: async () => null,
                put: async () => { throw new Error('KV down'); },
                delete: async () => { },
            },
        });
        const res = await app.fetch(req('GET', '/health'), env);
        expect(res.status).toBe(503);

        const data = await res.json() as any;
        expect(data.status).toBe('degraded');
        expect(data.services.d1.status).toBe('ok');
        expect(data.services.kv.status).toBe('error');
    });

    it('returns 503 when both D1 and KV fail', async () => {
        const env = createEnv({
            DB: {
                prepare: () => ({
                    bind: () => ({ first: () => { throw new Error('D1 down'); } }),
                    first: () => { throw new Error('D1 down'); },
                }),
            },
            KV: {
                put: async () => { throw new Error('KV down'); },
            },
        });
        const res = await app.fetch(req('GET', '/health'), env);
        expect(res.status).toBe(503);

        const data = await res.json() as any;
        expect(data.status).toBe('degraded');
        expect(data.services.d1.status).toBe('error');
        expect(data.services.kv.status).toBe('error');
    });

    it('includes latency and environment in response', async () => {
        const env = createEnv({ ENVIRONMENT: 'staging' });
        const res = await app.fetch(req('GET', '/health'), env);
        const data = await res.json() as any;
        expect(data.environment).toBe('staging');
        expect(data.latency).toMatch(/^\d+ms$/);
        expect(data.timestamp).toBeDefined();
    });

    it('defaults environment to development when not set', async () => {
        const env = createEnv({ ENVIRONMENT: '' });
        const res = await app.fetch(req('GET', '/health'), env);
        const data = await res.json() as any;
        expect(data.environment).toBe('development');
    });
});

// =============================================================
// WORKER ERROR HANDLER
// =============================================================
describe('Worker error handler', () => {
    it('returns generic error in production', async () => {
        // Trigger an unhandled error by using invalid JSON body on a JSON-parsing route
        const env = createEnv({ ENVIRONMENT: 'production' });
        const res = await app.fetch(
            new Request('http://localhost/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: 'not-json{{',
            }),
            env,
        );
        expect(res.status).toBe(500);
        const data = await res.json() as any;
        expect(data.error).toBe('Internal Server Error');
        expect(data.message).toBe('Something went wrong');
    });

    it('returns detailed error in development', async () => {
        const env = createEnv({ ENVIRONMENT: 'development' });
        const res = await app.fetch(
            new Request('http://localhost/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: 'not-json{{',
            }),
            env,
        );
        expect(res.status).toBe(500);
        const data = await res.json() as any;
        expect(data.error).toBe('Internal Server Error');
        // In dev, message should be the actual error message (not the generic one)
        expect(data.message).not.toBe('Something went wrong');
    });
});

// =============================================================
// AUTH — /me EDGE CASES
// =============================================================
describe('GET /auth/me — edge cases', () => {
    it('returns 401 with Bearer prefix missing', async () => {
        const env = createEnv();
        const res = await app.fetch(
            req('GET', '/auth/me', undefined, { Authorization: 'Token abc123' }),
            env,
        );
        expect(res.status).toBe(401);
        const data = await res.json() as any;
        expect(data.error).toBe('Not authenticated');
    });

    it('returns 404 when token valid but user deleted from DB', async () => {
        const env = createEnv();
        const token = await getToken(env, 'ghost@test.com');

        // Clear users from DB to simulate deleted user
        (env.DB as any)._users.length = 0;

        const res = await app.fetch(
            req('GET', '/auth/me', undefined, { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(404);
        const data = await res.json() as any;
        expect(data.error).toBe('User not found');
    });
});

// =============================================================
// AUTH — SIGNUP EDGE CASES
// =============================================================
describe('POST /auth/signup — edge cases', () => {
    it('normalizes email to lowercase', async () => {
        const env = createEnv();
        const res = await app.fetch(
            req('POST', '/auth/signup', { email: 'Upper@TEST.com', password: 'password123' }),
            env,
        );
        expect(res.status).toBe(201);
        const data = await res.json() as any;
        expect(data.user.email).toBe('upper@test.com');
    });

    it('defaults name to empty string when not provided', async () => {
        const env = createEnv();
        const res = await app.fetch(
            req('POST', '/auth/signup', { email: 'noname@test.com', password: 'password123' }),
            env,
        );
        expect(res.status).toBe(201);
        const data = await res.json() as any;
        expect(data.user.name).toBe('');
    });
});

// =============================================================
// AUTH — LOGIN EDGE CASES
// =============================================================
describe('POST /auth/login — edge cases', () => {
    it('normalizes email for login lookup', async () => {
        const env = createEnv();
        // Sign up with lowercase
        await app.fetch(
            req('POST', '/auth/signup', { email: 'case@test.com', password: 'password123' }),
            env,
        );
        // Login with uppercase variant
        const res = await app.fetch(
            req('POST', '/auth/login', { email: 'CASE@TEST.COM', password: 'password123' }),
            env,
        );
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.token).toBeDefined();
        expect(data.user.email).toBe('case@test.com');
    });
});

// =============================================================
// AGENTS — EXECUTE EDGE CASES
// =============================================================
describe('POST /agents/execute — edge cases', () => {
    it('returns 400 when agent field is empty', async () => {
        const env = createEnv();
        const token = await getToken(env);
        const res = await app.fetch(
            req('POST', '/agents/execute',
                { agent: '', context: 'some context' },
                { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(400);
    });

    it('returns 400 when context field is empty', async () => {
        const env = createEnv();
        const token = await getToken(env);
        const res = await app.fetch(
            req('POST', '/agents/execute',
                { agent: 'code-review', context: '' },
                { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(400);
    });

    it('returns 500 when no API key for provider', async () => {
        const env = createEnv({
            DEEPSEEK_API_KEY: undefined,
            OPENAI_API_KEY: undefined,
            ANTHROPIC_API_KEY: undefined,
        });
        const token = await getToken(env);
        const res = await app.fetch(
            req('POST', '/agents/execute',
                { agent: 'code-review', context: 'review this code' },
                { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(500);
        const data = await res.json() as any;
        expect(data.error).toContain('No API key');
    });

    it('returns 500 when specific provider has no key', async () => {
        const env = createEnv({
            ANTHROPIC_API_KEY: undefined,
        });
        const token = await getToken(env);
        const res = await app.fetch(
            req('POST', '/agents/execute',
                { agent: 'code-review', context: 'test', provider: 'anthropic' },
                { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(500);
        const data = await res.json() as any;
        expect(data.error).toContain('anthropic');
    });
});

// =============================================================
// AGENTS — EXECUTIONS PAGINATION
// =============================================================
describe('GET /agents/executions — pagination', () => {
    it('accepts limit and offset query params', async () => {
        const env = createEnv();
        const token = await getToken(env);
        const res = await app.fetch(
            req('GET', '/agents/executions?limit=5&offset=0', undefined,
                { Authorization: `Bearer ${token}` }),
            env,
        );
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.executions).toBeInstanceOf(Array);
        expect(data.count).toBeDefined();
    });
});

// =============================================================
// JWT — EXPIRED TOKEN
// =============================================================
describe('JWT — expired token', () => {
    it('rejects expired tokens', async () => {
        const { signJWT, verifyJWT } = await import('../src/utils/jwt');
        // Sign a token that expires in -1 hours (already expired)
        const token = await signJWT(
            { sub: 'u-expired', email: 'exp@t.com', tier: 'free' },
            'secret-long-enough-for-test-1234',
            -1, // negative hours = already expired
        );
        await expect(
            verifyJWT(token, 'secret-long-enough-for-test-1234'),
        ).rejects.toThrow('Token expired');
    });

    it('expired token returns 401 from /auth/me', async () => {
        const { signJWT } = await import('../src/utils/jwt');
        const env = createEnv();
        // Create a token that expired
        const expired = await signJWT(
            { sub: 'u-old', email: 'old@t.com', tier: 'free' },
            env.JWT_SECRET,
            -1,
        );
        const res = await app.fetch(
            req('GET', '/auth/me', undefined, { Authorization: `Bearer ${expired}` }),
            env,
        );
        expect(res.status).toBe(401);
        const data = await res.json() as any;
        expect(data.error).toBe('Invalid token');
    });
});

// =============================================================
// CORS — DISALLOWED ORIGIN
// =============================================================
describe('CORS — additional cases', () => {
    it('allows studio.lunaos.ai origin', async () => {
        const res = await app.fetch(
            new Request('http://localhost/', {
                method: 'OPTIONS',
                headers: { Origin: 'https://studio.lunaos.ai' },
            }),
            createEnv(),
        );
        expect(res.headers.get('access-control-allow-origin')).toBe('https://studio.lunaos.ai');
    });

    it('allows lunaos.ai origin', async () => {
        const res = await app.fetch(
            new Request('http://localhost/', {
                method: 'OPTIONS',
                headers: { Origin: 'https://lunaos.ai' },
            }),
            createEnv(),
        );
        expect(res.headers.get('access-control-allow-origin')).toBe('https://lunaos.ai');
    });

    it('allows localhost:5173 origin', async () => {
        const res = await app.fetch(
            new Request('http://localhost/', {
                method: 'OPTIONS',
                headers: { Origin: 'http://localhost:5173' },
            }),
            createEnv(),
        );
        expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    });
});

// =============================================================
// AUTH MIDDLEWARE — DETAILED EDGE CASES
// =============================================================
describe('Auth middleware — edge cases', () => {
    it('execute rejects empty Authorization header → 401', async () => {
        const env = createEnv();
        const res = await app.fetch(
            req('POST', '/agents/execute',
                { agent: 'code-review', context: 'test' },
                { Authorization: '' }),
            env,
        );
        expect(res.status).toBe(401);
    });

    it('execute rejects malformed Bearer token → 401', async () => {
        const env = createEnv();
        const res = await app.fetch(
            req('POST', '/agents/execute',
                { agent: 'code-review', context: 'test' },
                { Authorization: 'Bearer not.a.valid.jwt' }),
            env,
        );
        expect(res.status).toBe(401);
        const data = await res.json() as any;
        expect(data.error).toContain('Invalid or expired');
    });

    it('executions rejects invalid JWT → 401', async () => {
        const env = createEnv();
        const res = await app.fetch(
            req('GET', '/agents/executions', undefined,
                { Authorization: 'Bearer xyz.abc.123' }),
            env,
        );
        expect(res.status).toBe(401);
    });
});

// =============================================================
// AGENT TIER → getTier
// =============================================================
describe('Agent tier logic', () => {
    it('free agents have tier=free in listing', async () => {
        const res = await app.fetch(req('GET', '/agents/list'), createEnv());
        const data = await res.json() as any;

        const freeExpected = ['code-review', 'testing-validation', 'documentation',
            'deployment', 'requirements-analyzer', 'design-architect'];
        for (const slug of freeExpected) {
            const agent = data.agents.find((a: any) => a.slug === slug);
            expect(agent, `expected ${slug} to be in list`).toBeDefined();
            expect(agent.tier).toBe('free');
        }
    });

    it('auth agent is tier=pro in listing', async () => {
        const res = await app.fetch(req('GET', '/agents/list'), createEnv());
        const data = await res.json() as any;
        const authAgent = data.agents.find((a: any) => a.slug === 'auth');
        expect(authAgent).toBeDefined();
        expect(authAgent.tier).toBe('pro');
    });
});

// =============================================================
// 404 — VARIOUS PATHS
// =============================================================
describe('404 — route not found', () => {
    it('POST /nonexistent → 404', async () => {
        const res = await app.fetch(req('POST', '/nonexistent'), createEnv());
        expect(res.status).toBe(404);
        const data = await res.json() as any;
        expect(data.error).toBe('Not Found');
        expect(data.path).toBe('/nonexistent');
    });

    it('GET /agents/unknown-path → 404', async () => {
        const res = await app.fetch(req('GET', '/agents/unknown-path'), createEnv());
        expect(res.status).toBe(404);
    });
});
