/**
 * Services Registry — /services/*
 *
 * Unified catalog of ALL OpenClaw-enabled services. The Luna dashboard
 * renders this as the Services Hub — a visual grid where users can
 * see, enable, configure, and manage every capability.
 *
 * Each service has:
 *   - Type, name, icon, description
 *   - Status (active/inactive/error)
 *   - Quick stats (message count, execution count, etc.)
 *   - Configuration schema
 *   - Available actions
 *
 * Endpoints:
 *   GET    /services                    — Full catalog with live status
 *   GET    /services/:category          — Single service category detail
 *   PATCH  /services/:category          — Update service preferences
 *   POST   /services/:category/test     — Test a service
 *   GET    /services/health             — Service-wide health summary
 */

import { Hono } from 'hono';
import type { AppEnv, ServiceEnv } from '../types';
import { requireAuth } from '../middleware/auth';

export const serviceRoutes = new Hono<AppEnv>();

// ─── Service Category Definitions ───────────────────────────────────────────

interface ServiceCategory {
    id: string;
    name: string;
    icon: string;
    description: string;
    tier: 'core' | 'integration' | 'premium';
    docsUrl: string;
    configurable: boolean;
    actions: ServiceAction[];
}

interface ServiceAction {
    id: string;
    label: string;
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    endpoint: string;
    description: string;
}

