/**
 * Browser Recording API Routes — CDP-Based Test Recording via OpenClaw (P1)
 * 
 * Provides endpoints for managing browser recording sessions,
 * processing captured interactions, and generating Playwright tests.
 */

import { Router, Request, Response } from 'express';
import { BrowserRecordingBridgeService } from '../services/BrowserRecordingBridgeService.js';

const router = Router();

// ─── Session Management ───────────────────────────────────────────────

/**
 * POST /api/recordings/openclaw/start
 * Start a new browser recording session via OpenClaw
 */
router.post('/start', async (req: Request, res: Response) => {
    try {
        const service = BrowserRecordingBridgeService.getInstance();

        const { url, name, description, framework, notifyChannel, viewport } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'url is required',
            });
        }

        const result = await service.startRecording({
            url,
            name,
            description,
            framework,
            notifyChannel,
            viewport,
        });

        res.json({
            success: true,
            message: result.session.status === 'recording'
                ? `Recording session started: ${result.session.id}`
                : `Session created but OpenClaw is unavailable`,
            data: {
                session: result.session,
                gatewayResponse: {
                    success: result.hookResult.success,
                    status: result.hookResult.status,
                },
            },
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: 'Failed to start recording',
            details: error.message,
        });
    }
});

/**
 * POST /api/recordings/openclaw/:sessionId/stop
 * Stop an active recording session
 */
router.post('/:sessionId/stop', async (req: Request, res: Response) => {
    try {
        const service = BrowserRecordingBridgeService.getInstance();
        const { sessionId } = req.params;

        const result = await service.stopRecording(sessionId);

        res.json({
            success: true,
            message: `Recording session ${sessionId} stopped`,
            data: {
                session: result.session,
                gatewayResponse: {
                    success: result.hookResult.success,
                    status: result.hookResult.status,
                },
            },
        });
    } catch (error: any) {
        const status = error.message?.includes('not found') ? 404 : 400;
        res.status(status).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/recordings/openclaw/:sessionId/interactions
 * Submit captured interactions for processing & test generation
 * Called either by OpenClaw posting back, or manually with interaction data
 */
router.post('/:sessionId/interactions', async (req: Request, res: Response) => {
    try {
        const service = BrowserRecordingBridgeService.getInstance();
        const { sessionId } = req.params;
        const { interactions } = req.body;

        if (!interactions || !Array.isArray(interactions)) {
            return res.status(400).json({
                success: false,
                error: 'interactions (array) is required',
            });
        }

        const session = await service.processRecordingData(sessionId, interactions);

        res.json({
            success: true,
            message: session.status === 'completed'
                ? `Test generated from ${interactions.length} interactions`
                : `Processing failed: ${session.error}`,
            data: {
                session: {
                    id: session.id,
                    name: session.name,
                    status: session.status,
                    interactionsCount: session.interactions.length,
                    completedAt: session.completedAt,
                },
                generatedTest: session.generatedTest || null,
            },
        });
    } catch (error: any) {
        const status = error.message?.includes('not found') ? 404 : 500;
        res.status(status).json({
            success: false,
            error: error.message,
        });
    }
});

// ─── Session Queries ──────────────────────────────────────────────────

/**
 * GET /api/recordings/openclaw/sessions
 * List all recording sessions
 */
router.get('/sessions', (_req: Request, res: Response) => {
    try {
        const service = BrowserRecordingBridgeService.getInstance();
        const sessions = service.getAllSessions();
        const stats = service.getSessionStats();

        res.json({
            success: true,
            data: {
                sessions,
                stats,
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/recordings/openclaw/sessions/active
 * List only active recording sessions
 */
router.get('/sessions/active', (_req: Request, res: Response) => {
    try {
        const service = BrowserRecordingBridgeService.getInstance();
        const sessions = service.getActiveSessions();

        res.json({
            success: true,
            data: sessions,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/recordings/openclaw/:sessionId
 * Get details of a specific recording session
 */
router.get('/:sessionId', (req: Request, res: Response) => {
    try {
        const service = BrowserRecordingBridgeService.getInstance();
        const { sessionId } = req.params;
        const session = service.getSession(sessionId);

        if (!session) {
            return res.status(404).json({
                success: false,
                error: `Session '${sessionId}' not found`,
            });
        }

        res.json({
            success: true,
            data: session,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/recordings/openclaw/stats
 * Get recording session statistics
 */
router.get('/stats', (_req: Request, res: Response) => {
    try {
        const service = BrowserRecordingBridgeService.getInstance();
        const stats = service.getSessionStats();

        res.json({
            success: true,
            data: stats,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
