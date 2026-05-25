/**
 * OpenClaw Gateway Helpers — WebSocket connection + RPC + KV config
 *
 * Used by openclaw route handlers to talk to remote OpenClaw Gateways.
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface GatewayRegistration {
    gatewayUrl: string;     // wss://my-machine.tail12345.ts.net:18789
    token: string;          // OPENCLAW_GATEWAY_TOKEN
    label?: string;         // "Home Mac", "Work Server"
}

interface OpenClawWSMessage {
    type: 'req' | 'res' | 'event';
    id?: string;
    method?: string;
    params?: Record<string, any>;
    ok?: boolean;
    payload?: any;
    error?: string;
    event?: string;
}

// ─── Connect to remote OpenClaw Gateway ─────────────────────────────

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

        ws.addEventListener('open', () => {
            // Wait for connect.challenge event from Gateway
        });

        ws.addEventListener('message', (event) => {
            try {
                const msg: OpenClawWSMessage = JSON.parse(typeof event.data === 'string' ? event.data : '');

                if (msg.type === 'event' && msg.event === 'connect.challenge') {
                    handshakeId = crypto.randomUUID();
                    const connectReq: OpenClawWSMessage = {
                        type: 'req', id: handshakeId, method: 'connect',
                        params: {
                            minProtocol: 3, maxProtocol: 3,
                            client: { id: 'lunaos-cloud', version: '0.2.0', platform: 'cloudflare', mode: 'operator' },
                            role: 'operator', scopes: ['operator.read', 'operator.write'],
                            caps: [], commands: [], permissions: {},
                            auth: { token }, locale: 'en-US', userAgent: 'lunaos-api/0.2.0',
                            device: { id: `luna-cloud-${crypto.randomUUID().slice(0, 8)}` },
                        },
                    };
                    ws.send(JSON.stringify(connectReq));
                    return;
                }

                if (msg.type === 'res' && msg.id === handshakeId && msg.ok) {
                    clearTimeout(timer);
                    resolve(ws);
                    return;
                }

                if (msg.type === 'res' && msg.id === handshakeId && !msg.ok) {
                    clearTimeout(timer);
                    ws.close();
                    reject(new Error(`Gateway auth failed: ${msg.error || 'rejected'}`));
                    return;
                }
            } catch (_e) { /* Non-JSON, skip */ }
        });

        ws.addEventListener('error', () => {
            clearTimeout(timer);
            reject(new Error(`Cannot reach Gateway: ${gatewayUrl}`));
        });

        ws.addEventListener('close', () => { clearTimeout(timer); });
    });
}

// ─── Send RPC to Gateway ────────────────────────────────────────────

export async function gatewayRPC(
    ws: WebSocket,
    method: string,
    params: Record<string, any>,
    timeoutMs = 30000,
): Promise<any> {
    return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();

        const timer = setTimeout(() => {
            reject(new Error(`RPC timeout: ${method}`));
        }, timeoutMs);

        const handler = (event: MessageEvent) => {
            try {
                const msg: OpenClawWSMessage = JSON.parse(typeof event.data === 'string' ? event.data : '');
                if (msg.type === 'res' && msg.id === id) {
                    clearTimeout(timer);
                    ws.removeEventListener('message', handler);
                    if (msg.ok) resolve(msg.payload);
                    else reject(new Error(msg.error || `RPC failed: ${method}`));
                }
            } catch (_e) { /* Skip non-JSON */ }
        };

        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ type: 'req', id, method, params }));
    });
}

// ─── Load user's Gateway registration from KV ───────────────────────

export async function getGatewayConfig(
    kv: KVNamespace,
    userId: string,
    gatewayId?: string,
): Promise<GatewayRegistration | null> {
    const key = gatewayId
        ? `openclaw:${userId}:gateways:${gatewayId}`
        : `openclaw:${userId}:default`;

    const raw = await kv.get(key);
    if (!raw) return null;

    try {
        return JSON.parse(raw) as GatewayRegistration;
    } catch {
        return null;
    }
}