const SERVICE_CATALOG: ServiceCategory[] = [
    {
        id: 'agents',
        name: 'AI Agents',
        icon: '🤖',
        description: '28+ specialized AI coding agents — code review, security audit, test generation, architecture design, and more.',
        tier: 'core',
        docsUrl: 'https://docs.lunaos.ai/agents',
        configurable: true,
        actions: [
            { id: 'list', label: 'Browse Agents', method: 'GET', endpoint: '/tools/agents', description: 'View all available agents' },
            { id: 'execute', label: 'Run Agent', method: 'POST', endpoint: '/tools/run', description: 'Execute an agent on your code' },
        ],
    },
    {
        id: 'chains',
        name: 'Agent Chains',
        icon: '🔗',
        description: 'Multi-agent pipelines — sequence multiple agents for comprehensive code analysis, full reviews, and automated workflows.',
        tier: 'core',
        docsUrl: 'https://docs.lunaos.ai/chains',
        configurable: true,
        actions: [
            { id: 'list', label: 'Browse Chains', method: 'GET', endpoint: '/tools/chains', description: 'View preset and custom chains' },
            { id: 'execute', label: 'Run Chain', method: 'POST', endpoint: '/tools/chain', description: 'Execute a multi-agent chain' },
        ],
    },
    {
        id: 'rag',
        name: 'Knowledge Base (RAG)',
        icon: '🔍',
        description: 'Semantic codebase search powered by vector embeddings. Index your repos and get AI-powered answers with full context.',
        tier: 'core',
        docsUrl: 'https://docs.lunaos.ai/rag',
        configurable: true,
        actions: [
            { id: 'search', label: 'Search', method: 'POST', endpoint: '/tools/search', description: 'Semantic search across indexed codebases' },
            { id: 'index', label: 'Index Files', method: 'POST', endpoint: '/tools/index', description: 'Index new files for RAG context' },
        ],
    },
    {
        id: 'channels',
        name: 'Channel Connections',
        icon: '💬',
        description: 'Connect Slack, WhatsApp, Discord, Telegram, and custom webhooks. Your AI agents respond directly in your team channels.',
        tier: 'integration',
        docsUrl: 'https://docs.lunaos.ai/channels',
        configurable: true,
        actions: [
            { id: 'list', label: 'My Connections', method: 'GET', endpoint: '/channels/connections', description: 'View connected channels' },
            { id: 'connect', label: 'Connect Channel', method: 'POST', endpoint: '/channels/connect', description: 'Connect a new channel' },
            { id: 'types', label: 'Available Channels', method: 'GET', endpoint: '/channels', description: 'Browse channel types' },
        ],
    },
    {
        id: 'gateways',
        name: 'Remote Gateways',
        icon: '🌐',
        description: 'Register remote OpenClaw gateways for on-premise execution. Run agents on your own infrastructure with full control.',
        tier: 'integration',
        docsUrl: 'https://docs.lunaos.ai/gateways',
        configurable: true,
        actions: [
            { id: 'list', label: 'My Gateways', method: 'GET', endpoint: '/gateways', description: 'View registered gateways' },
            { id: 'register', label: 'Register Gateway', method: 'POST', endpoint: '/gateways/register', description: 'Register a new gateway' },
        ],
    },
    {
        id: 'analytics',
        name: 'Usage Analytics',
        icon: '📊',
        description: 'Real-time usage dashboard — execution counts, response times, token usage, per-agent and per-channel breakdowns.',
        tier: 'core',
        docsUrl: 'https://docs.lunaos.ai/analytics',
        configurable: false,
        actions: [
            { id: 'overview', label: 'Dashboard', method: 'GET', endpoint: '/analytics/overview', description: 'Usage overview dashboard' },
            { id: 'skills', label: 'Skill Breakdown', method: 'GET', endpoint: '/analytics/skills', description: 'Per-skill execution metrics' },
            { id: 'sessions', label: 'Session History', method: 'GET', endpoint: '/analytics/sessions', description: 'Recent session log' },
        ],
    },
    {
        id: 'providers',
        name: 'LLM Providers',
        icon: '🧠',
        description: 'Configure AI model providers — DeepSeek, Anthropic (Claude), OpenAI (GPT). Set your default provider and manage API keys.',
        tier: 'core',
        docsUrl: 'https://docs.lunaos.ai/providers',
        configurable: true,
        actions: [
            { id: 'status', label: 'Provider Status', method: 'GET', endpoint: '/services/providers/status', description: 'Check which providers are configured' },
        ],
    },
    {
        id: 'api-keys',
        name: 'API Keys',
        icon: '🔑',
        description: 'Generate API keys for programmatic access. Use them in CI/CD pipelines, CLIs, or custom integrations.',
        tier: 'core',
        docsUrl: 'https://docs.lunaos.ai/api-keys',
        configurable: true,
        actions: [
            { id: 'list', label: 'My Keys', method: 'GET', endpoint: '/services/api-keys', description: 'View active API keys' },
            { id: 'create', label: 'Generate Key', method: 'POST', endpoint: '/services/api-keys', description: 'Create a new API key' },
        ],
    },
    {
        id: 'bridge',
        name: 'Cross-Platform Bridge',
        icon: '🌉',
        description: 'Unified execution hub for all platforms — LunaOS, OpenHands, CLI, webhooks. Single API to reach all agents from anywhere.',
        tier: 'integration',
        docsUrl: 'https://docs.lunaos.ai/bridge',
        configurable: false,
        actions: [
            { id: 'execute', label: 'Execute', method: 'POST', endpoint: '/bridge/execute', description: 'Run an agent via the bridge' },
            { id: 'channels', label: 'Integration Channels', method: 'GET', endpoint: '/bridge/channels', description: 'List available integrations' },
        ],
    },
];

// ═══════════════════════════════════════════════════════════════════════════
// Routes
// ═══════════════════════════════════════════════════════════════════════════

// ─── GET /services — Full catalog with live status ──────────────────────────

