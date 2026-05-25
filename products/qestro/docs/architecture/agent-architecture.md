# Agent Architecture

Complete cloud-based mobile testing with downloadable agent for local devices.

## Agent-Based Architecture

```
Questro SaaS (Cloud)
        ↕️ WebSocket/API
Questro Agent (Local)
        ↓ Controls
Local Mobile Devices
        ↓ Maestro Commands
iOS/Android Apps
```

## How It Works

1. **User downloads Questro Agent** (lightweight ~10MB)
2. **Agent connects to cloud SaaS** via secure WebSocket
3. **Cloud orchestrates testing** through agent
4. **Agent executes Maestro** on local devices
5. **Results stream back** to cloud dashboard
6. **Real-time collaboration** with team members

## Architecture Components

### 1. Cloud SaaS Platform
- **Recording Studio**: Web-based test creation
- **Agent Management**: Connect/disconnect agents
- **Real-time Dashboard**: Live device monitoring
- **Test Orchestration**: Distribute tests to agents
- **Result Collection**: Aggregate test results

### 2. Questro Agent
- **Lightweight Executable**: Cross-platform (Windows/macOS/Linux)
- **Device Detection**: Auto-discover connected devices
- **Maestro Integration**: Execute tests on devices
- **Screen Streaming**: Send device screen to cloud
- **Secure Connection**: Encrypted communication with cloud

### 3. Local Device Testing
- **USB Connected Devices**: iOS/Android via USB
- **Wireless Devices**: iOS/Android via WiFi
- **Emulators/Simulators**: Local virtual devices
- **Multiple Devices**: Test on several devices simultaneously

## Agent Installation

```bash
# Download and install agent
curl -L https://download.questro.app/agent/latest/questro-agent-macos.pkg -o questro-agent.pkg
sudo installer -pkg questro-agent.pkg -target /

# Or via npm
npm install -g @questro/agent

# Or direct download from dashboard
# https://app.questro.app/download/agent
```

## Agent Configuration

```javascript
// agent/src/config.js
export const AgentConfig = {
  cloudUrl: 'wss://api.questro.app',
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

## Agent Core Service

```typescript
// agent/src/AgentService.ts
export class QuestroAgent {
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
    
    console.log('🚀 Questro Agent running...');
  }
  
  private async connectToCloud() {
    this.ws = new WebSocket(`${AgentConfig.cloudUrl}/agent`);
    
    this.ws.on('open', () => {
      console.log('📡 Connected to Questro Cloud');
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
}
```

## Device Management

The agent includes comprehensive device management capabilities for iOS, Android, and emulator support.

## Security & Authentication

### Agent Authentication

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
}
```

## Benefits of Agent Architecture

### For Users
- ✅ **Easy Setup**: Download and run agent
- ✅ **Local Devices**: Use your own devices
- ✅ **Cloud Benefits**: Access from anywhere
- ✅ **Team Sharing**: Share devices with team
- ✅ **Real-time**: Live collaboration

### For Business
- ✅ **True SaaS**: Cloud-based orchestration
- ✅ **Scalable**: Unlimited agents
- ✅ **Secure**: Encrypted connections
- ✅ **Device Flexibility**: Any device, anywhere
- ✅ **Enterprise Ready**: Team management

### Technical Advantages
- ✅ **Hybrid Architecture**: Best of cloud + local
- ✅ **Real-time Sync**: Instant updates
- ✅ **Fault Tolerant**: Auto-reconnection
- ✅ **Cross-Platform**: Windows/macOS/Linux
- ✅ **Lightweight**: Minimal resource usage

This agent-based architecture provides the perfect blend of cloud SaaS capabilities with local device testing capabilities.