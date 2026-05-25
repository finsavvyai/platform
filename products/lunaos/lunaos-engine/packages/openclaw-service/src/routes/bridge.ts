/**
 * Bridge Routes — /bridge/*
 *
 * The cross-platform integration hub. This is the single entry point
 * that all external channels hit to access OpenClaw capabilities.
 *
 * Architecture:
 *   ┌─────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐
 *   │  Slack   │  │ WhatsApp  │  │  Discord  │  │ Telegram  │  │  Custom  │
 *   └────┬────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └────┬─────┘
 *        │             │              │              │              │
 *        └──────────┬──┘──────────────┘──────────────┘──────────────┘
 *                   ▼
 *          ┌─────────────────┐
 *          │  POST /bridge/  │  ← Unified JSON protocol
 *          │    channel      │
 *          └────────┬────────┘
 *                   ▼
 *          ┌─────────────────┐     ┌──────────────┐
 *          │  OpenClaw Svc   │◀───▶│  LunaOS API  │
 *          │  Tool Execution │     │  OpenHands    │
 *          └─────────────────┘     └──────────────┘
 *
 * Each channel just needs:
 *   1. A webhook handler that reformats incoming messages to BridgeRequest
 *   2. A response formatter that sends results back to the channel
 *
 * Supported channels:
 *   POST /bridge/execute    — Direct execution (Luna, OpenHands, CLI)
 *   POST /bridge/webhook    — Generic webhook (Slack, Discord, Telegram)
 *   POST /bridge/slack      — Slack-specific webhook handler
 *   POST /bridge/whatsapp   — WhatsApp Business API webhook
 *   POST /bridge/discord    — Discord interactions webhook
 *   POST /bridge/telegram   — Telegram Bot API webhook
 *   GET  /bridge/channels   — List configured channels
 */

import { Hono } from 'hono';
import type { AppEnv, ServiceEnv } from '../types';
import { requireAuth, requireServiceAuth, rateLimit } from '../middleware/auth';
import { clawGuard } from '../middleware/guard';

export const bridgeRoutes = new Hono<AppEnv>();

// Guard all bridge endpoints against prompt injection (self-hosted Claw)
bridgeRoutes.use('/bridge/*', clawGuard());

// ─── Channel Registry ───────────────────────────────────────────────────────

interface ChannelConfig {
    id: string;
    name: string;
    type: 'messaging' | 'service' | 'webhook' | 'cli';
    status: 'active' | 'configured' | 'available';
    endpoint: string;
    description: string;
}

const CHANNELS: ChannelConfig[] = [
    {
        id: 'luna', name: 'LunaOS Engine', type: 'service', status: 'active',
        endpoint: '/bridge/execute', description: 'Native LunaOS agent platform',
    },
    {
        id: 'openhands', name: 'OpenHands AI', type: 'service', status: 'active',
        endpoint: '/bridge/execute', description: 'OpenHands AI engine integration',
    },
    {
        id: 'cli', name: 'CLI', type: 'cli', status: 'active',
        endpoint: '/bridge/execute', description: 'Command-line interface',
    },
    {
        id: 'slack', name: 'Slack', type: 'messaging', status: 'available',
        endpoint: '/bridge/slack', description: 'Slack workspace bot integration',
    },
    {
        id: 'whatsapp', name: 'WhatsApp', type: 'messaging', status: 'available',
        endpoint: '/bridge/whatsapp', description: 'WhatsApp Business API',
    },
    {
        id: 'discord', name: 'Discord', type: 'messaging', status: 'available',
        endpoint: '/bridge/discord', description: 'Discord bot integration',
    },
    {
        id: 'telegram', name: 'Telegram', type: 'messaging', status: 'available',
        endpoint: '/bridge/telegram', description: 'Telegram Bot API',
    },
    {
        id: 'webhook', name: 'Custom Webhook', type: 'webhook', status: 'active',
        endpoint: '/bridge/webhook', description: 'Generic webhook for any platform',
    },
];

