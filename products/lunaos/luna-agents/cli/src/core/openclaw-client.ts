/**
 * OpenClaw Gateway Client for Luna Agents
 *
 * Connects to a local OpenClaw Gateway via WebSocket and enables
 * Luna agents to use OpenClaw's tool suite:
 *   - exec (run shell commands)
 *   - read/write/edit (file operations)
 *   - browser (web automation)
 *   - web_search / web_fetch
 *   - cron (scheduled tasks)
 *   - sessions_spawn (sub-agent delegation)
 *   - memory_search (long-term memory)
 *
 * Usage:
 *   const client = new OpenClawClient();
 *   await client.connect();
 *   const result = await client.sendMessage('Review src/api.ts for security issues');
 */

// @ts-ignore — ws types may not be installed
import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';

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

// ─── Default Config ─────────────────────────────────────────────────

const DEFAULT_CONFIG: OpenClawConfig = {
    gatewayUrl: process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789',
    token: process.env.OPENCLAW_GATEWAY_TOKEN,
    clientId: 'luna-agents',
    timeout: 30000,
};

// ─── Client ─────────────────────────────────────────────────────────

export class OpenClawClient {
    private ws: WebSocket | null = null;
    private config: OpenClawConfig;
    private pendingRequests = new Map<string, {
        resolve: (value: any) => void;
        reject: (error: Error) => void;
        timer: ReturnType<typeof setTimeout>;
    }>();
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

    private sendConnectRequest(challenge?: any): void {
        const connectReq: OpenClawMessage = {
            type: 'req',
            id: randomUUID(),
            method: 'connect',
            params: {
                minProtocol: 3,
                maxProtocol: 3,
                client: {
                    id: this.config.clientId,
                    version: '0.1.0',
                    platform: process.platform === 'darwin' ? 'macos' : 'linux',
                    mode: 'operator',
                },
                role: 'operator',
                scopes: ['operator.read', 'operator.write'],
                caps: [],
                commands: [],
                permissions: {},
                auth: {
                    token: this.config.token || '',
                },
                locale: 'en-US',
                userAgent: 'luna-agents/0.1.0',
                device: {
                    id: `luna-${randomUUID().slice(0, 8)}`,
                },
            },
        };

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

    private async rpc(method: string, params: Record<string, any> = {}): Promise<any> {
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

    // ── High-Level Agent Operations ────────────────────────────────

    /**
     * Send a message to the main agent session.
     * This is the primary way Luna agents interact with OpenClaw.
     */
    async sendMessage(
        message: string,
        options: {
            sessionKey?: string;
            idempotencyKey?: string;
        } = {}
    ): Promise<any> {
        return this.rpc('agent', {
            message,
            sessionKey: options.sessionKey,
            idempotencyKey: options.idempotencyKey || randomUUID(),
        });
    }

    /**
     * Spawn a sub-agent session with a specific task.
     * The sub-agent runs independently and reports back when done.
     */
    async spawnSubAgent(
        task: string,
        options: {
            label?: string;
            agentId?: string;
            model?: string;
            cleanup?: 'delete' | 'keep';
            timeoutSeconds?: number;
        } = {}
    ): Promise<SpawnResult> {
        return this.rpc('sessions_spawn', {
            task,
            label: options.label,
            agentId: options.agentId,
            model: options.model,
            cleanup: options.cleanup || 'keep',
            runTimeoutSeconds: options.timeoutSeconds || 0,
        });
    }

    /**
     * Send a message to another session (inter-agent communication).
     */
    async sendToSession(
        sessionKey: string,
        message: string,
        timeoutSeconds = 0
    ): Promise<any> {
        return this.rpc('sessions_send', {
            sessionKey,
            message,
            timeoutSeconds,
        });
    }

    /**
     * List all active sessions.
     */
    async listSessions(): Promise<SessionInfo[]> {
        return this.rpc('sessions_list', {});
    }

    /**
     * Get history for a session.
     */
    async getSessionHistory(sessionKey: string): Promise<any[]> {
        return this.rpc('sessions_history', { sessionKey });
    }

    // ── Tool Wrappers ──────────────────────────────────────────────

    /**
     * Execute a shell command via OpenClaw's exec tool.
     */
    async exec(
        command: string,
        options: {
            timeout?: number;
            background?: boolean;
            elevated?: boolean;
        } = {}
    ): Promise<ExecResult> {
        return this.rpc('exec', {
            command,
            timeout: options.timeout || 30,
            background: options.background || false,
            elevated: options.elevated || false,
        });
    }

    /**
     * Read a file via OpenClaw's read tool.
     */
    async readFile(filePath: string): Promise<string> {
        const result = await this.rpc('read', { file: filePath });
        return result?.content || '';
    }

    /**
     * Write a file via OpenClaw's write tool.
     */
    async writeFile(filePath: string, content: string): Promise<void> {
        await this.rpc('write', { file: filePath, content });
    }

    /**
     * Search the web via OpenClaw's web_search tool.
     */
    async webSearch(query: string, count = 5): Promise<any[]> {
        return this.rpc('web_search', { query, count });
    }

    /**
     * Fetch a URL via OpenClaw's web_fetch tool.
     */
    async webFetch(url: string, extractMode: 'markdown' | 'text' = 'markdown'): Promise<string> {
        const result = await this.rpc('web_fetch', { url, extractMode });
        return result?.content || '';
    }

    /**
     * Search memory via OpenClaw's memory_search tool.
     */
    async memorySearch(query: string, limit = 5): Promise<any[]> {
        return this.rpc('memory_search', { query, limit });
    }

    /**
     * Check gateway health.
     */
    async health(): Promise<any> {
        return this.rpc('health', {});
    }

    // ── Utilities ──────────────────────────────────────────────────

    private rejectAllPending(reason: string): void {
        for (const [id, pending] of this.pendingRequests) {
            clearTimeout(pending.timer);
            pending.reject(new Error(reason));
        }
        this.pendingRequests.clear();
    }
}

// ─── Helper: Check if OpenClaw is running ───────────────────────────

export async function isOpenClawRunning(
    gatewayUrl = 'ws://127.0.0.1:18789'
): Promise<boolean> {
    return new Promise((resolve) => {
        const ws = new WebSocket(gatewayUrl);
        const timer = setTimeout(() => {
            ws.close();
            resolve(false);
        }, 2000);

        ws.on('open', () => {
            clearTimeout(timer);
            ws.close();
            resolve(true);
        });

        ws.on('error', () => {
            clearTimeout(timer);
            resolve(false);
        });
    });
}

// ─── Helper: Auto-detect execution backend ──────────────────────────

export type ExecutionBackend = 'openclaw' | 'local' | 'cloud';

export async function detectBackend(): Promise<ExecutionBackend> {
    // 1. Check if OpenClaw is running locally
    if (await isOpenClawRunning()) {
        return 'openclaw';
    }

    // 2. Check for cloud token
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const credPath = path.join(os.homedir(), '.luna', 'credentials.yaml');

    if (fs.existsSync(credPath)) {
        try {
            const yaml = await import('yaml');
            const creds = yaml.parse(fs.readFileSync(credPath, 'utf-8'));
            if (creds?.cloud_token) return 'cloud';
        } catch { /* ignore */ }
    }

    // 3. Default to local
    return 'local';
}
