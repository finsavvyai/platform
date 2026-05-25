# 📱 TestFlow Pro SaaS - Cloud Agent Architecture

Complete cloud-based mobile testing with downloadable agent for local devices.

## 🎯 **Agent-Based Architecture**

```
TestFlow Pro SaaS (Cloud)
        ↕️ WebSocket/API
TestFlow Pro Agent (Local)
        ↓ Controls
Local Mobile Devices
        ↓ Maestro Commands
iOS/Android Apps
```

## 🔧 **How It Works**

1. **User downloads TestFlow Pro Agent** (lightweight ~10MB)
2. **Agent connects to cloud SaaS** via secure WebSocket
3. **Cloud orchestrates testing** through agent
4. **Agent executes Maestro** on local devices
5. **Results stream back** to cloud dashboard
6. **Real-time collaboration** with team members

## 🏗️ **Architecture Components**

### **1. Cloud SaaS Platform**
- **Recording Studio**: Web-based test creation
- **Agent Management**: Connect/disconnect agents
- **Real-time Dashboard**: Live device monitoring
- **Test Orchestration**: Distribute tests to agents
- **Result Collection**: Aggregate test results

### **2. TestFlow Pro Agent**
- **Lightweight Executable**: Cross-platform (Windows/macOS/Linux)
- **Device Detection**: Auto-discover connected devices
- **Maestro Integration**: Execute tests on devices
- **Screen Streaming**: Send device screen to cloud
- **Secure Connection**: Encrypted communication with cloud

### **3. Local Device Testing**
- **USB Connected Devices**: iOS/Android via USB
- **Wireless Devices**: iOS/Android via WiFi
- **Emulators/Simulators**: Local virtual devices
- **Multiple Devices**: Test on several devices simultaneously

## 🖥️ **TestFlow Pro Agent**

### **Agent Installation**

```bash
# Download and install agent
curl -L https://download.testflow.pro/agent/latest/testflow-agent-macos.pkg -o testflow-agent.pkg
sudo installer -pkg testflow-agent.pkg -target /

# Or via npm
npm install -g @testflow-pro/agent

# Or direct download from dashboard
# https://app.testflow.pro/download/agent
```

### **Agent Configuration**

```javascript
// agent/src/config.js
export const AgentConfig = {
  cloudUrl: 'wss://api.testflow.pro',
  agentId: generateUniqueId(),
  version: '1.0.0',
  capabilities: {
    maestro: true,
    appium: true,
    xctest: true,
    espresso: true
  },
  deviceSupport: {
    ios: true,
    android: true,
    emulators: true
  }
};
```

### **Agent Core Service**

```typescript
// agent/src/AgentService.ts
export class TestFlowAgent {
  private ws: WebSocket;
  private deviceManager: DeviceManager;
  private maestroRunner: MaestroRunner;
  
  async start() {
    // Connect to cloud
    await this.connectToCloud();
    
    // Discover devices
    await this.deviceManager.scanDevices();
    
    // Register with cloud
    await this.registerAgent();
    
    console.log('🚀 TestFlow Pro Agent running...');
  }
  
  private async connectToCloud() {
    this.ws = new WebSocket(`${AgentConfig.cloudUrl}/agent`);
    
    this.ws.on('open', () => {
      console.log('📡 Connected to TestFlow Pro Cloud');
    });
    
    this.ws.on('message', async (data) => {
      const message = JSON.parse(data.toString());
      await this.handleCloudMessage(message);
    });
    
    this.ws.on('close', () => {
      console.log('⚠️ Disconnected from cloud, reconnecting...');
      setTimeout(() => this.connectToCloud(), 5000);
    });
  }
  
  private async handleCloudMessage(message: any) {
    switch (message.type) {
      case 'START_RECORDING':
        await this.startRecording(message.payload);
        break;
      case 'STOP_RECORDING':
        await this.stopRecording(message.payload);
        break;
      case 'EXECUTE_TEST':
        await this.executeTest(message.payload);
        break;
      case 'GET_DEVICES':
        await this.sendDeviceList();
        break;
      case 'STREAM_DEVICE':
        await this.startDeviceStreaming(message.payload);
        break;
    }
  }
  
  private async startRecording(payload: any) {
    const { sessionId, deviceId, appId } = payload;
    
    try {
      // Start Maestro recording
      const recording = await this.maestroRunner.startRecording({
        deviceId,
        appId,
        outputFormat: 'yaml'
      });
      
      // Send confirmation to cloud
      this.sendToCloud({
        type: 'RECORDING_STARTED',
        sessionId,
        recording
      });
      
      // Start streaming device screen
      await this.startDeviceStreaming({ sessionId, deviceId });
      
    } catch (error) {
      this.sendToCloud({
        type: 'RECORDING_ERROR',
        sessionId,
        error: error.message
      });
    }
  }
  
  private async sendDeviceList() {
    const devices = await this.deviceManager.getConnectedDevices();
    
    this.sendToCloud({
      type: 'DEVICE_LIST',
      devices: devices.map(device => ({
        id: device.id,
        name: device.name,
        platform: device.platform,
        version: device.version,
        status: device.status,
        screen: device.screen
      }))
    });
  }
  
  private sendToCloud(message: any) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}
```

