/**
 * Telemetry Routes — internal analytics dashboard API
 *
 * GET  /telemetry/overview   → top-level metrics (DAU, executions, error rate)
 * GET  /telemetry/agents     → per-agent stats (popularity, avg duration, errors)
 * GET  /telemetry/providers  → per-provider/model stats
 */

import { Hono } from 'hono';
import { getOverviewMetrics, getAgentStats, getProviderStats, getVariantStats } from '../services/telemetry';

const telemetryRoutes = new Hono<{ Bindings: { DB: D1Database } }>();

// ─── Overview: DAU, WAU, total executions, error rate, top agents ────────────

telemetryRoutes.get('/overview', async (c) => {
    const since = c.req.query('since') || undefined;
    const metrics = await getOverviewMetrics(c.env.DB, since);

    return c.json({
        ok: true,
        data: metrics,
    });
});

// ─── Agent stats: popularity ranking with execution counts & error rates ─────

telemetryRoutes.get('/agents', async (c) => {
    const since = c.req.query('since') || undefined;
    const stats = await getAgentStats(c.env.DB, since);

    // Enrich top custom agents with their variant stats
    for (let i = 0; i < stats.length; i++) {
        const agent = stats[i];
        if (agent.agent.startsWith('custom-') || agent.agent) { // We can check all agents
            const variants = await getVariantStats(c.env.DB, agent.agent, since);
            if (variants && variants.length > 0) {
                stats[i].variants = variants;
            }
        }
    }

    return c.json({
        ok: true,
        data: stats,
        count: stats.length,
    });
});

// ─── Provider stats: model usage, token consumption ──────────────────────────

telemetryRoutes.get('/providers', async (c) => {
    const since = c.req.query('since') || undefined;
    const stats = await getProviderStats(c.env.DB, since);

    return c.json({
        ok: true,
        data: stats,
        count: stats.length,
    });
});

export { telemetryRoutes };
