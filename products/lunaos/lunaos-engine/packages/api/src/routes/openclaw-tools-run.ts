/**
 * OpenClaw Tool: luna_run — Execute a single Luna agent (streaming SSE)
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { Env } from '../worker';
import { requireAuthOrApiKey } from '../middleware/api-key-auth';
import { rateLimit } from '../middleware/rate-limiter';
import { getPersona } from '../data/personas';
import { getAgentTier, canAccessAgent, getUpgradeCTA } from '../data/agent-tiers';
import { calculateTokenUsage, saveTokenUsage } from '../services/token-tracker';
import { trackSkillExecution, LUNA_AGENTS } from '../services/openclaw-service';
import { callLLM, parseSSEToken, resolveLLMConfig } from '../services/llm-streaming';

export const runToolRoute = new Hono<{ Bindings: Env }>();

runToolRoute.post('/', requireAuthOrApiKey, rateLimit, async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json<{
        agent: string;
        context: string;
        useRag?: boolean;
        provider?: string;
        model?: string;
    }>();

    if (!body.agent || !body.context) {
        return c.json({ error: 'agent and context are required' }, 400);
    }

    const persona = getPersona(body.agent);
    if (!persona) {
        return c.json({ error: `Unknown agent: ${body.agent}`, available: LUNA_AGENTS }, 404);
    }

    const userTier = c.get('userTier');
    if (!canAccessAgent(userTier, body.agent)) {
        return c.json(getUpgradeCTA(body.agent, persona.name), 403);
    }

    const llmConfig = resolveLLMConfig(c.env, body.provider, body.model);
    if (!llmConfig.apiKey) {
        return c.json({ error: `No API key configured for ${llmConfig.provider}` }, 500);
    }

    const executionId = crypto.randomUUID();
    const startTime = Date.now();

    return streamSSE(c, async (stream) => {
        let fullOutput = '';

        try {
            let systemPrompt = persona.systemPrompt || `You are ${persona.name}, a specialized AI agent from LunaOS.`;
            let ragSourceCount = 0;

            // RAG Context Injection
            const ragEnabled = body.useRag !== false && c.env.AI && c.env.VECTORIZE;
            if (ragEnabled) {
                ragSourceCount = await injectRAGContext(c.env, body.context, systemPrompt, stream, (updated) => { systemPrompt = updated; });
            }

            const llmResponse = await callLLM(llmConfig.provider, llmConfig.model, llmConfig.apiKey!, systemPrompt, body.context, c.env);
            if (!llmResponse.ok) {
                const errBody = await llmResponse.text();
                await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: `LLM error: ${errBody}` }) });
                return;
            }

            fullOutput = await streamLLMResponse(llmResponse, llmConfig.provider, stream);
            const duration = Date.now() - startTime;

            try {
                await trackSkillExecution(c.env.DB, {
                    userId, skillName: 'luna_run', agentSlug: body.agent,
                    provider: llmConfig.provider, inputLength: body.context.length,
                    outputLength: fullOutput.length, durationMs: duration,
                    status: 'completed', source: 'openclaw-tools',
                });
            } catch { /* non-critical */ }

            try {
                await c.env.DB.prepare(
                    `INSERT INTO executions (id, user_id, agent, provider, model, duration_ms, output_length, rag_sources, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(executionId, userId, body.agent, llmConfig.provider, llmConfig.model, duration, fullOutput.length, ragSourceCount, new Date().toISOString()).run();
            } catch { /* non-critical */ }

            const tokenUsage = calculateTokenUsage(body.context, fullOutput, llmConfig.model);
            await saveTokenUsage(c.env.DB, executionId, tokenUsage);

            await stream.writeSSE({
                event: 'done',
                data: JSON.stringify({
                    tool: 'luna_run', executionId, agent: body.agent, agentName: persona.name,
                    provider: llmConfig.provider, model: llmConfig.model,
                    durationMs: duration, ragSources: ragSourceCount, tokens: tokenUsage,
                }),
            });
        } catch (err: any) {
            try {
                await trackSkillExecution(c.env.DB, {
                    userId, skillName: 'luna_run', agentSlug: body.agent,
                    provider: llmConfig.provider, inputLength: body.context.length,
                    durationMs: Date.now() - startTime, status: 'failed',
                    error: err.message, source: 'openclaw-tools',
                });
            } catch { /* ignore */ }
            await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: err.message }) });
        }
    });
});

/** Inject RAG context into the system prompt. Returns ragSourceCount. */
async function injectRAGContext(
    env: any, context: string, systemPrompt: string,
    stream: any, updatePrompt: (s: string) => void,
): Promise<number> {
    let ragSourceCount = 0;
    try {
        const ragStart = Date.now();
        const embeddingResult = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [context.substring(0, 512)] });
        const queryVector = embeddingResult?.data?.[0];
        if (queryVector?.length > 0) {
            const searchResult = await env.VECTORIZE.query(queryVector, { topK: 5, returnValues: false, returnMetadata: true });
            if (searchResult?.matches?.length > 0) {
                const chunkIds = searchResult.matches.map((m: any) => `'${m.id}'`).join(',');
                const chunks = await env.DB.prepare(`SELECT id, content, metadata FROM chunks WHERE id IN (${chunkIds})`).all();
                const contentMap = new Map<string, any>();
                (chunks.results || []).forEach((row: any) => contentMap.set(row.id, row));

                const ragChunks: string[] = [];
                let totalLen = 0;
                const MAX_RAG_CHARS = 4000;
                for (const match of searchResult.matches) {
                    if (totalLen >= MAX_RAG_CHARS) break;
                    const row = contentMap.get(match.id);
                    if (!row?.content) continue;
                    let meta: any = {};
                    try { meta = JSON.parse(row.metadata || '{}'); } catch { /* ok */ }
                    const source = meta?.source || meta?.path || match.id;
                    const snippet = row.content.substring(0, MAX_RAG_CHARS - totalLen);
                    ragChunks.push(`--- ${source} (score: ${match.score.toFixed(3)}) ---\n${snippet}`);
                    totalLen += snippet.length;
                    ragSourceCount++;
                }
                if (ragChunks.length > 0) {
                    updatePrompt(systemPrompt + `\n\n## Relevant Codebase Context\n${ragChunks.join('\n\n')}\n\nUse this context to provide more accurate analysis.`);
                    await stream.writeSSE({ event: 'rag', data: JSON.stringify({ sources: ragSourceCount, searchTimeMs: Date.now() - ragStart }) });
                }
            }
        }
    } catch { /* Continue without RAG */ }
    return ragSourceCount;
}

/** Stream LLM response tokens to SSE. Returns the full output string. */
async function streamLLMResponse(llmResponse: Response, provider: string, stream: any): Promise<string> {
    const reader = llmResponse.body?.getReader();
    if (!reader) return '';

    const decoder = new TextDecoder();
    let buffer = '';
    let fullOutput = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            const token = parseSSEToken(data, provider);
            if (token) {
                fullOutput += token;
                await stream.writeSSE({ event: 'token', data: token });
            }
        }
    }
    return fullOutput;
}
