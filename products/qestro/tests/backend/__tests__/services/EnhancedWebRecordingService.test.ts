import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { WebRecordingService } from '../../../../backend/src/services/WebRecordingService';
import { CloudTestingService } from '../../../../backend/src/services/CloudTestingService';
import { SmartSelectorService } from '../../../../backend/src/services/SmartSelectorService';
import { AssertionSuggestionService } from '../../../../backend/src/services/AssertionSuggestionService';
import { ParameterizationService } from '../../../../backend/src/services/ParameterizationService';
import { WebRecordingConfig, RecordedAction, ElementInfo } from '../../../../backend/src/types/recording';

// Mock dependencies
jest.mock('../../../../backend/src/services/CloudTestingService');
jest.mock('../../../../backend/src/services/SmartSelectorService');
jest.mock('../../../../backend/src/services/AssertionSuggestionService');
jest.mock('../../../../backend/src/services/ParameterizationService');
jest.mock('../../../../backend/src/services/AIService');

const mockCloudTestingService = CloudTestingService as jest.MockedClass<typeof CloudTestingService>;
const mockSmartSelectorService = SmartSelectorService as jest.MockedClass<typeof SmartSelectorService>;
const mockAssertionSuggestionService = AssertionSuggestionService as jest.MockedClass<typeof AssertionSuggestionService>;
const mockParameterizationService = ParameterizationService as jest.MockedClass<typeof ParameterizationService>;

