/**
 * OpenClaw Backend Service — Cloudflare Worker
 *
 * Standalone backend that provides the OpenClaw protocol as a service.
 * Acts as the central hub connecting LunaOS agents, OpenHands AI engine,
 * and external consumers (CLI, dashboards, plugins).
 *
 * Architecture:
 *   ┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
 *   │  LunaOS API  │────▶│  OpenClaw Svc    │◀────│  OpenHands   │
 *   │  (cf worker) │     │  (this worker)    │     │  (ai-engine) │
 *   └──────────────┘     └──────────────────┘     └──────────────┘
 *          ▲                      │ ▼                     ▲
 *          │                ┌─────┴─────┐                 │
 *          │                │  D1 / KV  │                 │
 *          │                └───────────┘                 │
 *    Users / CLI                                    Users / CLI
 *
 * Capabilities:
 *   1. Tool Registry — OpenClaw-compatible tool definitions
 *   2. Agent Execution — Direct LLM calls with streaming SSE
 *   3. Chain Execution — Multi-agent pipelines
 *   4. RAG Search & Indexing — Semantic codebase search
 *   5. Gateway Management — Register/manage remote gateways
 *   6. Analytics — Usage tracking, skill metrics, session history
 *   7. Cross-Platform Bridge — Unified API for Luna + OpenHands
 *
 * Consumers:
 *   - LunaOS Engine (via Service Binding or HTTP)
 *   - OpenHands AI Engine (via HTTP)
 *   - CLI tools (via HTTP + API key)
 *   - Dashboard (via HTTP + JWT)
 *   - External plugins (via HTTP + API key)
 */

import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { toolRoutes } from './routes/tools';
import { gatewayRoutes } from './routes/gateways';
import { analyticsRoutes } from './routes/analytics';
import { bridgeRoutes } from './routes/bridge';
import { channelRoutes } from './routes/channels';
import { serviceRoutes } from './routes/services';
import type { AppEnv } from './types';

const app = new Hono<AppEnv>();

// ─── Global Middleware ──────────────────────────────────────────────────────

app.use('*', logger());
app.use('*', cors({
    origin: [
        'https://lunaos.ai',
        'https://studio.lunaos.ai',
        'https://api.lunaos.ai',
        'https://dash.lunaos.ai',
        'http://localhost:5173',
        'http://localhost:8787',
        'http://localhost:8788',
        'http://localhost:8790',
        'http://localhost:8000',  // OpenHands
    ],
    allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Service-Key', 'X-Request-Source', 'X-Webhook-Secret'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    exposeHeaders: ['X-Request-Id', 'X-Execution-Id'],
    maxAge: 86400,
}));

// Add security headers
app.use('*', async (c, next) => {
    await next();
    c.res.headers.set('X-Content-Type-Options', 'nosniff');
    c.res.headers.set('X-Frame-Options', 'DENY');
    c.res.headers.set('X-Request-Id', crypto.randomUUID());
});

// ─── Mount Routes ───────────────────────────────────────────────────────────

app.route('/tools', toolRoutes);
app.route('/gateways', gatewayRoutes);
app.route('/analytics', analyticsRoutes);
app.route('/bridge', bridgeRoutes);
app.route('/channels', channelRoutes);
app.route('/services', serviceRoutes);

// ─── Root & Health ──────────────────────────────────────────────────────────

app.get('/', (c) => {
    return c.json({
        service: 'OpenClaw Backend Service',
        version: c.env.VERSION || '1.0.0',
        protocol: 'openclaw-v3',
        status: 'operational',
        capabilities: [
            'agent-execution',
            'chain-execution',
            'rag-search',
            'rag-indexing',
            'gateway-management',
            'analytics',
            'luna-bridge',
            'openhands-bridge',
        ],
        endpoints: {
            tools: '/tools',
            gateways: '/gateways',
            analytics: '/analytics',
            bridge: '/bridge',
            health: '/health',
        },
        docs: 'https://docs.lunaos.ai/openclaw',
    });
});

app.get('/health', async (c) => {
    const start = Date.now();
    const checks: Record<string, { status: string; detail?: string; latency?: string }> = {};

    // D1 check
    try {
        const d1Start = Date.now();
        const result = await c.env.DB.prepare(
            "SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table'"
        ).first<{ cnt: number }>();
        checks.d1 = {
            status: 'ok',
            latency: `${Date.now() - d1Start}ms`,
            detail: `${result?.cnt || 0} tables`,
        };
    } catch (err: any) {
        checks.d1 = { status: 'error', detail: err.message };
    }

    // KV check
    try {
        const kvStart = Date.now();
        await c.env.KV.put('_oc_health', Date.now().toString());
        checks.kv = {
            status: 'ok',
            latency: `${Date.now() - kvStart}ms`,
        };
    } catch (err: any) {
        checks.kv = { status: 'error', detail: err.message };
    }

    // LLM providers
    checks.llm = {
        status: 'ok',
        detail: [
            c.env.DEEPSEEK_API_KEY ? 'deepseek' : null,
            c.env.ANTHROPIC_API_KEY ? 'anthropic' : null,
            c.env.OPENAI_API_KEY ? 'openai' : null,
        ].filter(Boolean).join(', ') || 'none',
    };

    const allOk = Object.values(checks).every(c => c.status === 'ok');

    return c.json({
        status: allOk ? 'healthy' : 'degraded',
        version: c.env.VERSION || '1.0.0',
        environment: c.env.ENVIRONMENT || 'development',
        latency: `${Date.now() - start}ms`,
        services: checks,
        timestamp: new Date().toISOString(),
    }, allOk ? 200 : 503);
});

// ─── 404 & Error ────────────────────────────────────────────────────────────

app.notFound((c) => c.json({ error: 'Not Found', path: c.req.path }, 404));

app.onError((err, c) => {
    console.error(`[OPENCLAW ERROR] ${c.req.method} ${c.req.path}:`, err.message);
    return c.json({
        error: 'Internal Server Error',
        message: c.env.ENVIRONMENT === 'development' ? err.message : 'Something went wrong',
    }, 500);
});

export default app;
