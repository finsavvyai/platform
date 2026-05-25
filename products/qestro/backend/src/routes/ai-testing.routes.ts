/**
 * AI Testing Routes - AI-powered test generation, execution, and healing
 */

import { Router } from 'express';
import { QestroAIService } from '../services/QestroAIService.js';
import { PlaywrightExecutorService } from '../services/PlaywrightExecutorService.js';

const router = Router();
const aiService = QestroAIService.getInstance();
const executor = PlaywrightExecutorService.getInstance();

/**
 * POST /api/ai/generate-test
 * Generate a test using AI
 */
router.post('/generate-test', async (req, res) => {
    try {
        const { scenario, platform, userStory } = req.body;

        if (!scenario || !platform) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: scenario, platform'
            });
        }

        const result = await aiService.generateTest({
            scenario,
            platform,
            userStory
        });

        res.json({
            success: true,
            ...result
        });
    } catch (error: any) {
        console.error('[AI Routes] Generate test error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate test'
        });
    }
});

/**
 * POST /api/ai/heal-test
 * Self-heal a failed test
 */
router.post('/heal-test', async (req, res) => {
    try {
        const { testCode, errorLog, stackTrace } = req.body;

        if (!testCode || !errorLog) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: testCode, errorLog'
            });
        }

        const result = await aiService.healTest({
            testCode,
            errorLog,
            stackTrace: stackTrace || ''
        });

        res.json({
            success: true,
            ...result
        });
    } catch (error: any) {
        console.error('[AI Routes] Heal test error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to heal test'
        });
    }
});

/**
 * POST /api/ai/analyze-failure
 * Analyze why a test failed
 */
router.post('/analyze-failure', async (req, res) => {
    try {
        const { testName, error, stackTrace, testCode, screenshots } = req.body;

        if (!testName || !error || !testCode) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: testName, error, testCode'
            });
        }

        const result = await aiService.analyzeFailure({
            testName,
            error,
            stackTrace: stackTrace || '',
            testCode,
            screenshots: screenshots || []
        });

        res.json({
            success: true,
            ...result
        });
    } catch (error: any) {
        console.error('[AI Routes] Analyze failure error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to analyze failure'
        });
    }
});

/**
 * POST /api/tests/execute
 * Execute a test with Playwright
 */
router.post('/execute', async (req, res) => {
    try {
        const { testId, testCode, browser, headless, timeout, baseUrl, viewport } = req.body;

        if (!testId || !testCode) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: testId, testCode'
            });
        }

        // Execute test asynchronously and return immediately
        executor.executeTest({
            testId,
            testCode,
            browser: browser || 'chromium',
            headless: headless !== false,
            timeout: timeout || 30000,
            baseUrl,
            viewport
        }).then(result => {
            console.log(`[AI Routes] Test ${testId} completed:`, result.status);
        }).catch(error => {
            console.error(`[AI Routes] Test ${testId} execution error:`, error);
        });

        res.json({
            success: true,
            message: 'Test execution started',
            testId
        });
    } catch (error: any) {
        console.error('[AI Routes] Execute test error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to execute test'
        });
    }
});

/**
 * POST /api/tests/execute-sync
 * Execute a test synchronously and wait for results
 */
router.post('/execute-sync', async (req, res) => {
    try {
        const { testId, testCode, browser, headless, timeout, baseUrl, viewport } = req.body;

        if (!testId || !testCode) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: testId, testCode'
            });
        }

        const result = await executor.executeTest({
            testId,
            testCode,
            browser: browser || 'chromium',
            headless: headless !== false,
            timeout: timeout || 30000,
            baseUrl,
            viewport
        });

        res.json({
            success: true,
            result
        });
    } catch (error: any) {
        console.error('[AI Routes] Execute sync error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to execute test'
        });
    }
});

/**
 * DELETE /api/tests/execute/:testId
 * Cancel a running test
 */
router.delete('/execute/:testId', async (req, res) => {
    try {
        const { testId } = req.params;
        const cancelled = await executor.cancelTest(testId);

        res.json({
            success: true,
            cancelled
        });
    } catch (error: any) {
        console.error('[AI Routes] Cancel test error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to cancel test'
        });
    }
});

/**
 * GET /api/tests/status/:testId
 * Check if a test is currently running
 */
router.get('/status/:testId', async (req, res) => {
    try {
        const { testId } = req.params;
        const isRunning = executor.isTestRunning(testId);

        res.json({
            success: true,
            testId,
            isRunning
        });
    } catch (error: any) {
        console.error('[AI Routes] Status check error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to check status'
        });
    }
});

/**
 * GET /api/tests/stats
 * Get execution statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = executor.getStats();

        res.json({
            success: true,
            stats
        });
    } catch (error: any) {
        console.error('[AI Routes] Stats error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get stats'
        });
    }
});

/**
 * GET /api/ai/health
 * Check if AI services are available
 */
router.get('/health', async (req, res) => {
    try {
        const isAvailable = await aiService.isAvailable();

        res.json({
            success: true,
            aiServicesAvailable: isAvailable,
            status: isAvailable ? 'healthy' : 'degraded'
        });
    } catch (error: any) {
        console.error('[AI Routes] Health check error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Health check failed'
        });
    }
});

export default router;
