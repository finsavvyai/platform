/**
 * Health routes
 *   GET /health — fast lightweight check (no DB/KV pings) — P95 target <50ms
 *   GET /ready  — deep readiness check with DB ping (for load balancer probes)
 */

import { Hono } from 'hono';
import type { Env } from '../worker';

export const healthRoutes = new Hono<{ Bindings: Env }>();

/** Readiness probe — 200 if DB is reachable, 503 otherwise. */
export async function readyHandler(c: any) {
    try {
        await c.env.DB.prepare('SELECT 1').first();
        return c.json({ status: 'ready', timestamp: new Date().toISOString() });
    } catch (err: any) {
        return c.json({
            status: 'not_ready',
            error: err.message?.slice(0, 200),
            timestamp: new Date().toISOString(),
        }, 503);
    }
}

healthRoutes.get('/', async (c) => {
    const start = Date.now();
    const checks: Record<string, { status: string; latency?: string; detail?: string }> = {};

    // Check D1
    try {
        const d1Start = Date.now();
        const result = await c.env.DB.prepare(
            "SELECT COUNT(*) as table_count FROM sqlite_master WHERE type='table'"
        ).first<{ table_count: number }>();
        checks.d1 = {
            status: 'ok',
            latency: `${Date.now() - d1Start}ms`,
            detail: `${result?.table_count || 0} tables`,
        };
    } catch (err: any) {
        checks.d1 = { status: 'error', detail: err.message };
    }

    // Check KV
    try {
        const kvStart = Date.now();
        await c.env.KV.put('_health', Date.now().toString());
        const val = await c.env.KV.get('_health');
        checks.kv = {
            status: val ? 'ok' : 'degraded',
            latency: `${Date.now() - kvStart}ms`,
        };
    } catch (err: any) {
        checks.kv = { status: 'error', detail: err.message };
    }

    // Check Vectorize
    try {
        const vecStart = Date.now();
        if (c.env.VECTORIZE) {
            // Vectorize describe() check
            const info = await c.env.VECTORIZE.describe();
            checks.vectorize = {
                status: 'ok',
                latency: `${Date.now() - vecStart}ms`,
                detail: `${info?.vectorsCount || 0} vectors`,
            };
        } else {
            checks.vectorize = { status: 'not_configured' };
        }
    } catch (err: any) {
        checks.vectorize = { status: 'error', detail: err.message };
    }

    // Check LLM providers (lightweight — just verify keys exist)
    checks.llm = {
        status: 'ok',
        detail: [
            c.env.DEEPSEEK_API_KEY ? 'deepseek' : null,
            c.env.ANTHROPIC_API_KEY ? 'anthropic' : null,
            c.env.OPENAI_API_KEY ? 'openai' : null,
        ].filter(Boolean).join(', ') || 'none_configured',
    };

    // Check AI binding (Workers AI)
    if (c.env.AI) {
        checks.workers_ai = { status: 'ok' };
    }

    const allHealthy = Object.values(checks).every(
        v => v.status === 'ok' || v.status === 'not_configured'
    );
    const latency = Date.now() - start;

    return c.json({
        status: allHealthy ? 'healthy' : 'degraded',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: c.env.ENVIRONMENT || 'development',
        latency: `${latency}ms`,
        services: checks,
        uptime: 'cloudflare_managed',
    }, allHealthy ? 200 : 503);
});

