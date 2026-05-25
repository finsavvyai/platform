/**
 * OpenClaw Bridge routes — /openclaw/*
 *
 * Full native OpenClaw integration for LunaOS.
 *
 * Sub-routes:
 *   /openclaw/register        — Register/remove gateways
 *   /openclaw/status           — Check Gateway connectivity
 *   /openclaw/dispatch         — Dispatch agents to remote Gateway
 *   /openclaw/dispatch/stream  — Stream dispatch results via SSE
 *   /openclaw/exec             — Remote command execution
 *   /openclaw/message          — Send messages to Gateway agent
 *   /openclaw/sessions         — List active sessions
 *   /openclaw/tools/*          — Native OpenClaw tool endpoints
 *   /openclaw/analytics/*      — Usage analytics and metrics
 */

import { Hono } from 'hono';
import type { Env } from '../worker';
import { requireAuthOrApiKey } from '../middleware/api-key-auth';
import { saveGateway, deleteGateway as removeGateway } from '../services/openclaw-service';
import { openclawToolRoutes } from './openclaw-tools';
import { openclawAnalyticsRoutes } from './openclaw-analytics';
import { openclawDispatchRoutes } from './openclaw-dispatch';
import {
    connectToGateway, gatewayRPC, getGatewayConfig,
    type GatewayRegistration,
} from './openclaw-gateway-helpers';

const openclawRoutes = new Hono<{ Bindings: Env }>();

// Mount sub-routes
openclawRoutes.route('/tools', openclawToolRoutes);
openclawRoutes.route('/analytics', openclawAnalyticsRoutes);
openclawRoutes.route('/dispatch', openclawDispatchRoutes);

// ─── POST /openclaw/register — Register a remote OpenClaw Gateway ───

openclawRoutes.post('/register', requireAuthOrApiKey, async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json<{
        gatewayUrl: string; token: string; label?: string;
        id?: string; setDefault?: boolean;
    }>();

    if (!body.gatewayUrl || (!body.gatewayUrl.startsWith('wss://') && !body.gatewayUrl.startsWith('ws://'))) {
        return c.json({ error: 'gatewayUrl must start with wss:// or ws://' }, 400);
    }
    if (!body.token) {
        return c.json({ error: 'Gateway auth token is required' }, 400);
    }

    try {
        const ws = await connectToGateway(body.gatewayUrl, body.token, 8000);
        const health = await gatewayRPC(ws, 'health', {}, 5000);
        ws.close();

        const gatewayId = body.id || crypto.randomUUID().slice(0, 8);
        const registration: GatewayRegistration = {
            gatewayUrl: body.gatewayUrl, token: body.token,
            label: body.label || 'Default Gateway',
        };

        const key = `openclaw:${userId}:gateways:${gatewayId}`;
        await c.env.KV.put(key, JSON.stringify(registration), { expirationTtl: 60 * 60 * 24 * 365 });

        if (body.setDefault !== false) {
            await c.env.KV.put(`openclaw:${userId}:default`, JSON.stringify(registration), { expirationTtl: 60 * 60 * 24 * 365 });
        }

        try {
            await saveGateway(c.env.DB, userId, {
                id: gatewayId, gatewayUrl: body.gatewayUrl,
                label: registration.label || 'Default Gateway',
                status: 'active', healthStatus: 'healthy', metadata: health,
            });
        } catch { /* D1 write is non-critical */ }

        return c.json({ success: true, gatewayId, label: registration.label, health, message: 'Gateway registered and verified' });
    } catch (err: any) {
        return c.json({
            error: 'Gateway connection failed', detail: err.message,
            hint: 'Ensure your OpenClaw Gateway is running and accessible. For remote access use wss:// with Tailscale Funnel or SSH tunnel.',
        }, 502);
    }
});

// ─── DELETE /openclaw/register/:id — Remove a gateway ────────────────

openclawRoutes.delete('/register/:id', requireAuthOrApiKey, async (c) => {
    const userId = c.get('userId');
    const gatewayId = c.req.param('id');
    await c.env.KV.delete(`openclaw:${userId}:gateways:${gatewayId}`);
    try { await removeGateway(c.env.DB, userId, gatewayId); } catch { /* non-critical */ }
    return c.json({ success: true, deleted: gatewayId });
});

// ─── GET /openclaw/status — Check Gateway connectivity ───────────────

openclawRoutes.get('/status', requireAuthOrApiKey, async (c) => {
    const userId = c.get('userId');
    const config = await getGatewayConfig(c.env.KV, userId);

    if (!config) {
        return c.json({ connected: false, error: 'No OpenClaw Gateway registered', hint: 'POST /openclaw/register with your gateway URL and token' });
    }

    try {
        const ws = await connectToGateway(config.gatewayUrl, config.token, 5000);
        const health = await gatewayRPC(ws, 'health', {}, 5000);
        ws.close();
        return c.json({ connected: true, gatewayUrl: config.gatewayUrl, label: config.label, health });
    } catch (err: any) {
        return c.json({ connected: false, gatewayUrl: config.gatewayUrl, label: config.label, error: err.message });
    }
});

// ─── GET /openclaw/sessions — List active sessions on Gateway ────────

openclawRoutes.get('/sessions', requireAuthOrApiKey, async (c) => {
    const userId = c.get('userId');
    const config = await getGatewayConfig(c.env.KV, userId);
    if (!config) return c.json({ error: 'No Gateway registered' }, 400);

    try {
        const ws = await connectToGateway(config.gatewayUrl, config.token);
        const sessions = await gatewayRPC(ws, 'sessions_list', {});
        ws.close();
        return c.json({ sessions });
    } catch (err: any) {
        return c.json({ error: err.message }, 502);
    }
});

// ─── POST /openclaw/exec — Execute a command on remote Gateway ───────

openclawRoutes.post('/exec', requireAuthOrApiKey, async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json<{ command: string; gatewayId?: string; timeout?: number }>();
    if (!body.command) return c.json({ error: 'command is required' }, 400);

    const config = await getGatewayConfig(c.env.KV, userId, body.gatewayId);
    if (!config) return c.json({ error: 'No Gateway registered' }, 400);

    try {
        const ws = await connectToGateway(config.gatewayUrl, config.token);
        const result = await gatewayRPC(ws, 'exec', { command: body.command, timeout: body.timeout || 30 }, (body.timeout || 30) * 1000 + 5000);
        ws.close();
        return c.json({ result });
    } catch (err: any) {
        return c.json({ error: err.message }, 502);
    }
});

// ─── POST /openclaw/message — Send a chat message to Gateway agent ───

openclawRoutes.post('/message', requireAuthOrApiKey, async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json<{ message: string; sessionKey?: string; gatewayId?: string }>();
    if (!body.message) return c.json({ error: 'message is required' }, 400);

    const config = await getGatewayConfig(c.env.KV, userId, body.gatewayId);
    if (!config) return c.json({ error: 'No Gateway registered' }, 400);

    try {
        const ws = await connectToGateway(config.gatewayUrl, config.token);
        const result = body.sessionKey
            ? await gatewayRPC(ws, 'sessions_send', { sessionKey: body.sessionKey, message: body.message, timeoutSeconds: 0 })
            : await gatewayRPC(ws, 'agent', { message: body.message, idempotencyKey: crypto.randomUUID() });
        ws.close();
        return c.json({ result });
    } catch (err: any) {
        return c.json({ error: err.message }, 502);
    }
});

export { openclawRoutes };
