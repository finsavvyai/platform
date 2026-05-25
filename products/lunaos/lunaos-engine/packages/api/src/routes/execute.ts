/**
 * Execute Route — agentic execution with tool-use via OpenHands
 *
 * POST /execute — run an agent with real tool execution
 * The agent can read files, run commands, edit code, and browse the web.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../worker';
import { requireAuthOrApiKey } from '../middleware/api-key-auth';
import { checkExecutionLimit } from '../middleware/billing';
import { checkAgentTier } from '../middleware/tier-check';
import { getPersona } from '../data/personas';
import { canAccessAgent, getUpgradeCTA } from '../data/agent-tiers';
import { LUNA_AGENTS } from '../services/openclaw-service';
import { runToolLoop, type ToolExecutorConfig } from '../services/tool-executor';
import type { OpenHandsConfig } from '../services/openhands-client';

const executeBodySchema = z.object({
    agent: z.string(),
    context: z.string().max(50000),
    maxIterations: z.number().positive().max(10).optional(),
});

export const executeRoutes = new Hono<{ Bindings: Env }>();

executeRoutes.post('/', requireAuthOrApiKey, checkAgentTier, checkExecutionLimit, async (c) => {
    const userId = c.get('userId');
    const userTier = c.get('userTier');

    if (userTier === 'free') {
        return c.json({
            error: 'Execution requires a Pro or Team plan',
            upgradeUrl: 'https://agents.lunaos.ai/pricing',
        }, 403);
    }

    const raw = await c.req.json();
    const parsed = executeBodySchema.safeParse(raw);
    if (!parsed.success) {
        return c.json({ error: 'Invalid input', issues: parsed.error.issues }, 400);
    }
    const body = parsed.data;

    const persona = getPersona(body.agent);
    if (!persona) {
        return c.json({ error: `Unknown agent: ${body.agent}`, available: LUNA_AGENTS }, 404);
    }

    if (!canAccessAgent(userTier, body.agent)) {
        return c.json(getUpgradeCTA(body.agent, persona.name), 403);
    }

    if (!c.env.ANTHROPIC_API_KEY) {
        return c.json({ error: 'Anthropic API key not configured for tool execution' }, 500);
    }

    const openhandsUrl = c.env.OPENHANDS_API_URL;
    if (!openhandsUrl) {
        return c.json({ error: 'OpenHands execution backend not configured' }, 500);
    }

    const openhandsConfig: OpenHandsConfig = {
        apiUrl: openhandsUrl,
        apiKey: c.env.OPENHANDS_API_KEY,
        timeoutMs: userTier === 'team' ? 300000 : 30000,
    };

    const toolConfig: ToolExecutorConfig = {
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        apiKey: c.env.ANTHROPIC_API_KEY,
        openhands: openhandsConfig,
        maxIterations: Math.min(body.maxIterations || 5, userTier === 'team' ? 15 : 5),
    };

    const systemPrompt = [
        persona.systemPrompt || `You are ${persona.name}, a specialized AI agent from LunaOS.`,
        '',
        'You have access to tools for executing commands, reading/writing files, and browsing the web.',
        'Use these tools to investigate, implement, test, and verify your work.',
        'Always explain what you are doing and why before calling a tool.',
        'After completing your work, provide a clear summary of what was done.',
    ].join('\n');

    const executionId = crypto.randomUUID();
    const start = Date.now();

    try {
        const result = await runToolLoop(
            toolConfig, systemPrompt, body.context,
        );

        const duration = Date.now() - start;

        try {
            await c.env.DB.prepare(
                `INSERT INTO executions (id, user_id, agent, provider, model, duration_ms, output_length, rag_sources, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ).bind(
                executionId, userId, body.agent, 'anthropic',
                toolConfig.model, duration, result.output.length, 0,
                new Date().toISOString(),
            ).run();
        } catch { /* non-critical */ }

        return c.json({
            executionId,
            agent: body.agent,
            agentName: persona.name,
            output: result.output,
            toolCalls: result.toolCalls.map((t) => ({
                tool: t.name,
                success: t.success,
                durationMs: t.durationMs,
                outputPreview: t.output.substring(0, 500),
            })),
            iterations: result.iterations,
            durationMs: duration,
        });
    } catch (err: any) {
        return c.json({ error: err.message, executionId }, 500);
    }
});
