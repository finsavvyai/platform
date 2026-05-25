/**
 * Dashboard Stats Routes
 * Provides aggregated statistics for the dashboard (mock-compatible)
 */

import { Router, Request, Response } from 'express';
import { testCaseStore } from './test-cases.mock.routes.js';
import { projectStore } from './projects.mock.routes.js';

const router = Router();

const formatResponse = (data: unknown, message?: string) => ({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
});

// GET /api/dashboard/stats - Get dashboard statistics from in-memory stores
router.get('/stats', (req: Request, res: Response) => {
    const activeCases = testCaseStore.filter((tc) => tc.isActive);
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const tc of activeCases) {
        byType[tc.type] = (byType[tc.type] || 0) + 1;
        byStatus[tc.status] = (byStatus[tc.status] || 0) + 1;
    }

    const liveFeed = activeCases.slice(-5).reverse().map((tc, i) => ({
        id: tc.id,
        title: tc.name,
        type: tc.type,
        timestamp: tc.createdAt,
        relativeTime: `${i + 1}m ago`,
        message: `Test case "${tc.name}" created`
    }));

    res.json(formatResponse({
        testCases: {
            total: activeCases.length,
            active: byStatus['Active'] || 0,
            byType,
            byStatus,
        },
        devices: { total: 1, available: 1, busy: 0 },
        projects: { total: projectStore.length },
        execution: {
            coverage: activeCases.length > 0 ? 89 : 0,
            statusBreakdown: { passed: 75, failed: 15, pending: 10 }
        },
        security: {
            score: 98, grade: 'A+', criticalIssues: 0,
            posture: { auth: 120, data: 98, infra: 86, api: 99, client: 85, gdpr: 65 }
        },
        aiStats: { selfHealed: 0, generated: activeCases.length, optimizedTimeMs: 3500 },
        liveFeed
    }));
});

// GET /api/dashboard/health - System health check
router.get('/health', async (req: Request, res: Response) => {
    try {
        // Basic health checks
        const healthStatus = {
            status: 'OPTIMAL',
            services: {
                database: 'online',
                api: 'online',
                websocket: 'online'
            },
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        };

        res.json(formatResponse(healthStatus));
    } catch (error) {
        res.json(formatResponse({
            status: 'DEGRADED',
            services: {
                database: 'unknown',
                api: 'online',
                websocket: 'unknown'
            },
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        }));
    }
});

export default router;
