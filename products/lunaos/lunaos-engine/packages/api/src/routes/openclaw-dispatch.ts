/**
 * OpenClaw Dispatch Routes — /openclaw/dispatch and /openclaw/dispatch/stream
 *
 * Dispatch Luna agents to a remote OpenClaw Gateway.
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { Env } from '../worker';
import { requireAuthOrApiKey } from '../middleware/api-key-auth';
import { getPersona, listPersonas } from '../data/personas';
import { createSession } from '../services/openclaw-service';
import { connectToGateway, gatewayRPC, getGatewayConfig } from './openclaw-gateway-helpers';

export const openclawDispatchRoutes = new Hono<{ Bindings: Env }>();

// ─── POST /openclaw/dispatch — Non-streaming dispatch ───────────────

openclawDispatchRoutes.post('/', requireAuthOrApiKey, async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json<{
        agent: string; context: string; gatewayId?: string;
        model?: string; cleanup?: 'delete' | 'keep'; timeoutSeconds?: number;
    }>();

    if (!body.agent || !body.context) {
        return c.json({ error: 'agent and context are required' }, 400);
    }

    const persona = getPersona(body.agent);
    if (!persona) {
        return c.json({ error: `Unknown agent: ${body.agent}`, available: listPersonas().map(p => p.slug) }, 400);
    }

    const config = await getGatewayConfig(c.env.KV, userId, body.gatewayId);
    if (!config) {
        return c.json({ error: 'No OpenClaw Gateway registered', hint: 'POST /openclaw/register first' }, 400);
    }

    try {
        const ws = await connectToGateway(config.gatewayUrl, config.token);
        const lunaTask = buildLunaTask(persona, body.context);

        const spawnResult = await gatewayRPC(ws, 'sessions_spawn', {
            task: lunaTask, label: `luna-${persona.slug}`,
            model: body.model, cleanup: body.cleanup || 'keep',
            runTimeoutSeconds: body.timeoutSeconds || 300,
        });
        ws.close();

        const sessionDbId = crypto.randomUUID();
        try {
            await createSession(c.env.DB, {
                id: sessionDbId, userId, gatewayId: body.gatewayId || 'default',
                sessionKey: spawnResult.sessionKey, runId: spawnResult.runId,
                agent: persona.slug, agentName: persona.name,
                model: body.model, taskSummary: body.context.substring(0, 500),
            });
        } catch { /* non-critical */ }

        return c.json({
            dispatched: true, agent: persona.slug, agentName: persona.name,
            sessionKey: spawnResult.sessionKey, runId: spawnResult.runId,
            gateway: config.label, trackingId: sessionDbId,
            message: `Agent "${persona.name}" dispatched to your OpenClaw Gateway`,
        });
    } catch (err: any) {
        return c.json({ error: `Dispatch failed: ${err.message}` }, 502);
    }
});

// ─── POST /openclaw/dispatch/stream — Streaming dispatch with polling ─

openclawDispatchRoutes.post('/stream', requireAuthOrApiKey, async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json<{
        agent: string; context: string; gatewayId?: string;
        model?: string; pollIntervalMs?: number; maxPollAttempts?: number;
    }>();

    if (!body.agent || !body.context) {
        return c.json({ error: 'agent and context are required' }, 400);
    }

    const persona = getPersona(body.agent);
    if (!persona) return c.json({ error: `Unknown agent: ${body.agent}` }, 400);

    const config = await getGatewayConfig(c.env.KV, userId, body.gatewayId);
    if (!config) return c.json({ error: 'No Gateway registered' }, 400);

    const pollInterval = body.pollIntervalMs || 3000;
    const maxAttempts = body.maxPollAttempts || 100;

    return streamSSE(c, async (stream) => {
        let ws: WebSocket | null = null;
        try {
            ws = await connectToGateway(config.gatewayUrl, config.token);
            await stream.writeSSE({ event: 'connected', data: JSON.stringify({ gateway: config.label, gatewayUrl: config.gatewayUrl }) });

            const lunaTask = buildLunaTask(persona, body.context);
            const spawnResult = await gatewayRPC(ws, 'sessions_spawn', {
                task: lunaTask, label: `luna-${persona.slug}`,
                model: body.model, cleanup: 'keep', runTimeoutSeconds: 300,
            });

            await stream.writeSSE({
                event: 'spawned',
                data: JSON.stringify({ agent: persona.slug, agentName: persona.name, sessionKey: spawnResult.sessionKey, runId: spawnResult.runId }),
            });

            let lastMessageCount = 0;
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                await new Promise(r => setTimeout(r, pollInterval));
                try {
                    const history = await gatewayRPC(ws, 'sessions_history', { sessionKey: spawnResult.sessionKey }, 10000);
                    if (Array.isArray(history) && history.length > lastMessageCount) {
                        for (let i = lastMessageCount; i < history.length; i++) {
                            const msg = history[i];
                            if (msg.role === 'assistant' && msg.content) {
                                const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                                await stream.writeSSE({ event: 'token', data: text });
                            }
                        }
                        lastMessageCount = history.length;
                        const lastMsg = history[history.length - 1];
                        if (lastMsg?.role === 'assistant' && !lastMsg?.toolCalls?.length) break;
                    }
                    await stream.writeSSE({ event: 'heartbeat', data: JSON.stringify({ attempt, messages: lastMessageCount }) });
                } catch (_pollErr) { /* keep polling */ }
            }

            await stream.writeSSE({ event: 'done', data: JSON.stringify({ sessionKey: spawnResult.sessionKey, totalMessages: lastMessageCount }) });
        } catch (err: any) {
            await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: err.message }) });
        } finally {
            ws?.close();
        }
    });
});

// ─── Helper ─────────────────────────────────────────────────────────

function buildLunaTask(persona: { name: string; slug: string; systemPrompt: string }, context: string): string {
    return [
        `You are acting as the "${persona.name}" Luna agent from LunaOS.`,
        ``, `## Your Role`,
        persona.systemPrompt.split('\n').slice(0, 50).join('\n'),
        ``, `## Task`, context,
        ``, `## Instructions`,
        `Use your available tools (exec, read, write, browser, web_search) to complete this task.`,
        `Provide a clear, actionable report when done.`,
    ].join('\n');
}