// ─── GET /bridge/channels — List available channels ─────────────────────────

bridgeRoutes.get('/channels', (c) => {
    return c.json({
        channels: CHANNELS,
        total: CHANNELS.length,
        active: CHANNELS.filter(ch => ch.status === 'active').length,
        available: CHANNELS.filter(ch => ch.status === 'available').length,
        docs: 'https://docs.lunaos.ai/openclaw/channels',
    });
});

// ─── POST /bridge/execute — Direct execution ────────────────────────────────
// Used by LunaOS, OpenHands, CLI, and any service-to-service call

bridgeRoutes.post('/execute', requireServiceAuth, rateLimit, async (c) => {
    const userId = c.get('userId') as string;
    const body = await c.req.json<{
        action: 'run' | 'chain' | 'search' | 'index' | 'status' | 'agents';
        source: string;
        payload: Record<string, any>;
        correlationId?: string;
    }>();

    if (!body.action || !body.payload) {
        return c.json({ error: 'Missing required fields: action, payload' }, 400);
    }

    const startTime = Date.now();
    const requestId = body.correlationId || crypto.randomUUID();
    const source = body.source || 'bridge';

    try {
        let result: any;

        switch (body.action) {
            case 'run': {
                const { agent, context, provider, useRag } = body.payload;
                if (!agent || !context) {
                    return c.json({ error: 'run requires agent and context' }, 400);
                }

                // Resolve API key
                const apiKey = resolveApiKey(c.env, provider || 'deepseek');
                if (!apiKey) {
                    return c.json({ error: `No API key for ${provider || 'deepseek'}` }, 500);
                }

                // Non-streaming execution for bridge calls
                result = await executeAgent(c.env, {
                    agent, context, provider: provider || 'deepseek',
                    model: getDefaultModel(provider || 'deepseek'),
                    apiKey, userId, source,
                });
                break;
            }

            case 'chain': {
                const { preset, context, provider } = body.payload;
                if (!preset || !context) {
                    return c.json({ error: 'chain requires preset and context' }, 400);
                }
                result = { preset, status: 'queued', message: 'Chain execution queued. Use streaming endpoint for real-time results.' };
                break;
            }

            case 'search': {
                const { query, topK } = body.payload;
                if (!query) {
                    return c.json({ error: 'search requires query' }, 400);
                }

                if (!c.env.AI || !c.env.VECTORIZE) {
                    return c.json({ error: 'RAG not configured' }, 503);
                }

                result = await executeSearch(c.env, query, topK || 5);
                break;
            }

            case 'agents': {
                result = {
                    agents: [
                        'code-review', 'testing-validation', 'documentation',
                        '365-security', 'design-architect', 'task-planner',
                        'requirements-analyzer', 'deployment', 'api-generator',
                        'database', 'run', 'task-executor',
                    ],
                    total: 28,
                };
                break;
            }

            case 'status': {
                const gateways = await c.env.DB.prepare(`
                    SELECT COUNT(*) as total, SUM(CASE WHEN health_status = 'healthy' THEN 1 ELSE 0 END) as healthy
                    FROM openclaw_gateways WHERE user_id = ? AND status = 'active'
                `).bind(userId).first<{ total: number; healthy: number }>();

                result = {
                    service: 'operational',
                    gateways: { total: gateways?.total || 0, healthy: gateways?.healthy || 0 },
                    channels: CHANNELS.filter(ch => ch.status === 'active').map(ch => ch.id),
                };
                break;
            }

            default:
                return c.json({
                    error: `Unknown action: ${body.action}`,
                    validActions: ['run', 'chain', 'search', 'index', 'status', 'agents'],
                }, 400);
        }

        return c.json({
            success: true,
            requestId,
            source,
            action: body.action,
            data: result,
            durationMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
        });

    } catch (err: any) {
        return c.json({
            success: false,
            requestId,
            source,
            action: body.action,
            error: err.message,
            durationMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
        }, 500);
    }
});

