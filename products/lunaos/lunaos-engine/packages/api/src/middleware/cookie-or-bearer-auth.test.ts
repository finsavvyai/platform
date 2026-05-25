import { Hono } from 'hono';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cookieOrBearerAuth } from './cookie-or-bearer-auth';

vi.mock('./api-key-auth', () => ({
    requireAuthOrApiKey: vi.fn(async (c: any, next: any) => {
        c.set('userId', 'bearer-user');
        c.set('userEmail', 'bearer@test');
        c.set('userTier', 'pro');
        c.set('authMethod', 'bearer_fallback');
        await next();
    }),
}));

const enc = new TextEncoder();
function toBuf(u: Uint8Array): ArrayBuffer {
    const out = new ArrayBuffer(u.byteLength);
    new Uint8Array(out).set(u);
    return out;
}
async function sign(value: string, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw', toBuf(enc.encode(secret)),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, toBuf(enc.encode(value))));
    let bin = ''; for (let i = 0; i < sig.length; i++) bin += String.fromCharCode(sig[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function makeApp(env: any) {
    const app = new Hono();
    app.use('*', cookieOrBearerAuth);
    app.get('/me', (c) => c.json({
        userId: c.get('userId'),
        userEmail: c.get('userEmail'),
        orgId: c.get('orgId'),
        authMethod: c.get('authMethod'),
    }));
    return (req: Request) => app.fetch(req, env);
}

function dbStub(sessions: Record<string, any>, users: Record<string, any>) {
    return {
        prepare: (sql: string) => ({
            bind: (...args: any[]) => ({
                first: async () => {
                    if (sql.includes('sso_sessions')) return sessions[args[0]] ?? null;
                    if (sql.includes('users')) return users[args[0]] ?? null;
                    return null;
                },
            }),
        }),
    };
}

const SECRET = 'test-secret-key-32-bytes-or-longer';

describe('cookieOrBearerAuth', () => {
    beforeEach(() => vi.clearAllMocks());

    it('happy path: valid sso_session cookie sets context vars', async () => {
        const sessionId = 'sess_abc123';
        const sig = await sign(sessionId, SECRET);
        const env = {
            SESSION_SECRET: SECRET,
            DB: dbStub(
                { [sessionId]: { user_id: 'u1', org_id: 'o1', expires_at: '2099-01-01' } },
                { u1: { id: 'u1', email: 'a@b.com', tier: 'enterprise' } },
            ),
        };
        const fetch = makeApp(env);
        const res = await fetch(new Request('http://x/me', {
            headers: { cookie: `sso_session=${sessionId}.${sig}` },
        }));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            userId: 'u1', userEmail: 'a@b.com', orgId: 'o1', authMethod: 'sso_cookie',
        });
    });

    it('rejects cookie with bad signature', async () => {
        const env = { SESSION_SECRET: SECRET, DB: dbStub({}, {}) };
        const fetch = makeApp(env);
        const res = await fetch(new Request('http://x/me', {
            headers: { cookie: 'sso_session=sess_abc.deadbeef' },
        }));
        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: 'invalid_sso_session' });
    });

    it('rejects malformed cookie (no separator dot)', async () => {
        const env = { SESSION_SECRET: SECRET, DB: dbStub({}, {}) };
        const fetch = makeApp(env);
        const res = await fetch(new Request('http://x/me', {
            headers: { cookie: 'sso_session=nodothere' },
        }));
        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: 'invalid_sso_session' });
    });

    it('rejects when session row missing or expired (DB returns null)', async () => {
        const sessionId = 'sess_gone';
        const sig = await sign(sessionId, SECRET);
        const env = { SESSION_SECRET: SECRET, DB: dbStub({}, {}) };
        const fetch = makeApp(env);
        const res = await fetch(new Request('http://x/me', {
            headers: { cookie: `sso_session=${sessionId}.${sig}` },
        }));
        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: 'sso_session_expired' });
    });

    it('rejects when user no longer exists', async () => {
        const sessionId = 'sess_orphan';
        const sig = await sign(sessionId, SECRET);
        const env = {
            SESSION_SECRET: SECRET,
            DB: dbStub({ [sessionId]: { user_id: 'gone', org_id: 'o1', expires_at: '2099-01-01' } }, {}),
        };
        const fetch = makeApp(env);
        const res = await fetch(new Request('http://x/me', {
            headers: { cookie: `sso_session=${sessionId}.${sig}` },
        }));
        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: 'user_not_found' });
    });

    it('falls back to bearer auth when no cookie present', async () => {
        const env = { SESSION_SECRET: SECRET, DB: dbStub({}, {}) };
        const fetch = makeApp(env);
        const res = await fetch(new Request('http://x/me'));
        expect(res.status).toBe(200);
        const body: any = await res.json();
        expect(body.authMethod).toBe('bearer_fallback');
        expect(body.userId).toBe('bearer-user');
    });

    it('falls back to bearer when cookie is present but for different name', async () => {
        const env = { SESSION_SECRET: SECRET, DB: dbStub({}, {}) };
        const fetch = makeApp(env);
        const res = await fetch(new Request('http://x/me', {
            headers: { cookie: 'other_cookie=something' },
        }));
        expect(res.status).toBe(200);
        const body: any = await res.json();
        expect(body.authMethod).toBe('bearer_fallback');
    });

    it('returns 500 when SESSION_SECRET and JWT_SECRET both missing', async () => {
        const sessionId = 'sess_x';
        const env = { DB: dbStub({}, {}) };
        const fetch = makeApp(env);
        const res = await fetch(new Request('http://x/me', {
            headers: { cookie: `sso_session=${sessionId}.somesig` },
        }));
        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: 'server_misconfigured' });
    });

    it('falls back to JWT_SECRET when SESSION_SECRET unset', async () => {
        const sessionId = 'sess_jwt';
        const sig = await sign(sessionId, SECRET);
        const env = {
            JWT_SECRET: SECRET,
            DB: dbStub(
                { [sessionId]: { user_id: 'u1', org_id: 'o1', expires_at: '2099-01-01' } },
                { u1: { id: 'u1', email: 'a@b.com', tier: 'free' } },
            ),
        };
        const fetch = makeApp(env);
        const res = await fetch(new Request('http://x/me', {
            headers: { cookie: `sso_session=${sessionId}.${sig}` },
        }));
        expect(res.status).toBe(200);
        const body: any = await res.json();
        expect(body.authMethod).toBe('sso_cookie');
    });

    it('parses multiple cookies and finds sso_session by name', async () => {
        const sessionId = 'sess_multi';
        const sig = await sign(sessionId, SECRET);
        const env = {
            SESSION_SECRET: SECRET,
            DB: dbStub(
                { [sessionId]: { user_id: 'u1', org_id: 'o1', expires_at: '2099-01-01' } },
                { u1: { id: 'u1', email: 'a@b.com', tier: 'pro' } },
            ),
        };
        const fetch = makeApp(env);
        const res = await fetch(new Request('http://x/me', {
            headers: { cookie: `theme=dark; sso_session=${sessionId}.${sig}; locale=en` },
        }));
        expect(res.status).toBe(200);
        const body: any = await res.json();
        expect(body.userId).toBe('u1');
    });
});
