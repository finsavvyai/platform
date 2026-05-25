/**
 * AI Step Recorder Routes
 * 
 * API endpoints for the AI-powered step recording feature.
 * Users can define test steps in natural language and the AI
 * will execute and record them on a real website.
 */

import { Router } from 'express';
import { aiStepRecorderService, AIStepRecorderConfig } from '../services/AIStepRecorderService.js';

// Simple console logger to avoid blocking winston initialization
const logger = {
    info: (...args: any[]) => console.log('[AI-RECORDER INFO]', ...args),
    error: (...args: any[]) => console.error('[AI-RECORDER ERROR]', ...args),
    warn: (...args: any[]) => console.warn('[AI-RECORDER WARN]', ...args),
    debug: (...args: any[]) => console.debug('[AI-RECORDER DEBUG]', ...args),
};

const router = Router();

/**
 * POST /api/ai-recorder/sessions
 * Create a new recording session with natural language steps
 */
router.post('/sessions', async (req, res) => {
    try {
        const { url, steps, config } = req.body;

        // Validation
        if (!url || typeof url !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Missing or invalid required field: url',
            });
        }

        if (!steps || !Array.isArray(steps) || steps.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing or invalid required field: steps (must be a non-empty array of strings)',
            });
        }

        // Create session
        const session = await aiStepRecorderService.createSession(
            url,
            steps,
            config as AIStepRecorderConfig
        );

        res.status(201).json({
            success: true,
            data: {
                sessionId: session.id,
                url: session.url,
                stepCount: session.steps.length,
                steps: session.steps,
                status: session.status,
                createdAt: session.createdAt,
            },
            message: 'Session created. Use POST /api/ai-recorder/sessions/:id/start to begin recording.',
        });
    } catch (error: any) {
        logger.error('Failed to create AI recorder session', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create recording session',
        });
    }
});

/**
 * POST /api/ai-recorder/sessions/:id/start
 * Start recording and executing the defined steps
 */
router.post('/sessions/:id/start', async (req, res) => {
    try {
        const { id } = req.params;
        const { config } = req.body;

        const session = aiStepRecorderService.getSession(id);
        if (!session) {
            return res.status(404).json({
                success: false,
                error: `Session ${id} not found`,
            });
        }

        if (session.status !== 'pending') {
            return res.status(400).json({
                success: false,
                error: `Session is already ${session.status}`,
            });
        }

        // Start recording in background
        aiStepRecorderService.startRecording(id, config as AIStepRecorderConfig)
            .then(completedSession => {
                logger.info(`Recording session ${id} completed successfully`);
            })
            .catch(error => {
                logger.error(`Recording session ${id} failed`, error);
            });

        res.json({
            success: true,
            message: 'Recording started. Poll GET /api/ai-recorder/sessions/:id/status for updates.',
            data: {
                sessionId: id,
                status: 'recording',
            },
        });
    } catch (error: any) {
        logger.error('Failed to start AI recorder session', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to start recording',
        });
    }
});

/**
 * POST /api/ai-recorder/sessions/:id/start-sync
 * Start recording synchronously and wait for completion
 */
router.post('/sessions/:id/start-sync', async (req, res) => {
    try {
        const { id } = req.params;
        const { config } = req.body;

        const session = aiStepRecorderService.getSession(id);
        if (!session) {
            return res.status(404).json({
                success: false,
                error: `Session ${id} not found`,
            });
        }

        if (session.status !== 'pending') {
            return res.status(400).json({
                success: false,
                error: `Session is already ${session.status}`,
            });
        }

        // Start recording and wait for completion
        const completedSession = await aiStepRecorderService.startRecording(id, config as AIStepRecorderConfig);

        res.json({
            success: true,
            data: {
                sessionId: completedSession.id,
                status: completedSession.status,
                executedSteps: completedSession.executedSteps,
                generatedCode: completedSession.generatedCode,
                screenshotCount: completedSession.screenshots.length,
                errors: completedSession.errors,
                duration: new Date().getTime() - completedSession.createdAt.getTime(),
            },
        });
    } catch (error: any) {
        logger.error('Failed to complete AI recorder session', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Recording failed',
        });
    }
});

/**
 * GET /api/ai-recorder/sessions/:id
 * Get session details including status, executed steps, and generated code
 */
router.get('/sessions/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const session = aiStepRecorderService.getSession(id);
        if (!session) {
            return res.status(404).json({
                success: false,
                error: `Session ${id} not found`,
            });
        }

        res.json({
            success: true,
            data: {
                id: session.id,
                url: session.url,
                status: session.status,
                steps: session.steps,
                executedSteps: session.executedSteps,
                generatedCode: session.generatedCode,
                screenshotCount: session.screenshots.length,
                errors: session.errors,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
            },
        });
    } catch (error: any) {
        logger.error('Failed to get AI recorder session', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get session',
        });
    }
});

/**
 * GET /api/ai-recorder/sessions/:id/status
 * Get lightweight status update for polling
 */
router.get('/sessions/:id/status', async (req, res) => {
    try {
        const { id } = req.params;

        const session = aiStepRecorderService.getSession(id);
        if (!session) {
            return res.status(404).json({
                success: false,
                error: `Session ${id} not found`,
            });
        }

        const completedSteps = session.executedSteps.filter(s => s.status === 'success').length;
        const failedSteps = session.executedSteps.filter(s => s.status === 'failed').length;

        res.json({
            success: true,
            data: {
                sessionId: session.id,
                status: session.status,
                totalSteps: session.steps.length,
                completedSteps,
                failedSteps,
                progress: Math.round((session.executedSteps.length / session.steps.length) * 100),
                currentStep: session.executedSteps.length + 1,
                hasErrors: session.errors.length > 0,
                updatedAt: session.updatedAt,
            },
        });
    } catch (error: any) {
        logger.error('Failed to get AI recorder status', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get status',
        });
    }
});