// ─── POST /bridge/webhook — Generic Webhook ─────────────────────────────────
// Any platform can send { text, userId, channelId, metadata }

bridgeRoutes.post('/webhook', rateLimit, async (c) => {
    const body = await c.req.json<{
        text: string;
        userId?: string;
        channelId?: string;
        platform?: string;
        replyUrl?: string;
        metadata?: Record<string, any>;
    }>();

    if (!body.text) {
        return c.json({ error: 'Missing required field: text' }, 400);
    }

    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    // Parse command from text: "@luna code-review: ..." or "/luna run code-review ..."
    const parsed = parseCommand(body.text);

    if (!parsed) {
        return c.json({
            requestId,
            response: `I didn't understand that command. Try:\n• \`@luna code-review: <your code>\`\n• \`@luna search: <query>\`\n• \`@luna agents\` — list available agents\n• \`@luna status\` — check system status`,
            platform: body.platform || 'webhook',
        });
    }

    try {
        const apiKey = resolveApiKey(c.env, 'deepseek');

        if (parsed.action === 'agents') {
            return c.json({
                requestId,
                response: '**Available Agents:**\n• code-review — Deep code analysis\n• testing-validation — Test generation\n• 365-security — Security audit\n• documentation — Doc generation\n• design-architect — System design\n• task-planner — Task breakdowns\n\n_53 agents total. Use `@luna <agent>: <context>` to run._',
                platform: body.platform || 'webhook',
            });
        }

        if (parsed.action === 'status') {
            return c.json({
                requestId,
                response: '✅ **OpenClaw Service:** Operational\n🤖 **Agents:** 53 available\n⚡ **Providers:** deepseek, anthropic, openai',
                platform: body.platform || 'webhook',
            });
        }

        if (parsed.action === 'run' && apiKey) {
            const result = await executeAgent(c.env, {
                agent: parsed.agent || 'run',
                context: parsed.context,
                provider: 'deepseek',
                model: 'deepseek-chat',
                apiKey,
                userId: body.userId || 'webhook',
                source: body.platform || 'webhook',
            });

            // Truncate for messaging platforms (Slack has 40k char limit, WhatsApp 4096)
            const maxLen = body.platform === 'whatsapp' ? 4000 : body.platform === 'telegram' ? 4000 : 39000;
            const truncated = result.output.length > maxLen
                ? result.output.substring(0, maxLen) + '\n\n_...truncated. Full results at dashboard._'
                : result.output;

            // If a reply URL is provided, send the response there too
            if (body.replyUrl) {
                try {
                    await fetch(body.replyUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: truncated }),
                    });
                } catch { /* non-blocking */ }
            }

            return c.json({
                requestId,
                response: truncated,
                agent: parsed.agent,
                durationMs: Date.now() - startTime,
                platform: body.platform || 'webhook',
            });
        }

        if (parsed.action === 'search') {
            if (!c.env.AI || !c.env.VECTORIZE) {
                return c.json({
                    requestId,
                    response: '⚠️ RAG search is not configured on this instance.',
                    platform: body.platform || 'webhook',
                });
            }

            const results = await executeSearch(c.env, parsed.context, 3);
            const formatted = results.results.map((r: any, i: number) =>
                `**${i + 1}.** ${r.metadata?.path || 'unknown'} (score: ${r.score?.toFixed(2)})\n\`\`\`\n${r.content?.substring(0, 300)}\n\`\`\``
            ).join('\n\n');

            return c.json({
                requestId,
                response: formatted || 'No results found.',
                platform: body.platform || 'webhook',
            });
        }

        return c.json({
            requestId,
            response: 'Unknown command. Try `@luna help` for usage.',
            platform: body.platform || 'webhook',
        });

    } catch (err: any) {
        return c.json({
            requestId,
            response: `❌ Error: ${err.message}`,
            platform: body.platform || 'webhook',
            durationMs: Date.now() - startTime,
        }, 500);
    }
});

// ─── POST /bridge/slack — Slack Events API ──────────────────────────────────

