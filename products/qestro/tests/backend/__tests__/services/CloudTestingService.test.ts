import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CloudTestingService } from '../../../../backend/src/services/CloudTestingService';
import { WebRecordingConfig } from '../../../../backend/src/types/recording';

// Mock puppeteer
jest.mock('puppeteer', () => ({
  launch: jest.fn(),
  connect: jest.fn()
}));

const mockPuppeteer = require('puppeteer');

describe('CloudTestingService', () => {
  let cloudTestingService: CloudTestingService;
  let mockBrowser: any;
  let mockPage: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPage = {
      setViewport: jest.fn(),
      setUserAgent: jest.fn(),
      setGeolocation: jest.fn(),
      setExtraHTTPHeaders: jest.fn(),
      on: jest.fn(),
      goto: jest.fn(),
      screenshot: jest.fn(),
      evaluate: jest.fn()
    };

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      pages: jest.fn().mockResolvedValue([mockPage]),
      close: jest.fn()
    } as any;

    mockPuppeteer.launch.mockResolvedValue(mockBrowser);
    mockPuppeteer.connect.mockResolvedValue(mockBrowser);

    cloudTestingService = new CloudTestingService();
  });

  afterEach(async () => {
    // Clean up any active sessions
    const activeSessions = await cloudTestingService.listActiveSessions();
    for (const sessionId of activeSessions) {
      await cloudTestingService.closeSession(sessionId);
    }
  });

  describe('Local Session Creation', () => {
    it('should create a local browser session', async () => {
      const config: WebRecordingConfig = {
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Custom User Agent',
        geolocation: { latitude: 37.7749, longitude: -122.4194 },
        locale: 'en-US'
      };

      const session = await cloudTestingService.createCloudSession('test-session', config);

      expect(session).toEqual({
        provider: 'local',
        sessionId: 'test-session',
        browser: mockBrowser,
        page: mockPage
      });

      expect(mockPuppeteer.launch).toHaveBeenCalledWith({
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--remote-debugging-port=9222',
          '--window-size=1920,1080'
        ]
      });

      expect(mockPage.setViewport).toHaveBeenCalledWith({ width: 1920, height: 1080 });
      expect(mockPage.setUserAgent).toHaveBeenCalledWith('Custom User Agent');
      expect(mockPage.setGeolocation).toHaveBeenCalledWith({ latitude: 37.7749, longitude: -122.4194 });
      expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalledWith({
        'Accept-Language': 'en-US'
      });
    });

    it('should use default viewport when not specified', async () => {
      const config: WebRecordingConfig = {};

      await cloudTestingService.createCloudSession('test-session', config);

      expect(mockPage.setViewport).toHaveBeenCalledWith({ width: 1920, height: 1080 });
    });
  });

  describe('BrowserStack Integration', () => {
    it('should attempt to create BrowserStack session', async () => {
      const config: WebRecordingConfig = {
        cloudProvider: 'browserstack',
        cloudCredentials: {
          browserstack: {
            username: 'test-user',
            accessKey: 'test-key',
            project: 'Test Project',
            build: 'Test Build'
          }
        },
        browser: 'chrome',
        viewport: { width: 1920, height: 1080 }
      };

      // Mock BrowserStack connection failure to test fallback
      mockPuppeteer.connect.mockRejectedValue(new Error('BrowserStack connection failed'));

      const session = await cloudTestingService.createCloudSession('test-session', config);

      // Should fallback to local session
      expect(session.provider).toBe('local');
      expect(mockPuppeteer.connect).toHaveBeenCalledWith({
        browserWSEndpoint: expect.stringContaining('wss://cdp.browserstack.com/puppeteer')
      });
    });

    it('should create BrowserStack session successfully', async () => {
      const config: WebRecordingConfig = {
        cloudProvider: 'browserstack',
        cloudCredentials: {
          browserstack: {
            username: 'test-user',
            accessKey: 'test-key'
          }
        }
      };

      // Mock successful BrowserStack connection
      mockPuppeteer.connect.mockResolvedValue(mockBrowser);

      const session = await cloudTestingService.createCloudSession('test-session', config);

      expect(session).toEqual({
        provider: 'browserstack',
        sessionId: 'test-session',
        sessionUrl: 'https://automate.browserstack.com/dashboard/v2/sessions/test-session',
        browser: mockBrowser,
        page: mockPage
      });
    });
  });

  describe('SauceLabs Integration', () => {
    it('should fallback to local for SauceLabs (not fully implemented)', async () => {
      const config: WebRecordingConfig = {
        cloudProvider: 'saucelabs',
        cloudCredentials: {
          saucelabs: {
            username: 'test-user',
            accessKey: 'test-key',
            tunnelIdentifier: 'test-tunnel'
          }
        }
      };

      const session = await cloudTestingService.createCloudSession('test-session', config);

      // Should fallback to local session since SauceLabs is not fully implemented
      expect(session.provider).toBe('local');
    });
  });

  describe('LambdaTest Integration', () => {
    it('should fallback to local for LambdaTest (not fully implemented)', async () => {
      const config: WebRecordingConfig = {
        cloudProvider: 'lambdatest',
        cloudCredentials: {
          lambdatest: {
            username: 'test-user',
            accessKey: 'test-key',
            tunnel: true,
            tunnelName: 'test-tunnel'
          }
        }
      };

      const session = await cloudTestingService.createCloudSession('test-session', config);

      // Should fallback to local session since LambdaTest is not fully implemented
      expect(session.provider).toBe('local');
    });
  });

  describe('Session Management', () => {
    it('should track active sessions', async () => {
      const config: WebRecordingConfig = {};

      await cloudTestingService.createCloudSession('session-1', config);
      await cloudTestingService.createCloudSession('session-2', config);

      const activeSessions = await cloudTestingService.listActiveSessions();
      expect(activeSessions).toContain('session-1');
      expect(activeSessions).toContain('session-2');
      expect(activeSessions).toHaveLength(2);
    });

    it('should retrieve existing session', async () => {
      const config: WebRecordingConfig = {};
      const createdSession = await cloudTestingService.createCloudSession('test-session', config);

      const retrievedSession = await cloudTestingService.getSession('test-session');
      expect(retrievedSession).toEqual(createdSession);
    });

    it('should return null for non-existent session', async () => {
      const session = await cloudTestingService.getSession('non-existent');
      expect(session).toBeNull();
    });

    it('should close session and clean up resources', async () => {
      const config: WebRecordingConfig = {};
      await cloudTestingService.createCloudSession('test-session', config);

      await cloudTestingService.closeSession('test-session');

      expect(mockBrowser.close).toHaveBeenCalled();
      
      const session = await cloudTestingService.getSession('test-session');
      expect(session).toBeNull();
    });

    it('should handle closing non-existent session gracefully', async () => {
      await expect(cloudTestingService.closeSession('non-existent'))
        .resolves.not.toThrow();
    });
  });

  describe('Session Features', () => {
    beforeEach(async () => {
      const config: WebRecordingConfig = {};
      await cloudTestingService.createCloudSession('test-session', config);
    });

    it('should return null for session video (not implemented for local)', async () => {
      const videoUrl = await cloudTestingService.getSessionVideo('test-session');
      expect(videoUrl).toBeNull();
    });

    it('should get session logs', async () => {
      const logs = await cloudTestingService.getSessionLogs('test-session');
      expect(Array.isArray(logs)).toBe(true);
    });

    it('should return empty logs for non-existent session', async () => {
      const logs = await cloudTestingService.getSessionLogs('non-existent');
      expect(logs).toEqual([]);
    });
  });

  describe('Provider Capabilities', () => {
    it('should return BrowserStack capabilities', async () => {
      const capabilities = await cloudTestingService.getProviderCapabilities('browserstack');
      
      expect(capabilities).toEqual({
        browsers: ['chrome', 'firefox', 'safari', 'edge'],
        platforms: ['Windows 10', 'Windows 11', 'macOS Monterey', 'macOS Ventura'],
        features: ['video', 'screenshots', 'network_logs', 'console_logs', 'local_testing']
      });
    });

    it('should return SauceLabs capabilities', async () => {
      const capabilities = await cloudTestingService.getProviderCapabilities('saucelabs');
      
      expect(capabilities).toEqual({
        browsers: ['chrome', 'firefox', 'safari', 'edge'],
        platforms: ['Windows 10', 'macOS', 'Linux'],
        features: ['video', 'screenshots', 'performance', 'extended_debugging']
      });
    });

    it('should return LambdaTest capabilities', async () => {
      const capabilities = await cloudTestingService.getProviderCapabilities('lambdatest');
      
      expect(capabilities).toEqual({
        browsers: ['chrome', 'firefox', 'safari', 'edge'],
        platforms: ['Windows 10', 'macOS', 'Linux'],
        features: ['video', 'screenshots', 'network', 'console', 'visual_testing']
      });
    });

    it('should return empty capabilities for unknown provider', async () => {
      const capabilities = await cloudTestingService.getProviderCapabilities('unknown');
      expect(capabilities).toEqual({});
    });
  });

  describe('Error Handling', () => {
    it('should handle browser launch failure', async () => {
      mockPuppeteer.launch.mockRejectedValue(new Error('Browser launch failed'));

      const config: WebRecordingConfig = {};

      await expect(cloudTestingService.createCloudSession('test-session', config))
        .rejects.toThrow('Browser launch failed');
    });

    it('should handle missing credentials for cloud providers', async () => {
      const config: WebRecordingConfig = {
        cloudProvider: 'browserstack'
        // Missing cloudCredentials
      };

      await expect(cloudTestingService.createCloudSession('test-session', config))
        .rejects.toThrow('BrowserStack credentials not provided');
    });

    it('should handle browser close failure gracefully', async () => {
      const config: WebRecordingConfig = {};
      await cloudTestingService.createCloudSession('test-session', config);

      mockBrowser.close.mockRejectedValue(new Error('Close failed'));

      // Should not throw
      await expect(cloudTestingService.closeSession('test-session'))
        .resolves.not.toThrow();
    });
  });

  describe('Unsupported Provider', () => {
    it('should throw error for unsupported cloud provider', async () => {
      const config: WebRecordingConfig = {
        cloudProvider: 'unsupported' as any
      };

      await expect(cloudTestingService.createCloudSession('test-session', config))
        .rejects.toThrow('Unsupported cloud provider: unsupported');
    });
  });
});