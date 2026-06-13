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
 *
 * Module layout (each file kept under the 200-line portfolio cap):
 *   - openclaw-types.ts      shared types + DEFAULT_CONFIG
 *   - openclaw-transport.ts  WebSocket transport + RPC/event base class
 *   - openclaw-backend.ts    isOpenClawRunning / detectBackend helpers
 *   - openclaw-client.ts     this file — high-level ops + tool wrappers
 *
 * Types and helpers are re-exported here so the public import surface
 * of this module is unchanged.
 */

import { randomUUID } from 'node:crypto';
import { OpenClawTransport } from './openclaw-transport.js';
import type {
    SessionInfo,
    ExecResult,
    SpawnResult,
} from './openclaw-types.js';

// Re-export the full public surface so existing imports keep working.
export type {
    OpenClawConfig,
    OpenClawMessage,
    SessionInfo,
    ExecResult,
    SpawnResult,
    ExecutionBackend,
} from './openclaw-types.js';
export { isOpenClawRunning, detectBackend } from './openclaw-backend.js';

// ─── Client ─────────────────────────────────────────────────────────

export class OpenClawClient extends OpenClawTransport {
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
}
