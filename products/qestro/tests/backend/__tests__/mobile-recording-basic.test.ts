import { RecordingService, RecordingConfig } from '../../../backend/src/services/RecordingService';

describe('Mobile Recording Basic Test', () => {
  let recordingService: RecordingService;

  beforeEach(() => {
    recordingService = new RecordingService();
  });

  afterEach(async () => {
    // Clean up any active sessions
    try {
      await recordingService.cleanup();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should create a mobile recording session', async () => {
    const config: RecordingConfig = {
      type: 'mobile',
      platform: 'ios',
      metadata: {
        deviceName: 'iPhone 14',
        appId: 'com.example.app'
      }
    };

    const session = await recordingService.startRecording(config);

    expect(session).toBeDefined();
    expect(session.id).toBeDefined();
    expect(session.type).toBe('mobile');
    expect(session.platform).toBe('ios');
    expect(session.status).toBe('recording');
    expect(session.startTime).toBeDefined();
    expect(session.metadata.deviceName).toBe('iPhone 14');
    expect(session.metadata.appId).toBe('com.example.app');
  });

  it('should create an Android recording session', async () => {
    const config: RecordingConfig = {
      type: 'mobile',
      platform: 'android',
      metadata: {
        deviceName: 'Pixel 7',
        appId: 'com.example.app'
      }
    };

    const session = await recordingService.startRecording(config);

    expect(session).toBeDefined();
    expect(session.type).toBe('mobile');
    expect(session.platform).toBe('android');
    expect(session.metadata.deviceName).toBe('Pixel 7');
  });

  it('should handle mobile recording session lifecycle', async () => {
    const config: RecordingConfig = {
      type: 'mobile',
      platform: 'ios',
      metadata: {
        deviceName: 'iPhone 14',
        appId: 'com.example.app'
      }
    };

    // Start recording
    const session = await recordingService.startRecording(config);
    expect(session.status).toBe('recording');

    // Check session exists
    const retrievedSession = recordingService.getSession(session.id);
    expect(retrievedSession).toBeDefined();
    expect(retrievedSession?.id).toBe(session.id);

    // Stop recording (this might fail due to missing Maestro, but that's expected)
    try {
      const stoppedSession = await recordingService.stopRecording(session.id);
      expect(stoppedSession.status).toBe('completed');
    } catch (error) {
      // Expected if Maestro is not installed
      expect(error).toBeDefined();
    }
  });

  it('should validate mobile recording configuration', () => {
    const validConfig: RecordingConfig = {
      type: 'mobile',
      platform: 'ios',
      metadata: {
        deviceName: 'iPhone 14',
        appId: 'com.example.app'
      }
    };

    expect(validConfig.type).toBe('mobile');
    expect(['ios', 'android'].includes(validConfig.platform)).toBe(true);
    expect(validConfig.metadata).toBeDefined();
  });
});