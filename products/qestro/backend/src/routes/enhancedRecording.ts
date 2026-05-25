import { Router } from 'express';
import { WebRecordingService } from '../services/WebRecordingService.js';
import { WebRecordingConfig, RecordedAction, ElementInfo } from '../types/recording.js';
import { logger } from '../utils/logger.js';

const router = Router();
const webRecordingService = new WebRecordingService();

// Start enhanced recording
router.post('/start', async (req, res) => {
  try {
    const { config }: { config: WebRecordingConfig } = req.body;
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const session = await webRecordingService.startCloudRecording(sessionId, config);
    
    res.json({
      success: true,
      sessionId: session.id,
      cloudProvider: session.cloudSession?.provider,
      features: {
        aiEnabled: !!config.aiFeatures,
        visualTesting: !!config.visualTesting,
        performanceMonitoring: !!config.performance
      }
    });
  } catch (error) {
    logger.error('Failed to start enhanced recording:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate smart selectors
router.post('/smart-selectors', async (req, res) => {
  try {
    const { sessionId, element, coordinates }: {
      sessionId: string;
      element: ElementInfo;
      coordinates?: { x: number; y: number };
    } = req.body;
    
    const smartSelector = await webRecordingService.generateSmartSelectors(
      sessionId, 
      element, 
      coordinates
    );
    
    res.json({
      success: true,
      selector: smartSelector
    });
  } catch (error) {
    logger.error('Failed to generate smart selectors:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate AI assertions
router.post('/ai-assertions', async (req, res) => {
  try {
    const { sessionId, action }: {
      sessionId: string;
      action: RecordedAction;
    } = req.body;
    
    const assertions = await webRecordingService.generateAIAssertions(sessionId, action);
    
    res.json({
      success: true,
      assertions,
      count: assertions.length
    });
  } catch (error) {
    logger.error('Failed to generate AI assertions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Detect parameters
router.post('/detect-parameters', async (req, res) => {
  try {
    const { sessionId }: { sessionId: string } = req.body;
    
    const parameters = await webRecordingService.detectParameters(sessionId);
    
    res.json({
      success: true,
      parameters,
      count: parameters.length
    });
  } catch (error) {
    logger.error('Failed to detect parameters:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get session analytics
router.get('/analytics/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const analytics = await webRecordingService.getSessionAnalytics(sessionId);
    
    if (!analytics) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    logger.error('Failed to get session analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Export enhanced session
router.get('/export/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { format = 'json' } = req.query;
    
    const exportedData = await webRecordingService.exportEnhancedSession(
      sessionId, 
      format as string
    );
    
    const contentType = format === 'yaml' ? 'text/yaml' : 'application/json';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="session-${sessionId}.${format}"`);
    
    if (format === 'yaml') {
      res.send(exportedData);
    } else {
      res.json({
        success: true,
        data: exportedData
      });
    }
  } catch (error) {
    logger.error('Failed to export session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get session status
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await webRecordingService.getRecordingSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    res.json({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        type: session.type,
        platform: session.platform,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        actionCount: session.actions.length,
        aiSuggestionsCount: session.aiSuggestions?.length || 0,
        parametersCount: session.parameters?.length || 0,
        visualBaselinesCount: session.visualBaselines?.length || 0,
        performanceMetricsCount: session.performanceMetrics?.length || 0,
        cloudProvider: session.cloudSession?.provider
      }
    });
  } catch (error) {
    logger.error('Failed to get session status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Stop recording
router.post('/stop', async (req, res) => {
  try {
    const { sessionId }: { sessionId: string } = req.body;
    
    const session = await webRecordingService.stopCloudRecording(sessionId);
    
    res.json({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        duration: session.duration,
        actionCount: session.actions.length,
        aiSuggestionsCount: session.aiSuggestions?.length || 0,
        parametersCount: session.parameters?.length || 0
      }
    });
  } catch (error) {
    logger.error('Failed to stop recording:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// List active sessions
router.get('/sessions', async (req, res) => {
  try {
    const activeSessions = await webRecordingService.listActiveSessions();
    
    res.json({
      success: true,
      sessions: activeSessions,
      count: activeSessions.length
    });
  } catch (error) {
    logger.error('Failed to list sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test endpoint for feature validation
router.get('/test', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Enhanced WebRecordingService API is working!',
      features: {
        smartSelectors: 'Generate intelligent element selectors with multiple strategies',
        aiAssertions: 'AI-powered assertion suggestions based on user actions',
        parameterDetection: 'Automatic detection of parameterizable test data',
        cloudIntegration: 'Multi-cloud testing with BrowserStack, SauceLabs, LambdaTest',
        visualTesting: 'Visual regression testing with baseline capture',
        performanceMonitoring: 'Real-time performance metrics collection',
        enhancedExport: 'Export with AI suggestions, parameters, and metrics'
      },
      endpoints: {
        'POST /start': 'Start enhanced recording session',
        'POST /smart-selectors': 'Generate smart selectors for elements',
        'POST /ai-assertions': 'Generate AI-powered assertions',
        'POST /detect-parameters': 'Detect parameterizable values',
        'GET /analytics/:sessionId': 'Get session analytics',
        'GET /export/:sessionId': 'Export enhanced session data',
        'GET /session/:sessionId': 'Get session status',
        'POST /stop': 'Stop recording session',
        'GET /sessions': 'List active sessions'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;