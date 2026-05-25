import puppeteer, { Browser, Page } from 'puppeteer';
import { WebRecordingConfig, CloudCredentials } from '../types/recording.js';
import { logger } from '../utils/logger.js';
import axios from 'axios';

export interface CloudSession {
  provider: string;
  sessionId: string;
  sessionUrl?: string;
  videoUrl?: string;
  browser?: Browser;
  page?: Page;
}

export class CloudTestingService {
  private activeSessions = new Map<string, CloudSession>();

  async createCloudSession(
    sessionId: string, 
    config: WebRecordingConfig
  ): Promise<CloudSession> {
    const provider = config.cloudProvider || 'local';
    
    if (provider === 'local') {
      return this.createLocalSession(sessionId, config);
    }

    switch (provider) {
      case 'browserstack':
        return this.createBrowserStackSession(sessionId, config);
      case 'saucelabs':
        return this.createSauceLabsSession(sessionId, config);
      case 'lambdatest':
        return this.createLambdaTestSession(sessionId, config);
      default:
        throw new Error(`Unsupported cloud provider: ${provider}`);
    }
  }

  private async createLocalSession(
    sessionId: string, 
    config: WebRecordingConfig
  ): Promise<CloudSession> {
    logger.info(`Creating local browser session for ${sessionId}`);

    const browser = await puppeteer.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--remote-debugging-port=9222',
        `--window-size=${config.viewport?.width || 1920},${config.viewport?.height || 1080}`
      ]
    });

    const page = await browser.newPage();
    await page.setViewport(config.viewport || { width: 1920, height: 1080 });

    if (config.userAgent) {
      await page.setUserAgent(config.userAgent);
    }

    if (config.geolocation) {
      await page.setGeolocation(config.geolocation);
    }

    if (config.locale) {
      await page.setExtraHTTPHeaders({
        'Accept-Language': config.locale
      });
    }

    const session: CloudSession = {
      provider: 'local',
      sessionId,
      browser,
      page
    };

    this.activeSessions.set(sessionId, session);
    return session;
  }

  private async createBrowserStackSession(
    sessionId: string, 
    config: WebRecordingConfig
  ): Promise<CloudSession> {
    const credentials = config.cloudCredentials?.browserstack;
    if (!credentials) {
      throw new Error('BrowserStack credentials not provided');
    }

    logger.info(`Creating BrowserStack session for ${sessionId}`);

    try {
      // BrowserStack capabilities
      const capabilities = {
        'bstack:options': {
          userName: credentials.username,
          accessKey: credentials.accessKey,
          projectName: credentials.project || 'Questro Testing',
          buildName: credentials.build || `Build-${Date.now()}`,
          sessionName: `Session-${sessionId}`,
          local: false,
          debug: true,
          networkLogs: true,
          consoleLogs: 'info',
          video: true,
          resolution: `${config.viewport?.width || 1920}x${config.viewport?.height || 1080}`
        },
        browserName: config.browser || 'chrome',
        browserVersion: 'latest',
        os: 'Windows',
        osVersion: '10'
      };

      // Connect to BrowserStack using WebDriver protocol
      const hubUrl = `https://${credentials.username}:${credentials.accessKey}@hub-cloud.browserstack.com/wd/hub`;
      
      // For now, we'll use puppeteer-core with a custom endpoint
      // In a full implementation, you'd use selenium-webdriver or similar
      const browser = await puppeteer.connect({
        browserWSEndpoint: `wss://cdp.browserstack.com/puppeteer?caps=${encodeURIComponent(JSON.stringify(capabilities))}`
      });

      const pages = await browser.pages();
      const page = pages[0] || await browser.newPage();

      const session: CloudSession = {
        provider: 'browserstack',
        sessionId,
        sessionUrl: `https://automate.browserstack.com/dashboard/v2/sessions/${sessionId}`,
        browser,
        page
      };

      this.activeSessions.set(sessionId, session);
      return session;
    } catch (error) {
      logger.error(`Failed to create BrowserStack session: ${error}`);
      // Fallback to local session
      return this.createLocalSession(sessionId, config);
    }
  }

  private async createSauceLabsSession(
    sessionId: string, 
    config: WebRecordingConfig
  ): Promise<CloudSession> {
    const credentials = config.cloudCredentials?.saucelabs;
    if (!credentials) {
      throw new Error('SauceLabs credentials not provided');
    }

    logger.info(`Creating SauceLabs session for ${sessionId}`);

    try {
      const capabilities = {
        browserName: config.browser || 'chrome',
        browserVersion: 'latest',
        platformName: 'Windows 10',
        'sauce:options': {
          username: credentials.username,
          accessKey: credentials.accessKey,
          name: `Questro-Session-${sessionId}`,
          build: `Build-${Date.now()}`,
          tunnelIdentifier: credentials.tunnelIdentifier,
          recordVideo: true,
          recordScreenshots: true,
          extendedDebugging: true,
          capturePerformance: true
        }
      };

      // Similar to BrowserStack, this would use WebDriver protocol
      // For now, fallback to local
      logger.warn('SauceLabs integration not fully implemented, falling back to local');
      return this.createLocalSession(sessionId, config);
    } catch (error) {
      logger.error(`Failed to create SauceLabs session: ${error}`);
      return this.createLocalSession(sessionId, config);
    }
  }

  private async createLambdaTestSession(
    sessionId: string, 
    config: WebRecordingConfig
  ): Promise<CloudSession> {
    const credentials = config.cloudCredentials?.lambdatest;
    if (!credentials) {
      throw new Error('LambdaTest credentials not provided');
    }

    logger.info(`Creating LambdaTest session for ${sessionId}`);

    try {
      const capabilities = {
        browserName: config.browser || 'chrome',
        browserVersion: 'latest',
        platform: 'Windows 10',
        'LT:Options': {
          username: credentials.username,
          accessKey: credentials.accessKey,
          name: `Questro-Session-${sessionId}`,
          build: `Build-${Date.now()}`,
          tunnel: credentials.tunnel,
          tunnelName: credentials.tunnelName,
          video: true,
          screenshot: true,
          network: true,
          console: true,
          visual: true
        }
      };

      // Similar implementation as above
      logger.warn('LambdaTest integration not fully implemented, falling back to local');
      return this.createLocalSession(sessionId, config);
    } catch (error) {
      logger.error(`Failed to create LambdaTest session: ${error}`);
      return this.createLocalSession(sessionId, config);
    }
  }

  async getSession(sessionId: string): Promise<CloudSession | null> {
    return this.activeSessions.get(sessionId) || null;
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    try {
      if (session.browser) {
        await session.browser.close();
      }
      this.activeSessions.delete(sessionId);
      logger.info(`Closed cloud session ${sessionId} on ${session.provider}`);
    } catch (error) {
      logger.error(`Failed to close session ${sessionId}: ${error}`);
    }
  }

  async getSessionVideo(sessionId: string): Promise<string | null> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    // For cloud providers, this would fetch the video URL from their APIs
    // For local sessions, we'd need to implement screen recording
    return session.videoUrl || null;
  }

  async getSessionLogs(sessionId: string): Promise<string[]> {
    const session = this.activeSessions.get(sessionId);
    if (!session?.page) return [];

    try {
      // Get console logs from the page
      const logs: string[] = [];
      session.page.on('console', (msg) => {
        logs.push(`[${msg.type()}] ${msg.text()}`);
      });
      return logs;
    } catch (error) {
      logger.error(`Failed to get session logs: ${error}`);
      return [];
    }
  }

  async listActiveSessions(): Promise<string[]> {
    return Array.from(this.activeSessions.keys());
  }

  async getProviderCapabilities(provider: string): Promise<any> {
    switch (provider) {
      case 'browserstack':
        return {
          browsers: ['chrome', 'firefox', 'safari', 'edge'],
          platforms: ['Windows 10', 'Windows 11', 'macOS Monterey', 'macOS Ventura'],
          features: ['video', 'screenshots', 'network_logs', 'console_logs', 'local_testing']
        };
      case 'saucelabs':
        return {
          browsers: ['chrome', 'firefox', 'safari', 'edge'],
          platforms: ['Windows 10', 'macOS', 'Linux'],
          features: ['video', 'screenshots', 'performance', 'extended_debugging']
        };
      case 'lambdatest':
        return {
          browsers: ['chrome', 'firefox', 'safari', 'edge'],
          platforms: ['Windows 10', 'macOS', 'Linux'],
          features: ['video', 'screenshots', 'network', 'console', 'visual_testing']
        };
      default:
        return {};
    }
  }
}

export const cloudTestingService = new CloudTestingService();