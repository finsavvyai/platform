/**
 * OpenClaw Skill Tracking — execution analytics for tool/skill usage
 */

/**
 * Record a skill (tool) execution for analytics.
 */
export async function trackSkillExecution(
    db: D1Database,
    execution: {
        userId: string; skillName: string; agentSlug?: string;
        provider?: string; inputLength?: number; outputLength?: number;
        durationMs?: number; status?: string; error?: string; source?: string;
    },
): Promise<string> {
    const id = crypto.randomUUID();

    await db.prepare(`
        INSERT INTO openclaw_skill_executions
        (id, user_id, skill_name, agent_slug, provider, input_length, output_length, duration_ms, status, error, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        id, execution.userId, execution.skillName,
        execution.agentSlug || null, execution.provider || 'deepseek',
        execution.inputLength || 0, execution.outputLength || 0,
        execution.durationMs || 0, execution.status || 'completed',
        execution.error || null, execution.source || 'api',
    ).run();

    return id;
}

/**
 * Get skill execution analytics for a user.
 */
export async function getSkillAnalytics(
    db: D1Database,
    userId: string,
    days = 30,
): Promise<{
    totalExecutions: number;
    bySkill: Record<string, number>;
    byAgent: Record<string, number>;
    byProvider: Record<string, number>;
    avgDurationMs: number;
    successRate: number;
}> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString();

    const total = await db.prepare(`
        SELECT COUNT(*) as count FROM openclaw_skill_executions
        WHERE user_id = ? AND created_at >= ?
    `).bind(userId, sinceStr).first<{ count: number }>();

    const bySkill = await db.prepare(`
        SELECT skill_name, COUNT(*) as count FROM openclaw_skill_executions
        WHERE user_id = ? AND created_at >= ? GROUP BY skill_name
    `).bind(userId, sinceStr).all();

    const byAgent = await db.prepare(`
        SELECT agent_slug, COUNT(*) as count FROM openclaw_skill_executions
        WHERE user_id = ? AND created_at >= ? AND agent_slug IS NOT NULL GROUP BY agent_slug
    `).bind(userId, sinceStr).all();

    const byProvider = await db.prepare(`
        SELECT provider, COUNT(*) as count FROM openclaw_skill_executions
        WHERE user_id = ? AND created_at >= ? GROUP BY provider
    `).bind(userId, sinceStr).all();

    const avgDuration = await db.prepare(`
        SELECT AVG(duration_ms) as avg_ms FROM openclaw_skill_executions
        WHERE user_id = ? AND created_at >= ? AND status = 'completed'
    `).bind(userId, sinceStr).first<{ avg_ms: number }>();

    const successCount = await db.prepare(`
        SELECT COUNT(*) as count FROM openclaw_skill_executions
        WHERE user_id = ? AND created_at >= ? AND status = 'completed'
    `).bind(userId, sinceStr).first<{ count: number }>();

    const totalCount = total?.count || 0;

    return {
        totalExecutions: totalCount,
        bySkill: Object.fromEntries((bySkill.results || []).map((r: any) => [r.skill_name, r.count])),
        byAgent: Object.fromEntries((byAgent.results || []).map((r: any) => [r.agent_slug, r.count])),
        byProvider: Object.fromEntries((byProvider.results || []).map((r: any) => [r.provider, r.count])),
        avgDurationMs: avgDuration?.avg_ms || 0,
        successRate: totalCount > 0 ? ((successCount?.count || 0) / totalCount) * 100 : 0,
    };
}
