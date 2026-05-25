/**
 * Chain Routes — API endpoints for agent chain execution
 *
 * POST   /chains/execute       — execute a chain (preset or custom)
 * POST   /chains/:id/resume    — resume a paused chain
 * GET    /chains               — list preset chains
 * GET    /chains/:id/status    — get chain execution status
 * GET    /chains/history       — list user's past chain executions
 * POST   /chains/:name/webhook — external webhook trigger
 * POST   /chains/swarm         — multi-agent debate
 */

import { Hono } from 'hono';
import type { Env } from '../worker';
import { requireAuth } from '../middleware/auth';
import { requireAuthOrApiKey } from '../middleware/api-key-auth';
import { checkExecutionLimit } from '../middleware/billing';
import { rateLimit } from '../middleware/rate-limiter';
import { validateChain, type ChainDefinition } from '../services/chain-schema';
import { executeChain } from '../services/chain-executor';
import { executeSwarm } from '../services/swarm-orchestrator';
import { getPresetChain, listPresetChains } from '../data/preset-chains';
import { streamChainExecution } from '../services/chain-stream-handler';
import { validateJson, validateQuery } from '../middleware/validation';
import { chainExecuteSchema, paginationSchema } from '../schemas';
import { verifyWebhookSignature } from '../utils/verify-webhook-signature';
import { z } from 'zod';

export const chainRoutes = new Hono<{ Bindings: Env }>();

// ─── GET /chains — list available preset chains ──────────────────────────────

chainRoutes.get('/', (c) => {
    const presets = listPresetChains();
    return c.json({
        presets,
        total: presets.length,
        docs: 'POST /chains/execute with { preset: "<slug>" } or custom chain definition',
    });
});

// ─── POST /chains/execute — run a chain ──────────────────────────────────────

