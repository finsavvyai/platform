import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

const storedUsers: Record<string, any> = {};

function createAuthApp() {
    const app = new Hono();

    app.post('/auth/signup', async (c) => {
        const body = await c.req.json().catch(() => ({}));
        if (!body.email || !body.password) return c.json({ error: 'Email and password are required' }, 400);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return c.json({ error: 'Invalid email address' }, 400);
        if (body.password.length < 8) return c.json({ error: 'Password must be at least 8 characters' }, 400);
        const email = body.email.toLowerCase();
        if (storedUsers[email]) return c.json({ error: 'Email already registered' }, 409);
        const userId = crypto.randomUUID();
        return c.json({
            token: `eyJ_mock_jwt_${userId.slice(0, 8)}`,
            user: { id: userId, email, name: body.name || '', tier: 'free' },
        }, 201);
    });

    app.post('/auth/login', async (c) => {
        const body = await c.req.json().catch(() => ({}));
        if (!body.email || !body.password) return c.json({ error: 'Email and password are required' }, 400);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return c.json({ error: 'Invalid email address' }, 400);
        const user = storedUsers[body.email.toLowerCase()];
        if (!user || body.password !== user.password) return c.json({ error: 'Invalid email or password' }, 401);
        return c.json({
            token: `eyJ_mock_jwt_${user.id.slice(0, 8)}`,
            user: { id: user.id, email: user.email, name: user.name, tier: user.tier },
        });
    });

    app.get('/auth/me', async (c) => {
        const auth = c.req.header('Authorization');
        if (!auth?.startsWith('Bearer ')) return c.json({ error: 'Not authenticated' }, 401);
        if (!auth.slice(7).startsWith('eyJ')) return c.json({ error: 'Invalid token' }, 401);
        return c.json({ user: { id: 'u1', email: 'test@test.com', tier: 'free' } });
    });

    return app;
}

const post = (body: any) => ({
    method: 'POST' as const,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

describe('POST /auth/signup', () => {
    it('creates user and returns JWT', async () => {
        const res = await createAuthApp().request('/auth/signup', post({ email: 'new@example.com', password: 'securePass1!' }));
        expect(res.status).toBe(201);
        const body = await res.json() as any;
        expect(body.token).toMatch(/^eyJ/);
        expect(body.user.email).toBe('new@example.com');
        expect(body.user.tier).toBe('free');
    });

    it('accepts optional name field', async () => {
        const res = await createAuthApp().request('/auth/signup', post({ email: 'named@test.com', password: 'Password1!', name: 'Luna' }));
        const body = await res.json() as any;
        expect(body.user.name).toBe('Luna');
    });

    it('rejects invalid email format', async () => {
        const res = await createAuthApp().request('/auth/signup', post({ email: 'bad', password: 'securePass1!' }));
        expect(res.status).toBe(400);
    });

    it('rejects short password (< 8 chars)', async () => {
        const res = await createAuthApp().request('/auth/signup', post({ email: 'v@t.com', password: 'short' }));
        expect(res.status).toBe(400);
    });

    it('rejects missing fields', async () => {
        const res = await createAuthApp().request('/auth/signup', post({}));
        expect(res.status).toBe(400);
    });

    it('rejects duplicate email (409)', async () => {
        storedUsers['dup@test.com'] = { id: 'u1', email: 'dup@test.com', tier: 'free' };
        const res = await createAuthApp().request('/auth/signup', post({ email: 'dup@test.com', password: 'securePass1!' }));
        expect(res.status).toBe(409);
        delete storedUsers['dup@test.com'];
    });

    it('normalizes email to lowercase', async () => {
        const res = await createAuthApp().request('/auth/signup', post({ email: 'User@EXAMPLE.com', password: 'securePass1!' }));
        const body = await res.json() as any;
        expect(body.user.email).toBe('user@example.com');
    });
});

describe('POST /auth/login', () => {
    it('returns 401 for non-existent user', async () => {
        const res = await createAuthApp().request('/auth/login', post({ email: 'nobody@t.com', password: 'pass1234' }));
        expect(res.status).toBe(401);
    });

    it('returns 401 for wrong password', async () => {
        storedUsers['login@t.com'] = { id: 'u2', email: 'login@t.com', password: 'correct1', name: '', tier: 'pro' };
        const res = await createAuthApp().request('/auth/login', post({ email: 'login@t.com', password: 'wrong' }));
        expect(res.status).toBe(401);
        delete storedUsers['login@t.com'];
    });

    it('returns JWT and user on valid login', async () => {
        storedUsers['ok@t.com'] = { id: 'u3', email: 'ok@t.com', password: 'pass1234', name: 'Ok', tier: 'pro' };
        const res = await createAuthApp().request('/auth/login', post({ email: 'ok@t.com', password: 'pass1234' }));
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.token).toMatch(/^eyJ/);
        expect(body.user.tier).toBe('pro');
        delete storedUsers['ok@t.com'];
    });

    it('rejects missing credentials', async () => {
        const res = await createAuthApp().request('/auth/login', post({}));
        expect(res.status).toBe(400);
    });

    it('rejects invalid email format', async () => {
        const res = await createAuthApp().request('/auth/login', post({ email: 'bad', password: 'x' }));
        expect(res.status).toBe(400);
    });
});

describe('GET /auth/me', () => {
    it('returns 401 without Authorization header', async () => {
        const res = await createAuthApp().request('/auth/me');
        expect(res.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
        const res = await createAuthApp().request('/auth/me', { headers: { Authorization: 'Bearer bad' } });
        expect(res.status).toBe(401);
    });

    it('returns user for valid token', async () => {
        const res = await createAuthApp().request('/auth/me', { headers: { Authorization: 'Bearer eyJ_mock' } });
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.user).toBeDefined();
        expect(body.user.email).toBeDefined();
    });
});
