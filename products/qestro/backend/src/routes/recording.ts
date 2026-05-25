import { Router, Request, Response } from 'express';
import {
  startRecording,
  stopRecording,
  getRecordingStatus,
  exportRecording,
  listRecordingSessions,
  deleteRecordingSession,
} from '../controllers/recordingController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { recordingValidationSchemas } from '../validation/recording.js';
import { webRecordingService } from '../services/WebRecordingService.js';
import { mobileRecordingService } from '../services/MobileRecordingService.js';
import { recordingStorageService } from '../services/RecordingStorageService.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Apply authentication to all recording routes
router.use(authenticateToken);

// Start a new recording session
router.post(
  '/start',
  validateRequest(recordingValidationSchemas.startRecording),
  startRecording
);

// Stop a recording session
router.post(
  '/stop',
  validateRequest(recordingValidationSchemas.stopRecording),
  stopRecording
);

// Get recording session status
router.get(
  '/:sessionId/status',
  getRecordingStatus
);

// Export recording session
router.get(
  '/:sessionId/export',
  exportRecording
);

// List recording sessions
router.get(
  '/sessions',
  listRecordingSessions
);

// Delete recording session
router.delete(
  '/:sessionId',
  deleteRecordingSession
);

// ==================== NEW ENHANCED ENDPOINTS ====================

/**
 * Save recording to storage
 * POST /api/recording/:sessionId/save
 */
router.post('/:sessionId/save', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { name, description, projectId, tags } = req.body;
    const userId = (req as any).user.id;

    // Get session from web or mobile service
    let session = await webRecordingService.getRecordingSession(sessionId);

    if (!session) {
      const mobileSession = mobileRecordingService.getSession(sessionId);
      if (mobileSession) {
        session = mobileSession as any;
      }
    }

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Recording session not found'
      });
    }

    const savedRecording = await recordingStorageService.saveRecording({
      session,
      name,
      description,
      projectId,
      userId,
      tags
    });

    res.json({
      success: true,
      data: savedRecording
    });
  } catch (error: any) {
    logger.error('Error saving recording:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save recording',
      message: error.message
    });
  }
});

/**
 * Get stored recordings
 * GET /api/recording/stored
 */
router.get('/stored/list', async (req: Request, res: Response) => {
  try {
    const { projectId, type, status, tags, search, limit, offset } = req.query;
    const userId = (req as any).user.id;

    const result = await recordingStorageService.listRecordings({
      projectId: projectId as string,
      userId,
      type: type as any,
      status: status as any,
      tags: tags ? (tags as string).split(',') : undefined,
      search: search as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined
    });

    res.json({
      success: true,
      data: result.recordings,
      total: result.total
    });
  } catch (error: any) {
    logger.error('Error listing recordings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list recordings',
      message: error.message
    });
  }
});

/**
 * Get stored recording by ID
 * GET /api/recording/stored/:recordingId
 */
router.get('/stored/:recordingId', async (req: Request, res: Response) => {
  try {
    const { recordingId } = req.params;

    const recording = await recordingStorageService.getRecording(recordingId);

    if (!recording) {
      return res.status(404).json({
        success: false,
        error: 'Recording not found'
      });
    }

    res.json({
      success: true,
      data: recording
    });
  } catch (error: any) {
    logger.error('Error getting recording:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recording',
      message: error.message
    });
  }
});

/**
 * Publish a recording
 * POST /api/recording/stored/:recordingId/publish
 */
router.post('/stored/:recordingId/publish', async (req: Request, res: Response) => {
  try {
    const { recordingId } = req.params;

    const recording = await recordingStorageService.publishRecording(recordingId);

    res.json({
      success: true,
      data: recording
    });
  } catch (error: any) {
    logger.error('Error publishing recording:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to publish recording',
      message: error.message
    });
  }
});

/**
 * Duplicate a recording
 * POST /api/recording/stored/:recordingId/duplicate
 */
router.post('/stored/:recordingId/duplicate', async (req: Request, res: Response) => {
  try {
    const { recordingId } = req.params;
    const { name } = req.body;

    const duplicate = await recordingStorageService.duplicateRecording(recordingId, name);

    res.json({
      success: true,
      data: duplicate
    });
  } catch (error: any) {
    logger.error('Error duplicating recording:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to duplicate recording',
      message: error.message
    });
  }
});

/**
 * Get mobile devices
 * GET /api/recording/mobile/devices
 */
router.get('/mobile/devices', async (req: Request, res: Response) => {
  try {
    const { platform } = req.query;

    let devices: any[] = [];

    if (!platform || platform === 'ios') {
      const iosDevices = await mobileRecordingService.getIOSDevices();
      devices = [...devices, ...iosDevices];
    }

    if (!platform || platform === 'android') {
      const androidDevices = await mobileRecordingService.getAndroidDevices();
      devices = [...devices, ...androidDevices];
    }

    res.json({
      success: true,
      data: devices
    });
  } catch (error: any) {
    logger.error('Error getting mobile devices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get mobile devices',
      message: error.message
    });
  }
});

/**
 * Get storage statistics
 * GET /api/recording/storage/stats
 */
router.get('/storage/stats', async (req: Request, res: Response) => {
  try {
    const stats = await recordingStorageService.getStorageStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    logger.error('Error getting storage stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get storage stats',
      message: error.message
    });
  }
});

export default router;