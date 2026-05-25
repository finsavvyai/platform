/**
 * Analytics Routes — /analytics/*
 *
 * Usage tracking, skill metrics, session history, and gateway health.
 */

import { Hono } from 'hono';
import type { AppEnv, ServiceEnv } from '../types';
import { requireAuth } from '../middleware/auth';

export const analyticsRoutes = new Hono<AppEnv>();

// ─── Overview ───────────────────────────────────────────────────────────────

analyticsRoutes.get('/overview', requireAuth, async (c) => {
    const userId = c.get('userId') as string;
    const days = parseInt(c.req.query('days') || '30');
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString();

    const [gateways, sessions, totalExecs, successExecs, avgDuration] = await Promise.all([
        c.env.DB.prepare(`
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                   SUM(CASE WHEN health_status = 'healthy' THEN 1 ELSE 0 END) as healthy
            FROM openclaw_gateways WHERE user_id = ? AND status != 'deleted'
        `).bind(userId).first<{ total: number; active: number; healthy: number }>(),

        c.env.DB.prepare(`
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN status = 'spawned' THEN 1 ELSE 0 END) as active,
                   AVG(duration_ms) as avg_ms
            FROM openclaw_sessions WHERE user_id = ? AND created_at >= ?
        `).bind(userId, sinceStr).first<{ total: number; active: number; avg_ms: number }>(),

        c.env.DB.prepare(`
            SELECT COUNT(*) as count FROM openclaw_skill_executions
            WHERE user_id = ? AND created_at >= ?
        `).bind(userId, sinceStr).first<{ count: number }>(),

        c.env.DB.prepare(`
            SELECT COUNT(*) as count FROM openclaw_skill_executions
            WHERE user_id = ? AND created_at >= ? AND status = 'completed'
        `).bind(userId, sinceStr).first<{ count: number }>(),

        c.env.DB.prepare(`
            SELECT AVG(duration_ms) as avg_ms FROM openclaw_skill_executions
            WHERE user_id = ? AND created_at >= ? AND status = 'completed'
        `).bind(userId, sinceStr).first<{ avg_ms: number }>(),
    ]);

    const total = totalExecs?.count || 0;
    const success = successExecs?.count || 0;

    return c.json({
        period: `${days}d`,
        gateways: {
            total: gateways?.total || 0,
            active: gateways?.active || 0,
            healthy: gateways?.healthy || 0,
        },
        sessions: {
            total: sessions?.total || 0,
            active: sessions?.active || 0,
            avgDurationMs: Math.round(sessions?.avg_ms || 0),
        },
        skills: {
            totalExecutions: total,
            avgDurationMs: Math.round(avgDuration?.avg_ms || 0),
            successRate: total > 0 ? Math.round((success / total) * 100) : 0,
        },
    });
});

// ─── Gateway List ───────────────────────────────────────────────────────────

analyticsRoutes.get('/gateways', requireAuth, async (c) => {
    const userId = c.get('userId') as string;

    const result = await c.env.DB.prepare(`
        SELECT id, gateway_url, label, status, health_status, last_connected_at, created_at
        FROM openclaw_gateways
        WHERE user_id = ? AND status != 'deleted'
        ORDER BY created_at DESC
    `).bind(userId).all();

    const gateways = (result.results || []).map((r: any) => ({
        id: r.id,
        gatewayUrl: r.gateway_url,
        label: r.label,
        status: r.status,
        healthStatus: r.health_status,
        lastConnectedAt: r.last_connected_at,
        createdAt: r.created_at,
    }));

    return c.json({ gateways, total: gateways.length });
});

// ─── Sessions ───────────────────────────────────────────────────────────────

analyticsRoutes.get('/sessions', requireAuth, async (c) => {
    const userId = c.get('userId') as string;
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');

    const result = await c.env.DB.prepare(`
        SELECT id, gateway_id, session_key, run_id, agent, agent_name,
               status, message_count, duration_ms, created_at, completed_at
        FROM openclaw_sessions
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all();

    const sessions = (result.results || []).map((r: any) => ({
        id: r.id,
        gatewayId: r.gateway_id,
        agent: r.agent,
        agentName: r.agent_name,
        status: r.status,
        messageCount: r.message_count,
        durationMs: r.duration_ms,
        createdAt: r.created_at,
        completedAt: r.completed_at,
    }));

    return c.json({ sessions, count: sessions.length, limit, offset });
});

// ─── Skills Breakdown ───────────────────────────────────────────────────────

analyticsRoutes.get('/skills', requireAuth, async (c) => {
    const userId = c.get('userId') as string;
    const days = parseInt(c.req.query('days') || '30');
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString();

    const [bySkill, byAgent, byProvider, bySource] = await Promise.all([
        c.env.DB.prepare(`
            SELECT skill_name, COUNT(*) as count, AVG(duration_ms) as avg_ms
            FROM openclaw_skill_executions
            WHERE user_id = ? AND created_at >= ?
            GROUP BY skill_name ORDER BY count DESC
        `).bind(userId, sinceStr).all(),

        c.env.DB.prepare(`
            SELECT agent_slug, COUNT(*) as count
            FROM openclaw_skill_executions
            WHERE user_id = ? AND created_at >= ? AND agent_slug IS NOT NULL
            GROUP BY agent_slug ORDER BY count DESC LIMIT 10
        `).bind(userId, sinceStr).all(),

        c.env.DB.prepare(`
            SELECT provider, COUNT(*) as count
            FROM openclaw_skill_executions
            WHERE user_id = ? AND created_at >= ?
            GROUP BY provider ORDER BY count DESC
        `).bind(userId, sinceStr).all(),

        c.env.DB.prepare(`
            SELECT source, COUNT(*) as count
            FROM openclaw_skill_executions
            WHERE user_id = ? AND created_at >= ?
            GROUP BY source ORDER BY count DESC
        `).bind(userId, sinceStr).all(),
    ]);

    return c.json({
        period: `${days}d`,
        bySkill: (bySkill.results || []).map((r: any) => ({
            skill: r.skill_name,
            count: r.count,
            avgDurationMs: Math.round(r.avg_ms || 0),
        })),
        byAgent: (byAgent.results || []).map((r: any) => ({
            agent: r.agent_slug,
            count: r.count,
        })),
        byProvider: (byProvider.results || []).map((r: any) => ({
            provider: r.provider,
            count: r.count,
        })),
        bySource: (bySource.results || []).map((r: any) => ({
            source: r.source,
            count: r.count,
        })),
    });
});
