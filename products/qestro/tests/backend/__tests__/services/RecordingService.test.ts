import { RecordingService, RecordingConfig } from '../../../../backend/src/services/RecordingService.js';
import { EventEmitter } from 'events';
import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('child_process');
jest.mock('../../../../backend/src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockSpawn = jest.fn();

jest.unstable_mockModule('child_process', () => ({
  spawn: mockSpawn
}));

describe('RecordingService', () => {
  let recordingService: RecordingService;
  let mockProcess: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock child process
    mockProcess = {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      on: jest.fn(),
      kill: jest.fn()
    };
    
    mockSpawn.mockReturnValue(mockProcess);
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue('test file content');
    mockFs.readdir.mockResolvedValue([]);
    
    recordingService = new RecordingService('./test-recordings');
  });

  afterEach(async () => {
    await recordingService.cleanup();
  });

  describe('startRecording', () => {
    it('should start a mobile recording session', async () => {
      const config: RecordingConfig = {
        type: 'mobile',
        platform: 'ios',
        metadata: {
          deviceName: 'iPhone 15 Pro',
          appId: 'com.test.app'
        }
      };

      const session = await recordingService.startRecording(config);

      expect(session.id).toBeDefined();
      expect(session.type).toBe('mobile');
      expect(session.status).toBe('recording');
      expect(session.platform).toBe('ios');
      expect(session.metadata.deviceName).toBe('iPhone 15 Pro');
      expect(session.metadata.appId).toBe('com.test.app');
      expect(session.startTime).toBeInstanceOf(Date);
      expect(session.actions).toEqual([]);
    });

    it('should start a web recording session', async () => {
      const config: RecordingConfig = {
        type: 'web',
        platform: 'chrome',
        metadata: {
          url: 'https://example.com',
          viewport: { width: 1920, height: 1080 }
        }
      };

      const session = await recordingService.startRecording(config);

      expect(session.type).toBe('web');
      expect(session.platform).toBe('chrome');
      expect(session.metadata.url).toBe('https://example.com');
      expect(session.metadata.viewport).toEqual({ width: 1920, height: 1080 });
    });

    it('should create output directory', async () => {
      const config: RecordingConfig = {
        type: 'mobile',
        platform: 'ios',
        metadata: {}
      };

      await recordingService.startRecording(config);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('./test-recordings'),
        { recursive: true }
      );
    });

    it('should spawn maestro process for mobile recording', async () => {
      const config: RecordingConfig = {
        type: 'mobile',
        platform: 'ios',
        metadata: {
          deviceName: 'iPhone 15 Pro',
          appId: 'com.test.app'
        }
      };

      await recordingService.startRecording(config);

      expect(mockSpawn).toHaveBeenCalledWith('maestro', [
        'record',
        '--output', expect.stringMatching(/recording\.yaml$/),
        '--format', 'yaml',
        '--platform', 'ios',
        '--device', 'iPhone 15 Pro',
        '--app-id', 'com.test.app'
      ], expect.any(Object));
    });

    it('should spawn workflow-use process for web recording', async () => {
      const config: RecordingConfig = {
        type: 'web',
        platform: 'chrome',
        metadata: {
          url: 'https://example.com',
          viewport: { width: 1920, height: 1080 }
        }
      };

      await recordingService.startRecording(config);

      expect(mockSpawn).toHaveBeenCalledWith('workflow-use', [
        'record',
        '--output', expect.stringMatching(/workflow\.yaml$/),
        '--browser', 'chrome',
        '--url', 'https://example.com',
        '--viewport', '1920x1080'
      ], expect.any(Object));
    });

    it('should emit recording:started event', async () => {
      const config: RecordingConfig = {
        type: 'mobile',
        platform: 'ios',
        metadata: {}
      };

      const eventSpy = jest.fn();
      recordingService.on('recording:started', eventSpy);

      const session = await recordingService.startRecording(config);

      expect(eventSpy).toHaveBeenCalledWith(session);
    });

    it('should handle process spawn error', async () => {
      const config: RecordingConfig = {
        type: 'mobile',
        platform: 'ios',
        metadata: {}
      };

      mockSpawn.mockImplementation(() => {
        throw new Error('Failed to spawn maestro');
      });

      await expect(recordingService.startRecording(config)).rejects.toThrow('Failed to spawn maestro');
    });
  });

  describe('stopRecording', () => {
    it('should stop active recording session', async () => {
      const config: RecordingConfig = {
        type: 'mobile',
        platform: 'ios',
        metadata: {}
      };

      const session = await recordingService.startRecording(config);
      
      // Simulate some actions
      session.actions.push({
        id: 'action-1',
        type: 'tap',
        timestamp: Date.now(),
        coordinates: { x: 100, y: 200 }
      });

      const stoppedSession = await recordingService.stopRecording(session.id);

      expect(stoppedSession.status).toBe('completed');
      expect(stoppedSession.endTime).toBeInstanceOf(Date);
      expect(stoppedSession.duration).toBeGreaterThan(0);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should throw error for non-existent session', async () => {
      await expect(recordingService.stopRecording('non-existent'))
        .rejects.toThrow('Session non-existent not found');
    });

    it('should throw error for session not currently recording', async () => {
      const config: RecordingConfig = {
        type: 'mobile',
        platform: 'ios',
        metadata: {}
      };

      const session = await recordingService.startRecording(config);
      await recordingService.stopRecording(session.id);

      // Try to stop again
      await expect(recordingService.stopRecording(session.id))
        .rejects.toThrow(`Session ${session.id} is not currently recording`);
    });

    it('should emit recording:completed event', async () => {
      const config: RecordingConfig = {
        type: 'mobile',
        platform: 'ios',
        metadata: {}
      };

      const eventSpy = jest.fn();
      recordingService.on('recording:completed', eventSpy);

      const session = await recordingService.startRecording(config);
      const stoppedSession = await recordingService.stopRecording(session.id);

      expect(eventSpy).toHaveBeenCalledWith(stoppedSession);
    });
  });

  describe('exportSession', () => {
    it('should export session to Maestro format', async () => {
      const session = await createTestSession();
      session.actions = [
        {
          id: '1',
          type: 'tap',
          timestamp: Date.now(),
          coordinates: { x: 100, y: 200 },
          element: 'Submit Button'
        },
        {
          id: '2',
          type: 'type',
          timestamp: Date.now(),
          text: 'test input'
        }
      ];

      const exported = await recordingService.exportSession(session.id, 'maestro');

      expect(exported).toContain('# TestFlow Pro - Generated Maestro Test');
      expect(exported).toContain('appId: com.test.app');
      expect(exported).toContain('- tapOn:');
      expect(exported).toContain('point: 100,200');
      expect(exported).toContain('element: "Submit Button"');
      expect(exported).toContain('- inputText: "test input"');
    });

    it('should export session to workflow-use format', async () => {
      const session = await createTestSession('web');
      session.actions = [
        {
          id: '1',
          type: 'tap',
          timestamp: Date.now(),
          selector: 'button[data-testid="submit"]'
        },
        {
          id: '2',
          type: 'type',
          timestamp: Date.now(),
          text: 'test@example.com',
          selector: 'input[type="email"]'
        }
      ];

      const exported = await recordingService.exportSession(session.id, 'workflow-use');

      expect(exported).toContain('# TestFlow Pro - Generated workflow-use Test');
      expect(exported).toContain('name: "Recorded Web Test"');
      expect(exported).toContain('url: "https://example.com"');
      expect(exported).toContain('steps:');
      expect(exported).toContain('- click:');
      expect(exported).toContain('selector: "button[data-testid=\'submit\']"');
      expect(exported).toContain('- type:');
      expect(exported).toContain('text: "test@example.com"');
    });

    it('should export session to JSON format', async () => {
      const session = await createTestSession();
      session.actions = [
        {
          id: '1',
          type: 'tap',
          timestamp: Date.now(),
          coordinates: { x: 100, y: 200 }
        }
      ];

      const exported = await recordingService.exportSession(session.id, 'json');
      const parsed = JSON.parse(exported);

      expect(parsed.id).toBe(session.id);
      expect(parsed.type).toBe('mobile');
      expect(parsed.actions).toHaveLength(1);
      expect(parsed.actions[0].type).toBe('tap');
    });

    it('should throw error for non-existent session', async () => {
      await expect(recordingService.exportSession('non-existent', 'maestro'))
        .rejects.toThrow('Session non-existent not found');
    });

    it('should throw error for incomplete session', async () => {
      const session = await createTestSession();
      session.status = 'recording';

      await expect(recordingService.exportSession(session.id, 'maestro'))
        .rejects.toThrow(`Session ${session.id} is not completed`);
    });

    it('should throw error for unsupported format', async () => {
      const session = await createTestSession();

      await expect(recordingService.exportSession(session.id, 'unsupported' as any))
        .rejects.toThrow('Unsupported export format: unsupported');
    });
  });

  describe('parseMaestroOutput', () => {
    it('should parse tap actions from Maestro output', () => {
      const session = createMockSession();
      const output = 'ACTION: tap at (150, 300) on Login Button\n';

      recordingService['parseMaestroOutput'](session, output);

      expect(session.actions).toHaveLength(1);
      expect(session.actions[0].type).toBe('tap');
      expect(session.actions[0].coordinates).toEqual({ x: 150, y: 300 });
      expect(session.actions[0].element).toBe('Login Button');
    });

    it('should parse input text actions from Maestro output', () => {
      const session = createMockSession();
      const output = 'ACTION: input text "username@example.com" to Email Field\n';

      recordingService['parseMaestroOutput'](session, output);

      expect(session.actions).toHaveLength(1);
      expect(session.actions[0].type).toBe('type');
      expect(session.actions[0].text).toBe('username@example.com');
      expect(session.actions[0].element).toBe('Email Field');
    });

    it('should parse swipe actions from Maestro output', () => {
      const session = createMockSession();
      const output = 'ACTION: swipe from (100, 500) to (100, 200)\n';

      recordingService['parseMaestroOutput'](session, output);

      expect(session.actions).toHaveLength(1);
      expect(session.actions[0].type).toBe('swipe');
      expect(session.actions[0].coordinates).toEqual({ x: 100, y: 500 });
      expect(session.actions[0].metadata.endCoordinates).toEqual({ x: 100, y: 200 });
    });

    it('should emit recording:action event for each parsed action', () => {
      const session = createMockSession();
      const eventSpy = jest.fn();
      recordingService.on('recording:action', eventSpy);

      const output = 'ACTION: tap at (150, 300) on Login Button\n';
      recordingService['parseMaestroOutput'](session, output);

      expect(eventSpy).toHaveBeenCalledWith({
        session,
        action: expect.objectContaining({
          type: 'tap',
          coordinates: { x: 150, y: 300 },
          element: 'Login Button'
        })
      });
    });
  });

  describe('parseWorkflowOutput', () => {
    it('should parse click actions from workflow-use output', () => {
      const session = createMockSession();
      const output = 'STEP: click on button[data-testid="submit"]\n';

      recordingService['parseWorkflowOutput'](session, output);

      expect(session.actions).toHaveLength(1);
      expect(session.actions[0].type).toBe('tap');
      expect(session.actions[0].selector).toBe('button[data-testid="submit"]');
    });

    it('should parse type actions from workflow-use output', () => {
      const session = createMockSession();
      const output = 'STEP: type "test@example.com" into input[type="email"]\n';

      recordingService['parseWorkflowOutput'](session, output);

      expect(session.actions).toHaveLength(1);
      expect(session.actions[0].type).toBe('type');
      expect(session.actions[0].text).toBe('test@example.com');
      expect(session.actions[0].selector).toBe('input[type="email"]');
    });

    it('should parse navigate actions from workflow-use output', () => {
      const session = createMockSession();
      const output = 'STEP: navigate to https://dashboard.example.com\n';

      recordingService['parseWorkflowOutput'](session, output);

      expect(session.actions).toHaveLength(1);
      expect(session.actions[0].type).toBe('navigate');
      expect(session.actions[0].text).toBe('https://dashboard.example.com');
    });
  });

  describe('getSession', () => {
    it('should return session by ID', async () => {
      const config: RecordingConfig = {
        type: 'mobile',
        platform: 'ios',
        metadata: {}
      };

      const session = await recordingService.startRecording(config);
      const retrieved = recordingService.getSession(session.id);

      expect(retrieved).toBe(session);
    });

    it('should return undefined for non-existent session', () => {
      const retrieved = recordingService.getSession('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAllSessions', () => {
    it('should return all active sessions', async () => {
      const config1: RecordingConfig = {
        type: 'mobile',
        platform: 'ios',
        metadata: {}
      };
      const config2: RecordingConfig = {
        type: 'web',
        platform: 'chrome',
        metadata: {}
      };

      await recordingService.startRecording(config1);
      await recordingService.startRecording(config2);

      const sessions = recordingService.getAllSessions();
      expect(sessions).toHaveLength(2);
    });

    it('should return empty array when no sessions', () => {
      const sessions = recordingService.getAllSessions();
      expect(sessions).toHaveLength(0);
    });
  });

  // Helper functions
  async function createTestSession(type: 'mobile' | 'web' = 'mobile') {
    const config: RecordingConfig = {
      type,
      platform: type === 'mobile' ? 'ios' : 'chrome',
      metadata: type === 'mobile' 
        ? { deviceName: 'iPhone 15 Pro', appId: 'com.test.app' }
        : { url: 'https://example.com', viewport: { width: 1920, height: 1080 } }
    };

    const session = await recordingService.startRecording(config);
    await recordingService.stopRecording(session.id);
    return session;
  }

  function createMockSession() {
    return {
      id: 'test-session',
      type: 'mobile' as const,
      platform: 'ios' as const,
      status: 'recording' as const,
      startTime: new Date(),
      duration: 0,
      metadata: {},
      actions: [],
      artifacts: {
        screenshots: [],
        videos: [],
        logs: []
      }
    };
  }
});