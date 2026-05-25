/**
 * OpenClaw Gateway — WebSocket connection management and persistence
 */

import type { OpenClawWSMessage, GatewayInfo } from './openclaw-types';

// ─── Gateway Connection ─────────────────────────────────────────────────────

/**
 * Connect to a remote OpenClaw Gateway via WebSocket.
 * Handles the full connect.challenge -> connect -> hello-ok handshake.
 */
export async function connectToGateway(
    gatewayUrl: string,
    token: string,
    timeoutMs = 10000,
): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(gatewayUrl);

        const timer = setTimeout(() => {
            ws.close();
            reject(new Error(`Gateway connection timeout: ${gatewayUrl}`));
        }, timeoutMs);

        let handshakeId: string | null = null;

        ws.addEventListener('open', () => { /* Wait for connect.challenge */ });

        ws.addEventListener('message', (event) => {
            try {
                const msg: OpenClawWSMessage = JSON.parse(typeof event.data === 'string' ? event.data : '');

                if (msg.type === 'event' && msg.event === 'connect.challenge') {
                    handshakeId = crypto.randomUUID();
                    const connectReq: OpenClawWSMessage = {
                        type: 'req', id: handshakeId, method: 'connect',
                        params: {
                            minProtocol: 3, maxProtocol: 3,
                            client: { id: 'lunaos-engine', version: '0.3.0', platform: 'cloudflare', mode: 'operator' },
                            role: 'operator', scopes: ['operator.read', 'operator.write'],
                            caps: ['tools', 'sessions', 'exec'], commands: [], permissions: {},
                            auth: { token }, locale: 'en-US', userAgent: 'lunaos-engine/0.3.0',
                            device: { id: `luna-engine-${crypto.randomUUID().slice(0, 8)}` },
                        },
                    };
                    ws.send(JSON.stringify(connectReq));
                    return;
                }

                if (msg.type === 'res' && msg.id === handshakeId && msg.ok) {
                    clearTimeout(timer); resolve(ws); return;
                }
                if (msg.type === 'res' && msg.id === handshakeId && !msg.ok) {
                    clearTimeout(timer); ws.close();
                    reject(new Error(`Gateway auth failed: ${msg.error || 'rejected'}`)); return;
                }
            } catch { /* Non-JSON, skip */ }
        });

        ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error(`Cannot reach Gateway: ${gatewayUrl}`)); });
        ws.addEventListener('close', () => { clearTimeout(timer); });
    });
}

/**
 * Send an RPC call over an established Gateway WebSocket connection.
 */
export async function gatewayRPC(
    ws: WebSocket,
    method: string,
    params: Record<string, any>,
    timeoutMs = 30000,
): Promise<any> {
    return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        const timer = setTimeout(() => reject(new Error(`RPC timeout: ${method}`)), timeoutMs);

        const handler = (event: MessageEvent) => {
            try {
                const msg: OpenClawWSMessage = JSON.parse(typeof event.data === 'string' ? event.data : '');
                if (msg.type === 'res' && msg.id === id) {
                    clearTimeout(timer);
                    ws.removeEventListener('message', handler);
                    if (msg.ok) resolve(msg.payload);
                    else reject(new Error(msg.error || `RPC failed: ${method}`));
                }
            } catch { /* Skip non-JSON */ }
        };

        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ type: 'req', id, method, params }));
    });
}

// ─── Gateway Persistence (D1) ───────────────────────────────────────────────

export async function saveGateway(
    db: D1Database, userId: string,
    gateway: { id: string; gatewayUrl: string; label: string; status?: string; healthStatus?: string; metadata?: any },
): Promise<void> {
    await db.prepare(`
        INSERT INTO openclaw_gateways (id, user_id, gateway_url, label, status, health_status, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
            gateway_url = excluded.gateway_url, label = excluded.label,
            status = excluded.status, health_status = excluded.health_status,
            metadata = excluded.metadata, updated_at = datetime('now')
    `).bind(
        gateway.id, userId, gateway.gatewayUrl, gateway.label,
        gateway.status || 'active', gateway.healthStatus || 'unknown',
        gateway.metadata ? JSON.stringify(gateway.metadata) : null,
    ).run();
}

export async function listGateways(db: D1Database, userId: string): Promise<GatewayInfo[]> {
    const result = await db.prepare(`
        SELECT id, gateway_url, label, status, health_status, last_connected_at, metadata
        FROM openclaw_gateways WHERE user_id = ? AND status != 'deleted' ORDER BY created_at DESC
    `).bind(userId).all();

    return (result.results || []).map((row: any) => ({
        id: row.id, gatewayUrl: row.gateway_url, token: '',
        label: row.label, status: row.status, healthStatus: row.health_status,
        lastConnectedAt: row.last_connected_at,
        capabilities: row.metadata ? JSON.parse(row.metadata)?.capabilities : undefined,
    }));
}

export async function deleteGateway(db: D1Database, userId: string, gatewayId: string): Promise<boolean> {
    const result = await db.prepare(`
        UPDATE openclaw_gateways SET status = 'deleted', updated_at = datetime('now')
        WHERE id = ? AND user_id = ?
    `).bind(gatewayId, userId).run();
    return (result.meta?.changes ?? 0) > 0;
}
