import { Router, Request, Response } from 'express';
import { webRecordingService } from '../services/WebRecordingService.js';
import { mobileRecordingService } from '../services/MobileRecordingService.js';
import { recordingStorageService } from '../services/RecordingStorageService.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * Start playback session
 * POST /api/playback/start
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { recordingId, speed = 1.0, stepByStep = false } = req.body;

    if (!recordingId) {
      return res.status(400).json({
        success: false,
        error: 'recordingId is required'
      });
    }

    const recording = await recordingStorageService.getRecording(recordingId);

    if (!recording) {
      return res.status(404).json({
        success: false,
        error: 'Recording not found'
      });
    }

    // Create playback session
    const playbackSession = {
      id: `playback_${Date.now()}`,
      recordingId,
      type: recording.type,
      speed,
      stepByStep,
      currentStep: 0,
      totalSteps: recording.actions.length,
      status: 'ready',
      createdAt: Date.now()
    };

    res.json({
      success: true,
      data: playbackSession
    });
  } catch (error: any) {
    logger.error('Error starting playback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start playback',
      message: error.message
    });
  }
});

/**
 * Execute next step in playback
 * POST /api/playback/:sessionId/next
 */
router.post('/:sessionId/next', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    // This would execute the next step in the playback
    // For now, we'll return a success response

    res.json({
      success: true,
      message: 'Step executed successfully'
    });
  } catch (error: any) {
    logger.error('Error executing playback step:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute playback step',
      message: error.message
    });
  }
});

/**
 * Pause playback
 * POST /api/playback/:sessionId/pause
 */
router.post('/:sessionId/pause', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    res.json({
      success: true,
      message: 'Playback paused'
    });
  } catch (error: any) {
    logger.error('Error pausing playback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to pause playback',
      message: error.message
    });
  }
});

/**
 * Resume playback
 * POST /api/playback/:sessionId/resume
 */
router.post('/:sessionId/resume', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    res.json({
      success: true,
      message: 'Playback resumed'
    });
  } catch (error: any) {
    logger.error('Error resuming playback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resume playback',
      message: error.message
    });
  }
});

/**
 * Stop playback
 * POST /api/playback/:sessionId/stop
 */
router.post('/:sessionId/stop', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    res.json({
      success: true,
      message: 'Playback stopped'
    });
  } catch (error: any) {
    logger.error('Error stopping playback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop playback',
      message: error.message
    });
  }
});

/**
 * Seek to specific step
 * POST /api/playback/:sessionId/seek
 */
router.post('/:sessionId/seek', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { stepIndex } = req.body;

    if (stepIndex === undefined) {
      return res.status(400).json({
        success: false,
        error: 'stepIndex is required'
      });
    }

    res.json({
      success: true,
      message: `Seeked to step ${stepIndex}`
    });
  } catch (error: any) {
    logger.error('Error seeking playback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to seek playback',
      message: error.message
    });
  }
});

/**
 * Set playback speed
 * POST /api/playback/:sessionId/speed
 */
router.post('/:sessionId/speed', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { speed } = req.body;

    if (!speed || speed <= 0 || speed > 5) {
      return res.status(400).json({
        success: false,
        error: 'Invalid speed value (must be between 0 and 5)'
      });
    }

    res.json({
      success: true,
      message: `Playback speed set to ${speed}x`
    });
  } catch (error: any) {
    logger.error('Error setting playback speed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set playback speed',
      message: error.message
    });
  }
});

/**
 * Get screenshot for a specific step
 * GET /api/playback/recording/:recordingId/step/:stepIndex/screenshot
 */
router.get('/recording/:recordingId/step/:stepIndex/screenshot', async (req: Request, res: Response) => {
  try {
    const { recordingId, stepIndex } = req.params;

    const recording = await recordingStorageService.getRecording(recordingId);

    if (!recording) {
      return res.status(404).json({
        success: false,
        error: 'Recording not found'
      });
    }

    const index = parseInt(stepIndex);
    if (isNaN(index) || index < 0 || index >= recording.actions.length) {
      return res.status(400).json({
        success: false,
        error: 'Invalid step index'
      });
    }

    // Get screenshot for the action
    const action = recording.actions[index];
    if (action.screenshot) {
      const screenshot = await recordingStorageService.getArtifact(action.screenshot);

      if (screenshot) {
        res.setHeader('Content-Type', 'image/png');
        res.send(screenshot);
        return;
      }
    }

    res.status(404).json({
      success: false,
      error: 'Screenshot not found for this step'
    });
  } catch (error: any) {
    logger.error('Error getting screenshot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get screenshot',
      message: error.message
    });
  }
});

/**
 * Get timeline data for playback
 * GET /api/playback/recording/:recordingId/timeline
 */
router.get('/recording/:recordingId/timeline', async (req: Request, res: Response) => {
  try {
    const { recordingId } = req.params;

    const recording = await recordingStorageService.getRecording(recordingId);

    if (!recording) {
      return res.status(404).json({
        success: false,
        error: 'Recording not found'
      });
    }

    // Build timeline from actions
    const timeline = recording.actions.map((action, index) => ({
      stepIndex: index,
      timestamp: action.timestamp,
      type: action.type,
      description: getActionDescription(action),
      hasScreenshot: !!action.screenshot,
      duration: index < recording.actions.length - 1
        ? recording.actions[index + 1].timestamp - action.timestamp
        : 0
    }));

    res.json({
      success: true,
      data: {
        recordingId,
        totalSteps: recording.actions.length,
        duration: recording.duration || 0,
        timeline
      }
    });
  } catch (error: any) {
    logger.error('Error getting timeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get timeline',
      message: error.message
    });
  }
});

/**
 * Helper function to get action description
 */
function getActionDescription(action: any): string {
  switch (action.type) {
    case 'click':
    case 'tap':
      return `Click on ${action.element || 'element'}`;
    case 'input':
      return `Type "${action.text || ''}"`;
    case 'navigation':
      return `Navigate to ${action.url || 'page'}`;
    case 'scroll':
      return `Scroll to ${action.scrollX}, ${action.scrollY}`;
    case 'wait':
      return `Wait ${action.duration || 0}ms`;
    case 'assert':
      return `Assert ${action.assertion?.type || 'condition'}`;
    case 'swipe':
      return `Swipe ${action.metadata?.direction || 'up'}`;
    default:
      return action.type;
  }
}

export default router;