/**
 * GET /api/ai-recorder/sessions/:id/code
 * Get the generated Playwright test code
 */
router.get('/sessions/:id/code', async (req, res) => {
    try {
        const { id } = req.params;

        const session = aiStepRecorderService.getSession(id);
        if (!session) {
            return res.status(404).json({
                success: false,
                error: `Session ${id} not found`,
            });
        }

        if (!session.generatedCode) {
            return res.status(400).json({
                success: false,
                error: 'No code generated yet. Recording may still be in progress.',
            });
        }

        res.json({
            success: true,
            data: {
                sessionId: session.id,
                code: session.generatedCode,
                language: 'typescript',
                framework: 'playwright',
            },
        });
    } catch (error: any) {
        logger.error('Failed to get generated code', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get code',
        });
    }
});

/**
 * GET /api/ai-recorder/sessions/:id/screenshots
 * Get all screenshots from the recording
 */
router.get('/sessions/:id/screenshots', async (req, res) => {
    try {
        const { id } = req.params;

        const session = aiStepRecorderService.getSession(id);
        if (!session) {
            return res.status(404).json({
                success: false,
                error: `Session ${id} not found`,
            });
        }

        // Return screenshot metadata (not full base64 to keep response small)
        const screenshots = session.screenshots.map(s => ({
            stepId: s.stepId,
            filename: s.filename,
            timestamp: s.timestamp,
        }));

        res.json({
            success: true,
            data: {
                sessionId: session.id,
                count: screenshots.length,
                screenshots,
            },
        });
    } catch (error: any) {
        logger.error('Failed to get screenshots', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get screenshots',
        });
    }
});

/**
 * GET /api/ai-recorder/sessions/:id/screenshots/:stepId
 * Get a specific screenshot by step ID
 */
router.get('/sessions/:id/screenshots/:stepId', async (req, res) => {
    try {
        const { id, stepId } = req.params;

        const session = aiStepRecorderService.getSession(id);
        if (!session) {
            return res.status(404).json({
                success: false,
                error: `Session ${id} not found`,
            });
        }

        const screenshot = session.screenshots.find(s => s.stepId === stepId);
        if (!screenshot) {
            return res.status(404).json({
                success: false,
                error: `Screenshot for step ${stepId} not found`,
            });
        }

        // Return as base64 data URL
        res.json({
            success: true,
            data: {
                stepId: screenshot.stepId,
                timestamp: screenshot.timestamp,
                image: `data:image/png;base64,${screenshot.base64}`,
            },
        });
    } catch (error: any) {
        logger.error('Failed to get screenshot', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get screenshot',
        });
    }
});

/**
 * DELETE /api/ai-recorder/sessions/:id
 * Cancel and delete a recording session
 */
router.delete('/sessions/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const session = aiStepRecorderService.getSession(id);
        if (!session) {
            return res.status(404).json({
                success: false,
                error: `Session ${id} not found`,
            });
        }

        if (session.status === 'recording') {
            await aiStepRecorderService.cancelSession(id);
        }

        aiStepRecorderService.deleteSession(id);

        res.json({
            success: true,
            message: `Session ${id} deleted`,
        });
    } catch (error: any) {
        logger.error('Failed to delete session', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete session',
        });
    }
});

/**
 * GET /api/ai-recorder/sessions
 * List all recording sessions
 */
router.get('/sessions', async (req, res) => {
    try {
        const sessions = aiStepRecorderService.getAllSessions();

        res.json({
            success: true,
            data: {
                count: sessions.length,
                sessions: sessions.map(s => ({
                    id: s.id,
                    url: s.url,
                    status: s.status,
                    stepCount: s.steps.length,
                    completedSteps: s.executedSteps.filter(es => es.status === 'success').length,
                    createdAt: s.createdAt,
                    updatedAt: s.updatedAt,
                })),
            },
        });
    } catch (error: any) {
        logger.error('Failed to list sessions', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to list sessions',
        });
    }
});

/**
 * POST /api/ai-recorder/quick-record
 * Quick endpoint to create and start a recording in one call
 */
router.post('/quick-record', async (req, res) => {
    try {
        const { url, steps, config } = req.body;

        // Validation
        if (!url || typeof url !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Missing or invalid required field: url',
            });
        }

        if (!steps || !Array.isArray(steps) || steps.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing or invalid required field: steps',
            });
        }

        // Create session
        const session = await aiStepRecorderService.createSession(
            url,
            steps,
            config as AIStepRecorderConfig
        );

        // Start recording and wait for completion
        const completedSession = await aiStepRecorderService.startRecording(
            session.id,
            config as AIStepRecorderConfig
        );

        res.json({
            success: true,
            data: {
                sessionId: completedSession.id,
                url: completedSession.url,
                status: completedSession.status,
                executedSteps: completedSession.executedSteps.map(s => ({
                    description: s.description,
                    action: s.action,
                    selector: s.selector,
                    status: s.status,
                    duration: s.duration,
                    error: s.error,
                })),
                generatedCode: completedSession.generatedCode,
                screenshotCount: completedSession.screenshots.length,
                errors: completedSession.errors,
                totalDuration: new Date().getTime() - completedSession.createdAt.getTime(),
            },
        });
    } catch (error: any) {
        logger.error('Quick record failed', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Quick record failed',
        });
    }
});

export default router;