### **Device Management**

```typescript
// agent/src/DeviceManager.ts
export class DeviceManager {
  
  async scanDevices(): Promise<Device[]> {
    const devices = [];
    
    // Scan iOS devices
    const iosDevices = await this.scanIOSDevices();
    devices.push(...iosDevices);
    
    // Scan Android devices
    const androidDevices = await this.scanAndroidDevices();
    devices.push(...androidDevices);
    
    // Scan emulators
    const emulators = await this.scanEmulators();
    devices.push(...emulators);
    
    return devices;
  }
  
  private async scanIOSDevices() {
    try {
      // Use ios-deploy or xcrun to detect devices
      const { stdout } = await exec('xcrun xctrace list devices');
      return this.parseIOSDevices(stdout);
    } catch (error) {
      console.warn('iOS device detection failed:', error.message);
      return [];
    }
  }
  
  private async scanAndroidDevices() {
    try {
      // Use adb to detect devices
      const { stdout } = await exec('adb devices -l');
      return this.parseAndroidDevices(stdout);
    } catch (error) {
      console.warn('Android device detection failed:', error.message);
      return [];
    }
  }
  
  async startScreenMirroring(deviceId: string): Promise<ScreenStream> {
    const device = await this.getDevice(deviceId);
    
    if (device.platform === 'ios') {
      return this.startIOSScreenMirroring(device);
    } else {
      return this.startAndroidScreenMirroring(device);
    }
  }
  
  private async startIOSScreenMirroring(device: Device) {
    // Use ios_instruments or similar for iOS screen capture
    const stream = spawn('ios_instruments', [
      'screenshot',
      '--device', device.id,
      '--format', 'jpeg',
      '--interval', '100'
    ]);
    
    return new ScreenStream(stream);
  }
  
  private async startAndroidScreenMirroring(device: Device) {
    // Use scrcpy or adb for Android screen capture
    const stream = spawn('adb', [
      '-s', device.id,
      'exec-out',
      'screencap -p'
    ]);
    
    return new ScreenStream(stream);
  }
}
```

### **Maestro Integration**

