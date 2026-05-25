/**
 * OpenClaw Tool: luna_chain — Execute a multi-agent chain (streaming SSE)
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { Env } from '../worker';
import { requireAuthOrApiKey } from '../middleware/api-key-auth';
import { rateLimit } from '../middleware/rate-limiter';
import { getPresetChain } from '../data/preset-chains';
import { executeChain } from '../services/chain-executor';
import { trackSkillExecution, CHAIN_PRESETS } from '../services/openclaw-service';

export const chainToolRoute = new Hono<{ Bindings: Env }>();

chainToolRoute.post('/', requireAuthOrApiKey, rateLimit, async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json<{
        preset: string;
        context: string;
        provider?: string;
        model?: string;
    }>();

    if (!body.preset || !body.context) {
        return c.json({ error: 'preset and context are required' }, 400);
    }

    const chainDef = getPresetChain(body.preset);
    if (!chainDef) {
        return c.json({ error: `Unknown chain preset: ${body.preset}`, available: CHAIN_PRESETS }, 404);
    }

    const chainId = crypto.randomUUID();
    const startTime = Date.now();

    return streamSSE(c, async (stream) => {
        try {
            await stream.writeSSE({
                event: 'chain_start',
                data: JSON.stringify({
                    tool: 'luna_chain', chainId, name: chainDef.name,
                    preset: body.preset, nodeCount: chainDef.nodes.length,
                    agents: chainDef.nodes.map(n => n.agent),
                }),
            });

            const result = await executeChain(chainDef, body.context, c.env, {
                provider: body.provider, model: body.model, chainId,
                onProgress: async (event) => {
                    await stream.writeSSE({
                        event: event.type,
                        data: JSON.stringify({
                            nodeId: event.nodeId, agent: event.agent,
                            label: event.label, progress: Math.round(event.progress * 100),
                            ...(event.result ? {
                                status: event.result.status,
                                output: event.result.output?.substring(0, 2000),
                                durationMs: event.result.durationMs,
                                error: event.result.error,
                            } : {}),
                        }),
                    });
                },
            });

            const duration = Date.now() - startTime;

            try {
                await trackSkillExecution(c.env.DB, {
                    userId, skillName: 'luna_chain', agentSlug: body.preset,
                    provider: body.provider || 'deepseek', inputLength: body.context.length,
                    outputLength: result.finalOutput.length, durationMs: duration,
                    status: result.status, source: 'openclaw-tools',
                });
            } catch { /* non-critical */ }

            await stream.writeSSE({
                event: 'chain_done',
                data: JSON.stringify({
                    tool: 'luna_chain', chainId, preset: body.preset,
                    chainName: result.chainName, status: result.status,
                    totalDurationMs: result.totalDurationMs,
                    nodes: result.nodes.map(n => ({
                        nodeId: n.nodeId, agent: n.agent, label: n.label,
                        status: n.status, durationMs: n.durationMs,
                    })),
                }),
            });
        } catch (err: any) {
            try {
                await trackSkillExecution(c.env.DB, {
                    userId, skillName: 'luna_chain', agentSlug: body.preset,
                    durationMs: Date.now() - startTime, status: 'failed',
                    error: err.message, source: 'openclaw-tools',
                });
            } catch { /* ignore */ }

            await stream.writeSSE({
                event: 'chain_error',
                data: JSON.stringify({ chainId, error: err.message }),
            });
        }
    });
});