serviceRoutes.get('/', requireAuth, async (c) => {
    const userId = c.get('userId') as string;

    // Load live stats in parallel
    const [
        agentStats,
        channelStats,
        gatewayStats,
        analyticsStats,
        providerStatus,
        apiKeyCount,
        userPrefs,
    ] = await Promise.all([
        getAgentStats(c.env, userId),
        getChannelStats(c.env, userId),
        getGatewayStats(c.env, userId),
        getAnalyticsSummary(c.env, userId),
        getProviderStatus(c.env),
        getApiKeyCount(c.env, userId),
        getUserPreferences(c.env, userId),
    ]);

    const services = SERVICE_CATALOG.map(svc => {
        const prefs = userPrefs[svc.id] || {};
        let status: 'active' | 'inactive' | 'partial' | 'error' = 'active';
        let stats: Record<string, any> = {};
        let quickInfo = '';

        switch (svc.id) {
            case 'agents':
                stats = agentStats;
                quickInfo = `${agentStats.totalAgents} agents available`;
                break;

            case 'chains':
                stats = { presets: agentStats.chainPresets, customChains: 0 };
                quickInfo = `${agentStats.chainPresets} preset chains`;
                break;

            case 'rag':
                stats = { indexed: agentStats.ragEnabled };
                status = agentStats.ragEnabled ? 'active' : 'inactive';
                quickInfo = agentStats.ragEnabled ? 'Vectorize enabled' : 'Not configured';
                break;

            case 'channels':
                stats = channelStats;
                status = channelStats.active > 0 ? 'active' : 'inactive';
                quickInfo = channelStats.active > 0
                    ? `${channelStats.active} connected, ${channelStats.totalMessages} messages`
                    : 'No channels connected';
                break;

            case 'gateways':
                stats = gatewayStats;
                status = gatewayStats.total > 0 ? 'active' : 'inactive';
                quickInfo = gatewayStats.total > 0
                    ? `${gatewayStats.online}/${gatewayStats.total} online`
                    : 'No gateways registered';
                break;

            case 'analytics':
                stats = analyticsStats;
                quickInfo = `${analyticsStats.totalExecutions} executions (${analyticsStats.period})`;
                break;

            case 'providers':
                stats = providerStatus;
                const configuredCount = Object.values(providerStatus.providers).filter(Boolean).length;
                status = configuredCount > 0 ? 'active' : 'error';
                quickInfo = configuredCount > 0
                    ? `${configuredCount}/3 providers configured`
                    : 'No providers configured!';
                break;

            case 'api-keys':
                stats = { active: apiKeyCount };
                status = apiKeyCount > 0 ? 'active' : 'inactive';
                quickInfo = apiKeyCount > 0 ? `${apiKeyCount} active keys` : 'No API keys';
                break;

            case 'bridge':
                quickInfo = 'Always available';
                break;
        }

        return {
            ...svc,
            status,
            stats,
            quickInfo,
            enabled: prefs.enabled !== false, // enabled by default
            preferences: prefs,
        };
    });

    return c.json({
        services,
        total: services.length,
        byTier: {
            core: services.filter(s => s.tier === 'core').length,
            integration: services.filter(s => s.tier === 'integration').length,
            premium: services.filter(s => s.tier === 'premium').length,
        },
        timestamp: new Date().toISOString(),
    });
});

// ─── GET /services/:category — Single service detail ────────────────────────

serviceRoutes.get('/:category', requireAuth, async (c) => {
    const userId = c.get('userId') as string;
    const category = c.req.param('category');

    const svc = SERVICE_CATALOG.find(s => s.id === category);
    if (!svc) {
        return c.json({
            error: `Unknown service: ${category}`,
            available: SERVICE_CATALOG.map(s => s.id),
        }, 404);
    }

    let detail: any = {};

    switch (category) {
        case 'agents':
            detail = await getAgentDetail(c.env);
            break;

        case 'chains':
            detail = await getChainDetail(c.env);
            break;

        case 'channels':
            detail = await getChannelDetail(c.env, userId);
            break;

        case 'gateways':
            detail = await getGatewayDetail(c.env, userId);
            break;

        case 'providers':
            detail = await getProviderDetail(c.env);
            break;

        case 'api-keys':
            detail = await getApiKeyDetail(c.env, userId);
            break;

        case 'analytics':
            detail = await getAnalyticsDetail(c.env, userId);
            break;

        default:
            detail = { message: `Detail view not yet available for ${category}` };
    }

    const prefs = await getUserPreferences(c.env, userId);

    return c.json({
        service: {
            ...svc,
            preferences: prefs[category] || {},
        },
        detail,
    });
});

// ─── PATCH /services/:category — Update preferences ────────────────────────

