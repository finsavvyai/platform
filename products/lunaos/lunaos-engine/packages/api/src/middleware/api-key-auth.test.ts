import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

vi.mock('../services/key-manager', () => ({
    isApiKey: vi.fn(),
    validateApiKey: vi.fn(),
}));

vi.mock('../utils/jwt', () => ({
    verifyJWT: vi.fn(),
}));

import { requireAuthOrApiKey } from './api-key-auth';
import { isApiKey, validateApiKey } from '../services/key-manager';
import { verifyJWT } from '../utils/jwt';

const mockedIsApiKey = vi.mocked(isApiKey);
const mockedValidateApiKey = vi.mocked(validateApiKey);
const mockedVerifyJWT = vi.mocked(verifyJWT);

function createApp() {
    const app = new Hono<{ Bindings: { JWT_SECRET: string; DB: any } }>();
    app.use('/api/*', requireAuthOrApiKey);
    app.get('/api/data', (c) => {
        return c.json({
            userId: c.get('userId'),
            email: c.get('userEmail'),
            tier: c.get('userTier'),
        });
    });
    return app;
}

const mockDB = { prepare: vi.fn() };
const env = { JWT_SECRET: 'test-secret', DB: mockDB };

describe('requireAuthOrApiKey middleware', () => {
    it('should reject 401 when Authorization header is missing', async () => {
        const app = createApp();
        const res = await app.request('/api/data', {}, env);
        expect(res.status).toBe(401);
        const body = await res.json() as Record<string, any>;
        expect(body.error).toContain('Missing');
    });

    it('should reject 401 when header has no Bearer prefix', async () => {
        const app = createApp();
        const res = await app.request('/api/data', {
            headers: { Authorization: 'Token abc' },
        }, env);
        expect(res.status).toBe(401);
    });

    it('should authenticate with a valid API key', async () => {
        mockedIsApiKey.mockReturnValue(true);
        mockedValidateApiKey.mockResolvedValue({
            valid: true, keyId: 'k1', userId: 'user-7', name: 'dev', tier: 'team',
        });
        const app = createApp();
        const res = await app.request('/api/data', {
            headers: { Authorization: 'Bearer lnos_live_abc' },
        }, env);
        expect(res.status).toBe(200);
        const body = await res.json() as Record<string, any>;
        expect(body.userId).toBe('user-7');
        expect(body.tier).toBe('team');
        expect(body.email).toBe('');
    });

    it('should reject 401 for revoked API key', async () => {
        mockedIsApiKey.mockReturnValue(true);
        mockedValidateApiKey.mockResolvedValue({ valid: false });
        const app = createApp();
        const res = await app.request('/api/data', {
            headers: { Authorization: 'Bearer lnos_live_revoked' },
        }, env);
        expect(res.status).toBe(401);
        const body = await res.json() as Record<string, any>;
        expect(body.error).toContain('revoked');
    });

    it('should reject 401 when API key returns null', async () => {
        mockedIsApiKey.mockReturnValue(true);
        mockedValidateApiKey.mockResolvedValue(null);
        const app = createApp();
        const res = await app.request('/api/data', {
            headers: { Authorization: 'Bearer lnos_live_bad' },
        }, env);
        expect(res.status).toBe(401);
    });

    it('should fall through to JWT when token is not an API key', async () => {
        mockedIsApiKey.mockReturnValue(false);
        mockedVerifyJWT.mockResolvedValue({
            sub: 'user-9', email: 'jwt@lunaos.ai', tier: 'pro', iat: 0, exp: 9999999999,
        });
        const app = createApp();
        const res = await app.request('/api/data', {
            headers: { Authorization: 'Bearer jwt-token' },
        }, env);
        expect(res.status).toBe(200);
        const body = await res.json() as Record<string, any>;
        expect(body.userId).toBe('user-9');
        expect(body.email).toBe('jwt@lunaos.ai');
    });

    it('should reject 401 when JWT is invalid (non-API-key path)', async () => {
        mockedIsApiKey.mockReturnValue(false);
        mockedVerifyJWT.mockRejectedValue(new Error('Invalid signature'));
        const app = createApp();
        const res = await app.request('/api/data', {
            headers: { Authorization: 'Bearer bad-jwt' },
        }, env);
        expect(res.status).toBe(401);
        const body = await res.json() as Record<string, any>;
        expect(body.error).toContain('Invalid or expired');
    });
});