describe('Enhanced WebRecordingService', () => {
  let webRecordingService: WebRecordingService;
  let mockPage: any;
  let mockBrowser: any;
  let mockCloudSession: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock page and browser
    mockPage = {
      goto: jest.fn(),
      screenshot: jest.fn(),
      evaluate: jest.fn(),
      setViewport: jest.fn(),
      setUserAgent: jest.fn(),
      setGeolocation: jest.fn(),
      setExtraHTTPHeaders: jest.fn(),
      on: jest.fn(),
      click: jest.fn(),
      type: jest.fn(),
      close: jest.fn()
    };

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
      pages: jest.fn().mockResolvedValue([mockPage])
    };

    mockCloudSession = {
      provider: 'local',
      sessionId: 'test-session-123',
      browser: mockBrowser,
      page: mockPage,
      sessionUrl: 'https://example.com/session/123',
      videoUrl: 'https://example.com/video/123'
    };

    // Mock CloudTestingService
    mockCloudTestingService.prototype.createCloudSession = jest.fn().mockResolvedValue(mockCloudSession);
    mockCloudTestingService.prototype.closeSession = jest.fn();

    webRecordingService = new WebRecordingService();
  });

  afterEach(async () => {
    // Clean up any active sessions
    const activeSessions = await webRecordingService.listActiveSessions();
    for (const sessionId of activeSessions) {
      try {
        await webRecordingService.stopCloudRecording(sessionId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Enhanced Cloud Recording', () => {
    it('should start cloud recording with AI features enabled', async () => {
      const config: WebRecordingConfig = {
        url: 'https://example.com',
        browser: 'chrome',
        cloudProvider: 'browserstack',
        aiFeatures: {
          smartSelectors: true,
          assertionSuggestions: true,
          elementHealing: true,
          parameterDetection: true
        },
        visualTesting: {
          enableBaselines: true,
          threshold: 0.1
        },
        performance: {
          collectMetrics: true,
          thresholds: {
            loadTime: 3000,
            firstContentfulPaint: 1500
          }
        }
      };

      mockPage.goto.mockResolvedValue(undefined);
      mockPage.screenshot.mockResolvedValue(Buffer.from('screenshot'));
      mockPage.evaluate.mockResolvedValue({
        loadTime: 1200,
        domContentLoaded: 800,
        firstContentfulPaint: 900
      });

      const session = await webRecordingService.startCloudRecording('test-session', config);

      expect(session).toBeDefined();
      expect(session.id).toBe('test-session');
      expect(session.type).toBe('web');
      expect(session.status).toBe('recording');
      expect(session.config).toEqual(config);
      expect(session.cloudSession).toEqual({
        provider: 'local',
        sessionId: 'test-session-123',
        sessionUrl: 'https://example.com/session/123',
        videoUrl: 'https://example.com/video/123'
      });
      expect(session.aiSuggestions).toEqual([]);
      expect(session.parameters).toEqual([]);
      expect(session.visualBaselines).toEqual([]);
      expect(session.performanceMetrics).toEqual([]);

      expect(mockCloudTestingService.prototype.createCloudSession).toHaveBeenCalledWith('test-session', config);
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', { waitUntil: 'networkidle2' });
    });

    it('should capture performance metrics during recording', async () => {
      const config: WebRecordingConfig = {
        performance: { collectMetrics: true }
      };

      const mockMetrics = {
        loadTime: 1200,
        domContentLoaded: 800,
        firstContentfulPaint: 900,
        largestContentfulPaint: 0,
        cumulativeLayoutShift: 0,
        firstInputDelay: 0
      };

      mockPage.evaluate.mockResolvedValue(mockMetrics);

      const session = await webRecordingService.startCloudRecording('test-session', config);
      await webRecordingService.capturePerformanceMetrics(mockPage, 'test-session');

      const updatedSession = await webRecordingService.getRecordingSession('test-session');
      expect(updatedSession?.performanceMetrics).toHaveLength(1);
      expect(updatedSession?.performanceMetrics?.[0].metrics).toEqual(mockMetrics);
    });

    it('should capture visual baselines when enabled', async () => {
      const config: WebRecordingConfig = {
        visualTesting: { enableBaselines: true }
      };

      const mockScreenshot = Buffer.from('baseline-screenshot');
      mockPage.screenshot.mockResolvedValue(mockScreenshot);

      const session = await webRecordingService.startCloudRecording('test-session', config);
      await webRecordingService.captureVisualBaseline(mockPage, 'test-session', 'action-123');

      const updatedSession = await webRecordingService.getRecordingSession('test-session');
      expect(updatedSession?.visualBaselines).toHaveLength(1);
      expect(updatedSession?.visualBaselines?.[0]).toEqual({
        actionId: 'action-123',
        baseline: mockScreenshot.toString('base64'),
        timestamp: expect.any(Number)
      });
    });
  });

  describe('AI-Powered Features', () => {
    beforeEach(async () => {
      const config: WebRecordingConfig = {
        aiFeatures: {
          smartSelectors: true,
          assertionSuggestions: true,
          elementHealing: true,
          parameterDetection: true
        }
      };
      await webRecordingService.startCloudRecording('test-session', config);
    });

    it('should generate AI assertions for actions', async () => {
      const mockAssertions = [
        {
          type: 'visual' as const,
          selector: '#submit-button',
          expected: 'visible',
          confidence: 0.9,
          reasoning: 'Button should be visible after form interaction',
          autoGenerated: true
        }
      ];

      mockAssertionSuggestionService.prototype.generateAssertionSuggestions = jest.fn()
        .mockResolvedValue(mockAssertions);

      const action: RecordedAction = {
        id: 'action-123',
        type: 'click',
        timestamp: Date.now(),
        selector: '#submit-button'
      };

      const suggestions = await webRecordingService.generateAIAssertions('test-session', action);

      expect(suggestions).toEqual(mockAssertions);
      expect(mockAssertionSuggestionService.prototype.generateAssertionSuggestions)
        .toHaveBeenCalledWith(mockPage, action, expect.any(Object));
    });

    it('should detect parameterizable elements', async () => {
      const mockParameters = [
        {
          selector: '#email-input',
          element: {
            tagName: 'INPUT',
            type: 'email',
            attributes: { name: 'email' }
          },
          parameterType: 'input' as const,
          suggestedName: 'emailAddress',
          defaultValue: 'test@example.com',
          confidence: 0.9,
          dataPattern: 'email'
        }
      ];

      mockParameterizationService.prototype.detectParameters = jest.fn()
        .mockResolvedValue(mockParameters);

      const parameters = await webRecordingService.detectParameters('test-session');

      expect(parameters).toEqual(mockParameters);
      expect(mockParameterizationService.prototype.detectParameters)
        .toHaveBeenCalledWith(mockPage, []);
    });

    it('should generate smart selectors for elements', async () => {
      const mockSmartSelector = {
        primary: '#email-input',
        fallbacks: ['[data-testid="email"]', 'input[type="email"]'],
        confidence: 0.95,
        strategy: 'id' as const,
        stability: 0.9,
        aiGenerated: false
      };

      mockSmartSelectorService.prototype.generateSmartSelectors = jest.fn()
        .mockResolvedValue(mockSmartSelector) as any;

      const element: ElementInfo = {
        tagName: 'INPUT',
        type: 'email',
        attributes: { id: 'email-input', name: 'email' }
      };

      const selector = await webRecordingService.generateSmartSelectors(
        'test-session', 
        element, 
        { x: 100, y: 200 }
      );

      expect(selector).toEqual(mockSmartSelector);
      expect(mockSmartSelectorService.prototype.generateSmartSelectors)
        .toHaveBeenCalledWith(mockPage, element, { x: 100, y: 200 });
    });

    it('should heal broken selectors', async () => {
      const originalSelector = {
        primary: '#old-button',
        fallbacks: ['button.submit'],
        confidence: 0.8,
        strategy: 'id' as const,
        stability: 0.7,
        aiGenerated: false
      };

      const healedSelector = {
        primary: 'button.submit',
        fallbacks: ['#old-button'],
        confidence: 0.64, // Reduced confidence
        strategy: 'css' as const,
        stability: 0.7,
        aiGenerated: false
      };

      mockSmartSelectorService.prototype.healSelector = jest.fn()
        .mockResolvedValue(healedSelector) as any;

      const element: ElementInfo = {
        tagName: 'BUTTON',
        text: 'Submit',
        attributes: { class: 'submit' }
      };

      const healed = await webRecordingService.healSelector('test-session', originalSelector, element);

      expect(healed).toEqual(healedSelector);
      expect(mockSmartSelectorService.prototype.healSelector)
        .toHaveBeenCalledWith(mockPage, originalSelector, element);
    });
  });

  describe('Session Analytics', () => {
    it('should provide comprehensive session analytics', async () => {
      const config: WebRecordingConfig = {
        cloudProvider: 'browserstack'
      };

      const session = await webRecordingService.startCloudRecording('test-session', config);
      
      // Simulate some actions
      session.actions = [
        {
          id: 'action-1',
          type: 'click',
          timestamp: Date.now() - 2000
        },
        {
          id: 'action-2',
          type: 'input',
          timestamp: Date.now() - 1000
        },
        {
          id: 'action-3',
          type: 'click',
          timestamp: Date.now()
        }
      ];

      session.aiSuggestions = [{ type: 'visual', selector: 'button', expected: 'visible', confidence: 0.9, reasoning: 'test', autoGenerated: true }];
      session.parameters = [{ selector: 'input', element: { tagName: 'INPUT' }, parameterType: 'input', suggestedName: 'test', defaultValue: 'test', confidence: 0.8 }];

      const analytics = await webRecordingService.getSessionAnalytics('test-session');

      expect(analytics).toEqual({
        sessionId: 'test-session',
        duration: expect.any(Number),
        actionCount: 3,
        aiSuggestionsCount: 1,
        parametersCount: 1,
        visualBaselinesCount: 0,
        performanceMetricsCount: 0,
        cloudProvider: 'local',
        averageActionInterval: 1000
      });
    });
  });

  describe('Enhanced Export', () => {
    it('should export session with all enhanced data', async () => {
      const config: WebRecordingConfig = {
        aiFeatures: { smartSelectors: true }
      };

      const session = await webRecordingService.startCloudRecording('test-session', config);
      
      // Add some test data
      session.actions = [{ id: 'action-1', type: 'click', timestamp: Date.now() }];
      session.aiSuggestions = [{ type: 'visual', selector: 'button', expected: 'visible', confidence: 0.9, reasoning: 'test', autoGenerated: true }];

      const exported = await webRecordingService.exportEnhancedSession('test-session', 'json');

      expect(exported).toEqual({
        session: {
          id: 'test-session',
          type: 'web',
          platform: 'chrome',
          config,
          duration: undefined,
          cloudProvider: 'local'
        },
        actions: session.actions,
        aiSuggestions: session.aiSuggestions,
        parameters: [],
        visualBaselines: [],
        performanceMetrics: []
      });
    });

    it('should export session in YAML format', async () => {
      const config: WebRecordingConfig = {};
      await webRecordingService.startCloudRecording('test-session', config);

      const exported = await webRecordingService.exportEnhancedSession('test-session', 'yaml');

      expect(typeof exported).toBe('string');
      expect(exported).toContain('session:');
      expect(exported).toContain('actions:');
    });
  });

  describe('Error Handling', () => {
    it('should handle cloud session creation failure gracefully', async () => {
      mockCloudTestingService.prototype.createCloudSession = jest.fn()
        .mockRejectedValue(new Error('Cloud provider unavailable')) as any;

      const config: WebRecordingConfig = {
        cloudProvider: 'browserstack'
      };

      await expect(webRecordingService.startCloudRecording('test-session', config))
        .rejects.toThrow('Failed to start recording');
    });

    it('should handle AI service failures gracefully', async () => {
      const config: WebRecordingConfig = {
        aiFeatures: { assertionSuggestions: true }
      };

      await webRecordingService.startCloudRecording('test-session', config);

      mockAssertionSuggestionService.prototype.generateAssertionSuggestions = jest.fn()
        .mockRejectedValue(new Error('AI service unavailable')) as any;

      const action: RecordedAction = {
        id: 'action-123',
        type: 'click',
        timestamp: Date.now(),
        selector: '#button'
      };

      const suggestions = await webRecordingService.generateAIAssertions('test-session', action);

      expect(suggestions).toEqual([]);
    });

    it('should handle missing session gracefully', async () => {
      const analytics = await webRecordingService.getSessionAnalytics('non-existent-session');
      expect(analytics).toBeNull();

      await expect(webRecordingService.exportEnhancedSession('non-existent-session', 'json'))
        .rejects.toThrow('Session not found');
    });
  });

  describe('Event Emission', () => {
    it('should emit events for enhanced recording lifecycle', async () => {
      const recordingStartedSpy = jest.fn();
      const performanceCapturedSpy = jest.fn();
      const visualBaselineCapturedSpy = jest.fn();
      const aiAssertionsGeneratedSpy = jest.fn();
      const parametersDetectedSpy = jest.fn();

      webRecordingService.on('recording:started', recordingStartedSpy);
      webRecordingService.on('performance:captured', performanceCapturedSpy);
      webRecordingService.on('visual:baseline_captured', visualBaselineCapturedSpy);
      webRecordingService.on('ai:assertions_generated', aiAssertionsGeneratedSpy);
      webRecordingService.on('parameters:detected', parametersDetectedSpy);

      const config: WebRecordingConfig = {
        performance: { collectMetrics: true },
        visualTesting: { enableBaselines: true }
      };

      mockPage.evaluate.mockResolvedValue({ loadTime: 1000 });
      mockPage.screenshot.mockResolvedValue(Buffer.from('screenshot'));

      await webRecordingService.startCloudRecording('test-session', config);

      expect(recordingStartedSpy).toHaveBeenCalledWith({
        sessionId: 'test-session',
        config,
        cloudSession: expect.any(Object)
      });

      await webRecordingService.capturePerformanceMetrics(mockPage, 'test-session');
      expect(performanceCapturedSpy).toHaveBeenCalled();

      await webRecordingService.captureVisualBaseline(mockPage, 'test-session', 'action-123');
      expect(visualBaselineCapturedSpy).toHaveBeenCalled();
    });
  });
});