/**
 * Notification Router API Routes — Multi-Channel QA Notification Management (P1)
 * 
 * Provides endpoints for managing notification routing rules, recipients,
 * testing notifications, and viewing notification history.
 */

import { Router, Request, Response } from 'express';
import { NotificationRouterService } from '../services/NotificationRouterService.js';

const router = Router();

// ─── Status & Health ──────────────────────────────────────────────────

/**
 * GET /api/notifications/status
 * Get notification router status
 */
router.get('/status', (_req: Request, res: Response) => {
    try {
        const routerService = NotificationRouterService.getInstance();
        const status = routerService.getStatus();

        res.json({
            success: true,
            message: 'Notification router operational',
            data: status,
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: 'Failed to get notification status',
            details: error.message,
        });
    }
});

// ─── Rules Management ─────────────────────────────────────────────────

/**
 * GET /api/notifications/rules
 * List all notification routing rules
 */
router.get('/rules', (_req: Request, res: Response) => {
    try {
        const routerService = NotificationRouterService.getInstance();
        const rules = routerService.getRules();

        res.json({
            success: true,
            data: {
                rules,
                total: rules.length,
                enabled: rules.filter((r) => r.enabled).length,
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/notifications/rules
 * Create or update a notification rule
 */
router.post('/rules', (req: Request, res: Response) => {
    try {
        const routerService = NotificationRouterService.getInstance();
        const rule = req.body;

        if (!rule.id || !rule.eventType || !rule.channels || !rule.recipients) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: id, eventType, channels, recipients',
            });
        }

        routerService.addRule({
            enabled: true,
            severity: ['critical', 'high', 'medium', 'low', 'info'],
            ...rule,
        });

        res.json({
            success: true,
            message: `Rule '${rule.id}' saved`,
            data: rule,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/notifications/rules/:ruleId/toggle
 * Enable or disable a notification rule
 */
router.put('/rules/:ruleId/toggle', (req: Request, res: Response) => {
    try {
        const routerService = NotificationRouterService.getInstance();
        const { ruleId } = req.params;
        const { enabled } = req.body;

        if (typeof enabled !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'enabled (boolean) is required',
            });
        }

        const toggled = routerService.toggleRule(ruleId, enabled);
        if (!toggled) {
            return res.status(404).json({
                success: false,
                error: `Rule '${ruleId}' not found`,
            });
        }

        res.json({
            success: true,
            message: `Rule '${ruleId}' ${enabled ? 'enabled' : 'disabled'}`,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/notifications/rules/:ruleId
 * Delete a notification rule
 */
router.delete('/rules/:ruleId', (req: Request, res: Response) => {
    try {
        const routerService = NotificationRouterService.getInstance();
        const { ruleId } = req.params;

        const removed = routerService.removeRule(ruleId);
        if (!removed) {
            return res.status(404).json({
                success: false,
                error: `Rule '${ruleId}' not found`,
            });
        }

        res.json({
            success: true,
            message: `Rule '${ruleId}' deleted`,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── Recipients ───────────────────────────────────────────────────────

/**
 * GET /api/notifications/recipients
 * List all notification recipients
 */
router.get('/recipients', (_req: Request, res: Response) => {
    try {
        const routerService = NotificationRouterService.getInstance();
        const recipients = routerService.getRecipients();

        res.json({
            success: true,
            data: recipients,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/notifications/recipients
 * Add or update a notification recipient
 */
router.post('/recipients', (req: Request, res: Response) => {
    try {
        const routerService = NotificationRouterService.getInstance();
        const recipient = req.body;

        if (!recipient.id || !recipient.name || !recipient.role || !recipient.channels) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: id, name, role, channels',
            });
        }

        routerService.addRecipient(recipient);

        res.json({
            success: true,
            message: `Recipient '${recipient.name}' saved`,
            data: recipient,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/notifications/recipients/:recipientId
 * Remove a notification recipient
 */
router.delete('/recipients/:recipientId', (req: Request, res: Response) => {
    try {
        const routerService = NotificationRouterService.getInstance();
        const { recipientId } = req.params;

        const removed = routerService.removeRecipient(recipientId);
        if (!removed) {
            return res.status(404).json({
                success: false,
                error: `Recipient '${recipientId}' not found`,
            });
        }

        res.json({
            success: true,
            message: `Recipient '${recipientId}' deleted`,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── Dispatch Test ────────────────────────────────────────────────────

/**
 * POST /api/notifications/test
 * Fire a test notification to verify routing
 */
router.post('/test', async (req: Request, res: Response) => {
    try {
        const routerService = NotificationRouterService.getInstance();
        const { eventType, severity, message } = req.body;

        const result = await routerService.dispatch({
            type: eventType || 'test_failure',
            severity: severity || 'info',
            title: '🧪 Test Notification',
            message: message || 'This is a test notification from Qestro Notification Router.',
            metadata: { isTest: true },
        });

        res.json({
            success: true,
            message: 'Test notification dispatched',
            data: result,
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: 'Failed to dispatch test notification',
            details: error.message,
        });
    }
});

/**
 * POST /api/notifications/dispatch
 * Dispatch a real notification event (for programmatic use)
 */
router.post('/dispatch', async (req: Request, res: Response) => {
    try {
        const routerService = NotificationRouterService.getInstance();
        const event = req.body;

        if (!event.type || !event.severity || !event.title || !event.message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: type, severity, title, message',
            });
        }

        const result = await routerService.dispatch(event);

        res.json({
            success: true,
            data: result,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
