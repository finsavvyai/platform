/**
 * OpenClaw Gateway — shared types and default configuration.
 *
 * Extracted from openclaw-client.ts to keep each module under the
 * portfolio 200-line cap. Re-exported by openclaw-client.ts so the
 * public import surface is unchanged.
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface OpenClawConfig {
    /** Gateway WebSocket URL (default: ws://127.0.0.1:18789) */
    gatewayUrl: string;
    /** Auth token (OPENCLAW_GATEWAY_TOKEN) */
    token?: string;
    /** Client identifier */
    clientId: string;
    /** Timeout for RPC calls in ms */
    timeout: number;
}

export interface OpenClawMessage {
    type: 'req' | 'res' | 'event';
    id?: string;
    method?: string;
    params?: Record<string, any>;
    ok?: boolean;
    payload?: any;
    error?: string;
    event?: string;
    seq?: number;
}

export interface SessionInfo {
    key: string;
    agentId: string;
    model: string;
    status: string;
}

export interface ExecResult {
    exitCode: number;
    stdout: string;
    stderr: string;
    sessionId?: string;
}

export interface SpawnResult {
    accepted: boolean;
    runId: string;
    sessionKey: string;
}

export type ExecutionBackend = 'openclaw' | 'local' | 'cloud';

// ─── Default Config ─────────────────────────────────────────────────

export const DEFAULT_CONFIG: OpenClawConfig = {
    gatewayUrl: process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789',
    token: process.env.OPENCLAW_GATEWAY_TOKEN,
    clientId: 'luna-agents',
    timeout: 30000,
};

// ─── Connect handshake ──────────────────────────────────────────────

/**
 * Build the protocol-3 `connect` request the gateway expects after it
 * sends its connect.challenge event.
 */
export function buildConnectRequest(
    config: OpenClawConfig,
    requestId: string,
    deviceId: string
): OpenClawMessage {
    return {
        type: 'req',
        id: requestId,
        method: 'connect',
        params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
                id: config.clientId,
                version: '0.1.0',
                platform: process.platform === 'darwin' ? 'macos' : 'linux',
                mode: 'operator',
            },
            role: 'operator',
            scopes: ['operator.read', 'operator.write'],
            caps: [],
            commands: [],
            permissions: {},
            auth: { token: config.token || '' },
            locale: 'en-US',
            userAgent: 'luna-agents/0.1.0',
            device: { id: deviceId },
        },
    };
}
