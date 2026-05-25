/**
 * Telemetry Aggregation — queries for analytics dashboards
 */

import type { AgentStats, ProviderStats, VariantStats, OverviewMetrics } from './telemetry';

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function sevenDaysAgo(): string {
    return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

// ─── Aggregation Queries ─────────────────────────────────────────────────────

export async function getAgentStats(db: D1Database, since: string = sevenDaysAgo()): Promise<AgentStats[]> {
    const results = await db.prepare(`
        SELECT agent, COUNT(*) as total_executions, AVG(duration_ms) as avg_duration_ms,
            SUM(CASE WHEN event_type = 'execution_error' THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as error_rate,
            MAX(created_at) as last_used
        FROM analytics_events WHERE agent IS NOT NULL AND created_at >= ?
        GROUP BY agent ORDER BY total_executions DESC LIMIT 30
    `).bind(since).all<{ agent: string; total_executions: number; avg_duration_ms: number; error_rate: number; last_used: string }>();

    return (results.results || []).map(r => ({
        agent: r.agent,
        totalExecutions: r.total_executions,
        avgDurationMs: Math.round(r.avg_duration_ms || 0),
        errorRate: Math.round((r.error_rate || 0) * 10000) / 100,
        lastUsed: r.last_used,
    }));
}

export async function getVariantStats(db: D1Database, agentSlug: string, since: string = sevenDaysAgo()): Promise<VariantStats[]> {
    const results = await db.prepare(`
        SELECT json_extract(tags, '$.variant_id') as variant_id,
            COUNT(*) as total_executions, AVG(duration_ms) as avg_duration_ms,
            SUM(CASE WHEN event_type = 'execution_error' THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as error_rate
        FROM analytics_events
        WHERE agent = ? AND json_extract(tags, '$.variant_id') IS NOT NULL AND created_at >= ?
        GROUP BY variant_id ORDER BY total_executions DESC
    `).bind(agentSlug, since).all<{ variant_id: string; total_executions: number; avg_duration_ms: number; error_rate: number }>();

    return (results.results || []).map(r => ({
        variantId: r.variant_id,
        totalExecutions: r.total_executions,
        avgDurationMs: Math.round(r.avg_duration_ms || 0),
        errorRate: Math.round((r.error_rate || 0) * 10000) / 100,
    }));
}

export async function getProviderStats(db: D1Database, since: string = sevenDaysAgo()): Promise<ProviderStats[]> {
    const results = await db.prepare(`
        SELECT provider, model, COUNT(*) as total_calls, AVG(duration_ms) as avg_duration_ms,
            COALESCE(SUM(input_tokens), 0) as total_input_tokens,
            COALESCE(SUM(output_tokens), 0) as total_output_tokens
        FROM analytics_events WHERE provider IS NOT NULL AND created_at >= ?
        GROUP BY provider, model ORDER BY total_calls DESC LIMIT 20
    `).bind(since).all<{ provider: string; model: string; total_calls: number; avg_duration_ms: number; total_input_tokens: number; total_output_tokens: number }>();

    return (results.results || []).map(r => ({
        provider: r.provider, model: r.model || 'unknown',
        totalCalls: r.total_calls,
        avgDurationMs: Math.round(r.avg_duration_ms || 0),
        totalInputTokens: r.total_input_tokens,
        totalOutputTokens: r.total_output_tokens,
    }));
}

export async function getOverviewMetrics(db: D1Database, since: string = sevenDaysAgo()): Promise<OverviewMetrics> {
    const overall = await db.prepare(`
        SELECT COUNT(*) as total_executions, COUNT(DISTINCT user_hash) as unique_users,
            AVG(duration_ms) as avg_duration_ms,
            SUM(CASE WHEN event_type = 'execution_error' THEN 1 ELSE 0 END) * 1.0 / NULLIF(COUNT(*), 0) as error_rate
        FROM analytics_events WHERE created_at >= ?
    `).bind(since).first<{ total_executions: number; unique_users: number; avg_duration_ms: number; error_rate: number }>();

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const dau = await db.prepare(`
        SELECT COUNT(DISTINCT user_hash) as count FROM analytics_events
        WHERE user_hash IS NOT NULL AND created_at >= ?
    `).bind(dayAgo).first<{ count: number }>();

    const wau = await db.prepare(`
        SELECT COUNT(DISTINCT user_hash) as count FROM analytics_events
        WHERE user_hash IS NOT NULL AND created_at >= ?
    `).bind(since).first<{ count: number }>();

    const topAgents = await getAgentStats(db, since);
    const topProviders = await getProviderStats(db, since);

    return {
        totalExecutions: overall?.total_executions || 0,
        uniqueUsers: overall?.unique_users || 0,
        avgDurationMs: Math.round(overall?.avg_duration_ms || 0),
        errorRate: Math.round((overall?.error_rate || 0) * 10000) / 100,
        topAgents: topAgents.slice(0, 10),
        topProviders: topProviders.slice(0, 5),
        dailyActiveUsers: dau?.count || 0,
        weeklyActiveUsers: wau?.count || 0,
    };
}
