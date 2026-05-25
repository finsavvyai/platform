/**
 * OpenClaw Analytics Routes — /openclaw/analytics/*
 *
 * Dashboard and analytics endpoints for monitoring OpenClaw usage,
 * gateway health, session history, and skill execution metrics.
 *
 * Endpoints:
 *   GET  /openclaw/analytics/overview    — aggregated usage stats
 *   GET  /openclaw/analytics/gateways    — list registered gateways
 *   GET  /openclaw/analytics/sessions    — session history
 *   GET  /openclaw/analytics/skills      — skill execution breakdown
 */

import { Hono } from 'hono';
import type { Env } from '../worker';
import { requireAuthOrApiKey } from '../middleware/api-key-auth';
import {
    listGateways,
    listSessions,
    getSkillAnalytics,
} from '../services/openclaw-service';

export const openclawAnalyticsRoutes = new Hono<{ Bindings: Env }>();

// ─── GET /openclaw/analytics/overview — High-level usage dashboard ───────────

openclawAnalyticsRoutes.get('/overview', requireAuthOrApiKey, async (c) => {
    const userId = c.get('userId');
    const days = parseInt(c.req.query('days') || '30');

    try {
        const [gateways, sessions, skills] = await Promise.all([
            listGateways(c.env.DB, userId),
            listSessions(c.env.DB, userId, { limit: 5 }),
            getSkillAnalytics(c.env.DB, userId, days),
        ]);

        return c.json({
            period: `${days}d`,
            gateways: {
                total: gateways.length,
                active: gateways.filter(g => g.status === 'active').length,
                healthy: gateways.filter(g => g.healthStatus === 'healthy').length,
            },
            sessions: {
                recent: sessions.slice(0, 5).map(s => ({
                    agent: s.agent,
                    agentName: s.agentName,
                    status: s.status,
                    durationMs: s.durationMs,
                    createdAt: s.createdAt,
                })),
            },
            skills: {
                totalExecutions: skills.totalExecutions,
                topSkills: Object.entries(skills.bySkill)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([name, count]) => ({ name, count })),
                topAgents: Object.entries(skills.byAgent)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([slug, count]) => ({ slug, count })),
                avgDurationMs: Math.round(skills.avgDurationMs),
                successRate: Number(skills.successRate.toFixed(1)),
            },
        });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

// ─── GET /openclaw/analytics/gateways — List all registered gateways ─────────

openclawAnalyticsRoutes.get('/gateways', requireAuthOrApiKey, async (c) => {
    const userId = c.get('userId');

    try {
        const gateways = await listGateways(c.env.DB, userId);

        return c.json({
            gateways: gateways.map(g => ({
                id: g.id,
                label: g.label,
                gatewayUrl: g.gatewayUrl,
                status: g.status,
                healthStatus: g.healthStatus,
                lastConnectedAt: g.lastConnectedAt,
                capabilities: g.capabilities,
            })),
            total: gateways.length,
        });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

// ─── GET /openclaw/analytics/sessions — Session history ──────────────────────

openclawAnalyticsRoutes.get('/sessions', requireAuthOrApiKey, async (c) => {
    const userId = c.get('userId');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');
    const gatewayId = c.req.query('gatewayId');

    try {
        const sessions = await listSessions(c.env.DB, userId, {
            limit,
            offset,
            gatewayId,
        });

        return c.json({
            sessions,
            count: sessions.length,
            limit,
            offset,
        });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

// ─── GET /openclaw/analytics/skills — Skill execution breakdown ──────────────

openclawAnalyticsRoutes.get('/skills', requireAuthOrApiKey, async (c) => {
    const userId = c.get('userId');
    const days = parseInt(c.req.query('days') || '30');

    try {
        const analytics = await getSkillAnalytics(c.env.DB, userId, days);

        return c.json({
            period: `${days}d`,
            ...analytics,
        });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});
