import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { securityHeaders } from './security-headers';

function createApp() {
    const app = new Hono();
    app.use('/*', securityHeaders);
    app.get('/test', (c) => c.json({ ok: true }));
    return app;
}

describe('securityHeaders middleware', () => {
    it('should set Strict-Transport-Security header', async () => {
        const app = createApp();
        const res = await app.request('/test');
        const hsts = res.headers.get('Strict-Transport-Security');
        expect(hsts).toContain('max-age=31536000');
        expect(hsts).toContain('includeSubDomains');
        expect(hsts).toContain('preload');
    });

    it('should set X-Content-Type-Options to nosniff', async () => {
        const app = createApp();
        const res = await app.request('/test');
        expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('should set X-Frame-Options to DENY', async () => {
        const app = createApp();
        const res = await app.request('/test');
        expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('should set Content-Security-Policy with restrictive defaults', async () => {
        const app = createApp();
        const res = await app.request('/test');
        const csp = res.headers.get('Content-Security-Policy');
        expect(csp).toContain("default-src 'none'");
        expect(csp).toContain("script-src 'self'");
        expect(csp).toContain("frame-ancestors 'none'");
    });

    it('should set X-XSS-Protection header', async () => {
        const app = createApp();
        const res = await app.request('/test');
        expect(res.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    });

    it('should set Referrer-Policy', async () => {
        const app = createApp();
        const res = await app.request('/test');
        expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    it('should set Permissions-Policy restricting sensitive features', async () => {
        const app = createApp();
        const res = await app.request('/test');
        const pp = res.headers.get('Permissions-Policy');
        expect(pp).toContain('camera=()');
        expect(pp).toContain('microphone=()');
        expect(pp).toContain('geolocation=()');
    });

    it('should set Cross-Origin headers', async () => {
        const app = createApp();
        const res = await app.request('/test');
        expect(res.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
        expect(res.headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp');
        expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
    });

    it('should not expose Server header', async () => {
        const app = createApp();
        const res = await app.request('/test');
        expect(res.headers.get('Server')).toBeNull();
        expect(res.headers.get('X-Powered-By')).toBeNull();
    });

    it('should still return the original response body', async () => {
        const app = createApp();
        const res = await app.request('/test');
        expect(res.status).toBe(200);
        const body = await res.json() as Record<string, any>;
        expect(body.ok).toBe(true);
    });
});
