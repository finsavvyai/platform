/**
 * OpenClaw Services Proxy Routes — /openclaw/services/*
 *
 * Proxies requests from the LunaOS Engine API to the
 * OpenClaw Service's /services/* and /channels/* endpoints.
 */

import { Hono } from 'hono';
import type { Env } from '../worker';
import { requireAuthOrApiKey } from '../middleware/api-key-auth';
import { proxyToOpenClaw } from './openclaw-proxy';

const app = new Hono<{ Bindings: Env }>();

// ═══════════════════════════════════════════════════════════
// Services Catalog
// ═══════════════════════════════════════════════════════════

app.get('/', requireAuthOrApiKey, async (c) => {
    const userId = c.get('userId');
    const res = await proxyToOpenClaw(c.env as any, '/services', { method: 'GET', _authHeader: c.req.header('Authorization') } as any, userId);
    return c.json(await res.json(), res.status as any);
});

app.get('/health', async (c) => {
    const res = await proxyToOpenClaw(c.env as any, '/services/health', { method: 'GET' });
    return c.json(await res.json(), res.status as any);
});

app.get('/:category', requireAuthOrApiKey, async (c) => {
    const category = c.req.param('category');
    const userId = c.get('userId');
    const res = await proxyToOpenClaw(c.env as any, `/services/${category}`, { method: 'GET', _authHeader: c.req.header('Authorization') } as any, userId);
    return c.json(await res.json(), res.status as any);
});

app.patch('/:category', requireAuthOrApiKey, async (c) => {
    const category = c.req.param('category');
    const userId = c.get('userId');
    const body = await c.req.text();
    const res = await proxyToOpenClaw(c.env as any, `/services/${category}`, { method: 'PATCH', body, _authHeader: c.req.header('Authorization') } as any, userId);
    return c.json(await res.json(), res.status as any);
});

app.post('/:category/test', requireAuthOrApiKey, async (c) => {
    const category = c.req.param('category');
    const userId = c.get('userId');
    const res = await proxyToOpenClaw(c.env as any, `/services/${category}/test`, { method: 'POST', _authHeader: c.req.header('Authorization') } as any, userId);
    return c.json(await res.json(), res.status as any);
});

// ═══════════════════════════════════════════════════════════
// Channel Connections (proxy to /channels/*)
// ═══════════════════════════════════════════════════════════

app.get('/channels/types', requireAuthOrApiKey, async (c) => {
    const res = await proxyToOpenClaw(c.env as any, '/channels', { method: 'GET' });
    return c.json(await res.json(), res.status as any);
});

app.get('/channels/connections', requireAuthOrApiKey, async (c) => {
    const userId = c.get('userId');
    const res = await proxyToOpenClaw(c.env as any, '/channels/connections', { method: 'GET', _authHeader: c.req.header('Authorization') } as any, userId);
    return c.json(await res.json(), res.status as any);
});

app.post('/channels/connect', requireAuthOrApiKey, async (c) => {
    const userId = c.get('userId');
    const body = await c.req.text();
    const res = await proxyToOpenClaw(c.env as any, '/channels/connect', { method: 'POST', body, _authHeader: c.req.header('Authorization') } as any, userId);
    return c.json(await res.json(), res.status as any);
});

app.delete('/channels/:id', requireAuthOrApiKey, async (c) => {
    const connId = c.req.param('id');
    const userId = c.get('userId');
    const res = await proxyToOpenClaw(c.env as any, `/channels/${connId}`, { method: 'DELETE', _authHeader: c.req.header('Authorization') } as any, userId);
    return c.json(await res.json(), res.status as any);
});

app.post('/channels/:id/test', requireAuthOrApiKey, async (c) => {
    const connId = c.req.param('id');
    const userId = c.get('userId');
    const res = await proxyToOpenClaw(c.env as any, `/channels/${connId}/test`, { method: 'POST', _authHeader: c.req.header('Authorization') } as any, userId);
    return c.json(await res.json(), res.status as any);
});

app.get('/channels/:id/stats', requireAuthOrApiKey, async (c) => {
    const connId = c.req.param('id');
    const userId = c.get('userId');
    const res = await proxyToOpenClaw(c.env as any, `/channels/${connId}/stats`, { method: 'GET', _authHeader: c.req.header('Authorization') } as any, userId);
    return c.json(await res.json(), res.status as any);
});

// ═══════════════════════════════════════════════════════════
// API Keys
// ═══════════════════════════════════════════════════════════

app.get('/api-keys', requireAuthOrApiKey, async (c) => {
    const userId = c.get('userId');
    const res = await proxyToOpenClaw(c.env as any, '/services/api-keys', { method: 'GET', _authHeader: c.req.header('Authorization') } as any, userId);
    return c.json(await res.json(), res.status as any);
});

app.post('/api-keys', requireAuthOrApiKey, async (c) => {
    const userId = c.get('userId');
    const body = await c.req.text();
    const res = await proxyToOpenClaw(c.env as any, '/services/api-keys', { method: 'POST', body, _authHeader: c.req.header('Authorization') } as any, userId);
    return c.json(await res.json(), res.status as any);
});

app.delete('/api-keys/:keyId', requireAuthOrApiKey, async (c) => {
    const keyId = c.req.param('keyId');
    const userId = c.get('userId');
    const res = await proxyToOpenClaw(c.env as any, `/services/api-keys/${keyId}`, { method: 'DELETE', _authHeader: c.req.header('Authorization') } as any, userId);
    return c.json(await res.json(), res.status as any);
});

// ═══════════════════════════════════════════════════════════
// Provider Status
// ═══════════════════════════════════════════════════════════

app.get('/providers/status', requireAuthOrApiKey, async (c) => {
    const userId = c.get('userId');
    const res = await proxyToOpenClaw(c.env as any, '/services/providers/status', { method: 'GET', _authHeader: c.req.header('Authorization') } as any, userId);
    return c.json(await res.json(), res.status as any);
});

export const openclawServicesRoutes = app;