```typescript
// agent/src/MaestroRunner.ts
export class MaestroRunner {
  
  async startRecording(config: RecordingConfig): Promise<MaestroRecording> {
    const { deviceId, appId, outputFormat } = config;
    
    const outputFile = `recording-${Date.now()}.yaml`;
    const maestroArgs = [
      'record',
      '--device', deviceId,
      '--app-id', appId,
      '--output', outputFile,
      '--format', outputFormat
    ];
    
    const maestroProcess = spawn('maestro', maestroArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Monitor Maestro output
    maestroProcess.stdout.on('data', (data) => {
      const output = data.toString();
      this.parseAndSendActions(output);
    });
    
    maestroProcess.stderr.on('data', (data) => {
      console.warn('Maestro warning:', data.toString());
    });
    
    return new MaestroRecording(maestroProcess, outputFile);
  }
  
  private parseAndSendActions(output: string) {
    // Parse Maestro output for real-time actions
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('ACTION:')) {
        const action = this.parseActionLine(line);
        
        // Send to cloud in real-time
        this.agent.sendToCloud({
          type: 'ACTION_RECORDED',
          action
        });
      }
    }
  }
  
  async executeTest(testFile: string, deviceId: string): Promise<TestResult> {
    const maestroArgs = [
      'test',
      '--device', deviceId,
      '--format', 'json',
      testFile
    ];
    
    const { stdout, stderr } = await exec(`maestro ${maestroArgs.join(' ')}`);
    
    return {
      success: !stderr,
      output: stdout,
      error: stderr,
      timestamp: new Date()
    };
  }
}
```

## ☁️ **Cloud Platform Updates**

### **Agent Management Dashboard**

```typescript
// frontend/src/components/AgentManager.tsx
export function AgentManager() {
  const [connectedAgents, setConnectedAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  
  useEffect(() => {
    // Listen for agent connections
    socket.on('agent:connected', (agent) => {
      setConnectedAgents(prev => [...prev, agent]);
    });
    
    socket.on('agent:disconnected', (agentId) => {
      setConnectedAgents(prev => prev.filter(a => a.id !== agentId));
    });
    
    socket.on('device:list', (data) => {
      // Update device list for agent
      setConnectedAgents(prev => 
        prev.map(agent => 
          agent.id === data.agentId 
            ? { ...agent, devices: data.devices }
            : agent
        )
      );
    });
  }, []);
  
  return (
    <div className="agent-manager">
      <h2>Connected Agents</h2>
      
      {connectedAgents.length === 0 ? (
        <div className="no-agents">
          <p>No agents connected</p>
          <button onClick={() => showAgentDownload()}>
            Download Agent
          </button>
        </div>
      ) : (
        connectedAgents.map(agent => (
          <AgentCard 
            key={agent.id} 
            agent={agent}
            onSelect={setSelectedAgent}
          />
        ))
      )}
      
      {selectedAgent && (
        <DeviceSelector 
          agent={selectedAgent}
          onDeviceSelect={handleDeviceSelect}
        />
      )}
    </div>
  );
}
```

### **Cloud Recording Service Updates**

```typescript
// backend/src/services/CloudRecordingService.ts
export class CloudRecordingService extends EventEmitter {
  private connectedAgents = new Map<string, AgentConnection>();
  
  setupAgentWebSocket(io: Server) {
    io.of('/agent').on('connection', (socket) => {
      console.log('Agent connected:', socket.id);
      
      socket.on('register', (agentInfo) => {
        this.registerAgent(socket, agentInfo);
      });
      
      socket.on('device_list', (devices) => {
        this.updateAgentDevices(socket.id, devices);
      });
      
      socket.on('action_recorded', (action) => {
        this.handleRecordedAction(socket.id, action);
      });
      
      socket.on('disconnect', () => {
        this.unregisterAgent(socket.id);
      });
    });
  }
  
  async startMobileRecording(sessionId: string, agentId: string, deviceId: string) {
    const agent = this.connectedAgents.get(agentId);
    
    if (!agent) {
      throw new Error('Agent not connected');
    }
    
    // Send recording command to agent
    agent.socket.emit('start_recording', {
      sessionId,
      deviceId,
      appId: session.metadata.appId
    });
    
    // Wait for confirmation
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Recording start timeout'));
      }, 10000);
      
      agent.socket.once('recording_started', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
      
      agent.socket.once('recording_error', (error) => {
        clearTimeout(timeout);
        reject(new Error(error.message));
      });
    });
  }
  
  private registerAgent(socket: any, agentInfo: any) {
    const agent = {
      id: socket.id,
      socket,
      info: agentInfo,
      devices: [],
      status: 'online'
    };
    
    this.connectedAgents.set(socket.id, agent);
    
    // Notify frontend
    this.io.emit('agent:connected', {
      id: agent.id,
      name: agentInfo.name,
      version: agentInfo.version,
      capabilities: agentInfo.capabilities
    });
    
    // Request device list
    socket.emit('get_devices');
  }
}
```

