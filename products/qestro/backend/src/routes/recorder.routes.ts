/**
 * Test Recorder Routes
 * API endpoints for browser session recording and test code generation
 */

import { Router, Request, Response } from 'express';
import { authenticateUser, requireRole } from '../middleware/auth.js';
import { recorderEngine } from '../services/test-recorder/index.js';
import { RecordedAction, RecordingOptions } from '../services/test-recorder/types.js';
import { logger } from '../utils/logger.js';

const router = Router();

const formatResponse = (data: unknown, message?: string) => ({
  success: true,
  data,
  message,
  timestamp: new Date().toISOString(),
});

const handleError = (res: Response, error: unknown, statusCode = 500) => {
  const msg = error instanceof Error ? error.message : 'Unknown error';
  logger.error('Recorder error:', { error: msg });
  res.status(statusCode).json({
    success: false,
    error: msg,
    timestamp: new Date().toISOString(),
  });
};

// POST /api/recorder/start - Start recording session
router.post('/start', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { projectId, url, options } = req.body;

    if (!projectId || !url) {
      return res.status(400).json(
        formatResponse(null, 'Missing projectId or url')
      );
    }

    const sessionId = recorderEngine.startRecording(
      projectId,
      url,
      options as Partial<RecordingOptions>,
      {
        screenSize: req.body.screenSize,
        userAgent: req.get('user-agent'),
        platform: req.body.platform,
        timestamp: Date.now(),
      }
    );

    res.status(201).json(
      formatResponse({ sessionId, url }, 'Recording session started')
    );
  } catch (error) {
    handleError(res, error, 400);
  }
});

// POST /api/recorder/action - Record an action
router.post('/action', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { sessionId, action } = req.body;

    if (!sessionId || !action) {
      return res.status(400).json(
        formatResponse(null, 'Missing sessionId or action')
      );
    }

    recorderEngine.recordAction(sessionId, action as RecordedAction);

    res.status(200).json(
      formatResponse({ sessionId }, 'Action recorded')
    );
  } catch (error) {
    handleError(res, error, 400);
  }
});

// POST /api/recorder/stop/:sessionId - Stop recording and generate code
router.post('/stop/:sessionId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { testName, includeScreenshots } = req.body;

    if (!sessionId) {
      return res.status(400).json(
        formatResponse(null, 'Missing sessionId')
      );
    }

    const result = await recorderEngine.stopRecording(sessionId, {
      testName,
      includeScreenshots: includeScreenshots ?? true,
      language: 'playwright',
    });

    res.status(200).json(
      formatResponse(result, 'Recording processed and code generated')
    );
  } catch (error) {
    handleError(res, error, 400);
  }
});

// GET /api/recorder/session/:sessionId - Get session info
router.get('/session/:sessionId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json(
        formatResponse(null, 'Missing sessionId')
      );
    }

    const session = recorderEngine.getSession(sessionId);
    if (!session) {
      return res.status(404).json(
        formatResponse(null, 'Session not found')
      );
    }

    res.status(200).json(
      formatResponse({
        id: session.id,
        projectId: session.projectId,
        url: session.url,
        status: session.status,
        actionCount: session.actions.length,
        duration: session.duration,
        startTime: session.startTime,
        endTime: session.endTime,
      }, 'Session retrieved')
    );
  } catch (error) {
    handleError(res, error);
  }
});

// POST /api/recorder/pause/:sessionId - Pause recording
router.post('/pause/:sessionId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = recorderEngine.pauseRecording(sessionId);
    if (!session) {
      return res.status(404).json(
        formatResponse(null, 'Session not found')
      );
    }

    res.status(200).json(
      formatResponse({ sessionId }, 'Recording paused')
    );
  } catch (error) {
    handleError(res, error);
  }
});

// POST /api/recorder/resume/:sessionId - Resume recording
router.post('/resume/:sessionId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = recorderEngine.resumeRecording(sessionId);
    if (!session) {
      return res.status(404).json(
        formatResponse(null, 'Session not found')
      );
    }

    res.status(200).json(
      formatResponse({ sessionId }, 'Recording resumed')
    );
  } catch (error) {
    handleError(res, error);
  }
});

// POST /api/recorder/export/:sessionId - Export recording as code
router.post('/export/:sessionId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { format } = req.body;

    if (!sessionId) {
      return res.status(400).json(
        formatResponse(null, 'Missing sessionId')
      );
    }

    const code = await recorderEngine.exportRecording(
      sessionId,
      (format as 'playwright' | 'cypress') || 'playwright'
    );

    res.status(200).json(
      formatResponse({ code, format: format || 'playwright' }, 'Recording exported')
    );
  } catch (error) {
    handleError(res, error);
  }
});

// GET /api/recorder/stats - Get recorder stats
router.get('/stats', authenticateUser, async (req: Request, res: Response) => {
  try {
    const stats = recorderEngine.getStats();
    res.status(200).json(
      formatResponse(stats, 'Recorder stats retrieved')
    );
  } catch (error) {
    handleError(res, error);
  }
});

// DELETE /api/recorder/session/:sessionId - Delete/cleanup session
router.delete('/session/:sessionId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json(
        formatResponse(null, 'Missing sessionId')
      );
    }

    const deleted = recorderEngine.deleteSession(sessionId);
    if (!deleted) {
      return res.status(404).json(
        formatResponse(null, 'Session not found')
      );
    }

    res.status(200).json(
      formatResponse({ sessionId }, 'Session deleted')
    );
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
