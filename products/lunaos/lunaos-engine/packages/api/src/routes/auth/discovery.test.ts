/**
 * discovery route — GET /v1/sso/discovery?email=<email>
 * Verifies: 200 hit, 404 miss, 400 bad email, 429 rate-limit, no enumeration.
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { discoveryRouter } from './discovery';

// Mount the router at its real path so internal `get('/')` handler matches.
function makeApp(env: ReturnType<typeof makeEnv>) {
    const app = new Hono();
    app.route('/v1/sso/discovery', discoveryRouter);
    return { fetch: (req: Request) => app.fetch(req, env) };
}

// ─── Env mock ─────────────────────────────────────────────────────────────────

function makeEnv(dbRow: { id: string; type: string } | null = null) {
    return {
        DB: {
            prepare: vi.fn(() => ({
                bind: vi.fn(() => ({
                    first: vi.fn(async () => dbRow),
                })),
            })),
        },
        KV: {},
        JWT_SECRET: 'test',
    };
}

function makeReq(email: string, ip = '1.2.3.4'): Request {
    return new Request(`http://localhost/v1/sso/discovery?email=${encodeURIComponent(email)}`, {
        headers: { 'cf-connecting-ip': ip },
    });
}

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('GET /v1/sso/discovery — 200 path', () => {
    it('returns idpId, type, initiateUrl for known email domain (oidc)', async () => {
        const env = makeEnv({ id: 'idp-okta', type: 'oidc' });
        const res = await makeApp(env).fetch(makeReq('alice@acme.com'));
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.idpId).toBe('idp-okta');
        expect(body.type).toBe('oidc');
        expect(body.initiateUrl).toBe('/v1/sso/oidc/initiate');
    });

    it('returns correct initiateUrl for saml type', async () => {
        const env = makeEnv({ id: 'idp-saml', type: 'saml' });
        const res = await makeApp(env).fetch(makeReq('bob@corp.com'));
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.initiateUrl).toBe('/v1/sso/saml/initiate');
    });

    it('does NOT leak orgId in response', async () => {
        const env = makeEnv({ id: 'idp-1', type: 'oidc' });
        const res = await makeApp(env).fetch(makeReq('user@domain.io'));
        const body = await res.json() as any;
        expect(body.orgId).toBeUndefined();
    });

    it('domain lookup is case-insensitive (lowercases domain)', async () => {
        const env = makeEnv({ id: 'idp-1', type: 'oidc' });
        await makeApp(env).fetch(makeReq('User@ACME.COM'));
        const bindCall = (env.DB.prepare as ReturnType<typeof vi.fn>).mock.results[0]?.value?.bind?.mock?.calls?.[0];
        expect(bindCall?.[0]).toBe('acme.com');
    });
});

// ─── Miss path — uniform 200 (FIND-010 fix: no enumeration oracle) ───────────

describe('GET /v1/sso/discovery — miss path (uniform 200)', () => {
    it('returns 200 with null fields for unknown domain (FIND-010)', async () => {
        const env = makeEnv(null);
        const res = await makeApp(env).fetch(makeReq('user@unknown-domain.io'));
        // FIND-010: no 404 oracle. Both hit and miss return 200 with same shape.
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.idpId).toBeNull();
        expect(body.type).toBeNull();
        expect(body.initiateUrl).toBeNull();
    });

    it('miss response has same shape as 200 hit (no info-leak fields)', async () => {
        const env = makeEnv(null);
        const res = await makeApp(env).fetch(makeReq('user@nothing.com'));
        const body = await res.json() as any;
        expect(Object.keys(body).sort()).toEqual(
            ['correlationId', 'idpId', 'initiateUrl', 'type'].sort(),
        );
    });
});

// ─── 400: malformed email ─────────────────────────────────────────────────────

describe('GET /v1/sso/discovery — 400 validation', () => {
    it('returns 400 for missing email param', async () => {
        const env = makeEnv();
        const res = await makeApp(env).fetch(
            new Request('http://localhost/v1/sso/discovery', { headers: { 'cf-connecting-ip': '1.2.3.4' } }),
        );
        expect(res.status).toBe(400);
    });

    it('returns 400 for non-email string', async () => {
        const env = makeEnv();
        const res = await makeApp(env).fetch(makeReq('not-an-email'));
        expect(res.status).toBe(400);
        const body = await res.json() as any;
        expect(body.error).toBe('validation_failed');
    });

    it('returns 400 for email without domain part', async () => {
        const env = makeEnv();
        const res = await makeApp(env).fetch(makeReq('user@'));
        expect(res.status).toBe(400);
    });
});

// ─── Rate limiting (30 req/min/IP) ────────────────────────────────────────────

describe('GET /v1/sso/discovery — rate limiting', () => {
    it('returns 429 after 30 requests from same IP', async () => {
        const env = makeEnv({ id: 'idp-1', type: 'oidc' });
        const app = makeApp(env);
        const testIp = `10.0.0.${Math.floor(Math.random() * 200) + 10}`; // unique IP per test run
        let lastStatus = 200;
        for (let i = 0; i < 32; i++) {
            const res = await app.fetch(makeReq(`user${i}@example.com`, testIp));
            lastStatus = res.status;
        }
        expect(lastStatus).toBe(429);
    });

    it('429 response includes Retry-After header', async () => {
        const env = makeEnv({ id: 'idp-1', type: 'oidc' });
        const app = makeApp(env);
        const hammeredIp = `10.1.${Math.floor(Math.random() * 255)}.1`;
        let finalRes: Response | null = null;
        for (let i = 0; i < 32; i++) {
            finalRes = await app.fetch(makeReq(`x${i}@example.com`, hammeredIp));
        }
        expect(finalRes?.headers.get('Retry-After')).toBe('60');
    });

    it('different IPs have independent rate-limit buckets', async () => {
        const env = makeEnv({ id: 'idp-1', type: 'oidc' });
        const app = makeApp(env);
        const ipA = `192.168.100.${Math.floor(Math.random() * 200)}`;
        const ipB = `192.168.200.${Math.floor(Math.random() * 200)}`;
        // Exhaust ipA
        for (let i = 0; i < 32; i++) {
            await app.fetch(makeReq(`a${i}@ex.com`, ipA));
        }
        // ipB should still be allowed
        const res = await app.fetch(makeReq('user@ex.com', ipB));
        expect(res.status).not.toBe(429);
    });
});