## 📦 **Agent Distribution**

### **Download Portal**

```typescript
// frontend/src/pages/AgentDownload.tsx
export function AgentDownload() {
  const [platform, setPlatform] = useState(detectPlatform());
  
  const downloadLinks = {
    windows: 'https://download.testflow.pro/agent/latest/testflow-agent-windows.exe',
    macos: 'https://download.testflow.pro/agent/latest/testflow-agent-macos.pkg',
    linux: 'https://download.testflow.pro/agent/latest/testflow-agent-linux.deb'
  };
  
  return (
    <div className="agent-download">
      <h1>Download TestFlow Pro Agent</h1>
      <p>Connect your local devices to the cloud</p>
      
      <div className="platform-selector">
        {Object.keys(downloadLinks).map(p => (
          <button 
            key={p}
            className={platform === p ? 'active' : ''}
            onClick={() => setPlatform(p)}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      
      <div className="download-section">
        <a 
          href={downloadLinks[platform]}
          className="download-button"
          download
        >
          Download for {platform}
        </a>
        
        <div className="installation-steps">
          <h3>Installation Steps:</h3>
          <ol>
            <li>Download the agent for your platform</li>
            <li>Install and run the agent</li>
            <li>Connect your mobile devices via USB</li>
            <li>Agent will appear in your dashboard</li>
            <li>Start recording tests!</li>
          </ol>
        </div>
      </div>
      
      <div className="agent-features">
        <h3>Agent Features:</h3>
        <ul>
          <li>✅ Auto-detect connected devices</li>
          <li>✅ Real-time screen streaming</li>
          <li>✅ Secure cloud connection</li>
          <li>✅ Maestro integration</li>
          <li>✅ Multiple device support</li>
        </ul>
      </div>
    </div>
  );
}
```

## 🔐 **Security & Authentication**

### **Agent Authentication**

```typescript
// agent/src/auth.ts
export class AgentAuth {
  
  async authenticateWithCloud() {
    // Get user's API key from cloud dashboard
    const apiKey = await this.getStoredApiKey() || await this.promptForApiKey();
    
    // Connect with authentication
    const ws = new WebSocket(`${cloudUrl}/agent?auth=${apiKey}`);
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'AUTH_SUCCESS') {
        console.log('✅ Agent authenticated successfully');
        this.storeApiKey(apiKey);
      } else if (message.type === 'AUTH_FAILED') {
        console.error('❌ Agent authentication failed');
        this.clearApiKey();
      }
    });
  }
  
  private async promptForApiKey(): Promise<string> {
    console.log('🔑 Please get your API key from: https://app.testflow.pro/settings/api');
    
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      rl.question('Enter your API key: ', (apiKey) => {
        rl.close();
        resolve(apiKey.trim());
      });
    });
  }
}
```

## 🎯 **Benefits of Agent Architecture**

### **For Users**
- ✅ **Easy Setup**: Download and run agent
- ✅ **Local Devices**: Use your own devices
- ✅ **Cloud Benefits**: Access from anywhere
- ✅ **Team Sharing**: Share devices with team
- ✅ **Real-time**: Live collaboration

### **For Business**
- ✅ **True SaaS**: Cloud-based orchestration
- ✅ **Scalable**: Unlimited agents
- ✅ **Secure**: Encrypted connections
- ✅ **Device Flexibility**: Any device, anywhere
- ✅ **Enterprise Ready**: Team management

### **Technical Advantages**
- ✅ **Hybrid Architecture**: Best of cloud + local
- ✅ **Real-time Sync**: Instant updates
- ✅ **Fault Tolerant**: Auto-reconnection
- ✅ **Cross-Platform**: Windows/macOS/Linux
- ✅ **Lightweight**: Minimal resource usage

This agent-based architecture gives you the perfect blend of cloud SaaS capabilities with local device testing! 🚀📱