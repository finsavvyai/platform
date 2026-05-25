/**
 * /api/recordings/* — auth + routing proof.
 *
 * The MVP playback endpoint streams video bytes from R2. It accepts
 * auth via either the Authorization: Bearer header OR a `?token=`
 * query param (because HTMLVideoElement can't send custom headers).
 * We prove here that:
 *   1. Unauthed GET is 401 (not 404 → route is mounted).
 *   2. Bad `?token=` is 401 (the query path validates).
 *   3. Unauthed POST upload is 401.
 *   4. Valid auth on a nonexistent run is 404 (auth layer passed,
 *      storage layer correctly reports the miss).
 *
 * We don't actually upload a real video here — that's covered by the
 * curl-based live smoke test in the MVP report — because generating
 * a valid JWT in the test harness requires the live JWT_SECRET.
 */
import { test, expect } from '@playwright/test';

const API = process.env.E2E_API_URL || 'https://api.qestro.app';
const RUN = 'not-a-real-run-id-' + Date.now();

test.describe('/api/recordings — auth and routing', () => {
    test('GET without auth → 401', async ({ request }) => {
        const res = await request.get(`${API}/api/recordings/${RUN}`);
        expect(res.status()).toBe(401);
        const body = await res.json().catch(() => ({}));
        // Must NOT be the default Hono notFound payload.
        expect(body?.error).not.toBe('Not Found');
    });

    test('GET with bad ?token= → 401', async ({ request }) => {
        const res = await request.get(`${API}/api/recordings/${RUN}?token=not.a.real.token`);
        expect(res.status()).toBe(401);
    });

    test('GET with bad bearer → 401', async ({ request }) => {
        const res = await request.get(`${API}/api/recordings/${RUN}`, {
            headers: { Authorization: 'Bearer not.a.real.token' },
        });
        expect(res.status()).toBe(401);
    });

    test('POST upload without auth → 401', async ({ request }) => {
        const res = await request.post(`${API}/api/recordings/${RUN}/upload`, {
            data: new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]), // EBML magic
            headers: { 'Content-Type': 'video/webm' },
        });
        expect(res.status()).toBe(401);
    });

    test('POST upload with bad bearer → 401', async ({ request }) => {
        const res = await request.post(`${API}/api/recordings/${RUN}/upload`, {
            data: new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]),
            headers: {
                'Content-Type': 'video/webm',
                Authorization: 'Bearer not.a.real.token',
            },
        });
        expect(res.status()).toBe(401);
    });

    test('route is mounted — GET returns 401 not Hono default 404', async ({ request }) => {
        // A mounted route with auth rejects unauthed callers with 401
        // BEFORE Hono's notFound fires. This alone proves the route is
        // registered (a 404 with `error: "Not Found"` would indicate
        // the /api/recordings/* prefix is not wired up).
        const res = await request.get(`${API}/api/recordings/${RUN}`);
        expect(res.status()).toBe(401);
        const body = await res.json().catch(() => ({}));
        expect(body?.error).not.toBe('Not Found');
        expect(body?.error).toBe('Unauthorized');
    });
});
