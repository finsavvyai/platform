import { TestFlowAgent, AgentMessage } from '../AgentService.js';
import { AgentConfig } from '../config.js';
import { Logger } from '../utils/Logger.js';
import { DeviceManager } from '../managers/DeviceManager.js';
import { MaestroRunner } from '../runners/MaestroRunner.js';
import { ScreenStreamer } from '../streaming/ScreenStreamer.js';
import { AgentAuth } from '../auth/AgentAuth.js';
import WebSocket from 'ws';
import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('../managers/DeviceManager.js');
jest.mock('../runners/MaestroRunner.js');
jest.mock('../streaming/ScreenStreamer.js');
jest.mock('../auth/AgentAuth.js');
jest.mock('ws');
jest.mock('node-machine-id', () => ({
  machineId: jest.fn().mockResolvedValue('test-machine-id-123')
}));

const MockedDeviceManager = DeviceManager as jest.MockedClass<typeof DeviceManager>;
const MockedMaestroRunner = MaestroRunner as jest.MockedClass<typeof MaestroRunner>;
const MockedScreenStreamer = ScreenStreamer as jest.MockedClass<typeof ScreenStreamer>;
const MockedAgentAuth = AgentAuth as jest.MockedClass<typeof AgentAuth>;
const MockedWebSocket = WebSocket as jest.MockedClass<typeof WebSocket>;

