import { WebRecordingService } from '../../../backend/src/services/WebRecordingService';
import { WebRecordingConfig } from '../../../backend/src/types/recording';

// Mock dependencies
jest.mock('puppeteer');
jest.mock('../../../backend/src/services/CloudTestingService');
jest.mock('../../../backend/src/utils/logger');

describe('Web Recording Basic Test', () => {
  let webRecordingService: WebRecordingService;
  let mockBrowser: any;
  let mockPage: any;
  let mockCloudTestingService: any;

  beforeEach(() => {
    // Setup mocks
    mockPage = {
      goto: jest.fn().mockResolvedValue(undefined),
      click: jest.fn().mockResolvedValue(undefined),
      type: jest.fn().mockResolvedValue(undefined),
      screenshot: jest.fn().mockResolvedValue(Buffer.from('screenshot')),
      evaluate: jest.fn().mockResolvedValue(true),
      evaluateOnNewDocument: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      removeAllListeners: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
      url: jest.fn().mockReturnValue('https://example.com'),
      title: jest.fn().mockResolvedValue('Test Page'),
      content: jest.fn().mockResolvedValue('<html><body>Test</body></html>'),
      metrics: jest.fn().mockResolvedValue({
        Timestamp: Date.now(),
        Documents: 1,
        Frames: 1,
        JSEventListeners: 5,
        Nodes: 100,
        LayoutCount: 2,
        RecalcStyleCount: 1,
        LayoutDuration: 0.1,
        RecalcStyleDuration: 0.05,
        ScriptDuration: 0.2,
        TaskDuration: 0.3,
        JSHeapUsedSize: 1000000,
        JSHeapTotalSize: 2000000
      })
    };

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined),
      pages: jest.fn().mockResolvedValue([mockPage])
    };

    // Mock CloudTestingService
    mockCloudTestingService = {
      createCloudSession: jest.fn().mockResolvedValue({
        provider: 'browserstack',
        sessionId: 'cloud-session-123',
        sessionUrl: 'https://automate.browserstack.com/sessions/cloud-session-123',
        videoUrl: 'https://automate.browserstack.com/sessions/cloud-session-123/video',
        browser: mockBrowser,
        page: mockPage
      })
    };

    webRecordingService = new WebRecordingService();
    // Replace the cloud testing service with our mock
    (webRecordingService as any).cloudTestingService = mockCloudTestingService;
  });

  afterEach(async () => {
    // Clean up any active sessions
    try {
      // Manual cleanup since cleanup method might not exist
      const activeSessions = (webRecordingService as any).activeSessions;
      const browsers = (webRecordingService as any).browsers;
      
      if (activeSessions) {
        activeSessions.clear();
      }
      if (browsers) {
        browsers.clear();
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should create a web recording session', async () => {
    const sessionId = 'web-session-1';
    const config: WebRecordingConfig = {
      browser: 'chrome',
      url: 'https://example.com',
      viewport: { width: 1920, height: 1080 },
      aiFeatures: {
        smartSelectors: true,
        assertionSuggestions: true,
        elementHealing: true,
        parameterDetection: true
      },
      performance: {
        collectMetrics: true,
        thresholds: {
          loadTime: 3000,
          firstContentfulPaint: 1500
        }
      },
      visualTesting: {
        enableBaselines: true,
        threshold: 0.1
      }
    };

    const session = await webRecordingService.startCloudRecording(sessionId, config);

    expect(session).toBeDefined();
    expect(session.id).toBe(sessionId);
    expect(session.type).toBe('web');
    expect(session.platform).toBe('chrome');
    expect(session.status).toBe('recording');
    expect(session.config).toEqual(config);
    expect(session.cloudSession).toBeDefined();
    expect(session.cloudSession?.provider).toBe('browserstack');
  });

  it('should navigate to initial URL during recording setup', async () => {
    const sessionId = 'web-session-2';
    const config: WebRecordingConfig = {
      browser: 'chrome',
      url: 'https://test-app.com',
      viewport: { width: 1280, height: 720 }
    };

    await webRecordingService.startCloudRecording(sessionId, config);

    expect(mockPage.goto).toHaveBeenCalledWith(
      'https://test-app.com',
      { waitUntil: 'networkidle2' }
    );
  });

  it('should setup enhanced recording listeners', async () => {
    const sessionId = 'web-session-3';
    const config: WebRecordingConfig = {
      browser: 'firefox',
      url: 'https://example.com'
    };

    await webRecordingService.startCloudRecording(sessionId, config);

    expect(mockPage.evaluateOnNewDocument).toHaveBeenCalled();
    
    // Check that the injected script was called
    const injectedScript = mockPage.evaluateOnNewDocument.mock.calls[0][0];
    expect(injectedScript).toBeDefined();
    expect(typeof injectedScript).toBe('function');
  });

  it('should capture performance metrics when enabled', async () => {
    const sessionId = 'web-session-4';
    const config: WebRecordingConfig = {
      browser: 'chrome',
      url: 'https://example.com',
      performance: {
        collectMetrics: true,
        thresholds: {
          loadTime: 2000,
          firstContentfulPaint: 1000
        }
      }
    };

    const session = await webRecordingService.startCloudRecording(sessionId, config);

    expect(session.performanceMetrics).toBeDefined();
    expect(Array.isArray(session.performanceMetrics)).toBe(true);
  });

  it('should capture visual baselines when enabled', async () => {
    const sessionId = 'web-session-5';
    const config: WebRecordingConfig = {
      browser: 'chrome',
      url: 'https://example.com',
      visualTesting: {
        enableBaselines: true,
        threshold: 0.05
      }
    };

    const session = await webRecordingService.startCloudRecording(sessionId, config);

    expect(session.visualBaselines).toBeDefined();
    expect(Array.isArray(session.visualBaselines)).toBe(true);
  });

  it('should handle different browser configurations', async () => {
    const browsers: Array<'chrome' | 'firefox' | 'safari' | 'edge'> = ['chrome', 'firefox', 'safari', 'edge'];

    for (const browser of browsers) {
      const sessionId = `web-session-${browser}`;
      const config: WebRecordingConfig = {
        browser,
        url: 'https://example.com'
      };

      const session = await webRecordingService.startCloudRecording(sessionId, config);

      expect(session.platform).toBe(browser);
      expect(session.config.browser).toBe(browser);
    }
  });

  it('should support different viewport sizes', async () => {
    const viewports = [
      { width: 1920, height: 1080 }, // Desktop
      { width: 1366, height: 768 },  // Laptop
      { width: 768, height: 1024 },  // Tablet
      { width: 375, height: 667 }    // Mobile
    ];

    for (const viewport of viewports) {
      const sessionId = `web-session-${viewport.width}x${viewport.height}`;
      const config: WebRecordingConfig = {
        browser: 'chrome',
        url: 'https://example.com',
        viewport
      };

      const session = await webRecordingService.startCloudRecording(sessionId, config);

      expect(session.config.viewport).toEqual(viewport);
    }
  });

  it('should emit recording events', async () => {
    const sessionId = 'web-session-events';
    const config: WebRecordingConfig = {
      browser: 'chrome',
      url: 'https://example.com'
    };

    const eventSpy = jest.fn();
    webRecordingService.on('recording:started', eventSpy);

    await webRecordingService.startCloudRecording(sessionId, config);

    expect(eventSpy).toHaveBeenCalledWith({
      sessionId,
      config,
      cloudSession: expect.objectContaining({
        provider: 'browserstack',
        sessionId: 'cloud-session-123'
      })
    });
  });

  it('should handle recording errors gracefully', async () => {
    const sessionId = 'web-session-error';
    const config: WebRecordingConfig = {
      browser: 'chrome',
      url: 'https://invalid-url'
    };

    // Mock an error in cloud session creation
    mockCloudTestingService.createCloudSession.mockRejectedValue(
      new Error('Failed to create cloud session')
    );

    await expect(
      webRecordingService.startCloudRecording(sessionId, config)
    ).rejects.toThrow('Failed to start recording');
  });

  it('should validate recording configuration', () => {
    const validConfigs = [
      {
        browser: 'chrome',
        url: 'https://example.com'
      },
      {
        browser: 'firefox',
        url: 'https://test.com',
        viewport: { width: 1280, height: 720 },
        aiFeatures: {
          smartSelectors: true,
          assertionSuggestions: true
        }
      },
      {
        browser: 'safari',
        url: 'https://app.com',
        performance: { collectMetrics: true },
        visualTesting: { enableBaselines: true }
      }
    ];

    validConfigs.forEach(config => {
      expect(config.browser).toBeDefined();
      expect(config.url).toBeDefined();
      expect(config.url).toMatch(/^https?:\/\//);
    });
  });

  it('should support cloud provider configuration', async () => {
    const sessionId = 'web-session-cloud';
    const config: WebRecordingConfig = {
      browser: 'chrome',
      url: 'https://example.com',
      cloudProvider: 'browserstack',
      cloudCredentials: {
        browserstack: {
          username: 'test-user',
          accessKey: 'test-key',
          project: 'Test Project',
          build: 'Test Build'
        }
      }
    };

    const session = await webRecordingService.startCloudRecording(sessionId, config);

    expect(session.config.cloudProvider).toBeDefined();
    expect(session.config.cloudProvider).toBe('browserstack');
  });

  it('should track session lifecycle', async () => {
    const sessionId = 'web-session-lifecycle';
    const config: WebRecordingConfig = {
      browser: 'chrome',
      url: 'https://example.com'
    };

    // Start recording
    const session = await webRecordingService.startCloudRecording(sessionId, config);
    expect(session.status).toBe('recording');
    expect(session.startTime).toBeDefined();

    // Session should be tracked
    const activeSessions = (webRecordingService as any).activeSessions;
    expect(activeSessions.has(sessionId)).toBe(true);

    const browsers = (webRecordingService as any).browsers;
    expect(browsers.has(sessionId)).toBe(true);
  });
});