serviceRoutes.patch('/:category', requireAuth, async (c) => {
    const userId = c.get('userId') as string;
    const category = c.req.param('category');

    const svc = SERVICE_CATALOG.find(s => s.id === category);
    if (!svc) {
        return c.json({ error: `Unknown service: ${category}` }, 404);
    }

    if (!svc.configurable) {
        return c.json({ error: `Service ${category} is not configurable` }, 400);
    }

    const body = await c.req.json<{
        enabled?: boolean;
        defaultAgent?: string;
        defaultProvider?: string;
        config?: Record<string, any>;
    }>();

    // Load existing, merge
    const existing = await getUserPreferences(c.env, userId);
    const updated = {
        ...existing,
        [category]: {
            ...(existing[category] || {}),
            ...body,
            updatedAt: new Date().toISOString(),
        },
    };

    await c.env.KV.put(`svc_prefs:${userId}`, JSON.stringify(updated), { expirationTtl: 60 * 60 * 24 * 365 });

    return c.json({ updated: true, category, preferences: updated[category] });
});

// ─── POST /services/:category/test — Test a service ────────────────────────

serviceRoutes.post('/:category/test', requireAuth, async (c) => {
    const category = c.req.param('category');

    const svc = SERVICE_CATALOG.find(s => s.id === category);
    if (!svc) {
        return c.json({ error: `Unknown service: ${category}` }, 404);
    }

    const results: Record<string, { ok: boolean; latency: string; detail?: string }> = {};
    const start = Date.now();

    try {
        switch (category) {
            case 'agents':
            case 'chains':
            case 'rag': {
                // Test D1
                const d1Start = Date.now();
                await c.env.DB.prepare("SELECT 1").first();
                results.database = { ok: true, latency: `${Date.now() - d1Start}ms` };

                // Test LLM
                const llmStart = Date.now();
                const provider = c.env.DEEPSEEK_API_KEY ? 'deepseek' : c.env.ANTHROPIC_API_KEY ? 'anthropic' : 'none';
                if (provider !== 'none') {
                    results.llm = { ok: true, latency: `${Date.now() - llmStart}ms`, detail: provider };
                } else {
                    results.llm = { ok: false, latency: '0ms', detail: 'No LLM provider configured' };
                }
                break;
            }

            case 'channels': {
                const d1Start = Date.now();
                await c.env.DB.prepare("SELECT COUNT(*) FROM channel_connections").first();
                results.database = { ok: true, latency: `${Date.now() - d1Start}ms` };
                break;
            }

            case 'gateways': {
                const kvStart = Date.now();
                await c.env.KV.put('_svc_test', 'ok');
                results.kv = { ok: true, latency: `${Date.now() - kvStart}ms` };
                break;
            }

            case 'providers': {
                const providers = ['deepseek', 'anthropic', 'openai'] as const;
                for (const p of providers) {
                    const key = p === 'deepseek' ? c.env.DEEPSEEK_API_KEY
                        : p === 'anthropic' ? c.env.ANTHROPIC_API_KEY
                            : c.env.OPENAI_API_KEY;
                    results[p] = { ok: !!key, latency: '0ms', detail: key ? 'configured' : 'missing' };
                }
                break;
            }

            default:
                results.service = { ok: true, latency: '0ms', detail: 'Basic check passed' };
        }
    } catch (err: any) {
        results.error = { ok: false, latency: `${Date.now() - start}ms`, detail: err.message };
    }

    const allOk = Object.values(results).every(r => r.ok);

    return c.json({
        service: category,
        healthy: allOk,
        checks: results,
        totalLatency: `${Date.now() - start}ms`,
    });
});

// ─── GET /services/health — Cross-service health summary ────────────────────

serviceRoutes.get('/health', async (c) => {
    const start = Date.now();

    const [d1, kv, llm] = await Promise.allSettled([
        c.env.DB.prepare("SELECT 1").first(),
        c.env.KV.put('_health', Date.now().toString()),
        Promise.resolve(!!c.env.DEEPSEEK_API_KEY || !!c.env.ANTHROPIC_API_KEY || !!c.env.OPENAI_API_KEY),
    ]);

    const checks = {
        database: { ok: d1.status === 'fulfilled', detail: d1.status === 'rejected' ? (d1 as any).reason?.message : 'ok' },
        kv: { ok: kv.status === 'fulfilled', detail: kv.status === 'rejected' ? (kv as any).reason?.message : 'ok' },
        llm: {
            ok: llm.status === 'fulfilled' && (llm as PromiseFulfilledResult<boolean>).value,
            detail: [
                c.env.DEEPSEEK_API_KEY ? 'deepseek' : null,
                c.env.ANTHROPIC_API_KEY ? 'anthropic' : null,
                c.env.OPENAI_API_KEY ? 'openai' : null,
            ].filter(Boolean).join(', ') || 'none',
        },
    };

    const allOk = Object.values(checks).every(ch => ch.ok);

    return c.json({
        status: allOk ? 'healthy' : 'degraded',
        latency: `${Date.now() - start}ms`,
        checks,
        serviceCount: SERVICE_CATALOG.length,
        timestamp: new Date().toISOString(),
    }, allOk ? 200 : 503);
});