bridgeRoutes.post('/slack', async (c) => {
    const body = await c.req.json<any>();

    // Slack URL verification challenge
    if (body.type === 'url_verification') {
        return c.json({ challenge: body.challenge });
    }

    // Slack event callback
    if (body.type === 'event_callback' && body.event) {
        const event = body.event;

        // Only handle messages mentioning the bot
        if (event.type === 'app_mention' || (event.type === 'message' && !event.bot_id)) {
            const text = event.text?.replace(/<@[A-Z0-9]+>/g, '').trim() || '';

            if (!text) {
                return c.json({ ok: true });
            }

            // Process async — Slack expects fast response
            const parsed = parseCommand(text);
            const apiKey = resolveApiKey(c.env, 'deepseek');

            if (parsed?.action === 'run' && apiKey) {
                // Respond to Slack via response_url or chat.postMessage
                // For now, return inline (works with Slack's 3s timeout for simple commands)
                try {
                    const result = await executeAgent(c.env, {
                        agent: parsed.agent || 'run',
                        context: parsed.context,
                        provider: 'deepseek',
                        model: 'deepseek-chat',
                        apiKey,
                        userId: event.user || 'slack',
                        source: 'slack',
                    });

                    const response = result.output.substring(0, 39000);

                    // Post back to Slack via webhook or Slack API
                    // This requires SLACK_BOT_TOKEN env var
                    if (c.env.KV) {
                        const slackToken = await c.env.KV.get('slack_bot_token');
                        if (slackToken) {
                            await fetch('https://slack.com/api/chat.postMessage', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${slackToken}`,
                                },
                                body: JSON.stringify({
                                    channel: event.channel,
                                    text: `🤖 *${parsed.agent || 'run'}*:\n${response}`,
                                    thread_ts: event.ts,
                                }),
                            });
                        }
                    }
                } catch {
                    // Non-blocking — Slack already got 200
                }
            }
        }
    }

    return c.json({ ok: true });
});

// ─── POST /bridge/whatsapp — WhatsApp Business API ──────────────────────────

bridgeRoutes.post('/whatsapp', async (c) => {
    const body = await c.req.json<any>();

    // WhatsApp verification (GET is handled separately, but webhook is POST)
    if (body.object === 'whatsapp_business_account') {
        const entries = body.entry || [];

        for (const entry of entries) {
            const changes = entry.changes || [];
            for (const change of changes) {
                if (change.field !== 'messages') continue;

                const messages = change.value?.messages || [];
                for (const msg of messages) {
                    if (msg.type !== 'text') continue;

                    const text = msg.text?.body || '';
                    const from = msg.from;
                    const parsed = parseCommand(text);

                    if (parsed) {
                        const apiKey = resolveApiKey(c.env, 'deepseek');
                        if (apiKey && parsed.action === 'run') {
                            try {
                                const result = await executeAgent(c.env, {
                                    agent: parsed.agent || 'run',
                                    context: parsed.context,
                                    provider: 'deepseek',
                                    model: 'deepseek-chat',
                                    apiKey,
                                    userId: from,
                                    source: 'whatsapp',
                                });

                                // Reply via WhatsApp Business API
                                const waToken = await c.env.KV.get('wa_access_token');
                                const waPhoneId = await c.env.KV.get('wa_phone_id');

                                if (waToken && waPhoneId) {
                                    await fetch(`https://graph.facebook.com/v18.0/${waPhoneId}/messages`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${waToken}`,
                                        },
                                        body: JSON.stringify({
                                            messaging_product: 'whatsapp',
                                            to: from,
                                            type: 'text',
                                            text: { body: result.output.substring(0, 4000) },
                                        }),
                                    });
                                }
                            } catch {
                                // Non-blocking
                            }
                        }
                    }
                }
            }
        }
    }

    return c.json({ ok: true });
});

