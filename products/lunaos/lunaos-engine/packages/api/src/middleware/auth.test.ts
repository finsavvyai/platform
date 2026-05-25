import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

// Mock verifyJWT before importing middleware
vi.mock('../utils/jwt', () => ({
    verifyJWT: vi.fn(),
}));

import { requireAuth } from './auth';
import { verifyJWT } from '../utils/jwt';

const mockedVerifyJWT = vi.mocked(verifyJWT);

function createApp() {
    const app = new Hono<{ Bindings: { JWT_SECRET: string } }>();
    app.use('/protected/*', requireAuth);
    app.get('/protected/data', (c) => {
        return c.json({
            userId: c.get('userId'),
            email: c.get('userEmail'),
            tier: c.get('userTier'),
        });
    });
    return app;
}

const env = { JWT_SECRET: 'test-secret' };

describe('requireAuth middleware', () => {
    it('should reject with 401 when Authorization header is missing', async () => {
        const app = createApp();
        const res = await app.request('/protected/data', {}, env);
        expect(res.status).toBe(401);
        const body = await res.json() as Record<string, any>;
        expect(body.error).toContain('Missing');
    });

    it('should reject with 401 when Authorization header has no Bearer prefix', async () => {
        const app = createApp();
        const res = await app.request('/protected/data', {
            headers: { Authorization: 'Basic abc123' },
        }, env);
        expect(res.status).toBe(401);
        const body = await res.json() as Record<string, any>;
        expect(body.error).toContain('Missing or invalid');
    });

    it('should reject with 401 when token is expired', async () => {
        mockedVerifyJWT.mockRejectedValue(new Error('Token expired'));
        const app = createApp();
        const res = await app.request('/protected/data', {
            headers: { Authorization: 'Bearer expired-token' },
        }, env);
        expect(res.status).toBe(401);
        const body = await res.json() as Record<string, any>;
        expect(body.error).toContain('Invalid or expired');
        expect(body.detail).toBe('Token expired');
    });

    it('should reject with 401 when token is malformed', async () => {
        mockedVerifyJWT.mockRejectedValue(new Error('Invalid token format'));
        const app = createApp();
        const res = await app.request('/protected/data', {
            headers: { Authorization: 'Bearer not.a.valid.jwt' },
        }, env);
        expect(res.status).toBe(401);
        const body = await res.json() as Record<string, any>;
        expect(body.error).toContain('Invalid or expired');
    });

    it('should pass and set context vars when JWT is valid', async () => {
        mockedVerifyJWT.mockResolvedValue({
            sub: 'user-42',
            email: 'dev@lunaos.ai',
            tier: 'pro',
            iat: 1000,
            exp: 9999999999,
        });
        const app = createApp();
        const res = await app.request('/protected/data', {
            headers: { Authorization: 'Bearer valid-token' },
        }, env);
        expect(res.status).toBe(200);
        const body = await res.json() as Record<string, any>;
        expect(body.userId).toBe('user-42');
        expect(body.email).toBe('dev@lunaos.ai');
        expect(body.tier).toBe('pro');
    });

    it('should pass the token (not the full header) to verifyJWT', async () => {
        mockedVerifyJWT.mockResolvedValue({
            sub: 'u1', email: 'a@b.c', tier: 'free', iat: 0, exp: 9999999999,
        });
        const app = createApp();
        await app.request('/protected/data', {
            headers: { Authorization: 'Bearer my-secret-token' },
        }, env);
        expect(mockedVerifyJWT).toHaveBeenCalledWith('my-secret-token', 'test-secret');
    });
});
