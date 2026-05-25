import { Router } from 'express';
import { 
  startRecording,
  stopRecording,
  getRecordingStatus,
  exportRecording,
  listRecordingSessions,
  deleteRecordingSession
} from '../controllers/recordingController.js';
import { 
  authenticateUser, 
  requireSubscription, 
  requireFeature, 
  checkUsageLimit 
} from '../middleware/auth.js';
import { 
  trackUsageMiddleware, 
  validatePaymentRequired, 
  enforceBusinessRules 
} from '../middleware/usageTrackingMiddleware.js';
import { 
  freeUserLimiter, 
  paidUserLimiter 
} from '../middleware/securityMiddleware.js';

const router = Router();

// Apply authentication to all routes
router.use(authenticateUser);

// Apply rate limiting based on subscription
router.use(async (req: any, res, next) => {
  try {
    const subscription = req.user ? await import('../services/SubscriptionService').then(s => 
      s.subscriptionService.getActiveSubscription(req.user!.userId)
    ) : null;
    
    if (!subscription || subscription.planId === 'free') {
      return freeUserLimiter(req, res, next);
    } else {
      return paidUserLimiter(req, res, next);
    }
  } catch (error) {
    return freeUserLimiter(req, res, next);
  }
});

// Start recording - requires usage limit check and tracks usage
router.post('/start', 
  checkUsageLimit('recording', 100),
  validatePaymentRequired,
  enforceBusinessRules,
  trackUsageMiddleware('recording'),
  startRecording
);

// Stop recording
router.post('/:sessionId/stop', 
  stopRecording
);

// Get recording details
router.get('/:sessionId', 
getRecordingStatus
);

// List user's recordings
router.get('/', 
listRecordingSessions
);

// Export recording - feature-gated for advanced formats
router.post('/:sessionId/export',
  requireFeature('All Export Formats'),
  enforceBusinessRules,
exportRecording
);

// Delete recording
router.delete('/:sessionId',
deleteRecordingSession
);

// TODO: Implement these routes when controllers are ready
// Execute recording - requires execution limit
// router.post('/:sessionId/execute',
//   checkUsageLimit('execution'),
//   validatePaymentRequired,
//   trackUsageMiddleware('execution'),
//   executeRecording
// );

// Get execution results
// router.get('/:sessionId/executions',
//   getExecutions
// );

// Parallel execution - feature-gated for higher plans
// router.post('/:sessionId/execute-parallel',
//   requireFeature('Parallel Execution'),
//   checkUsageLimit('execution'),
//   validatePaymentRequired,
//   trackUsageMiddleware('execution', 5), // Track as 5 executions for parallel
//   executeParallel
// );

// Advanced features - require higher plans
// router.post('/:sessionId/schedule',
//   requireSubscription('professional'),
//   requireFeature('Scheduled Execution'),
//   scheduleExecution
// );

// router.post('/:sessionId/analyze',
//   requireFeature('Advanced Analytics'),
//   analyzeRecording
// );

// Team collaboration - requires team features
// router.post('/:sessionId/share',
//   requireFeature('Team Collaboration'),
//   shareRecording
// );

// router.get('/:sessionId/comments',
//   requireFeature('Team Collaboration'),
//   getComments
// );

// router.post('/:sessionId/comments',
//   requireFeature('Team Collaboration'),
//   addComment
// );

export default router;