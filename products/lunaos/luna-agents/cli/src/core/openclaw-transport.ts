/**
 * OpenClaw Gateway — WebSocket transport + RPC base layer.
 *
 * Holds connection lifecycle, the JSON-RPC request/response plumbing,
 * and event subscription. The high-level agent operations and tool
 * wrappers live in openclaw-client.ts on the OpenClawClient subclass.
 *
 * Extracted to keep each module under the portfolio 200-line cap.
 */

// @ts-ignore — ws types may not be installed
import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import {
    DEFAULT_CONFIG,
    buildConnectRequest,
    type OpenClawConfig,
    type OpenClawMessage,
} from './openclaw-types.js';

type PendingRequest = {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
};

export class OpenClawTransport {
    private ws: WebSocket | null = null;
    protected config: OpenClawConfig;
    private pendingRequests = new Map<string, PendingRequest>();
    private eventListeners = new Map<string, ((payload: any) => void)[]>();
    private connected = false;
    private deviceToken: string | null = null;

    constructor(config?: Partial<OpenClawConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // ── Connection ─────────────────────────────────────────────────

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.config.gatewayUrl);

            this.ws.on('open', () => {
                // Gateway sends connect.challenge first — we listen for it
            });

            this.ws.on('message', (data: Buffer | string) => {
                try {
                    const msg: OpenClawMessage = JSON.parse(data.toString());
                    this.handleMessage(msg, resolve);
                } catch (_e) {
                    // Non-JSON message, ignore
                }
            });

            this.ws.on('error', (err: Error) => {
                if (!this.connected) {
                    reject(new Error(`Failed to connect to OpenClaw Gateway at ${this.config.gatewayUrl}: ${err.message}`));
                }
            });

            this.ws.on('close', () => {
                this.connected = false;
                this.rejectAllPending('WebSocket closed');
            });

            // Timeout for initial connection
            setTimeout(() => {
                if (!this.connected) {
                    this.ws?.close();
                    reject(new Error(`Connection timeout — is OpenClaw running? (${this.config.gatewayUrl})`));
                }
            }, this.config.timeout);
        });
    }

    private handleMessage(msg: OpenClawMessage, onConnected?: (value: void) => void): void {
        // Handle connect.challenge — respond with connect request
        if (msg.type === 'event' && msg.event === 'connect.challenge') {
            this.sendConnectRequest(msg.payload);
            return;
        }

        // Handle connect response (hello-ok)
        if (msg.type === 'res' && msg.payload?.type === 'hello-ok') {
            this.connected = true;
            this.deviceToken = msg.payload?.auth?.deviceToken || null;
            onConnected?.();
            return;
        }

        // Handle RPC responses
        if (msg.type === 'res' && msg.id) {
            const pending = this.pendingRequests.get(msg.id);
            if (pending) {
                clearTimeout(pending.timer);
                this.pendingRequests.delete(msg.id);
                if (msg.ok) {
                    pending.resolve(msg.payload);
                } else {
                    pending.reject(new Error(msg.error || 'RPC call failed'));
                }
            }
            return;
        }

        // Handle events
        if (msg.type === 'event' && msg.event) {
            const listeners = this.eventListeners.get(msg.event) || [];
            for (const listener of listeners) {
                listener(msg.payload);
            }
        }
    }

    private sendConnectRequest(_challenge?: any): void {
        const connectReq = buildConnectRequest(
            this.config,
            randomUUID(),
            `luna-${randomUUID().slice(0, 8)}`
        );
        this.ws?.send(JSON.stringify(connectReq));
    }

    disconnect(): void {
        this.rejectAllPending('Client disconnecting');
        this.ws?.close();
        this.ws = null;
        this.connected = false;
    }

    isConnected(): boolean {
        return this.connected;
    }

    // ── RPC ────────────────────────────────────────────────────────

    protected async rpc(method: string, params: Record<string, any> = {}): Promise<any> {
        if (!this.connected || !this.ws) {
            throw new Error('Not connected to OpenClaw Gateway');
        }

        return new Promise((resolve, reject) => {
            const id = randomUUID();
            const timer = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`RPC timeout: ${method}`));
            }, this.config.timeout);

            this.pendingRequests.set(id, { resolve, reject, timer });

            const req: OpenClawMessage = {
                type: 'req',
                id,
                method,
                params,
            };

            this.ws!.send(JSON.stringify(req));
        });
    }

    // ── Event Subscription ─────────────────────────────────────────

    on(event: string, listener: (payload: any) => void): void {
        const listeners = this.eventListeners.get(event) || [];
        listeners.push(listener);
        this.eventListeners.set(event, listeners);
    }

    off(event: string, listener: (payload: any) => void): void {
        const listeners = this.eventListeners.get(event) || [];
        this.eventListeners.set(event, listeners.filter(l => l !== listener));
    }

    // ── Utilities ──────────────────────────────────────────────────

    private rejectAllPending(reason: string): void {
        for (const [, pending] of this.pendingRequests) {
            clearTimeout(pending.timer);
            pending.reject(new Error(reason));
        }
        this.pendingRequests.clear();
    }
}