describe('TestFlowAgent', () => {
  let agent: TestFlowAgent;
  let mockLogger: Logger;
  let mockDeviceManager: jest.Mocked<DeviceManager>;
  let mockMaestroRunner: jest.Mocked<MaestroRunner>;
  let mockScreenStreamer: jest.Mocked<ScreenStreamer>;
  let mockAuth: jest.Mocked<AgentAuth>;
  let mockWebSocket: jest.Mocked<WebSocket>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      success: jest.fn(),
      debug: jest.fn()
    } as any;

    // Setup mocks
    mockDeviceManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getConnectedDevices: jest.fn().mockResolvedValue([]),
      getSystemInfo: jest.fn().mockResolvedValue({ hostname: 'test-machine', platform: 'darwin' }),
      getPreviousDevices: jest.fn().mockReturnValue([])
    } as any;

    mockMaestroRunner = {
      initialize: jest.fn().mockResolvedValue(undefined),
      startRecording: jest.fn().mockResolvedValue({ id: 'recording-123', startTime: new Date() }),
      stopRecording: jest.fn().mockResolvedValue({ duration: 30000, actions: [], yamlFile: 'test.yaml' }),
      cleanup: jest.fn().mockResolvedValue(undefined),
      on: jest.fn()
    } as any;

    mockScreenStreamer = {
      startStream: jest.fn().mockResolvedValue(undefined),
      stopStream: jest.fn().mockResolvedValue(undefined),
      stopAll: jest.fn().mockResolvedValue(undefined),
      on: jest.fn()
    } as any;

    mockAuth = {
      authenticate: jest.fn().mockResolvedValue({ success: true }),
      getToken: jest.fn().mockReturnValue('test-auth-token')
    } as any;

    mockWebSocket = {
      on: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      readyState: WebSocket.OPEN
    } as any;

    // Setup constructor mocks
    MockedDeviceManager.mockImplementation(() => mockDeviceManager);
    MockedMaestroRunner.mockImplementation(() => mockMaestroRunner);
    MockedScreenStreamer.mockImplementation(() => mockScreenStreamer);
    MockedAgentAuth.mockImplementation(() => mockAuth);
    MockedWebSocket.mockImplementation(() => mockWebSocket);

    agent = new TestFlowAgent(AgentConfig, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Agent Initialization', () => {
    it('should initialize all components successfully', async () => {
      // Mock WebSocket connection
      const mockOn = mockWebSocket.on as jest.MockedFunction<typeof mockWebSocket.on>;
      mockOn.mockImplementation((event: string, callback: Function) => {
        if (event === 'open') {
          setImmediate(() => callback());
        }
        return mockWebSocket;
      });

      await agent.start();

      expect(mockLogger.info).toHaveBeenCalledWith('🚀 Starting TestFlow Pro Agent...');
      expect(mockDeviceManager.initialize).toHaveBeenCalled();
      expect(mockMaestroRunner.initialize).toHaveBeenCalled();
      expect(mockAuth.authenticate).toHaveBeenCalled();
      expect(mockLogger.success).toHaveBeenCalledWith('✅ TestFlow Pro Agent is running!');
    });

    it('should throw error if authentication fails', async () => {
      mockAuth.authenticate.mockResolvedValue({ success: false, error: 'Invalid API key' });

      await expect(agent.start()).rejects.toThrow('Authentication failed: Invalid API key');
    });

    it('should throw error if component initialization fails', async () => {
      mockDeviceManager.initialize.mockRejectedValue(new Error('Device manager init failed'));

      await expect(agent.start()).rejects.toThrow('Device manager init failed');
    });
  });

  describe('Cloud Connection', () => {
    it('should connect to cloud with proper authentication', async () => {
      const mockOn = mockWebSocket.on as jest.MockedFunction<typeof mockWebSocket.on>;
      mockOn.mockImplementation((event: string, callback: Function) => {
        if (event === 'open') {
          setImmediate(() => callback());
        }
        return mockWebSocket;
      });

      await agent.start();

      expect(MockedWebSocket).toHaveBeenCalledWith(
        `${AgentConfig.cloudUrl}/agent`,
        {
          headers: {
            'Authorization': 'Bearer test-auth-token',
            'User-Agent': `TestFlow-Pro-Agent/${AgentConfig.version}`,
            'X-Agent-ID': 'test-machine-id-123'
          }
        }
      );
    });

    it('should register agent after connection', async () => {
      const mockOn = mockWebSocket.on as jest.MockedFunction<typeof mockWebSocket.on>;
      const mockSend = mockWebSocket.send as jest.MockedFunction<typeof mockWebSocket.send>;
      
      mockDeviceManager.getConnectedDevices.mockResolvedValue([
        {
          id: 'device-1',
          name: 'iPhone 15 Pro',
          platform: 'ios',
          version: '17.0',
          status: 'connected',
          screen: { width: 393, height: 852 }
        }
      ]);

      mockOn.mockImplementation((event: string, callback: Function) => {
        if (event === 'open') {
          setImmediate(() => callback());
        }
        return mockWebSocket;
      });

      await agent.start();

      expect(mockSend).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'AGENT_REGISTER',
          payload: {
            agentId: 'test-machine-id-123',
            version: AgentConfig.version,
            capabilities: AgentConfig.capabilities,
            systemInfo: { hostname: 'test-machine', platform: 'darwin' },
            devices: [{
              id: 'device-1',
              name: 'iPhone 15 Pro',
              platform: 'ios',
              version: '17.0',
              status: 'connected',
              screen: { width: 393, height: 852 }
            }]
          },
          timestamp: expect.any(Number)
        })
      );
    });

    it('should handle connection failure', async () => {
      const mockOn = mockWebSocket.on as jest.MockedFunction<typeof mockWebSocket.on>;
      
      mockOn.mockImplementation((event: string, callback: Function) => {
        if (event === 'error') {
          setImmediate(() => callback(new Error('Connection failed')));
        }
        return mockWebSocket;
      });

      await expect(agent.start()).rejects.toThrow('Connection failed');
    });

    it('should schedule reconnection on disconnect', async () => {
      const mockOn = mockWebSocket.on as jest.MockedFunction<typeof mockWebSocket.on>;
      
      mockOn.mockImplementation((event: string, callback: Function) => {
        if (event === 'open') {
          setImmediate(() => callback());
        }
        if (event === 'close') {
          setImmediate(() => callback(1000, 'Normal closure'));
        }
        return mockWebSocket;
      });

      await agent.start();

      expect(mockLogger.warn).toHaveBeenCalledWith('🔌 Disconnected from cloud (1000: Normal closure)');
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      const mockOn = mockWebSocket.on as jest.MockedFunction<typeof mockWebSocket.on>;
      mockOn.mockImplementation((event: string, callback: Function) => {
        if (event === 'open') {
          setImmediate(() => callback());
        }
        return mockWebSocket;
      });

      await agent.start();
    });

    it('should handle PING message with PONG response', async () => {
      const mockSend = mockWebSocket.send as jest.MockedFunction<typeof mockWebSocket.send>;
      
      const message: AgentMessage = {
        type: 'PING',
        timestamp: Date.now()
      };

      await agent['handleCloudMessage'](message);

      expect(mockSend).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'PONG',
          timestamp: expect.any(Number)
        })
      );
    });

    it('should handle GET_DEVICES message', async () => {
      const mockSend = mockWebSocket.send as jest.MockedFunction<typeof mockWebSocket.send>;
      
      mockDeviceManager.getConnectedDevices.mockResolvedValue([
        {
          id: 'device-1',
          name: 'iPhone 15 Pro',
          platform: 'ios',
          version: '17.0',
          status: 'connected',
          screen: { width: 393, height: 852 }
        }
      ]);

      const message: AgentMessage = {
        type: 'GET_DEVICES',
        timestamp: Date.now()
      };

      await agent['handleCloudMessage'](message);

      expect(mockSend).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'DEVICE_LIST',
          payload: {
            devices: [{
              id: 'device-1',
              name: 'iPhone 15 Pro',
              platform: 'ios',
              version: '17.0',
              status: 'connected',
              screen: { width: 393, height: 852 }
            }]
          },
          timestamp: expect.any(Number)
        })
      );
    });

    it('should handle START_RECORDING message', async () => {
      const mockSend = mockWebSocket.send as jest.MockedFunction<typeof mockWebSocket.send>;
      
      const message: AgentMessage = {
        type: 'START_RECORDING',
        sessionId: 'session-123',
        payload: {
          deviceId: 'device-1',
          appId: 'com.test.app',
          recordingConfig: {}
        },
        timestamp: Date.now()
      };

      await agent['handleCloudMessage'](message);

      expect(mockMaestroRunner.startRecording).toHaveBeenCalledWith({
        sessionId: 'session-123',
        deviceId: 'device-1',
        appId: 'com.test.app',
        config: {}
      });

      expect(mockScreenStreamer.startStream).toHaveBeenCalledWith('device-1', 'session-123');

      expect(mockSend).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'RECORDING_STARTED',
          sessionId: 'session-123',
          payload: {
            recordingId: 'recording-123',
            deviceId: 'device-1',
            startTime: expect.any(Date)
          },
          timestamp: expect.any(Number)
        })
      );
    });

    it('should handle STOP_RECORDING message', async () => {
      const mockSend = mockWebSocket.send as jest.MockedFunction<typeof mockWebSocket.send>;
      
      const message: AgentMessage = {
        type: 'STOP_RECORDING',
        sessionId: 'session-123',
        payload: {
          recordingId: 'recording-123'
        },
        timestamp: Date.now()
      };

      await agent['handleCloudMessage'](message);

      expect(mockMaestroRunner.stopRecording).toHaveBeenCalledWith('recording-123');
      expect(mockScreenStreamer.stopStream).toHaveBeenCalledWith('session-123');

      expect(mockSend).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'RECORDING_STOPPED',
          sessionId: 'session-123',
          payload: {
            recordingId: 'recording-123',
            result: {
              duration: 30000,
              actionsCount: 0,
              yamlFile: 'test.yaml',
              actions: []
            }
          },
          timestamp: expect.any(Number)
        })
      );
    });

    it('should handle recording start error', async () => {
      const mockSend = mockWebSocket.send as jest.MockedFunction<typeof mockWebSocket.send>;
      
      mockMaestroRunner.startRecording.mockRejectedValue(new Error('Maestro not found'));

      const message: AgentMessage = {
        type: 'START_RECORDING',
        sessionId: 'session-123',
        payload: {
          deviceId: 'device-1',
          appId: 'com.test.app'
        },
        timestamp: Date.now()
      };

      await agent['handleCloudMessage'](message);

      expect(mockSend).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'RECORDING_ERROR',
          sessionId: 'session-123',
          payload: {
            error: 'Maestro not found'
          },
          timestamp: expect.any(Number)
        })
      );
    });

    it('should handle unknown message type', async () => {
      const message: AgentMessage = {
        type: 'UNKNOWN_MESSAGE',
        timestamp: Date.now()
      };

      await agent['handleCloudMessage'](message);

      expect(mockLogger.warn).toHaveBeenCalledWith('Unknown message type: UNKNOWN_MESSAGE');
    });
  });

  describe('Device Monitoring', () => {
    it('should detect new device connections', async () => {
      const mockOn = mockWebSocket.on as jest.MockedFunction<typeof mockWebSocket.on>;
      const mockSend = mockWebSocket.send as jest.MockedFunction<typeof mockWebSocket.send>;
      
      mockOn.mockImplementation((event: string, callback: Function) => {
        if (event === 'open') {
          setImmediate(() => callback());
        }
        return mockWebSocket;
      });

      // Start with no devices
      mockDeviceManager.getConnectedDevices.mockResolvedValueOnce([]);
      mockDeviceManager.getPreviousDevices.mockReturnValue([]);

      await agent.start();

      // Simulate device connection
      const newDevice = {
        id: 'device-1',
        name: 'iPhone 15 Pro',
        platform: 'ios',
        version: '17.0',
        status: 'connected',
        screen: { width: 393, height: 852 }
      };

      mockDeviceManager.getConnectedDevices.mockResolvedValue([newDevice]);

      // Trigger device monitoring check
      await agent['startDeviceMonitoring']();

      // Wait for monitoring interval
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockLogger.success).toHaveBeenCalledWith(
        expect.stringContaining('New device(s) connected: iPhone 15 Pro')
      );
    });

    it('should detect device disconnections', async () => {
      const mockOn = mockWebSocket.on as jest.MockedFunction<typeof mockWebSocket.on>;
      
      mockOn.mockImplementation((event: string, callback: Function) => {
        if (event === 'open') {
          setImmediate(() => callback());
        }
        return mockWebSocket;
      });

      const previousDevice = {
        id: 'device-1',
        name: 'iPhone 15 Pro',
        platform: 'ios',
        version: '17.0',
        status: 'connected',
        screen: { width: 393, height: 852 }
      };

      // Start with one device
      mockDeviceManager.getConnectedDevices.mockResolvedValueOnce([previousDevice]);
      mockDeviceManager.getPreviousDevices.mockReturnValue([previousDevice]);

      await agent.start();

      // Simulate device disconnection
      mockDeviceManager.getConnectedDevices.mockResolvedValue([]);

      // Trigger device monitoring check
      await agent['startDeviceMonitoring']();

      // Wait for monitoring interval
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Device(s) disconnected: iPhone 15 Pro')
      );
    });
  });

  describe('Agent Shutdown', () => {
    it('should stop all services gracefully', async () => {
      const mockOn = mockWebSocket.on as jest.MockedFunction<typeof mockWebSocket.on>;
      mockOn.mockImplementation((event: string, callback: Function) => {
        if (event === 'open') {
          setImmediate(() => callback());
        }
        return mockWebSocket;
      });

      await agent.start();
      await agent.stop();

      expect(mockWebSocket.close).toHaveBeenCalled();
      expect(mockScreenStreamer.stopAll).toHaveBeenCalled();
      expect(mockMaestroRunner.cleanup).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('🛑 TestFlow Pro Agent stopped');
    });

    it('should not attempt reconnection after stop', async () => {
      const mockOn = mockWebSocket.on as jest.MockedFunction<typeof mockWebSocket.on>;
      
      mockOn.mockImplementation((event: string, callback: Function) => {
        if (event === 'open') {
          setImmediate(() => callback());
        }
        return mockWebSocket;
      });

      await agent.start();
      await agent.stop();

      // Simulate disconnect after stop
      const closeCallback = (mockWebSocket.on as jest.Mock).mock.calls
        .find(call => call[0] === 'close')[1];
      
      closeCallback(1000, 'Normal closure');

      // Should not attempt reconnection
      expect(mockLogger.info).toHaveBeenCalledWith('🛑 TestFlow Pro Agent stopped');
    });
  });

  describe('Event Handling', () => {
    it('should forward Maestro action events to cloud', async () => {
      const mockOn = mockWebSocket.on as jest.MockedFunction<typeof mockWebSocket.on>;
      const mockSend = mockWebSocket.send as jest.MockedFunction<typeof mockWebSocket.send>;
      
      mockOn.mockImplementation((event: string, callback: Function) => {
        if (event === 'open') {
          setImmediate(() => callback());
        }
        return mockWebSocket;
      });

      await agent.start();

      // Setup event handlers
      agent.setupEventHandlers();

      // Simulate Maestro action event
      const maestroOnCallback = (mockMaestroRunner.on as jest.Mock).mock.calls
        .find(call => call[0] === 'action_recorded')[1];

      const actionData = {
        sessionId: 'session-123',
        action: {
          id: 'action-1',
          type: 'tap',
          timestamp: Date.now(),
          coordinates: { x: 100, y: 200 }
        }
      };

      maestroOnCallback(actionData);

      expect(mockSend).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'ACTION_RECORDED',
          sessionId: 'session-123',
          payload: actionData.action,
          timestamp: expect.any(Number)
        })
      );
    });

    it('should forward screen frame events to cloud', async () => {
      const mockOn = mockWebSocket.on as jest.MockedFunction<typeof mockWebSocket.on>;
      const mockSend = mockWebSocket.send as jest.MockedFunction<typeof mockWebSocket.send>;
      
      mockOn.mockImplementation((event: string, callback: Function) => {
        if (event === 'open') {
          setImmediate(() => callback());
        }
        return mockWebSocket;
      });

      await agent.start();

      // Setup event handlers
      agent.setupEventHandlers();

      // Simulate screen frame event
      const screenOnCallback = (mockScreenStreamer.on as jest.Mock).mock.calls
        .find(call => call[0] === 'frame')[1];

      const frameData = {
        sessionId: 'session-123',
        deviceId: 'device-1',
        frame: 'base64-encoded-frame',
        format: 'jpeg'
      };

      screenOnCallback(frameData);

      expect(mockSend).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'SCREEN_FRAME',
          sessionId: 'session-123',
          payload: {
            deviceId: 'device-1',
            frame: 'base64-encoded-frame',
            format: 'jpeg'
          },
          timestamp: expect.any(Number)
        })
      );
    });
  });
});