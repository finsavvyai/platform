/**
 * Telemetry Service — anonymous usage analytics for product decisions
 *
 * Tracks:
 *   - Agent execution counts and durations
 *   - Provider/model popularity
 *   - Error rates by agent
 *   - User engagement (daily/weekly active)
 *
 * All data is aggregated — no PII stored in analytics tables.
 */

// Re-export aggregation queries for backward compatibility
export {
    getAgentStats,
    getVariantStats,
    getProviderStats,
    getOverviewMetrics,
} from './telemetry-aggregation';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TelemetryEvent {
    eventType: 'execution_start' | 'execution_complete' | 'execution_error' | 'signup' | 'api_key_created';
    agent?: string;
    provider?: string;
    model?: string;
    durationMs?: number;
    inputTokens?: number;
    outputTokens?: number;
    errorType?: string;
    userId?: string;
    tier?: string;
    source?: 'cli' | 'api' | 'dashboard' | 'github-action';
}

export interface AgentStats {
    agent: string;
    totalExecutions: number;
    avgDurationMs: number;
    errorRate: number;
    lastUsed: string;
    variants?: VariantStats[];
}

export interface ProviderStats {
    provider: string;
    model: string;
    totalCalls: number;
    avgDurationMs: number;
    totalInputTokens: number;
    totalOutputTokens: number;
}

export interface VariantStats {
    variantId: string;
    totalExecutions: number;
    avgDurationMs: number;
    errorRate: number;
    winRate?: number;
}

export interface OverviewMetrics {
    totalExecutions: number;
    uniqueUsers: number;
    avgDurationMs: number;
    errorRate: number;
    topAgents: AgentStats[];
    topProviders: ProviderStats[];
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
}

// ─── Event Recording ─────────────────────────────────────────────────────────

/**
 * Record a telemetry event to D1 analytics table.
 * Non-blocking — failures are silently ignored.
 */
export async function recordEvent(db: D1Database, event: TelemetryEvent): Promise<void> {
    try {
        const hashedUser = event.userId ? await hashForAnalytics(event.userId) : null;

        await db.prepare(`
            INSERT INTO analytics_events (
                event_type, agent, provider, model,
                duration_ms, input_tokens, output_tokens,
                error_type, user_hash, tier, source, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            event.eventType, event.agent || null, event.provider || null,
            event.model || null, event.durationMs || null,
            event.inputTokens || null, event.outputTokens || null,
            event.errorType || null, hashedUser,
            event.tier || null, event.source || null,
            new Date().toISOString(),
        ).run();
    } catch {
        // Telemetry is best-effort — never block the request
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function hashForAnalytics(value: string): Promise<string> {
    const data = new TextEncoder().encode(value + '_luna_analytics_salt_v1');
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash).slice(0, 8))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
