/**
 * Conversational Test Generation Routes — NL → Test Suite via OpenClaw (P2)
 * 
 * API endpoints for the multi-turn conversational test generation flow.
 */

import { Router, Request, Response } from 'express';
import { ConversationalTestService } from '../services/ConversationalTestService.js';

const router = Router();

// ─── Session Lifecycle ────────────────────────────────────────────────

/**
 * POST /api/testgen/conversations/start
 * Start a new conversational test generation session
 */
router.post('/conversations/start', async (req: Request, res: Response) => {
    try {
        const service = ConversationalTestService.getInstance();
        const { message, channel, notifyOnComplete } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'message (string) is required — describe what you want to test',
            });
        }

        const result = await service.startConversation(message, {
            channel,
            notifyOnComplete,
        });

        res.json({
            success: true,
            message: 'Conversation started — answer the clarification questions to proceed',
            data: {
                sessionId: result.session.id,
                phase: result.session.phase,
                domain: result.session.context.domain,
                response: result.response,
                questions: result.questions,
            },
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: 'Failed to start conversation',
            details: error.message,
        });
    }
});

/**
 * POST /api/testgen/conversations/:sessionId/answer
 * Answer clarification questions
 */
router.post('/conversations/:sessionId/answer', async (req: Request, res: Response) => {
    try {
        const service = ConversationalTestService.getInstance();
        const { sessionId } = req.params;
        const { answers } = req.body;

        if (!answers || typeof answers !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'answers (object) is required — map question IDs to selected options',
            });
        }

        const result = await service.answerQuestions(sessionId, answers);

        res.json({
            success: true,
            message: `Generated ${result.scenarios.length} test scenarios — review and approve`,
            data: {
                sessionId: result.session.id,
                phase: result.session.phase,
                response: result.response,
                scenarios: result.scenarios.map(s => ({
                    id: s.id,
                    name: s.name,
                    description: s.description,
                    type: s.type,
                    priority: s.priority,
                    stepsCount: s.steps.length,
                })),
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
 * POST /api/testgen/conversations/:sessionId/approve
 * Approve scenarios and generate final test code
 */
router.post('/conversations/:sessionId/approve', async (req: Request, res: Response) => {
    try {
        const service = ConversationalTestService.getInstance();
        const { sessionId } = req.params;
        const { approvedIds, modifications } = req.body;

        const result = await service.approveScenarios(sessionId, approvedIds, modifications);

        res.json({
            success: true,
            message: `${result.savedScenarios.length} test cases saved to library`,
            data: {
                sessionId: result.session.id,
                phase: result.session.phase,
                response: result.response,
                savedScenarios: result.savedScenarios.map(s => ({
                    id: s.id,
                    name: s.name,
                    type: s.type,
                    priority: s.priority,
                    hasCode: !!s.generatedCode,
                    codePreview: s.generatedCode?.slice(0, 200),
                })),
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
 * POST /api/testgen/conversations/:sessionId/cancel
 * Cancel a conversation
 */
router.post('/conversations/:sessionId/cancel', (req: Request, res: Response) => {
    try {
        const service = ConversationalTestService.getInstance();
        const { sessionId } = req.params;

        const session = service.cancelConversation(sessionId);

        res.json({
            success: true,
            message: 'Conversation cancelled',
            data: {
                sessionId: session.id,
                phase: session.phase,
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

// ─── Queries ──────────────────────────────────────────────────────────

/**
 * GET /api/testgen/conversations
 * List all conversation sessions
 */
router.get('/conversations', (_req: Request, res: Response) => {
    try {
        const service = ConversationalTestService.getInstance();
        const sessions = service.getAllSessions();

        res.json({
            success: true,
            data: sessions.map(s => ({
                id: s.id,
                phase: s.phase,
                domain: s.context.domain,
                platform: s.context.platform,
                scenarioCount: s.scenarios.length,
                messageCount: s.messages.length,
                createdAt: s.createdAt,
                updatedAt: s.updatedAt,
            })),
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/testgen/conversations/:sessionId
 * Get full conversation details
 */
router.get('/conversations/:sessionId', (req: Request, res: Response) => {
    try {
        const service = ConversationalTestService.getInstance();
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
 * GET /api/testgen/conversations/:sessionId/code
 * Get generated code for all approved scenarios in a session
 */
router.get('/conversations/:sessionId/code', (req: Request, res: Response) => {
    try {
        const service = ConversationalTestService.getInstance();
        const { sessionId } = req.params;
        const session = service.getSession(sessionId);

        if (!session) {
            return res.status(404).json({
                success: false,
                error: `Session '${sessionId}' not found`,
            });
        }

        const approvedWithCode = session.scenarios
            .filter(s => s.approved && s.generatedCode)
            .map(s => ({
                id: s.id,
                name: s.name,
                code: s.generatedCode,
            }));

        if (approvedWithCode.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No approved scenarios with generated code',
            });
        }

        // Combine all code into a single file
        const combinedCode = approvedWithCode.map(s => s.code).join('\n\n');

        res.json({
            success: true,
            data: {
                sessionId,
                scenarioCount: approvedWithCode.length,
                scenarios: approvedWithCode,
                combinedCode,
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/testgen/stats
 * Get overall conversational test generation statistics
 */
router.get('/stats', (_req: Request, res: Response) => {
    try {
        const service = ConversationalTestService.getInstance();
        const stats = service.getStats();

        res.json({
            success: true,
            data: stats,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
