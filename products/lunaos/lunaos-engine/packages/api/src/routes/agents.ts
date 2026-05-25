/**
 * Agent routes — POST /agents/execute, GET /agents/list
 * Handles agent execution with LLM streaming via SSE
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { Env } from '../worker';
import { requireAuthOrApiKey } from '../middleware/api-key-auth';
import { checkExecutionLimit } from '../middleware/billing';
import { rateLimit } from '../middleware/rate-limiter';
import { PERSONAS, getPersona } from '../data/personas';
import { getAgentTier, canAccessAgent, getUpgradeCTA } from '../data/agent-tiers';
import { calculateTokenUsage, saveTokenUsage } from '../services/token-tracker';
import { callLLM } from '../services/llm-caller';
import { readAndStreamTokens } from '../services/sse-token-reader';
import { injectRAGContext } from '../services/rag-injector';
import { resolveCustomAgent } from '../services/custom-agent-resolver';
import { tryBoost } from '../services/agent-booster';
import { cacheKey, checkCache, storeInCache } from '../services/reasoning-bank';
import { packContext } from '../services/context-packer';
import { getBestRoute, recordOutcome } from '../services/smart-router';
import { resolveLLMConfig } from '../services/agent-config';
import { validateJson } from '../middleware/validation';
import { agentExecuteSchema } from '../schemas';
import { checkMilestones } from '../services/credits';
import { runSwarm, type SwarmStrategy } from '../services/swarm';

export const agentRoutes = new Hono<{ Bindings: Env }>();

/** GET /agents/list — public, no auth required */
agentRoutes.get('/list', (c) => {
  const agents = PERSONAS.map((p) => ({
    slug: p.slug,
    name: p.name,
    category: p.category,
    tier: getAgentTier(p.slug),
    hasSystemPrompt: p.systemPrompt.length > 0,
  }));

  return c.json({
    agents,
    total: agents.length,
    free: agents.filter((a) => a.tier === 'free').length,
    pro: agents.filter((a) => a.tier === 'pro').length,
  });
});