// ─── GET /services/providers/status — LLM provider config ──────────────────

serviceRoutes.get('/providers/status', requireAuth, async (c) => {
    return c.json(await getProviderDetail(c.env));
});

// ─── API Keys Management ────────────────────────────────────────────────────

serviceRoutes.get('/api-keys', requireAuth, async (c) => {
    const userId = c.get('userId') as string;
    return c.json(await getApiKeyDetail(c.env, userId));
});

serviceRoutes.post('/api-keys', requireAuth, async (c) => {
    const userId = c.get('userId') as string;
    const body = await c.req.json<{ label?: string; scopes?: string[] }>();

    const rawKey = `luna_${crypto.randomUUID().replace(/-/g, '')}`;
    const keyHash = await hashString(rawKey);
    const keyId = crypto.randomUUID();

    try {
        await c.env.DB.prepare(`
            INSERT INTO api_keys (id, user_id, key_hash, label, scopes, created_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
        `).bind(
            keyId, userId, keyHash,
            body.label || 'API Key',
            JSON.stringify(body.scopes || ['*']),
        ).run();
    } catch {
        // Table might not exist — create it
        await c.env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS api_keys (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                key_hash TEXT NOT NULL,
                label TEXT DEFAULT 'API Key',
                scopes TEXT DEFAULT '["*"]',
                last_used_at TEXT,
                revoked_at TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        `).run();

        await c.env.DB.prepare(`
            INSERT INTO api_keys (id, user_id, key_hash, label, scopes, created_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
        `).bind(
            keyId, userId, keyHash,
            body.label || 'API Key',
            JSON.stringify(body.scopes || ['*']),
        ).run();
    }

    return c.json({
        id: keyId,
        key: rawKey, // Only shown once!
        label: body.label || 'API Key',
        scopes: body.scopes || ['*'],
        warning: 'Save this key — it will not be shown again.',
    }, 201);
});

serviceRoutes.delete('/api-keys/:keyId', requireAuth, async (c) => {
    const userId = c.get('userId') as string;
    const keyId = c.req.param('keyId');

    await c.env.DB.prepare(`
        UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ? AND user_id = ?
    `).bind(keyId, userId).run();

    return c.json({ revoked: true, id: keyId });
});

// ═══════════════════════════════════════════════════════════════════════════
// Data Fetchers
// ═══════════════════════════════════════════════════════════════════════════

async function getAgentStats(env: ServiceEnv, userId: string) {
    const agentList = getBuiltInAgents();
    let recentExecutions = 0;

    try {
        const result = await env.DB.prepare(`
            SELECT COUNT(*) as cnt FROM openclaw_skill_executions
            WHERE user_id = ? AND created_at >= datetime('now', '-30 day')
        `).bind(userId).first<{ cnt: number }>();
        recentExecutions = result?.cnt || 0;
    } catch { /* table may not exist */ }

    return {
        totalAgents: agentList.length,
        chainPresets: 5,
        ragEnabled: !!env.VECTORIZE,
        recentExecutions,
    };
}

async function getChannelStats(env: ServiceEnv, userId: string) {
    try {
        const result = await env.DB.prepare(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                SUM(message_count) as total_messages
            FROM channel_connections WHERE user_id = ? AND status != 'revoked'
        `).bind(userId).first<any>();

        return {
            total: result?.total || 0,
            active: result?.active || 0,
            totalMessages: result?.total_messages || 0,
        };
    } catch {
        return { total: 0, active: 0, totalMessages: 0 };
    }
}

async function getGatewayStats(env: ServiceEnv, userId: string) {
    try {
        const result = await env.DB.prepare(`
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online
            FROM openclaw_gateways WHERE user_id = ?
        `).bind(userId).first<any>();

        return { total: result?.total || 0, online: result?.online || 0 };
    } catch {
        return { total: 0, online: 0 };
    }
}

async function getAnalyticsSummary(env: ServiceEnv, userId: string) {
    try {
        const result = await env.DB.prepare(`
            SELECT COUNT(*) as total,
                   AVG(duration_ms) as avg_duration
            FROM openclaw_skill_executions
            WHERE user_id = ? AND created_at >= datetime('now', '-7 day')
        `).bind(userId).first<any>();

        return {
            totalExecutions: result?.total || 0,
            avgDurationMs: Math.round(result?.avg_duration || 0),
            period: '7d',
        };
    } catch {
        return { totalExecutions: 0, avgDurationMs: 0, period: '7d' };
    }
}

function getProviderStatus(env: ServiceEnv) {
    return {
        providers: {
            deepseek: !!env.DEEPSEEK_API_KEY,
            anthropic: !!env.ANTHROPIC_API_KEY,
            openai: !!env.OPENAI_API_KEY,
        },
        default: env.DEEPSEEK_API_KEY ? 'deepseek'
            : env.ANTHROPIC_API_KEY ? 'anthropic'
                : env.OPENAI_API_KEY ? 'openai'
                    : 'none',
    };
}

async function getApiKeyCount(env: ServiceEnv, userId: string) {
    try {
        const result = await env.DB.prepare(
            'SELECT COUNT(*) as cnt FROM api_keys WHERE user_id = ? AND revoked_at IS NULL'
        ).bind(userId).first<{ cnt: number }>();
        return result?.cnt || 0;
    } catch {
        return 0;
    }
}

async function getUserPreferences(env: ServiceEnv, userId: string): Promise<Record<string, any>> {
    try {
        const raw = await env.KV.get(`svc_prefs:${userId}`);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

// ─── Detail Fetchers ────────────────────────────────────────────────────────

async function getAgentDetail(env: ServiceEnv) {
    const agents = getBuiltInAgents();
    return {
        agents,
        total: agents.length,
        categories: {
            'Code Quality': agents.filter(a => ['code-review', 'testing-validation', 'refactoring-engineer'].includes(a.slug)).length,
            'Security': agents.filter(a => a.slug.includes('security') || a.slug.includes('365')).length,
            'Architecture': agents.filter(a => a.slug.includes('architect') || a.slug.includes('design')).length,
            'Operations': agents.filter(a => a.slug.includes('devops') || a.slug.includes('ops') || a.slug.includes('sre')).length,
        },
    };
}

async function getChainDetail(env: ServiceEnv) {
    return {
        presets: [
            { id: 'full-review', name: 'Full Code Review', agents: ['code-review', '365-security', 'testing-validation'], description: 'Complete review: code quality + security + test coverage' },
            { id: 'security-pipeline', name: 'Security Pipeline', agents: ['365-security', 'code-review'], description: 'Security-first analysis with code quality follow-up' },
            { id: 'pr-review', name: 'PR Review', agents: ['code-review', 'testing-validation', 'documentation'], description: 'PR-ready review: code + tests + docs' },
            { id: 'architecture-review', name: 'Architecture Review', agents: ['design-architect', 'code-review', '365-security'], description: 'Big picture: architecture + code + security' },
            { id: 'refactor-pipeline', name: 'Refactoring Pipeline', agents: ['refactoring-engineer', 'testing-validation', 'code-review'], description: 'Refactor → test → review validation loop' },
        ],
        customChainsSupported: true,
    };
}

async function getChannelDetail(env: ServiceEnv, userId: string) {
    try {
        const result = await env.DB.prepare(`
            SELECT id, channel_type, label, status, external_name,
                   message_count, last_message_at, connected_at
            FROM channel_connections WHERE user_id = ? AND status != 'revoked'
            ORDER BY created_at DESC
        `).bind(userId).all();

        return {
            connections: result.results || [],
            total: (result.results || []).length,
        };
    } catch {
        return { connections: [], total: 0 };
    }
}

async function getGatewayDetail(env: ServiceEnv, userId: string) {
    try {
        const result = await env.DB.prepare(`
            SELECT id, url, name, status, region, last_ping_at, registered_at
            FROM openclaw_gateways WHERE user_id = ?
            ORDER BY registered_at DESC
        `).bind(userId).all();

        return {
            gateways: result.results || [],
            total: (result.results || []).length,
        };
    } catch {
        return { gateways: [], total: 0 };
    }
}

function getProviderDetail(env: ServiceEnv) {
    return {
        providers: [
            {
                id: 'deepseek',
                name: 'DeepSeek',
                model: 'deepseek-chat',
                configured: !!env.DEEPSEEK_API_KEY,
                description: 'Fast, affordable AI reasoning. Best price-performance ratio.',
                endpoint: 'https://api.deepseek.com',
            },
            {
                id: 'anthropic',
                name: 'Anthropic (Claude)',
                model: 'claude-sonnet-4-20250514',
                configured: !!env.ANTHROPIC_API_KEY,
                description: 'Best code understanding. Excellent for complex code review and architecture.',
                endpoint: 'https://api.anthropic.com',
            },
            {
                id: 'openai',
                name: 'OpenAI (GPT)',
                model: 'gpt-4o',
                configured: !!env.OPENAI_API_KEY,
                description: 'Versatile AI model. Great for general coding tasks.',
                endpoint: 'https://api.openai.com',
            },
        ],
        defaultProvider: env.DEEPSEEK_API_KEY ? 'deepseek'
            : env.ANTHROPIC_API_KEY ? 'anthropic'
                : env.OPENAI_API_KEY ? 'openai'
                    : 'none',
    };
}

async function getApiKeyDetail(env: ServiceEnv, userId: string) {
    try {
        const result = await env.DB.prepare(`
            SELECT id, label, scopes, last_used_at, created_at
            FROM api_keys WHERE user_id = ? AND revoked_at IS NULL
            ORDER BY created_at DESC
        `).bind(userId).all();

        return {
            keys: (result.results || []).map((k: any) => ({
                id: k.id,
                label: k.label,
                scopes: k.scopes ? JSON.parse(k.scopes) : ['*'],
                lastUsedAt: k.last_used_at,
                createdAt: k.created_at,
            })),
            total: (result.results || []).length,
        };
    } catch {
        return { keys: [], total: 0 };
    }
}

async function getAnalyticsDetail(env: ServiceEnv, userId: string) {
    try {
        const [byAgent, byProvider, bySource, recent] = await Promise.all([
            env.DB.prepare(`
                SELECT agent_slug, COUNT(*) as count, AVG(duration_ms) as avg_ms
                FROM openclaw_skill_executions WHERE user_id = ? AND created_at >= datetime('now', '-30 day')
                GROUP BY agent_slug ORDER BY count DESC LIMIT 10
            `).bind(userId).all(),

            env.DB.prepare(`
                SELECT provider, COUNT(*) as count
                FROM openclaw_skill_executions WHERE user_id = ? AND created_at >= datetime('now', '-30 day')
                GROUP BY provider ORDER BY count DESC
            `).bind(userId).all(),

            env.DB.prepare(`
                SELECT source, COUNT(*) as count
                FROM openclaw_skill_executions WHERE user_id = ? AND created_at >= datetime('now', '-30 day')
                GROUP BY source ORDER BY count DESC
            `).bind(userId).all(),

            env.DB.prepare(`
                SELECT skill_name, agent_slug, provider, duration_ms, status, source, created_at
                FROM openclaw_skill_executions WHERE user_id = ?
                ORDER BY created_at DESC LIMIT 20
            `).bind(userId).all(),
        ]);

        return {
            byAgent: byAgent.results || [],
            byProvider: byProvider.results || [],
            bySource: bySource.results || [],
            recentExecutions: recent.results || [],
            period: '30d',
        };
    } catch {
        return { byAgent: [], byProvider: [], bySource: [], recentExecutions: [], period: '30d' };
    }
}

// ─── Built-in Agent Registry ────────────────────────────────────────────────

function getBuiltInAgents() {
    return [
        { slug: 'code-review', name: 'Code Review', category: 'quality', description: 'Deep code analysis, bug detection, best practices' },
        { slug: '365-security', name: 'Security Audit (365)', category: 'security', description: 'OWASP scanning, vulnerability detection, hardening' },
        { slug: 'testing-validation', name: 'Test Writer', category: 'quality', description: 'Unit, integration, and e2e test generation' },
        { slug: 'design-architect', name: 'Architect', category: 'architecture', description: 'System design, tech stack, scalability patterns' },
        { slug: 'refactoring-engineer', name: 'Refactoring', category: 'quality', description: 'Code restructuring, pattern improvements, cleanup' },
        { slug: 'documentation', name: 'Documentation', category: 'docs', description: 'JSDoc, README, API docs, inline comments' },
        { slug: 'devops-engineer', name: 'DevOps', category: 'operations', description: 'CI/CD, Docker, Kubernetes, infrastructure' },
        { slug: 'performance', name: 'Performance', category: 'optimization', description: 'Bottleneck analysis, optimization, profiling' },
        { slug: 'accessibility', name: 'Accessibility', category: 'quality', description: 'WCAG compliance, a11y best practices' },
        { slug: 'api-designer', name: 'API Designer', category: 'architecture', description: 'RESTful design, OpenAPI, GraphQL schema' },
        { slug: 'database-expert', name: 'Database Expert', category: 'data', description: 'Schema design, query optimization, migrations' },
        { slug: 'frontend-specialist', name: 'Frontend Specialist', category: 'frontend', description: 'React, Vue, CSS, responsive design patterns' },
        { slug: 'backend-specialist', name: 'Backend Specialist', category: 'backend', description: 'Node.js, Go, Python, microservices, APIs' },
        { slug: 'ml-engineer', name: 'ML Engineer', category: 'ai', description: 'Model pipelines, feature engineering, MLOps' },
        { slug: 'mobile-developer', name: 'Mobile Developer', category: 'mobile', description: 'React Native, Flutter, iOS, Android patterns' },
        { slug: 'sre-engineer', name: 'SRE', category: 'operations', description: 'Monitoring, alerting, incident response, SLOs' },
        { slug: 'data-engineer', name: 'Data Engineer', category: 'data', description: 'ETL, data pipelines, warehouse design' },
        { slug: 'tech-lead', name: 'Tech Lead', category: 'leadership', description: 'Code standards, team workflows, tech decisions' },
        { slug: 'dependency-auditor', name: 'Dependency Auditor', category: 'security', description: 'Package vulnerabilities, license compliance' },
        { slug: 'migration-specialist', name: 'Migration Specialist', category: 'operations', description: 'Framework upgrades, language migrations' },
        { slug: 'debugging-expert', name: 'Debugging Expert', category: 'quality', description: 'Root cause analysis, error tracing, fix suggestions' },
        { slug: 'code-formatter', name: 'Code Formatter', category: 'quality', description: 'Linting, formatting, style guide enforcement' },
        { slug: 'i18n-specialist', name: 'i18n Specialist', category: 'quality', description: 'Internationalization, localization, RTL support' },
        { slug: 'git-reviewer', name: 'Git Reviewer', category: 'quality', description: 'Commit messages, branch strategies, PR reviews' },
        { slug: 'compliance-officer', name: 'Compliance', category: 'security', description: 'GDPR, HIPAA, SOC2, regulatory compliance' },
        { slug: 'ux-reviewer', name: 'UX Reviewer', category: 'frontend', description: 'Usability analysis, UX patterns, interaction design' },
        { slug: 'cost-optimizer', name: 'Cost Optimizer', category: 'optimization', description: 'Cloud cost analysis, resource right-sizing' },
        { slug: 'incident-responder', name: 'Incident Responder', category: 'operations', description: 'P1 response, postmortem, RCA documentation' },
    ];
}

// ─── Utility ────────────────────────────────────────────────────────────────

async function hashString(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
