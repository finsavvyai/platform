/**
 * Integration Management Routes
 *
 * Enterprise-grade API for managing the Qestro ↔ External platform integrations.
 * Provides:
 *   - /api/integrations/bus/status — Event bus health and metrics
 *   - /api/integrations/bus/events — Recent integration events
 *   - /api/integrations/bus/config — Runtime configuration management
 *   - /api/integrations/bus/security-alert — Manual security alert dispatch
 *   - /api/integrations/bus/test — Integration connectivity test
 */

import { Router, Request, Response } from 'express';
import { integrationEventBus } from '../services/IntegrationEventBus.js';
import { OpenClawBridgeService } from '../services/OpenClawBridgeService.js';
import { QestroAIBridgeService } from '../services/QestroAIBridgeService.js';

const router = Router();

// ─── Status & Health ───────────────────────────────────────────────

/**
 * GET /api/integrations/bus/status
 * Full status of the integration event bus, including metrics and bridge health
 */
router.get('/bus/status', async (_req: Request, res: Response) => {
    try {
        const metrics = integrationEventBus.getMetrics();
        const config = integrationEventBus.getConfig();
        const openClawBridge = OpenClawBridgeService.getInstance();
        const qestroAIBridge = QestroAIBridgeService.getInstance();

        const [openClawHealth, qestroAIHealth] = await Promise.allSettled([
            openClawBridge.healthCheck(),
            qestroAIBridge.healthCheck(),
        ]);

        res.json({
            success: true,
            data: {
                initialized: integrationEventBus.isInitialized(),
                metrics,
                config: {
                    enabled: config.enabled,
                    openClawEnabled: config.openClawEnabled,
                    qestroAIEnabled: config.qestroAIEnabled,
                    openHandsEnabled: config.qestroAIEnabled,
                    eventFilter: config.eventFilter,
                },
                bridges: {
                    openClaw: {
                        connected: openClawHealth.status === 'fulfilled' && openClawHealth.value,
                        details: openClawBridge.getStatus(),
                    },
                    qestroAI: {
                        connected: qestroAIHealth.status === 'fulfilled' && qestroAIHealth.value,
                    },
                },
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── Events ────────────────────────────────────────────────────────

/**
 * GET /api/integrations/bus/events
 * Recent integration events (last N events)
 */
router.get('/bus/events', (req: Request, res: Response) => {
    try {
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
        const events = integrationEventBus.getRecentEvents(limit);

        res.json({
            success: true,
            data: {
                events,
                count: events.length,
                limit,
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── Configuration ─────────────────────────────────────────────────

/**
 * PUT /api/integrations/bus/config
 * Update integration bus configuration at runtime
 */
router.put('/bus/config', (req: Request, res: Response) => {
    try {
        const allowed = [
            'enabled', 'openClawEnabled', 'qestroAIEnabled', 'openHandsEnabled',
            'throttleMs', 'silentMode', 'eventFilter',
        ];

        const updates: Record<string, any> = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                updates[key] = req.body[key];
            }
        }

        if (updates.openHandsEnabled !== undefined && updates.qestroAIEnabled === undefined) {
            updates.qestroAIEnabled = updates.openHandsEnabled;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                error: `No valid config keys. Allowed: ${allowed.join(', ')}`,
            });
        }

        integrationEventBus.updateConfig(updates);

        res.json({
            success: true,
            data: {
                updated: Object.keys(updates),
                config: integrationEventBus.getConfig(),
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── Manual Dispatch ───────────────────────────────────────────────

/**
 * POST /api/integrations/bus/security-alert
 * Dispatch a security alert through the integration bus
 */
router.post('/bus/security-alert', async (req: Request, res: Response) => {
    try {
        const { severity, category, description, affectedEndpoints, recommendation } = req.body;

        if (!severity || !description) {
            return res.status(400).json({
                success: false,
                error: 'severity and description are required',
            });
        }

        await integrationEventBus.dispatchSecurityAlert({
            severity,
            category: category || 'manual',
            description,
            affectedEndpoints,
            recommendation: recommendation || 'Review and investigate',
        });

        res.json({
            success: true,
            message: 'Security alert dispatched to all integration targets',
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── Connectivity Test ─────────────────────────────────────────────

/**
 * POST /api/integrations/bus/test
 * Test integration connectivity by sending a ping to all bridges
 */
router.post('/bus/test', async (_req: Request, res: Response) => {
    try {
        const results: Record<string, any> = {};
        const config = integrationEventBus.getConfig();

        if (config.openClawEnabled) {
            try {
                const bridge = OpenClawBridgeService.getInstance();
                const health = await bridge.healthCheck();
                results.openClaw = { connected: health, latency: 'ok' };
            } catch (err: any) {
                results.openClaw = { connected: false, error: err.message };
            }
        }

        if (config.qestroAIEnabled) {
            try {
                const bridge = QestroAIBridgeService.getInstance();
                const health = await bridge.healthCheck();
                results.qestroAI = { connected: health, latency: 'ok' };
            } catch (err: any) {
                results.qestroAI = { connected: false, error: err.message };
            }
        }

        res.json({
            success: true,
            data: {
                results,
                tested: Object.keys(results),
                allConnected: Object.values(results).every((r: any) => r.connected),
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