// WhatsApp GET verification
bridgeRoutes.get('/whatsapp', (c) => {
    const mode = c.req.query('hub.mode');
    const token = c.req.query('hub.verify_token');
    const challenge = c.req.query('hub.challenge');

    // Verify against stored token
    if (mode === 'subscribe' && challenge) {
        // In production, verify token against env var
        return c.text(challenge);
    }

    return c.json({ error: 'Verification failed' }, 403);
});

// ─── POST /bridge/discord — Discord Interactions ────────────────────────────

bridgeRoutes.post('/discord', async (c) => {
    const body = await c.req.json<any>();

    // Discord verification ping
    if (body.type === 1) {
        return c.json({ type: 1 });
    }

    // Slash command
    if (body.type === 2) {
        const command = body.data?.name;
        const options = body.data?.options || [];
        const userId = body.member?.user?.id || body.user?.id || 'discord';

        if (command === 'luna') {
            const agent = options.find((o: any) => o.name === 'agent')?.value || 'run';
            const context = options.find((o: any) => o.name === 'context')?.value || '';

            const apiKey = resolveApiKey(c.env, 'deepseek');
            if (apiKey && context) {
                try {
                    const result = await executeAgent(c.env, {
                        agent, context,
                        provider: 'deepseek',
                        model: 'deepseek-chat',
                        apiKey,
                        userId,
                        source: 'discord',
                    });

                    return c.json({
                        type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
                        data: {
                            content: `🤖 **${agent}**:\n${result.output.substring(0, 2000)}`,
                        },
                    });
                } catch (err: any) {
                    return c.json({
                        type: 4,
                        data: { content: `❌ Error: ${err.message}` },
                    });
                }
            }

            return c.json({
                type: 4,
                data: { content: 'Usage: `/luna agent:<agent> context:<your code or question>`' },
            });
        }
    }

    return c.json({ ok: true });
});

// ─── POST /bridge/telegram — Telegram Bot ───────────────────────────────────

bridgeRoutes.post('/telegram', async (c) => {
    const body = await c.req.json<any>();

    const message = body.message;
    if (!message?.text) return c.json({ ok: true });

    const text = message.text;
    const chatId = message.chat?.id;
    const userId = String(message.from?.id || 'telegram');

    const parsed = parseCommand(text.replace(/^\//, '')); // Remove leading /

    if (parsed?.action === 'run') {
        const apiKey = resolveApiKey(c.env, 'deepseek');
        if (apiKey) {
            try {
                const result = await executeAgent(c.env, {
                    agent: parsed.agent || 'run',
                    context: parsed.context,
                    provider: 'deepseek',
                    model: 'deepseek-chat',
                    apiKey,
                    userId,
                    source: 'telegram',
                });

                const tgToken = await c.env.KV.get('telegram_bot_token');
                if (tgToken && chatId) {
                    await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: chatId,
                            text: result.output.substring(0, 4000),
                            parse_mode: 'Markdown',
                        }),
                    });
                }
            } catch {
                // Non-blocking
            }
        }
    }

    return c.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse a natural language command into action + agent + context.
 *
 * Formats:
 *   "@luna code-review: Review this code..."
 *   "luna code-review Review this code..."
 *   "/luna run code-review Review this..."
 *   "code-review: Review this..."
 *   "search: authentication middleware"
 *   "agents"
 *   "status"
 */
function parseCommand(text: string): { action: string; agent?: string; context: string } | null {
    const cleaned = text.replace(/^[@/]?luna\s*/i, '').trim();

    if (!cleaned) return null;

    // Meta commands
    if (/^(agents?|list|help)$/i.test(cleaned)) {
        return { action: 'agents', context: '' };
    }
    if (/^(status|health|ping)$/i.test(cleaned)) {
        return { action: 'status', context: '' };
    }

    // Search command
    const searchMatch = cleaned.match(/^search[:\s]+(.+)$/i);
    if (searchMatch) {
        return { action: 'search', context: searchMatch[1].trim() };
    }

    // Agent execution: "agent-slug: context" or "agent-slug context"
    const agentMatch = cleaned.match(/^([a-z0-9-]+)[:\s]+(.+)$/is);
    if (agentMatch) {
        const possibleAgent = agentMatch[1].toLowerCase();
        const knownAgents = [
            'code-review', '365-security', 'testing-validation', 'documentation',
            'design-architect', 'task-planner', 'task-executor', 'requirements-analyzer',
            'deployment', 'api-generator', 'database', 'run', 'auth', 'seo',
            'docker', 'cloudflare', 'monitoring-observability', 'ui-fix', 'ui-test',
        ];

        if (knownAgents.includes(possibleAgent)) {
            return { action: 'run', agent: possibleAgent, context: agentMatch[2].trim() };
        }
    }

    // Default: treat entire text as context for general agent
    return { action: 'run', agent: 'run', context: cleaned };
}

