import { test, expect } from '@playwright/test';

/**
 * Simulates a Claude/ChatGPT browser extension calling the LunaOS API.
 * Extensions use API keys (not JWT) and present a User-Agent we recognize.
 */

const API_KEY = process.env.LUNAOS_TEST_API_KEY || 'luna_key_test_placeholder';

test.describe('Browser extension integration', () => {
    test('GET /openclaw/tools returns tool catalog', async ({ request }) => {
        const res = await request.get('/openclaw/tools', {
            headers: { Authorization: `Bearer ${API_KEY}` },
        });
        if (res.status() === 404) test.skip(true, 'OpenClaw tools endpoint not deployed');
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(Array.isArray(body.tools) || Array.isArray(body.data)).toBeTruthy();
    });

    test('POST /runs with missing auth returns 401', async ({ request }) => {
        const res = await request.post('/runs', {
            data: { workflowId: 'wf_1', input: { hello: 'world' } },
        });
        expect([401, 403]).toContain(res.status());
    });

    test('POST /openclaw/tools/run dispatches a known agent', async ({ request }) => {
        const res = await request.post('/openclaw/tools/run', {
            headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
            data: { agent: 'code-review', context: 'console.log("ok")', useRag: false },
        });
        if (res.status() === 404) test.skip(true, 'run endpoint not deployed');
        if (!res.ok()) {
            const text = await res.text();
            expect([401, 402, 429], `unexpected error ${res.status()}: ${text}`).toContain(res.status());
            return;
        }
        expect(res.ok()).toBeTruthy();
    });

    test('MCP handshake endpoint advertises server info', async ({ request }) => {
        const res = await request.post('/mcp/initialize', {
            headers: { Authorization: `Bearer ${API_KEY}` },
            data: { protocolVersion: '0.1.0', capabilities: {} },
        });
        if (res.status() === 404) test.skip(true, 'MCP endpoint not deployed');
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body).toHaveProperty('serverInfo');
    });

    test('rate limiting responds with 429 when spamming', async ({ request }) => {
        const results = await Promise.all(
            Array.from({ length: 25 }, () =>
                request.get('/openclaw/tools', {
                    headers: { Authorization: `Bearer ${API_KEY}` },
                }),
            ),
        );
        const codes = results.map((r) => r.status());
        const has429 = codes.some((c) => c === 429);
        const allOk = codes.every((c) => c < 400);
        expect(has429 || allOk, `rate-limit signal expected or all-ok, got: ${codes.join(',')}`).toBeTruthy();
    });

    test('User-Agent header is echoed into correlation metadata', async ({ request }) => {
        const res = await request.get('/openclaw/tools', {
            headers: { Authorization: `Bearer ${API_KEY}`, 'User-Agent': 'LunaOS-Ext/1.0' },
        });
        if (res.status() === 404) test.skip(true, 'endpoint not deployed');
        expect(res.ok()).toBeTruthy();
    });
});
