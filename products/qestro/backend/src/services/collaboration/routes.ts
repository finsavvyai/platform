/**
 * Collaboration REST API Routes
 */

import { Router, Request, Response } from 'express';
import { collaborationServer } from './CollaborationServer.js';
import { logger } from '../../utils/logger.js';

export const collaborationRouter = Router();

collaborationRouter.post('/sessions', async (req: Request, res: Response) => {
  try {
    const user = req.user as { userId: string; name?: string; email?: string } | undefined;
    const { testId, projectId } = req.body;
    if (!testId || !projectId) return res.status(400).json({ error: 'testId and projectId required' });
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const session = await collaborationServer.createSession(testId, projectId, user.userId, user.name || 'Anonymous');
    res.status(201).json({ success: true, session });
  } catch (error) {
    logger.error('Create session error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
  }
});

collaborationRouter.get('/sessions/:sessionId', (req: Request, res: Response) => {
  try {
    const state = collaborationServer.getSessionState(req.params.sessionId);
    if (!state) return res.status(404).json({ error: 'Session not found' });
    res.json({ success: true, sessionId: req.params.sessionId, state });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
  }
});

collaborationRouter.post('/sessions/:sessionId/join', async (req: Request, res: Response) => {
  try {
    const user = req.user as { userId: string; name?: string; email?: string } | undefined;
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const participant = await collaborationServer.joinSession(
      req.params.sessionId, user.userId, user.name || 'Anonymous', user.email || ''
    );
    res.json({ success: true, participant });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const code = msg.includes('not found') ? 404 : msg.includes('already') ? 409 : 500;
    res.status(code).json({ error: msg });
  }
});

collaborationRouter.post('/sessions/:sessionId/leave', async (req: Request, res: Response) => {
  try {
    const user = req.user as { userId: string } | undefined;
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    await collaborationServer.leaveSession(req.params.sessionId, user.userId);
    res.json({ success: true, message: 'Left session' });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
  }
});

collaborationRouter.get('/sessions/:sessionId/participants', (req: Request, res: Response) => {
  try {
    const participants = collaborationServer.getActiveParticipants(req.params.sessionId);
    res.json({ success: true, sessionId: req.params.sessionId, participants, count: participants.length });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
  }
});

collaborationRouter.post('/sessions/:sessionId/presence', async (req: Request, res: Response) => {
  try {
    const user = req.user as { userId: string } | undefined;
    const { status } = req.body;
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    if (!['editing', 'viewing', 'idle'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    await collaborationServer.updatePresence(req.params.sessionId, user.userId, status);
    res.json({ success: true, message: 'Presence updated' });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
  }
});

collaborationRouter.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = collaborationServer.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
  }
});

export default collaborationRouter;
