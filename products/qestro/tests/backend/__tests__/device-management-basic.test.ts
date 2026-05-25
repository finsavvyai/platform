import { AgentManager } from '../controllers/agentController';

describe('Device Management Basic Test', () => {
  let agentManager: AgentManager;
  let mockIo: any;

  beforeEach(() => {
    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    };
    agentManager = new AgentManager(mockIo);
  });

  it('should handle device registration', async () => {
    const agentId = 'test-agent-1';
    const userId = 'user-123';
    const devices = [
      {
        id: 'device-1',
        name: 'iPhone 14',
        platform: 'ios',
        version: '16.0',
        status: 'available'
      },
      {
        id: 'device-2',
        name: 'Pixel 7',
        platform: 'android',
        version: '13',
        status: 'available'
      }
    ];

    // Simulate agent registration
    await agentManager.handleAgentRegistration(agentId, {
      version: '1.0.0',
      capabilities: ['recording', 'streaming'],
      systemInfo: { os: 'macOS', arch: 'arm64' },
      devices: devices
    }, userId);

    // Check if agent is registered
    const agents = agentManager.getConnectedAgents();
    expect(agents.has(agentId)).toBe(true);

    const agent = agents.get(agentId);
    expect(agent).toBeDefined();
    expect(agent?.devices).toHaveLength(2);
    expect(agent?.devices[0].name).toBe('iPhone 14');
    expect(agent?.devices[1].name).toBe('Pixel 7');
  });

  it('should handle device list updates', async () => {
    const agentId = 'test-agent-2';
    const userId = 'user-456';

    // First register the agent
    await agentManager.handleAgentRegistration(agentId, {
      version: '1.0.0',
      capabilities: ['recording'],
      systemInfo: { os: 'Windows', arch: 'x64' },
      devices: []
    }, userId);

    // Update device list
    const newDevices = [
      {
        id: 'device-3',
        name: 'Samsung Galaxy S23',
        platform: 'android',
        version: '13',
        status: 'available'
      }
    ];

    await agentManager.handleDeviceList(agentId, { devices: newDevices });

    const agent = agentManager.getConnectedAgents().get(agentId);
    expect(agent?.devices).toHaveLength(1);
    expect(agent?.devices[0].name).toBe('Samsung Galaxy S23');

    // Check if device update was emitted
    expect(mockIo.to).toHaveBeenCalledWith(`user:${userId}`);
    expect(mockIo.emit).toHaveBeenCalledWith('agent:devices_updated', {
      agentId,
      devices: newDevices
    });
  });

  it('should support device refresh requests', async () => {
    const agentId = 'test-agent-3';
    const sendToAgentSpy = jest.spyOn(agentManager, 'sendToAgent').mockImplementation();

    await agentManager.refreshDevices(agentId);

    expect(sendToAgentSpy).toHaveBeenCalledWith(agentId, {
      type: 'REFRESH_DEVICES',
      timestamp: expect.any(Number)
    });

    sendToAgentSpy.mockRestore();
  });

  it('should support starting recording on specific devices', async () => {
    const agentId = 'test-agent-4';
    const sessionId = 'session-123';
    const deviceId = 'device-1';
    const config = {
      appId: 'com.example.app',
      recordVideo: true,
      recordScreenshots: true
    };

    const sendToAgentSpy = jest.spyOn(agentManager, 'sendToAgent').mockImplementation();

    await agentManager.startRecording(agentId, sessionId, deviceId, config);

    expect(sendToAgentSpy).toHaveBeenCalledWith(agentId, {
      type: 'START_RECORDING',
      payload: {
        sessionId,
        deviceId,
        appId: config.appId,
        recordingConfig: config
      },
      timestamp: expect.any(Number)
    });

    sendToAgentSpy.mockRestore();
  });

  it('should support device streaming', async () => {
    const agentId = 'test-agent-5';
    const sessionId = 'session-456';
    const deviceId = 'device-2';

    const sendToAgentSpy = jest.spyOn(agentManager, 'sendToAgent').mockImplementation();

    await agentManager.startStreaming(agentId, sessionId, deviceId);

    expect(sendToAgentSpy).toHaveBeenCalledWith(agentId, {
      type: 'START_STREAMING',
      payload: {
        sessionId,
        deviceId
      },
      timestamp: expect.any(Number)
    });

    sendToAgentSpy.mockRestore();
  });

  it('should support test execution on devices', async () => {
    const agentId = 'test-agent-6';
    const sessionId = 'session-789';
    const deviceId = 'device-3';
    const testContent = 'tap on "Login Button"';

    const sendToAgentSpy = jest.spyOn(agentManager, 'sendToAgent').mockImplementation();

    await agentManager.executeTest(agentId, sessionId, deviceId, testContent);

    expect(sendToAgentSpy).toHaveBeenCalledWith(agentId, {
      type: 'EXECUTE_TEST',
      payload: {
        sessionId,
        deviceId,
        testContent
      },
      timestamp: expect.any(Number)
    });

    sendToAgentSpy.mockRestore();
  });

  it('should track agent status and device availability', () => {
    const agentId = 'test-agent-7';
    const userId = 'user-789';

    // Register agent
    agentManager.handleAgentRegistration(agentId, {
      version: '1.0.0',
      capabilities: ['recording', 'streaming'],
      systemInfo: { os: 'macOS' },
      devices: [
        { id: 'device-1', name: 'iPhone 14', status: 'available' },
        { id: 'device-2', name: 'iPad Pro', status: 'busy' }
      ]
    }, userId);

    const agents = agentManager.getConnectedAgents();
    const agent = agents.get(agentId);

    expect(agent?.status).toBe('online');
    expect(agent?.devices).toHaveLength(2);
    expect(agent?.devices.find(d => d.id === 'device-1')?.status).toBe('available');
    expect(agent?.devices.find(d => d.id === 'device-2')?.status).toBe('busy');
  });
});