/** POST /agents/execute — requires auth, streams SSE response */
agentRoutes.post(
  '/execute',
  requireAuthOrApiKey,
  rateLimit,
  checkExecutionLimit,
  validateJson(agentExecuteSchema),
  async (c) => {
    const { agent, context, provider, model, useRag } = c.req.valid('json');
    const userId = c.get('userId');

    // Resolve persona (static or custom)
    let personaConfig = getPersona(agent) as any;
    let isCustom = false;

    if (!personaConfig) {
      const custom = await resolveCustomAgent(c.env.DB, userId, agent);
      if (custom) {
        personaConfig = custom;
        isCustom = true;
      }
    }

    if (!personaConfig) {
      return c.json({ error: `Unknown agent: ${agent}` }, 404);
    }

    // Check tier access
    if (!isCustom && !canAccessAgent(c.get('userTier'), agent)) {
      return c.json(getUpgradeCTA(agent, personaConfig.name), 403);
    }

    // Context Packing — trim context to reduce token usage
    const packResult = packContext(agent, context);

    // Smart Router — pick best provider/model from history
    const userTier = c.get('userTier') || 'free';
    const route = await getBestRoute(c.env, agent, userTier);

    // Resolve LLM config (user override > smart route > persona > defaults)
    const llmCfg = resolveLLMConfig(c.env, provider, model, route.provider, route.model, personaConfig.model);
    const selectedProvider = llmCfg.provider;
    const selectedModel = llmCfg.model;
    if (!llmCfg.apiKey) {
      return c.json({ error: `No API key configured for ${selectedProvider}` }, 500);
    }
    const apiKey = llmCfg.apiKey;

    const executionId = crypto.randomUUID();
    const startTime = Date.now();

    // Agent Booster: skip LLM for simple deterministic transforms
    const boost = tryBoost(agent, context);
    if (boost.boosted && boost.output) {
      await c.env.DB.prepare(
        `INSERT INTO executions (id, user_id, agent, provider, model, duration_ms, output_length, created_at, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(executionId, userId, agent, 'booster', boost.transform || '', boost.durationMs || 0, boost.output.length, new Date().toISOString(), JSON.stringify({ boosted: true })).run();
      return c.json({ executionId, output: boost.output, boosted: true, transform: boost.transform, durationMs: boost.durationMs });
    }
    c.header('X-Context-Savings', `${packResult.savings}%`);

    return streamSSE(c, async (stream) => {
      let fullOutput = '';
      try {
        let systemPrompt = personaConfig.systemPrompt ||
          `You are ${personaConfig.name}, a specialized AI agent from LunaOS.`;

        // RAG context injection
        const packedContext = packResult.packed;
        if (useRag !== false && c.env.AI && c.env.VECTORIZE) {
          const rag = await injectRAGContext(c.env, systemPrompt, packedContext);
          systemPrompt = rag.enrichedPrompt;
          if (rag.ragSourceCount > 0) {
            await stream.writeSSE({
              event: 'rag',
              data: JSON.stringify({ sources: rag.ragSourceCount, searchTimeMs: rag.searchTimeMs }),
            });
          }
        }

        // Emit context packing + routing metadata
        if (packResult.savings > 0 || route.reason !== 'default') {
          await stream.writeSSE({
            event: 'meta',
            data: JSON.stringify({
              contextSavings: packResult.savings,
              routeReason: route.reason,
              routeConfidence: route.confidence,
            }),
          });
        }

        // ReasoningBank: check cache before LLM call
        const rbKey = await cacheKey(agent, systemPrompt, packedContext);
        const cached = await checkCache(c.env, rbKey);
        if (cached) {
          await stream.writeSSE({ event: 'cache', data: JSON.stringify({ hit: true }) });
          await stream.writeSSE({ event: 'token', data: cached });
          await stream.writeSSE({ event: 'done', data: JSON.stringify({ executionId, duration: Date.now() - startTime, cacheHit: true }) });
          return;
        }
        // Call LLM and stream tokens
        const llmResponse = await callLLM(
          selectedProvider, selectedModel, apiKey, systemPrompt, packedContext,
          personaConfig.temperature ?? 0.3, c.env,
        );

        if (!llmResponse.ok) {
          const body = await llmResponse.text();
          await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: `LLM error: ${body}` }) });
          return;
        }

        fullOutput = await readAndStreamTokens(llmResponse, selectedProvider, stream);

        if (fullOutput.length > 0) await storeInCache(c.env, rbKey, fullOutput);
        // Save execution
        const duration = Date.now() - startTime;
        const metadata = personaConfig.variantId ? JSON.stringify({ variant_id: personaConfig.variantId }) : null;
        await c.env.DB.prepare(
          `INSERT INTO executions (id, user_id, agent, provider, model, duration_ms, output_length, created_at, tags)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(executionId, userId, agent, selectedProvider, selectedModel, duration, fullOutput.length, new Date().toISOString(), metadata).run();

        const tokenUsage = calculateTokenUsage(packedContext, fullOutput, selectedModel);
        await saveTokenUsage(c.env.DB, executionId, tokenUsage);

        // Record outcome for smart router learning
        await recordOutcome(c.env, agent, selectedProvider, selectedModel, true, duration, tokenUsage.totalTokens || 0);

        // Auto-award credit milestones after successful execution
        const milestones = await checkMilestones(c.env.DB, userId);

        await stream.writeSSE({
          event: 'done',
          data: JSON.stringify({ executionId, duration, tokens: tokenUsage, contextSavings: packResult.savings, milestones }),
        });
      } catch (err: any) {
        const duration = Date.now() - startTime;
        await recordOutcome(c.env, agent, selectedProvider, selectedModel, false, duration, 0);
        await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: err.message }) });
      }
    });
  },
);

/**
 * POST /agents/swarm — parallel execution of 2-5 agents
 * Strategies: race (fastest), consensus (majority), vote (longest)
 */
agentRoutes.post(
  '/swarm',
  requireAuthOrApiKey,
  rateLimit,
  checkExecutionLimit,
  async (c) => {
    let body: { agents: string[]; context: string; strategy: SwarmStrategy };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    if (!body.agents || !Array.isArray(body.agents)) {
      return c.json({ error: 'agents must be an array of 2-5 agent slugs' }, 400);
    }
    if (typeof body.context !== 'string' || !body.context) {
      return c.json({ error: 'context is required' }, 400);
    }
    if (!body.strategy) {
      body.strategy = 'race';
    }

    // Tier check: all agents must be accessible
    const userTier = c.get('userTier') || 'free';
    for (const slug of body.agents) {
      if (!canAccessAgent(userTier, slug)) {
        return c.json(
          { error: `Agent ${slug} requires higher tier`, tier: userTier },
          403,
        );
      }
    }

    try {
      const result = await runSwarm(c.env, body);
      return c.json(result);
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  },
);

// Agent executions route extracted to agent-executions.ts
export { agentExecutionRoutes } from './agent-executions';
