/**
 * Tool Routes — /tools/*
 *
 * OpenClaw-compatible tool API. Provides unified access to:
 *   - Agent execution (luna_run)
 *   - Chain execution (luna_chain)
 *   - RAG search (luna_search)
 *   - File indexing (luna_index)
 *   - Agent catalog
 *   - Chain catalog
 *
 * Consumed by: LunaOS, OpenHands, CLI, Dashboard, Plugins
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { AppEnv, ServiceEnv } from '../types';
import { requireAuth, rateLimit } from '../middleware/auth';

export const toolRoutes = new Hono<AppEnv>();

// ─── Agent Definitions ──────────────────────────────────────────────────────

const LUNA_AGENTS = [
    { slug: '365-security', name: 'Microsoft 365 Security Agent', category: 'solution', tier: 'pro' as const },
    { slug: 'analytics', name: 'Analytics & Monitoring Agent', category: 'solution', tier: 'pro' as const },
    { slug: 'api-generator', name: 'REST API Generator Agent', category: 'planning', tier: 'pro' as const },
    { slug: 'auth', name: 'Authentication & Authorization Agent', category: 'solution', tier: 'pro' as const },
    { slug: 'cloudflare', name: 'Cloudflare Deployment Agent', category: 'devops', tier: 'pro' as const },
    { slug: 'code-review', name: 'Code Review Agent', category: 'code-quality', tier: 'free' as const },
    { slug: 'database', name: 'Database Design Agent', category: 'solution', tier: 'pro' as const },
    { slug: 'deployment', name: 'Deployment Strategy Agent', category: 'devops', tier: 'pro' as const },
    { slug: 'design-architect', name: 'System Design Architect', category: 'planning', tier: 'pro' as const },
    { slug: 'docker', name: 'Docker & Containerization Agent', category: 'devops', tier: 'pro' as const },
    { slug: 'documentation', name: 'Documentation Generator Agent', category: 'code-quality', tier: 'free' as const },
    { slug: 'glm-vision', name: 'GLM Vision Agent', category: 'ai', tier: 'pro' as const },
    { slug: 'hig', name: 'Human Interface Guidelines Agent', category: 'design', tier: 'pro' as const },
    { slug: 'lemonsqueezy', name: 'LemonSqueezy Integration Agent', category: 'solution', tier: 'pro' as const },
    { slug: 'monitoring-observability', name: 'Monitoring & Observability Agent', category: 'devops', tier: 'pro' as const },
    { slug: 'openai-app', name: 'OpenAI Integration Agent', category: 'ai', tier: 'pro' as const },
    { slug: 'post-launch-review', name: 'Post-Launch Review Agent', category: 'code-quality', tier: 'pro' as const },
    { slug: 'rag-enhanced', name: 'RAG-Enhanced Analysis Agent', category: 'ai', tier: 'pro' as const },
    { slug: 'rag', name: 'RAG Pipeline Agent', category: 'ai', tier: 'pro' as const },
    { slug: 'requirements-analyzer', name: 'Requirements Analyzer Agent', category: 'planning', tier: 'free' as const },
    { slug: 'run', name: 'General Purpose Agent', category: 'general', tier: 'free' as const },
    { slug: 'seo', name: 'SEO Optimization Agent', category: 'marketing', tier: 'pro' as const },
    { slug: 'task-executor', name: 'Task Executor Agent', category: 'execution', tier: 'free' as const },
    { slug: 'task-planner', name: 'Task Planner Agent', category: 'planning', tier: 'free' as const },
    { slug: 'testing-validation', name: 'Testing & Validation Agent', category: 'code-quality', tier: 'pro' as const },
    { slug: 'ui-fix', name: 'UI Fix Agent', category: 'design', tier: 'pro' as const },
    { slug: 'ui-test', name: 'UI Testing Agent', category: 'code-quality', tier: 'pro' as const },
    { slug: 'user-guide', name: 'User Guide Generator Agent', category: 'code-quality', tier: 'pro' as const },
] as const;

const CHAIN_PRESETS = [
    {
        slug: 'full-review', name: 'Full Review',
        description: 'Comprehensive code review pipeline: review → test validation → documentation.',
        agents: ['code-review', 'testing-validation', 'documentation'],
    },
    {
        slug: 'new-feature', name: 'New Feature',
        description: 'Complete feature development: requirements → architecture → planning → execution.',
        agents: ['requirements-analyzer', 'design-architect', 'task-planner', 'task-executor'],
    },
    {
        slug: 'deploy', name: 'Deploy',
        description: 'Pre-deployment validation: code review → tests → deployment strategy.',
        agents: ['code-review', 'testing-validation', 'deployment'],
    },
    {
        slug: 'security-audit', name: 'Security Audit',
        description: 'Security-focused audit: security hardening → code review with security focus.',
        agents: ['365-security', 'code-review'],
    },
    {
        slug: 'api-design', name: 'API Design',
        description: 'API design pipeline: REST API design → database schema → documentation.',
        agents: ['api-generator', 'database', 'documentation'],
    },
];

// ─── Tool Registry ──────────────────────────────────────────────────────────

toolRoutes.get('/', (c) => {
    return c.json({
        tools: [
            {
                name: 'luna_run',
                description: `Run a specialized LunaOS coding agent. Available agents: ${LUNA_AGENTS.map(a => a.slug).join(', ')}`,
                category: 'execution',
                parameters: {
                    agent: { type: 'string', description: 'Agent slug', required: true, enum: LUNA_AGENTS.map(a => a.slug) },
                    context: { type: 'string', description: 'Code or context to analyze', required: true },
                    useRag: { type: 'boolean', description: 'Include RAG context', default: true },
                    provider: { type: 'string', description: 'LLM provider', default: 'deepseek', enum: ['deepseek', 'anthropic', 'openai'] },
                },
            },
            {
                name: 'luna_chain',
                description: `Run a multi-agent chain. Presets: ${CHAIN_PRESETS.map(p => p.slug).join(', ')}`,
                category: 'execution',
                parameters: {
                    preset: { type: 'string', description: 'Chain preset', required: true, enum: CHAIN_PRESETS.map(p => p.slug) },
                    context: { type: 'string', description: 'Code or context', required: true },
                    provider: { type: 'string', description: 'LLM provider', default: 'deepseek' },
                },
            },
            {
                name: 'luna_search',
                description: 'Semantic codebase search via RAG.',
                category: 'search',
                parameters: {
                    query: { type: 'string', description: 'Search query', required: true },
                    topK: { type: 'number', description: 'Results count', default: 5 },
                },
            },
            {
                name: 'luna_index',
                description: 'Index source files for RAG search.',
                category: 'indexing',
                parameters: {
                    files: { type: 'array', description: 'Array of {path, content}', required: true },
                    repoName: { type: 'string', description: 'Repository name' },
                },
            },
            {
                name: 'luna_agents',
                description: 'List all available agents.',
                category: 'meta',
                parameters: {},
            },
            {
                name: 'luna_status',
                description: 'Service and gateway status.',
                category: 'meta',
                parameters: {},
            },
        ],
        total: 6,
        protocol: 'openclaw-v3',
        version: '1.0.0',
    });
});

// ─── GET /tools/agents ──────────────────────────────────────────────────────

toolRoutes.get('/agents', (c) => {
    return c.json({
        agents: LUNA_AGENTS,
        total: LUNA_AGENTS.length,
        free: LUNA_AGENTS.filter(a => a.tier === 'free').length,
        pro: LUNA_AGENTS.filter(a => a.tier === 'pro').length,
    });
});

// ─── GET /tools/chains ──────────────────────────────────────────────────────

toolRoutes.get('/chains', (c) => {
    return c.json({
        presets: CHAIN_PRESETS.map(p => ({
            ...p,
            nodeCount: p.agents.length,
        })),
        total: CHAIN_PRESETS.length,
    });
});

// ─── POST /tools/run — Agent Execution ──────────────────────────────────────

toolRoutes.post('/run', requireAuth, rateLimit, async (c) => {
    const userId = c.get('userId') as string;
    const body = await c.req.json<{
        agent: string;
        context: string;
        provider?: string;
        model?: string;
        useRag?: boolean;
        source?: string;
    }>();

    // Validate required fields
    if (!body.agent || !body.context) {
        return c.json({ error: 'Missing required fields: agent, context' }, 400);
    }

    // Find agent
    const agentDef = LUNA_AGENTS.find(a => a.slug === body.agent);
    if (!agentDef) {
        return c.json({
            error: `Unknown agent: ${body.agent}`,
            available: LUNA_AGENTS.map(a => a.slug),
        }, 404);
    }

    // Tier check — look up user
    try {
        const user = await c.env.DB.prepare('SELECT tier FROM users WHERE id = ?').bind(userId).first<{ tier: string }>();
        const userTier = user?.tier || 'free';
        if (agentDef.tier === 'pro' && userTier === 'free') {
            return c.json({
                error: `${agentDef.name} requires Pro tier`,
                upgradeUrl: 'https://lunaos.ai/pricing',
            }, 403);
        }
    } catch {
        // User table may not exist in some environments — allow through
    }

    // Resolve provider and API key
    const provider = body.provider || 'deepseek';
    const model = body.model || getDefaultModel(provider);
    const apiKey = resolveApiKey(c.env, provider);

    if (!apiKey) {
        return c.json({ error: `No API key configured for ${provider}` }, 500);
    }

    const executionId = crypto.randomUUID();
    const startTime = Date.now();

    // Stream response via SSE
    return streamSSE(c, async (stream) => {
        let fullOutput = '';

        try {
            // Get agent persona for system prompt
            const systemPrompt = `You are ${agentDef.name}, a specialized AI agent from LunaOS. Provide expert analysis and actionable recommendations.`;

            // Optional RAG context injection
            let ragSources = 0;
            let enhancedPrompt = systemPrompt;

            if (body.useRag !== false && c.env.AI && c.env.VECTORIZE) {
                try {
                    const embedding = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', {
                        text: [body.context.substring(0, 512)],
                    });
                    const queryVector = embedding?.data?.[0];

                    if (queryVector?.length > 0) {
                        const results = await c.env.VECTORIZE.query(queryVector, {
                            topK: 5, returnValues: false, returnMetadata: true,
                        });

                        if (results?.matches?.length > 0) {
                            const chunkIds = results.matches.map((m: any) => `'${m.id}'`).join(',');
                            const chunks = await c.env.DB.prepare(
                                `SELECT id, content, metadata FROM chunks WHERE id IN (${chunkIds})`
                            ).all();

                            const contentMap = new Map((chunks.results || []).map((r: any) => [r.id, r]));
                            const ragParts: string[] = [];
                            let totalLen = 0;

                            for (const match of results.matches) {
                                if (totalLen >= 4000) break;
                                const row = contentMap.get(match.id);
                                if (!row) continue;
                                const snippet = `--- ${(row as any).metadata || ''} ---\n${(row as any).content}`;
                                ragParts.push(snippet);
                                totalLen += snippet.length;
                                ragSources++;
                            }

                            if (ragParts.length > 0) {
                                enhancedPrompt += `\n\n## Codebase Context (from RAG)\n${ragParts.join('\n\n')}`;
                                await stream.writeSSE({ event: 'rag', data: JSON.stringify({ sources: ragSources }) });
                            }
                        }
                    }
                } catch {
                    // RAG failure is non-blocking
                }
            }

            // Call LLM
            const llmResponse = await callLLM(provider, model, apiKey, enhancedPrompt, body.context);

            if (!llmResponse.ok) {
                const errBody = await llmResponse.text();
                await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: `LLM error: ${errBody.substring(0, 200)}` }) });
                return;
            }

            // Stream LLM SSE to client
            const reader = llmResponse.body?.getReader();
            if (!reader) return;

            const decoder = new TextDecoder();
            let buffer = '';

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

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content;
                        if (content) {
                            fullOutput += content;
                            await stream.writeSSE({ event: 'token', data: JSON.stringify({ content }) });
                        }
                    } catch { /* skip */ }
                }
            }

            const duration = Date.now() - startTime;

            // Track execution in D1
            try {
                await c.env.DB.prepare(`
                    INSERT INTO openclaw_skill_executions
                    (id, user_id, skill_name, agent_slug, provider, input_length, output_length, duration_ms, status, source)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                    executionId, userId, 'luna_run', body.agent,
                    provider, body.context.length, fullOutput.length,
                    duration, 'completed', body.source || 'openclaw-service',
                ).run();
            } catch { /* non-blocking */ }

            await stream.writeSSE({
                event: 'done',
                data: JSON.stringify({
                    executionId, duration, ragSources,
                    agent: body.agent, provider,
                }),
            });

        } catch (err: any) {
            await stream.writeSSE({
                event: 'error',
                data: JSON.stringify({ error: err.message }),
            });
        }
    });
});

// ─── POST /tools/chain — Chain Execution ────────────────────────────────────

toolRoutes.post('/chain', requireAuth, rateLimit, async (c) => {
    const userId = c.get('userId') as string;
    const body = await c.req.json<{ preset: string; context: string; provider?: string; source?: string }>();

    if (!body.preset || !body.context) {
        return c.json({ error: 'Missing required fields: preset, context' }, 400);
    }

    const preset = CHAIN_PRESETS.find(p => p.slug === body.preset);
    if (!preset) {
        return c.json({
            error: `Unknown chain preset: ${body.preset}`,
            available: CHAIN_PRESETS.map(p => p.slug),
        }, 404);
    }

    const provider = body.provider || 'deepseek';
    const apiKey = resolveApiKey(c.env, provider);

    if (!apiKey) {
        return c.json({ error: `No API key configured for ${provider}` }, 500);
    }

    const chainId = crypto.randomUUID();
    const startTime = Date.now();

    return streamSSE(c, async (stream) => {
        await stream.writeSSE({
            event: 'chain_start',
            data: JSON.stringify({
                chainId,
                preset: preset.slug,
                agents: preset.agents,
                nodeCount: preset.agents.length,
            }),
        });

        let previousOutput = '';

        for (let i = 0; i < preset.agents.length; i++) {
            const agentSlug = preset.agents[i];
            const agentDef = LUNA_AGENTS.find(a => a.slug === agentSlug);
            const agentName = agentDef?.name || agentSlug;

            await stream.writeSSE({
                event: 'node_start',
                data: JSON.stringify({ step: i + 1, agent: agentSlug, name: agentName }),
            });

            const model = getDefaultModel(provider);
            const systemPrompt = `You are ${agentName}, a specialized AI agent from LunaOS.`;
            const contextWithPrev = previousOutput
                ? `## Previous Agent Output\n${previousOutput}\n\n## Original Task\n${body.context}`
                : body.context;

            try {
                const llmResponse = await callLLM(provider, model, apiKey, systemPrompt, contextWithPrev);

                if (!llmResponse.ok) {
                    await stream.writeSSE({
                        event: 'node_error',
                        data: JSON.stringify({ step: i + 1, agent: agentSlug, error: 'LLM call failed' }),
                    });
                    continue;
                }

                // Collect full output
                const reader = llmResponse.body?.getReader();
                if (!reader) continue;

                const decoder = new TextDecoder();
                let nodeOutput = '';
                let buffer = '';

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

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content;
                            if (content) {
                                nodeOutput += content;
                                await stream.writeSSE({
                                    event: 'token',
                                    data: JSON.stringify({ step: i + 1, agent: agentSlug, content }),
                                });
                            }
                        } catch { /* skip */ }
                    }
                }

                previousOutput = nodeOutput;

                await stream.writeSSE({
                    event: 'node_done',
                    data: JSON.stringify({
                        step: i + 1,
                        agent: agentSlug,
                        outputLength: nodeOutput.length,
                    }),
                });

            } catch (err: any) {
                await stream.writeSSE({
                    event: 'node_error',
                    data: JSON.stringify({ step: i + 1, agent: agentSlug, error: err.message }),
                });
            }
        }

        const duration = Date.now() - startTime;

        // Track chain execution
        try {
            await c.env.DB.prepare(`
                INSERT INTO openclaw_skill_executions
                (id, user_id, skill_name, agent_slug, provider, input_length, output_length, duration_ms, status, source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                chainId, userId, 'luna_chain', preset.slug,
                provider, body.context.length, previousOutput.length,
                duration, 'completed', body.source || 'openclaw-service',
            ).run();
        } catch { /* non-blocking */ }

        await stream.writeSSE({
            event: 'chain_done',
            data: JSON.stringify({ chainId, duration, nodesCompleted: preset.agents.length }),
        });
    });
});

// ─── POST /tools/search — RAG Search ────────────────────────────────────────

toolRoutes.post('/search', requireAuth, rateLimit, async (c) => {
    const body = await c.req.json<{ query: string; topK?: number }>();

    if (!body.query) {
        return c.json({ error: 'Missing required field: query' }, 400);
    }

    if (!c.env.AI || !c.env.VECTORIZE) {
        return c.json({ error: 'RAG not configured — AI and Vectorize bindings required' }, 503);
    }

    const startTime = Date.now();
    const topK = body.topK || 5;

    try {
        const embedding = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', {
            text: [body.query.substring(0, 512)],
        });

        const queryVector = embedding?.data?.[0];
        if (!queryVector?.length) {
            return c.json({ error: 'Failed to generate embedding' }, 500);
        }

        const results = await c.env.VECTORIZE.query(queryVector, {
            topK, returnValues: false, returnMetadata: true,
        });

        if (!results?.matches?.length) {
            return c.json({ results: [], total: 0, searchTimeMs: Date.now() - startTime });
        }

        const chunkIds = results.matches.map((m: any) => `'${m.id}'`).join(',');
        const chunks = await c.env.DB.prepare(
            `SELECT id, content, metadata FROM chunks WHERE id IN (${chunkIds})`
        ).all();

        const contentMap = new Map((chunks.results || []).map((r: any) => [r.id, r]));

        const matches = results.matches.map((m: any) => {
            const row = contentMap.get(m.id);
            return {
                id: m.id,
                score: m.score,
                content: (row as any)?.content || '',
                metadata: (row as any)?.metadata ? JSON.parse((row as any).metadata) : m.metadata,
            };
        }).filter((m: any) => m.content);

        return c.json({
            results: matches,
            total: matches.length,
            searchTimeMs: Date.now() - startTime,
        });

    } catch (err: any) {
        return c.json({ error: `Search failed: ${err.message}` }, 500);
    }
});

// ─── POST /tools/index — File Indexing ──────────────────────────────────────

toolRoutes.post('/index', requireAuth, rateLimit, async (c) => {
    const body = await c.req.json<{
        files: Array<{ path: string; content: string }>;
        repoName?: string;
    }>();

    if (!body.files?.length) {
        return c.json({ error: 'Missing required field: files (non-empty array)' }, 400);
    }

    if (!c.env.AI || !c.env.VECTORIZE) {
        return c.json({ error: 'RAG not configured — AI and Vectorize bindings required' }, 503);
    }

    const startTime = Date.now();
    let indexed = 0;
    const errors: string[] = [];

    for (const file of body.files) {
        try {
            const chunkId = crypto.randomUUID();
            const metadata = JSON.stringify({
                path: file.path,
                repo: body.repoName || 'unknown',
                indexed_at: new Date().toISOString(),
            });

            // Generate embedding
            const embedding = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', {
                text: [file.content.substring(0, 2048)],
            });

            const vector = embedding?.data?.[0];
            if (!vector?.length) {
                errors.push(`${file.path}: embedding failed`);
                continue;
            }

            // Store in D1
            await c.env.DB.prepare(
                'INSERT INTO chunks (id, content, metadata) VALUES (?, ?, ?)'
            ).bind(chunkId, file.content, metadata).run();

            // Store in Vectorize
            await c.env.VECTORIZE.upsert([{
                id: chunkId,
                values: vector,
                metadata: { path: file.path, repo: body.repoName || 'unknown' },
            }]);

            indexed++;
        } catch (err: any) {
            errors.push(`${file.path}: ${err.message}`);
        }
    }

    return c.json({
        indexed,
        total: body.files.length,
        errors: errors.length > 0 ? errors : undefined,
        durationMs: Date.now() - startTime,
    });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function resolveApiKey(env: ServiceEnv, provider: string): string | undefined {
    const map: Record<string, string | undefined> = {
        deepseek: env.DEEPSEEK_API_KEY,
        anthropic: env.ANTHROPIC_API_KEY,
        openai: env.OPENAI_API_KEY,
    };
    return map[provider];
}

function getDefaultModel(provider: string): string {
    const models: Record<string, string> = {
        deepseek: 'deepseek-chat',
        anthropic: 'claude-sonnet-4-20250514',
        openai: 'gpt-4o',
    };
    return models[provider] || 'deepseek-chat';
}

async function callLLM(
    provider: string,
    model: string,
    apiKey: string,
    systemPrompt: string,
    userContent: string,
): Promise<Response> {
    const endpoints: Record<string, string> = {
        deepseek: 'https://api.deepseek.com/v1/chat/completions',
        anthropic: 'https://api.anthropic.com/v1/messages',
        openai: 'https://api.openai.com/v1/chat/completions',
    };

    if (provider === 'anthropic') {
        return fetch(endpoints.anthropic, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model,
                max_tokens: 8192,
                stream: true,
                system: systemPrompt,
                messages: [{ role: 'user', content: userContent }],
            }),
        });
    }

    // OpenAI-compatible (deepseek, openai)
    return fetch(endpoints[provider] || endpoints.openai, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            max_tokens: 8192,
            stream: true,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent },
            ],
        }),
    });
}
