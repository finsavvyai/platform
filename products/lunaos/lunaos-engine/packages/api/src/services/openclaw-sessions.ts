/**
 * OpenClaw Sessions — session lifecycle management and persistence
 */

import type { SessionInfo } from './openclaw-types';

/**
 * Record a new OpenClaw session.
 */
export async function createSession(
    db: D1Database,
    session: {
        id: string; userId: string; gatewayId: string; sessionKey: string;
        runId: string; agent: string; agentName: string;
        model?: string; taskSummary?: string;
    },
): Promise<void> {
    await db.prepare(`
        INSERT INTO openclaw_sessions (id, user_id, gateway_id, session_key, run_id, agent, agent_name, model, task_summary, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'spawned')
    `).bind(
        session.id, session.userId, session.gatewayId, session.sessionKey,
        session.runId, session.agent, session.agentName,
        session.model || null, session.taskSummary || null,
    ).run();
}

/**
 * Update session status and results.
 */
export async function updateSession(
    db: D1Database,
    sessionId: string,
    update: { status: string; messageCount?: number; durationMs?: number; resultSummary?: string },
): Promise<void> {
    await db.prepare(`
        UPDATE openclaw_sessions
        SET status = ?,
            message_count = COALESCE(?, message_count),
            duration_ms = COALESCE(?, duration_ms),
            result_summary = COALESCE(?, result_summary),
            completed_at = CASE WHEN ? IN ('completed', 'failed', 'timeout') THEN datetime('now') ELSE completed_at END
        WHERE id = ?
    `).bind(
        update.status, update.messageCount ?? null,
        update.durationMs ?? null, update.resultSummary ?? null,
        update.status, sessionId,
    ).run();
}

/**
 * List sessions for a user.
 */
export async function listSessions(
    db: D1Database,
    userId: string,
    options: { limit?: number; offset?: number; gatewayId?: string } = {},
): Promise<SessionInfo[]> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    let query = `
        SELECT id, gateway_id, session_key, run_id, agent, agent_name, status,
               message_count, duration_ms, created_at, completed_at
        FROM openclaw_sessions WHERE user_id = ?
    `;
    const bindings: any[] = [userId];

    if (options.gatewayId) {
        query += ` AND gateway_id = ?`;
        bindings.push(options.gatewayId);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    bindings.push(limit, offset);

    const result = await db.prepare(query).bind(...bindings).all();

    return (result.results || []).map((row: any) => ({
        id: row.id, gatewayId: row.gateway_id, sessionKey: row.session_key,
        runId: row.run_id, agent: row.agent, agentName: row.agent_name,
        status: row.status, messageCount: row.message_count,
        durationMs: row.duration_ms, createdAt: row.created_at,
        completedAt: row.completed_at,
    }));
}
