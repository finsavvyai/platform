# Cloud Recording Architecture

Complete cloud-based recording solution - no local installations required!

## Cloud-First Approach

Everything runs on the SaaS platform:
- ✅ **Browser Automation**: Cloud browsers via Puppeteer/Playwright
- ✅ **Mobile Testing**: Cloud device farms integration
- ✅ **Recording Processing**: Server-side action capture
- ✅ **Real-time Streaming**: WebRTC for live preview
- ✅ **Zero Installation**: Pure web-based interface

## Architecture Overview

```
User's Browser (Questro UI)
        ↓ WebRTC/WebSocket
Questro SaaS Backend
        ↓ Controls
Cloud Browser Instances (Puppeteer)
        ↓ Executes Tests
Target Web Applications
```

## Cloud Web Recording

### Puppeteer-Based Recording
Instead of local workflow-use, we use cloud browsers:

```typescript
// Cloud browser recording service
export class CloudRecordingService {
  private browsers = new Map<string, Browser>();
  
  async startWebRecording(session: RecordingSession) {
    // Launch cloud browser
    const browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport(session.metadata.viewport);
    
    // Start recording user interactions
    await this.setupRecordingListeners(page, session);
    
    // Navigate to target URL
    if (session.metadata.url) {
      await page.goto(session.metadata.url);
    }
    
    // Stream browser to frontend
    await this.setupBrowserStreaming(page, session);
  }
  
  private async setupRecordingListeners(page: Page, session: RecordingSession) {
    // Record clicks
    await page.evaluateOnNewDocument(() => {
      document.addEventListener('click', (e) => {
        window.recordAction({
          type: 'click',
          selector: getSelector(e.target),
          coordinates: { x: e.clientX, y: e.clientY },
          timestamp: Date.now()
        });
      });
    });
    
    // Record text input
    await page.evaluateOnNewDocument(() => {
      document.addEventListener('input', (e) => {
        window.recordAction({
          type: 'type',
          selector: getSelector(e.target),
          text: e.target.value,
          timestamp: Date.now()
        });
      });
    });
    
    // Capture actions via CDP
    await page.on('console', msg => {
      if (msg.text().startsWith('RECORD_ACTION:')) {
        const action = JSON.parse(msg.text().replace('RECORD_ACTION:', ''));
        this.processRecordedAction(session, action);
      }
    });
  }
}
```

## Cloud Mobile Recording

### Integration with Cloud Device Farms

```typescript
// Cloud mobile testing integration
export class CloudMobileService {
  
  async startMobileRecording(session: RecordingSession) {
    // Use AWS Device Farm, BrowserStack, or Sauce Labs
    const device = await this.allocateCloudDevice({
      platform: session.platform, // ios, android
      deviceName: session.metadata.deviceName,
      appId: session.metadata.appId
    });
    
    // Start recording via cloud device API
    const recordingSession = await device.startRecording({
      format: 'maestro',
      realTimeStreaming: true
    });
    
    // Stream device screen to frontend
    await this.setupDeviceStreaming(device, session);
    
    return recordingSession;
  }
  
  private async allocateCloudDevice(config: DeviceConfig) {
    // Integration with cloud providers
    switch (process.env.MOBILE_CLOUD_PROVIDER) {
      case 'browserstack':
        return new BrowserStackDevice(config);
      case 'saucelabs':
        return new SauceLabsDevice(config);
      case 'aws-device-farm':
        return new AWSDeviceFarmDevice(config);
      default:
        return new LocalEmulatorDevice(config);
    }
  }
}
```

## Real-time Browser Streaming

### WebRTC Integration for Live Preview

```typescript
// Browser streaming service
export class BrowserStreamingService {
  
  async setupBrowserStreaming(page: Page, session: RecordingSession) {
    // Capture browser screenshots at 30fps
    const streamInterval = setInterval(async () => {
      try {
        const screenshot = await page.screenshot({
          type: 'jpeg',
          quality: 80,
          fullPage: false
        });
        
        // Send to frontend via WebSocket
        this.io.to(`session:${session.id}`).emit('browser:frame', {
          sessionId: session.id,
          frame: screenshot.toString('base64'),
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('Screenshot error:', error);
      }
    }, 33); // ~30fps
    
    // Store interval for cleanup
    this.streamIntervals.set(session.id, streamInterval);
  }
  
  async setupInteractiveBrowserControl(page: Page, session: RecordingSession) {
    // Allow frontend to control browser
    this.io.on(`session:${session.id}:click`, async (data) => {
      await page.mouse.click(data.x, data.y);
    });
    
    this.io.on(`session:${session.id}:type`, async (data) => {
      await page.type(data.selector, data.text);
    });
    
    this.io.on(`session:${session.id}:navigate`, async (data) => {
      await page.goto(data.url);
    });
  }
}
```

## Frontend Integration

### Cloud Recording Interface

```typescript
// CloudRecordingStudio.tsx - Updated for cloud recording
export function CloudRecordingStudio() {
  const [browserStream, setBrowserStream] = useState<string>('');
  const [isRemoteControlling, setIsRemoteControlling] = useState(false);
  
  // Receive real-time browser frames
  useEffect(() => {
    socket.on('browser:frame', (data) => {
      setBrowserStream(`data:image/jpeg;base64,${data.frame}`);
    });
    
    socket.on('mobile:frame', (data) => {
      setMobileStream(`data:image/jpeg;base64,${data.frame}`);
    });
  }, []);
  
  const handleBrowserClick = (e: MouseEvent) => {
    if (isRemoteControlling) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Send click to cloud browser
      socket.emit(`session:${sessionId}:click`, { x, y });
    }
  };
  
  return (
    <div className="cloud-recording-studio">
      {/* Live browser preview */}
      <div className="browser-preview">
        <img 
          src={browserStream} 
          onClick={handleBrowserClick}
          className="live-browser-feed"
        />
        <div className="browser-controls">
          <button onClick={() => setIsRemoteControlling(!isRemoteControlling)}>
            {isRemoteControlling ? 'Stop Controlling' : 'Take Control'}
          </button>
        </div>
      </div>
      
      {/* Recording controls */}
      <CloudRecordingControls session={session} />
    </div>
  );
}
```

## Benefits of Cloud-Based Approach

### User Experience
- ✅ **Zero Installation**: No local tools required
- ✅ **Cross-Platform**: Works on any device with browser
- ✅ **Real-time Preview**: See recording live
- ✅ **Remote Control**: Control browsers from anywhere
- ✅ **Instant Access**: Start recording immediately

### Technical Advantages
- ✅ **Scalable**: Handle multiple concurrent recordings
- ✅ **Consistent**: Same environment for all users
- ✅ **Updated**: Always latest browser versions
- ✅ **Secure**: Isolated cloud environments
- ✅ **Reliable**: Professional cloud infrastructure

### Business Benefits
- ✅ **SaaS Model**: True cloud-based offering
- ✅ **Easy Onboarding**: No setup friction
- ✅ **Enterprise Ready**: Scales to large teams
- ✅ **Cost Effective**: Shared infrastructure
- ✅ **Competitive**: Unique cloud-first approach

## Docker Configuration for Cloud Browsers

```dockerfile
# Dockerfile for cloud browser service
FROM node:18-slim

# Install browser dependencies
RUN apt-get update && apt-get install -y \
    chromium-browser \
    firefox-esr \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxss1 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set up Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 8000
CMD ["npm", "start"]
```

This cloud-first approach makes Questro a true SaaS platform where everything runs in the cloud!