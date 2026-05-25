/**
 * OpenClaw Client — LunaOS Engine → OpenClaw Service bridge
 *
 * Lightweight HTTP client that the LunaOS engine uses to call the
 * standalone OpenClaw Backend Service. Provides typed methods for
 * all OpenClaw capabilities.
 *
 * Usage in LunaOS routes:
 *   const oc = createOpenClawClient(c.env);
 *   const result = await oc.run('code-review', 'Review this...', { provider: 'deepseek' });
 *   const agents = await oc.listAgents();
 *   const channels = await oc.listChannels();
 */

import type { Env } from '../worker';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OpenClawClientConfig {
    baseUrl: string;
    serviceKey: string;
}

export interface BridgeResult {
    success: boolean;
    requestId: string;
    source: string;
    action: string;
    data: any;
    error?: string;
    durationMs: number;
    timestamp: string;
}

export interface OpenClawClient {
    /** Execute a single agent */
    run(agent: string, context: string, opts?: {
        provider?: string;
        useRag?: boolean;
        userId?: string;
    }): Promise<BridgeResult>;

    /** Execute a multi-agent chain */
    chain(preset: string, context: string, opts?: {
        provider?: string;
        userId?: string;
    }): Promise<BridgeResult>;

    /** Semantic RAG search */
    search(query: string, topK?: number, userId?: string): Promise<BridgeResult>;

    /** List available agents */
    listAgents(): Promise<BridgeResult>;

    /** Get service status */
    status(userId?: string): Promise<BridgeResult>;

    /** List available channels (Slack, WhatsApp, etc.) */
    listChannels(): Promise<any>;

    /** Check service health */
    health(): Promise<any>;
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create an OpenClaw client from LunaOS environment bindings.
 *
 * The client can connect via:
 *   1. Service Binding (fastest — same Cloudflare account)
 *   2. HTTP (works across accounts / local dev)
 */
export function createOpenClawClient(env: Env & {
    OPENCLAW_SERVICE?: Fetcher;
    OPENCLAW_URL?: string;
    OPENCLAW_SERVICE_KEY?: string;
}): OpenClawClient {
    const baseUrl = env.OPENCLAW_URL || 'http://localhost:8790';
    const serviceKey = env.OPENCLAW_SERVICE_KEY || '';

    // Use Service Binding if available (zero-latency intra-Cloudflare calls)
    const serviceBinding = env.OPENCLAW_SERVICE;

    async function doFetch(request: Request): Promise<Response> {
        if (serviceBinding) {
            return serviceBinding.fetch(request);
        }
        return globalThis.fetch(request);
    }

    async function bridgeCall(
        action: string,
        payload: Record<string, any>,
        userId?: string,
    ): Promise<BridgeResult> {
        const url = `${baseUrl}/bridge/execute`;

        const response = await doFetch(
            new Request(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Service-Key': serviceKey,
                    'X-User-Id': userId || 'luna-engine',
                    'X-Request-Source': 'luna-engine',
                },
                body: JSON.stringify({
                    action,
                    source: 'luna',
                    payload,
                    correlationId: crypto.randomUUID(),
                }),
            }),
        );

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`OpenClaw service error (${response.status}): ${err}`);
        }

        return response.json() as Promise<BridgeResult>;
    }

    async function apiGet(path: string): Promise<any> {
        const url = `${baseUrl}${path}`;
        const response = await doFetch(
            new Request(url, {
                method: 'GET',
                headers: {
                    'X-Service-Key': serviceKey,
                    'X-Request-Source': 'luna-engine',
                },
            }),
        );
        return response.json();
    }

    return {
        async run(agent, context, opts) {
            return bridgeCall('run', {
                agent,
                context,
                provider: opts?.provider || 'deepseek',
                useRag: opts?.useRag !== false,
            }, opts?.userId);
        },

        async chain(preset, context, opts) {
            return bridgeCall('chain', {
                preset,
                context,
                provider: opts?.provider || 'deepseek',
            }, opts?.userId);
        },

        async search(query, topK = 5, userId) {
            return bridgeCall('search', { query, topK }, userId);
        },

        async listAgents() {
            return bridgeCall('agents', {});
        },

        async status(userId) {
            return bridgeCall('status', {}, userId);
        },

        async listChannels() {
            return apiGet('/bridge/channels');
        },

        async health() {
            return apiGet('/health');
        },
    };
}
