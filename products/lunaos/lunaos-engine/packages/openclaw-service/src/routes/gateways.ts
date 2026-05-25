/**
 * Gateway Routes — /gateways/*
 *
 * Manage remote OpenClaw gateway registrations.
 * Gateways are user-owned machines that can execute agents locally.
 */

import { Hono } from 'hono';
import type { AppEnv, ServiceEnv } from '../types';
import { requireAuth, rateLimit } from '../middleware/auth';

export const gatewayRoutes = new Hono<AppEnv>();

// ─── List gateways ──────────────────────────────────────────────────────────

gatewayRoutes.get('/', requireAuth, async (c) => {
    const userId = c.get('userId') as string;

    const result = await c.env.DB.prepare(`
        SELECT id, gateway_url, label, status, health_status, last_connected_at, metadata, created_at
        FROM openclaw_gateways
        WHERE user_id = ? AND status != 'deleted'
        ORDER BY created_at DESC
    `).bind(userId).all();

    const gateways = (result.results || []).map((r: any) => ({
        id: r.id,
        gatewayUrl: r.gateway_url,
        label: r.label,
        status: r.status,
        healthStatus: r.health_status,
        lastConnectedAt: r.last_connected_at,
        capabilities: r.metadata ? JSON.parse(r.metadata)?.capabilities : undefined,
        createdAt: r.created_at,
    }));

    return c.json({ gateways, total: gateways.length });
});

// ─── Register gateway ───────────────────────────────────────────────────────

gatewayRoutes.post('/register', requireAuth, rateLimit, async (c) => {
    const userId = c.get('userId') as string;
    const body = await c.req.json<{
        gatewayUrl: string;
        token: string;
        label?: string;
    }>();

    if (!body.gatewayUrl || !body.token) {
        return c.json({ error: 'Missing required fields: gatewayUrl, token' }, 400);
    }

    if (!body.gatewayUrl.startsWith('wss://') && !body.gatewayUrl.startsWith('ws://')) {
        return c.json({ error: 'gatewayUrl must use ws:// or wss:// protocol' }, 400);
    }

    const id = crypto.randomUUID();

    await c.env.DB.prepare(`
        INSERT INTO openclaw_gateways (id, user_id, gateway_url, label, status, health_status, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'active', 'unknown', ?, datetime('now'), datetime('now'))
    `).bind(
        id, userId, body.gatewayUrl,
        body.label || 'My Gateway',
        JSON.stringify({ token_hash: await hashToken(body.token) }),
    ).run();

    // Store token securely in KV (not D1)
    await c.env.KV.put(`gw_token:${id}`, body.token, { expirationTtl: 86400 * 365 });

    return c.json({
        id,
        gatewayUrl: body.gatewayUrl,
        label: body.label || 'My Gateway',
        status: 'active',
        message: 'Gateway registered successfully',
    }, 201);
});

// ─── Delete gateway ─────────────────────────────────────────────────────────

gatewayRoutes.delete('/:id', requireAuth, async (c) => {
    const userId = c.get('userId') as string;
    const gatewayId = c.req.param('id');

    const result = await c.env.DB.prepare(`
        UPDATE openclaw_gateways SET status = 'deleted', updated_at = datetime('now')
        WHERE id = ? AND user_id = ?
    `).bind(gatewayId, userId).run();

    if ((result.meta?.changes ?? 0) === 0) {
        return c.json({ error: 'Gateway not found' }, 404);
    }

    // Clean up KV token
    await c.env.KV.delete(`gw_token:${gatewayId}`);

    return c.json({ deleted: true, id: gatewayId });
});

// ─── Health check a gateway ─────────────────────────────────────────────────

gatewayRoutes.post('/:id/ping', requireAuth, async (c) => {
    const userId = c.get('userId') as string;
    const gatewayId = c.req.param('id');

    const gateway = await c.env.DB.prepare(`
        SELECT gateway_url FROM openclaw_gateways
        WHERE id = ? AND user_id = ? AND status = 'active'
    `).bind(gatewayId, userId).first<{ gateway_url: string }>();

    if (!gateway) {
        return c.json({ error: 'Gateway not found' }, 404);
    }

    // Simple HTTP health check to gateway
    const startTime = Date.now();
    try {
        const token = await c.env.KV.get(`gw_token:${gatewayId}`);
        // Just check if origin is reachable (basic TCP-level check via fetch)
        const healthUrl = gateway.gateway_url.replace('wss://', 'https://').replace('ws://', 'http://');
        const res = await fetch(healthUrl, {
            method: 'HEAD',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            signal: AbortSignal.timeout(5000),
        });

        const healthy = res.ok || res.status === 426; // 426 = Upgrade Required (WebSocket)
        const latency = Date.now() - startTime;

        await c.env.DB.prepare(`
            UPDATE openclaw_gateways
            SET health_status = ?, last_connected_at = datetime('now'), updated_at = datetime('now')
            WHERE id = ?
        `).bind(healthy ? 'healthy' : 'degraded', gatewayId).run();

        return c.json({
            id: gatewayId,
            healthy,
            latencyMs: latency,
            statusCode: res.status,
        });
    } catch (err: any) {
        await c.env.DB.prepare(`
            UPDATE openclaw_gateways SET health_status = 'offline', updated_at = datetime('now')
            WHERE id = ?
        `).bind(gatewayId).run();

        return c.json({
            id: gatewayId,
            healthy: false,
            error: err.message,
            latencyMs: Date.now() - startTime,
        });
    }
});

async function hashToken(token: string): Promise<string> {
    const data = new TextEncoder().encode(token);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