chainRoutes.post('/execute', requireAuthOrApiKey, rateLimit, checkExecutionLimit, validateJson(chainExecuteSchema), async (c) => {
    const { preset, chain: customChain, context, provider, model } = c.req.valid('json');

    let chainDef: ChainDefinition | undefined;
    if (preset) {
        chainDef = getPresetChain(preset);
        if (!chainDef) {
            return c.json({ error: `Unknown preset: "${preset}"`, available: listPresetChains().map(p => p.slug) }, 404);
        }
    } else if (customChain) {
        const validation = validateChain(customChain);
        if (!validation.valid) {
            return c.json({ error: 'Invalid chain definition', details: validation.errors }, 400);
        }
        chainDef = customChain;
    } else {
        return c.json({ error: 'Either "preset" or "chain" must be provided' }, 400);
    }

    const chainId = crypto.randomUUID();
    try {
        await c.env.DB.prepare(
            'INSERT INTO chain_executions (id, user_id, chain_name, chain_def, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        ).bind(chainId, c.get('userId'), chainDef.name, JSON.stringify(chainDef), 'running', new Date().toISOString()).run();
    } catch { /* non-critical */ }

    return streamChainExecution(c, { chainId, chainDef, context, env: c.env, provider, model });
});

// ─── POST /chains/:id/resume — resume a paused chain ─────────────────────────

chainRoutes.post('/:id/resume', requireAuthOrApiKey, rateLimit, checkExecutionLimit, validateJson(chainExecuteSchema), async (c) => {
    const chainId = c.req.param('id');
    const { context: userContext, provider, model } = c.req.valid('json');

    const execution = await c.env.DB.prepare(
        'SELECT chain_def, status, current_node_index, context FROM chain_executions WHERE id = ? AND user_id = ?',
    ).bind(chainId, c.get('userId')).first() as any;

    if (!execution) return c.json({ error: 'Chain execution not found' }, 404);
    if (execution.status !== 'paused') return c.json({ error: `Cannot resume chain in status: ${execution.status}` }, 400);

    let chainDef: ChainDefinition;
    try { chainDef = JSON.parse(execution.chain_def); } catch { return c.json({ error: 'Invalid chain definition stored' }, 500); }

    let initialOutputs = new Map<string, string>();
    try { initialOutputs = new Map(JSON.parse(execution.context || '[]')); } catch { /* empty */ }

    await c.env.DB.prepare('UPDATE chain_executions SET status = ?, updated_at = ? WHERE id = ?')
        .bind('running', new Date().toISOString(), chainId).run();

    return streamChainExecution(c, {
        chainId, chainDef, context: userContext, env: c.env,
        provider, model, startIndex: execution.current_node_index, initialOutputs,
    });
});

// ─── GET /chains/:id/status ──────────────────────────────────────────────────

chainRoutes.get('/:id/status', requireAuth, async (c) => {
    const execution = await c.env.DB.prepare(
        'SELECT id, chain_name, status, current_node_index, context, created_at, completed_at FROM chain_executions WHERE id = ? AND user_id = ?',
    ).bind(c.req.param('id'), c.get('userId')).first() as any;

    if (!execution) return c.json({ error: 'Chain execution not found' }, 404);

    let nodeContext = [];
    try { nodeContext = JSON.parse(execution.context || '[]'); } catch { /* ignore */ }

    return c.json({
        id: execution.id, chainName: execution.chain_name, status: execution.status,
        currentNodeIndex: execution.current_node_index, context: nodeContext,
        createdAt: execution.created_at, completedAt: execution.completed_at,
    });
});

// ─── GET /chains/history ─────────────────────────────────────────────────────

chainRoutes.get('/history', requireAuth, validateQuery(paginationSchema), async (c) => {
    const { limit, offset } = c.req.valid('query');
    const results = await c.env.DB.prepare(
        'SELECT id, chain_name, status, created_at, completed_at FROM chain_executions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    ).bind(c.get('userId'), limit, offset).all();

    return c.json({ executions: results.results, count: results.results?.length || 0 });
});

// ─── POST /chains/:name/webhook ──────────────────────────────────────────────

chainRoutes.post('/:name/webhook', async (c) => {
    if (!c.env.CHAINS_WEBHOOK_SECRET) {
        return c.json({ error: 'Webhook disabled: server secret not configured' }, 503);
    }

    const rawBody = await c.req.text();
    const sigHeader = c.req.header('x-luna-signature');
    const ok = await verifyWebhookSignature(rawBody, sigHeader, c.env.CHAINS_WEBHOOK_SECRET);
    if (!ok) return c.json({ error: 'Invalid webhook signature' }, 401);

    const chainDef = getPresetChain(c.req.param('name'));
    if (!chainDef) return c.json({ error: 'Chain not found' }, 404);

    let context = '';
    try { context = JSON.stringify(JSON.parse(rawBody)); } catch { /* empty body */ }

    const chainId = crypto.randomUUID();
    try {
        await c.env.DB.prepare(
            'INSERT INTO chain_executions (id, user_id, chain_name, chain_def, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        ).bind(chainId, 'webhook-user', chainDef.name, JSON.stringify(chainDef), 'running', new Date().toISOString()).run();
    } catch { /* non-critical */ }

    c.executionCtx.waitUntil(
        executeChain(chainDef, context, c.env, { provider: 'deepseek', model: 'deepseek-chat', chainId })
            .then(result => c.env.DB.prepare(
                'UPDATE chain_executions SET status = ?, duration_ms = ?, node_results = ?, completed_at = ? WHERE id = ?',
            ).bind(result.status, result.totalDurationMs, JSON.stringify(result.nodes), new Date().toISOString(), chainId).run())
            .catch(() => { /* ignore */ }),
    );

    return c.json({ message: 'Chain execution queued via webhook', chainId, chainName: c.req.param('name') }, 202);
});

// ─── POST /chains/swarm — Multi-Agent Debate ────────────────────────────────

const swarmSchema = z.object({
    topic: z.string(),
    generatorAgent: z.string(),
    criticAgent: z.string(),
    maxIterations: z.number().min(1).max(5).optional().default(3),
    provider: z.string().optional(),
    model: z.string().optional(),
});

chainRoutes.post('/swarm', requireAuthOrApiKey, rateLimit, checkExecutionLimit, validateJson(swarmSchema), async (c) => {
    const { topic, generatorAgent, criticAgent, maxIterations, provider, model } = c.req.valid('json');

    try {
        const result = await executeSwarm(topic, generatorAgent, criticAgent, maxIterations, c.env, { provider, model });

        c.executionCtx.waitUntil(
            c.env.DB.prepare(
                'INSERT INTO analytics_events (id, event_type, agent, provider, model, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            ).bind(crypto.randomUUID(), 'swarm_execution', `swarm:${generatorAgent}:${criticAgent}`, provider || 'deepseek', model || 'deepseek-chat', 0, new Date().toISOString()).run().catch(() => { }),
        );

        return c.json(result);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});