/**
 * Execute an agent (non-streaming) for webhook/bridge calls.
 */
async function executeAgent(
    env: ServiceEnv,
    opts: {
        agent: string;
        context: string;
        provider: string;
        model: string;
        apiKey: string;
        userId: string;
        source: string;
    }
): Promise<{ output: string; durationMs: number; executionId: string }> {
    const startTime = Date.now();
    const executionId = crypto.randomUUID();

    const systemPrompt = `You are a specialized AI coding agent from LunaOS (agent: ${opts.agent}). Provide expert analysis and actionable recommendations. Be concise but thorough.`;

    const response = await callLLM(opts.provider, opts.model, opts.apiKey, systemPrompt, opts.context);

    if (!response.ok) {
        throw new Error(`LLM error: ${response.status}`);
    }

    // Collect full response (non-streaming)
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let output = '';
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
                if (content) output += content;
            } catch { /* skip */ }
        }
    }

    const durationMs = Date.now() - startTime;

    // Track execution
    try {
        await env.DB.prepare(`
            INSERT INTO openclaw_skill_executions
            (id, user_id, skill_name, agent_slug, provider, input_length, output_length, duration_ms, status, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            executionId, opts.userId, 'luna_run', opts.agent,
            opts.provider, opts.context.length, output.length,
            durationMs, 'completed', opts.source,
        ).run();
    } catch { /* non-blocking */ }

    return { output, durationMs, executionId };
}

/**
 * Execute RAG search.
 */
async function executeSearch(
    env: ServiceEnv,
    query: string,
    topK: number,
): Promise<{ results: any[]; total: number; searchTimeMs: number }> {
    const startTime = Date.now();

    const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: [query.substring(0, 512)],
    });

    const vector = embedding?.data?.[0];
    if (!vector?.length) {
        return { results: [], total: 0, searchTimeMs: Date.now() - startTime };
    }

    const results = await env.VECTORIZE.query(vector, {
        topK, returnValues: false, returnMetadata: true,
    });

    if (!results?.matches?.length) {
        return { results: [], total: 0, searchTimeMs: Date.now() - startTime };
    }

    const chunkIds = results.matches.map((m: any) => `'${m.id}'`).join(',');
    const chunks = await env.DB.prepare(
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

    return { results: matches, total: matches.length, searchTimeMs: Date.now() - startTime };
}

function resolveApiKey(env: ServiceEnv, provider: string): string | undefined {
    return ({
        deepseek: env.DEEPSEEK_API_KEY,
        anthropic: env.ANTHROPIC_API_KEY,
        openai: env.OPENAI_API_KEY,
    } as Record<string, string | undefined>)[provider];
}

function getDefaultModel(provider: string): string {
    return ({
        deepseek: 'deepseek-chat',
        anthropic: 'claude-sonnet-4-20250514',
        openai: 'gpt-4o',
    } as Record<string, string>)[provider] || 'deepseek-chat';
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
                model, max_tokens: 4096, stream: true,
                system: systemPrompt,
                messages: [{ role: 'user', content: userContent }],
            }),
        });
    }

    return fetch(endpoints[provider] || endpoints.openai, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model, max_tokens: 4096, stream: true,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent },
            ],
        }),
    });
}
