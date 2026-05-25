import { Router } from 'express';
import { webRecordingController } from '../controllers/webRecordingController.js';
import { authenticateUser } from '../middleware/auth.js';
// import { validateRecordingRequest } from '../validation/recording.js'; // TODO: Fix validation

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateUser);

/**
 * @route POST /api/web-recording/start
 * @desc Start a new web recording session
 * @access Private
 */
router.post('/start', webRecordingController.startRecording);

/**
 * @route POST /api/web-recording/stop
 * @desc Stop an active web recording session
 * @access Private
 */
router.post('/stop', webRecordingController.stopRecording);

/**
 * @route GET /api/web-recording/:sessionId/status
 * @desc Get status of a recording session
 * @access Private
 */
router.get('/:sessionId/status', webRecordingController.getRecordingStatus);

/**
 * @route GET /api/web-recording/:sessionId/actions
 * @desc Get recorded actions for a session
 * @access Private
 */
router.get('/:sessionId/actions', webRecordingController.getRecordingActions);

/**
 * @route POST /api/web-recording/export
 * @desc Export recording to various formats
 * @access Private
 */
router.post('/export', webRecordingController.exportRecording);

/**
 * @route GET /api/web-recording/:sessionId/screenshot
 * @desc Get current screenshot of the recording session
 * @access Private
 */
router.get('/:sessionId/screenshot', webRecordingController.getRecordingScreenshot);

/**
 * @route GET /api/web-recording/active
 * @desc List all active recording sessions
 * @access Private
 */
router.get('/active', webRecordingController.listActiveSessions);

/**
 * @route POST /api/web-recording/:sessionId/execute
 * @desc Execute a specific action in the recording session
 * @access Private
 */
router.post('/:sessionId/execute', webRecordingController.executeAction);

export default router;