import { jest } from '@jest/globals';
import { WebRecordingService } from '../../../../backend/src/services/WebRecordingService.js';

// Mock Puppeteer
const mockPuppeteer = {
  launch: jest.fn(),
  connect: jest.fn(),
};

const mockBrowser = {
  newPage: jest.fn(),
  close: jest.fn(),
  pages: jest.fn(),
};

const mockPage = {
  goto: jest.fn(),
  click: jest.fn(),
  type: jest.fn(),
  screenshot: jest.fn(),
  evaluate: jest.fn(),
  on: jest.fn(),
  waitForSelector: jest.fn(),
  waitForNavigation: jest.fn(),
  close: jest.fn(),
  url: jest.fn(),
  title: jest.fn(),
};

jest.mock('puppeteer', () => ({
  default: mockPuppeteer,
}));

// Mock database
const mockDb = {
  query: jest.fn(),
  execute: jest.fn(),
};

jest.mock('../../../../backend/src/config/database.js', () => ({
  db: mockDb,
}));

// Mock AI service
const mockAIService = {
  generateTestCode: jest.fn(),
  analyzeCode: jest.fn(),
};

jest.mock('../../../../backend/src/services/AIService.js', () => ({
  AIService: jest.fn(() => mockAIService),
}));

describe('WebRecordingService', () => {
  let webRecordingService: WebRecordingService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockPuppeteer.launch.mockResolvedValue(mockBrowser);
    mockBrowser.newPage.mockResolvedValue(mockPage);
    mockPage.goto.mockResolvedValue();
    mockPage.screenshot.mockResolvedValue(Buffer.from('screenshot'));
    
    webRecordingService = new WebRecordingService();
  });

  afterEach(async () => {
    await webRecordingService.cleanup();
  });

  describe('startRecording', () => {
    it('should start a web recording session', async () => {
      const config = {
        url: 'https://example.com',
        viewport: { width: 1920, height: 1080 },
        headless: false
      };

      const session = await webRecordingService.startRecording(config);

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.url).toBe('https://example.com');
      expect(session.status).toBe('recording');
      expect(session.startTime).toBeInstanceOf(Date);
      expect(mockPuppeteer.launch).toHaveBeenCalledWith({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
        waitUntil: 'networkidle2'
      });
    });

    it('should handle recording start errors', async () => {
      mockPuppeteer.launch.mockRejectedValue(new Error('Browser launch failed'));

      const config = {
        url: 'https://example.com',
        viewport: { width: 1920, height: 1080 }
      };

      await expect(webRecordingService.startRecording(config))
        .rejects.toThrow('Browser launch failed');
    });
  });

  describe('recordAction', () => {
    it('should record a click action', async () => {
      const sessionId = 'session_123';
      const action = {
        type: 'click',
        selector: '#login-button',
        timestamp: Date.now()
      };

      mockPage.evaluate.mockResolvedValue(true);
      mockPage.screenshot.mockResolvedValue(Buffer.from('screenshot'));

      const result = await webRecordingService.recordAction(sessionId, action);

      expect(result).toBeDefined();
      expect(result.type).toBe('click');
      expect(result.selector).toBe('#login-button');
      expect(result.screenshot).toBeDefined();
      expect(mockPage.click).toHaveBeenCalledWith('#login-button');
    });

    it('should record a type action', async () => {
      const sessionId = 'session_123';
      const action = {
        type: 'type',
        selector: '#email',
        value: 'test@example.com',
        timestamp: Date.now()
      };

      mockPage.evaluate.mockResolvedValue(true);
      mockPage.screenshot.mockResolvedValue(Buffer.from('screenshot'));

      const result = await webRecordingService.recordAction(sessionId, action);

      expect(result).toBeDefined();
      expect(result.type).toBe('type');
      expect(result.selector).toBe('#email');
      expect(result.value).toBe('test@example.com');
      expect(mockPage.type).toHaveBeenCalledWith('#email', 'test@example.com');
    });

    it('should handle action recording errors', async () => {
      const sessionId = 'session_123';
      const action = {
        type: 'click',
        selector: '#non-existent',
        timestamp: Date.now()
      };

      mockPage.click.mockRejectedValue(new Error('Element not found'));

      await expect(webRecordingService.recordAction(sessionId, action))
        .rejects.toThrow('Element not found');
    });
  });

  describe('stopRecording', () => {
    it('should stop recording and save session', async () => {
      const sessionId = 'session_123';
      const mockSession = {
        id: sessionId,
        url: 'https://example.com',
        actions: [
          { type: 'click', selector: '#button' },
          { type: 'type', selector: '#input', value: 'test' }
        ]
      };

      mockDb.execute.mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await webRecordingService.stopRecording(sessionId);

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.endTime).toBeInstanceOf(Date);
      expect(mockBrowser.close).toHaveBeenCalled();
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO web_recordings'),
        expect.arrayContaining([sessionId, 'https://example.com'])
      );
    });

    it('should handle stop recording errors', async () => {
      const sessionId = 'session_123';
      mockBrowser.close.mockRejectedValue(new Error('Close failed'));

      await expect(webRecordingService.stopRecording(sessionId))
        .rejects.toThrow('Close failed');
    });
  });

  describe('generateTest', () => {
    it('should generate test code from recorded actions', async () => {
      const sessionId = 'session_123';
      const mockTestCode = `
        describe('Web Test', () => {
          it('should perform recorded actions', async () => {
            await page.goto('https://example.com');
            await page.click('#login-button');
            await page.type('#email', 'test@example.com');
          });
        });
      `;

      mockDb.query.mockResolvedValue({
        rows: [{
          id: sessionId,
          url: 'https://example.com',
          actions: JSON.stringify([
            { type: 'click', selector: '#login-button' },
            { type: 'type', selector: '#email', value: 'test@example.com' }
          ])
        }]
      });

      mockAIService.generateTestCode.mockResolvedValue(mockTestCode);

      const result = await webRecordingService.generateTest(sessionId, {
        framework: 'jest',
        language: 'typescript'
      });

      expect(result).toBeDefined();
      expect(result.code).toBe(mockTestCode);
      expect(result.framework).toBe('jest');
      expect(result.language).toBe('typescript');
      expect(mockAIService.generateTestCode).toHaveBeenCalledWith({
        description: expect.stringContaining('Web recording session'),
        platform: 'web',
        framework: 'jest',
        language: 'typescript',
        actions: expect.arrayContaining([
          expect.objectContaining({ type: 'click', selector: '#login-button' }),
          expect.objectContaining({ type: 'type', selector: '#email', value: 'test@example.com' })
        ])
      });
    });

    it('should handle test generation errors', async () => {
      const sessionId = 'session_123';
      mockDb.query.mockResolvedValue({ rows: [] });

      await expect(webRecordingService.generateTest(sessionId, {
        framework: 'jest',
        language: 'typescript'
      })).rejects.toThrow('Session not found');
    });
  });

  describe('getSession', () => {
    it('should retrieve recording session by ID', async () => {
      const sessionId = 'session_123';
      const mockSession = {
        id: sessionId,
        url: 'https://example.com',
        status: 'completed',
        actions: JSON.stringify([
          { type: 'click', selector: '#button' }
        ])
      };

      mockDb.query.mockResolvedValue({ rows: [mockSession] });

      const result = await webRecordingService.getSession(sessionId);

      expect(result).toBeDefined();
      expect(result.id).toBe(sessionId);
      expect(result.url).toBe('https://example.com');
      expect(result.status).toBe('completed');
      expect(result.actions).toHaveLength(1);
    });

    it('should return null for non-existent session', async () => {
      const sessionId = 'session_123';
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await webRecordingService.getSession(sessionId);

      expect(result).toBeNull();
    });
  });

  describe('listSessions', () => {
    it('should list all recording sessions for user', async () => {
      const userId = 'user_123';
      const mockSessions = [
        { id: 'session_1', url: 'https://example1.com', status: 'completed' },
        { id: 'session_2', url: 'https://example2.com', status: 'recording' }
      ];

      mockDb.query.mockResolvedValue({ rows: mockSessions });

      const result = await webRecordingService.listSessions(userId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('session_1');
      expect(result[1].id).toBe('session_2');
    });
  });

  describe('deleteSession', () => {
    it('should delete recording session', async () => {
      const sessionId = 'session_123';
      mockDb.execute.mockResolvedValue({ rows: [{ id: 1 }] });

      await webRecordingService.deleteSession(sessionId);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM web_recordings'),
        [sessionId]
      );
    });
  });

  describe('validateSelector', () => {
    it('should validate CSS selector', async () => {
      const selector = '#valid-selector';
      mockPage.evaluate.mockResolvedValue(true);

      const result = await webRecordingService.validateSelector(selector);

      expect(result).toBe(true);
      expect(mockPage.evaluate).toHaveBeenCalledWith(
        expect.stringContaining('document.querySelector'),
        selector
      );
    });

    it('should return false for invalid selector', async () => {
      const selector = '#invalid-selector';
      mockPage.evaluate.mockResolvedValue(false);

      const result = await webRecordingService.validateSelector(selector);

      expect(result).toBe(false);
    });
  });

  describe('takeScreenshot', () => {
    it('should take screenshot of current page', async () => {
      const sessionId = 'session_123';
      const screenshotBuffer = Buffer.from('screenshot data');
      mockPage.screenshot.mockResolvedValue(screenshotBuffer);

      const result = await webRecordingService.takeScreenshot(sessionId);

      expect(result).toBeDefined();
      expect(result).toEqual(screenshotBuffer);
      expect(mockPage.screenshot).toHaveBeenCalledWith({
        fullPage: true,
        type: 'png'
      });
    });
  });
});

