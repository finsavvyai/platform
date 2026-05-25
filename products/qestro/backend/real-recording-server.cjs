const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 9003;

// Store active recording sessions
const activeSessions = new Map();
const browsers = new Map();

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (origin.startsWith('http://localhost') || 
        origin.startsWith('https://localhost') || 
        origin.startsWith('file://') ||
        origin === 'null') {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: 'development',
    activeSessions: activeSessions.size
  });
});

// Mock authentication
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (email && password) {
    res.json({
      success: true,
      token: 'real-jwt-token-' + Date.now(),
      user: {
        id: 'user-123',
        email: email,
        name: 'Test User'
      }
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'Email and password required'
    });
  }
});

// REAL RECORDING: Start recording with actual browser
app.post('/api/recording/start', async (req, res) => {
  try {
    const { type, platform, metadata } = req.body;
    const sessionId = 'session-' + Date.now();
    
    console.log(`🎬 Starting REAL recording session: ${sessionId}`);
    console.log(`Target URL: ${metadata?.url || 'https://example.com'}`);
    
    // Launch actual browser
    const browser = await puppeteer.launch({
      headless: false, // Show browser so you can see it working!
      defaultViewport: { width: 1920, height: 1080 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set up recording listeners
    const actions = [];
    
    // Record page navigation
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        actions.push({
          type: 'navigate',
          url: frame.url(),
          timestamp: Date.now(),
          selector: null
        });
        console.log(`📍 Navigated to: ${frame.url()}`);
      }
    });
    
    // Record console messages
    page.on('console', (msg) => {
      actions.push({
        type: 'console',
        message: msg.text(),
        timestamp: Date.now(),
        selector: null
      });
    });
    
    // Navigate to target URL
    const targetUrl = metadata?.url || 'https://example.com';
    await page.goto(targetUrl, { waitUntil: 'networkidle0' });
    
    // Take initial screenshot
    const screenshot = await page.screenshot({ encoding: 'base64' });
    
    // Store session
    const session = {
      id: sessionId,
      type: type || 'web',
      platform: platform || 'chrome',
      status: 'recording',
      startTime: new Date().toISOString(),
      metadata: metadata || {},
      browser,
      page,
      actions,
      screenshots: [screenshot]
    };
    
    activeSessions.set(sessionId, session);
    browsers.set(sessionId, browser);
    
    // Set up real-time action recording
    await setupActionRecording(page, sessionId, actions);
    
    res.json({
      success: true,
      id: sessionId,
      type: session.type,
      platform: session.platform,
      status: session.status,
      startTime: session.startTime,
      metadata: session.metadata,
      initialScreenshot: `data:image/png;base64,${screenshot}`,
      browserVisible: true,
      message: 'Real browser launched! You can interact with it now.'
    });
    
  } catch (error) {
    console.error('Error starting recording:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Set up real action recording
async function setupActionRecording(page, sessionId, actions) {
  try {
    // Inject recording script into the page
    await page.evaluateOnNewDocument(() => {
      // Record clicks
      document.addEventListener('click', (event) => {
        const element = event.target;
        const selector = generateSelector(element);
        
        window.recordedAction = {
          type: 'click',
          selector: selector,
          text: element.textContent?.trim() || '',
          tagName: element.tagName,
          timestamp: Date.now(),
          coordinates: {
            x: event.clientX,
            y: event.clientY
          }
        };
      }, true);
      
      // Record input changes
      document.addEventListener('input', (event) => {
        const element = event.target;
        const selector = generateSelector(element);
        
        window.recordedAction = {
          type: 'input',
          selector: selector,
          value: element.value,
          tagName: element.tagName,
          timestamp: Date.now()
        };
      }, true);
      
      // Generate smart selector
      function generateSelector(element) {
        if (element.id) return `#${element.id}`;
        if (element.className) return `.${element.className.split(' ')[0]}`;
        
        let selector = element.tagName.toLowerCase();
        let parent = element.parentElement;
        
        while (parent && parent !== document.body) {
          if (parent.id) {
            selector = `#${parent.id} ${selector}`;
            break;
          }
          if (parent.className) {
            selector = `.${parent.className.split(' ')[0]} ${selector}`;
            break;
          }
          parent = parent.parentElement;
        }
        
        return selector;
      }
    });
    
    // Poll for recorded actions
    const pollActions = async () => {
      try {
        const session = activeSessions.get(sessionId);
        if (!session || session.status !== 'recording') return;
        
        const recordedAction = await page.evaluate(() => {
          const action = window.recordedAction;
          window.recordedAction = null;
          return action;
        });
        
        if (recordedAction) {
          actions.push(recordedAction);
          console.log(`🎯 Recorded action: ${recordedAction.type} on ${recordedAction.selector}`);
        }
        
        // Continue polling
        setTimeout(pollActions, 500);
      } catch (error) {
        console.error('Error polling actions:', error);
      }
    };
    
    // Start polling
    setTimeout(pollActions, 1000);
    
  } catch (error) {
    console.error('Error setting up action recording:', error);
  }
}

// REAL RECORDING: Stop recording
app.post('/api/recording/stop', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = activeSessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }
    
    console.log(`🛑 Stopping recording session: ${sessionId}`);
    
    // Take final screenshot
    const finalScreenshot = await session.page.screenshot({ encoding: 'base64' });
    session.screenshots.push(finalScreenshot);
    
    // Calculate duration
    const duration = Math.floor((Date.now() - new Date(session.startTime).getTime()) / 1000);
    
    // Update session
    session.status = 'stopped';
    session.endTime = new Date().toISOString();
    session.duration = duration;
    
    // Close browser
    await session.browser.close();
    browsers.delete(sessionId);
    
    console.log(`✅ Session ${sessionId} stopped. Recorded ${session.actions.length} actions`);
    
    res.json({
      success: true,
      sessionId: sessionId,
      status: 'stopped',
      duration: duration,
      actionsRecorded: session.actions.length,
      screenshots: session.screenshots.length,
      endTime: session.endTime,
      actions: session.actions.slice(0, 10), // Return first 10 actions as preview
      finalScreenshot: `data:image/png;base64,${finalScreenshot}`
    });
    
  } catch (error) {
    console.error('Error stopping recording:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get session details
app.get('/api/recording/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found'
    });
  }
  
  res.json({
    success: true,
    session: {
      id: session.id,
      type: session.type,
      platform: session.platform,
      status: session.status,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.duration,
      actionsRecorded: session.actions.length,
      screenshots: session.screenshots.length,
      metadata: session.metadata
    },
    actions: session.actions,
    screenshots: session.screenshots
  });
});

// List all sessions
app.get('/api/recording/sessions', (req, res) => {
  const sessions = Array.from(activeSessions.values()).map(session => ({
    id: session.id,
    type: session.type,
    platform: session.platform,
    status: session.status,
    startTime: session.startTime,
    endTime: session.endTime,
    duration: session.duration,
    actionsRecorded: session.actions.length,
    metadata: session.metadata
  }));
  
  res.json(sessions);
});

// PLAYBACK: Replay recorded actions
app.post('/api/recording/playback/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { speed = 1 } = req.body; // Speed multiplier (1 = normal, 0.5 = half speed, 2 = double speed)
    
    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }
    
    if (session.actions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No actions recorded to playback'
      });
    }
    
    console.log(`🎬 Starting playback for session ${sessionId} at ${speed}x speed`);
    
    // Launch new browser for playback
    const playbackBrowser = await puppeteer.launch({
      headless: false, // Show browser during playback
      defaultViewport: { width: 1920, height: 1080 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    
    const playbackPage = await playbackBrowser.newPage();
    
    // Start playback
    const playbackId = 'playback-' + Date.now();
    const playbackResults = [];
    
    // Navigate to initial URL
    const initialUrl = session.metadata.url || 'https://example.com';
    await playbackPage.goto(initialUrl, { waitUntil: 'networkidle0' });
    
    playbackResults.push({
      step: 0,
      action: 'navigate',
      url: initialUrl,
      status: 'success',
      timestamp: Date.now()
    });
    
    // Replay each action
    for (let i = 0; i < session.actions.length; i++) {
      const action = session.actions[i];
      
      try {
        console.log(`🎯 Replaying action ${i + 1}/${session.actions.length}: ${action.type}`);
        
        // Add delay based on speed
        const delay = Math.max(500 / speed, 100); // Minimum 100ms delay
        await new Promise(resolve => setTimeout(resolve, delay));
        
        let stepResult = {
          step: i + 1,
          action: action.type,
          selector: action.selector,
          status: 'success',
          timestamp: Date.now()
        };
        
        switch (action.type) {
          case 'click':
            if (action.selector) {
              await playbackPage.waitForSelector(action.selector, { timeout: 5000 });
              await playbackPage.click(action.selector);
              stepResult.message = `Clicked on ${action.selector}`;
            }
            break;
            
          case 'input':
            if (action.selector && action.value) {
              await playbackPage.waitForSelector(action.selector, { timeout: 5000 });
              await playbackPage.fill(action.selector, action.value);
              stepResult.message = `Typed "${action.value}" in ${action.selector}`;
              stepResult.value = action.value;
            }
            break;
            
          case 'navigate':
            if (action.url) {
              await playbackPage.goto(action.url, { waitUntil: 'networkidle0' });
              stepResult.message = `Navigated to ${action.url}`;
              stepResult.url = action.url;
            }
            break;
            
          default:
            stepResult.status = 'skipped';
            stepResult.message = `Skipped unsupported action: ${action.type}`;
        }
        
        playbackResults.push(stepResult);
        
      } catch (error) {
        console.error(`❌ Error replaying action ${i + 1}:`, error.message);
        playbackResults.push({
          step: i + 1,
          action: action.type,
          selector: action.selector,
          status: 'error',
          error: error.message,
          timestamp: Date.now()
        });
      }
    }
    
    // Take final screenshot
    const finalScreenshot = await playbackPage.screenshot({ encoding: 'base64' });
    
    // Keep browser open for a few seconds to see the result
    setTimeout(async () => {
      try {
        await playbackBrowser.close();
        console.log(`✅ Playback completed for session ${sessionId}`);
      } catch (error) {
        console.error('Error closing playback browser:', error);
      }
    }, 5000);
    
    res.json({
      success: true,
      playbackId,
      sessionId,
      totalActions: session.actions.length,
      successfulActions: playbackResults.filter(r => r.status === 'success').length,
      failedActions: playbackResults.filter(r => r.status === 'error').length,
      skippedActions: playbackResults.filter(r => r.status === 'skipped').length,
      speed,
      results: playbackResults,
      finalScreenshot: `data:image/png;base64,${finalScreenshot}`,
      message: 'Playback completed! Browser will close in 5 seconds.'
    });
    
  } catch (error) {
    console.error('Error during playback:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate test code from recorded actions
app.post('/api/recording/generate-test/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found'
    });
  }
  
  // Generate Playwright test code
  let testCode = `import { test, expect } from '@playwright/test';

test('Recorded test from session ${sessionId}', async ({ page }) => {
  // Navigate to initial URL
  await page.goto('${session.metadata.url || 'https://example.com'}');
  await page.waitForLoadState('networkidle');
  
`;

  session.actions.forEach((action, index) => {
    switch (action.type) {
      case 'click':
        testCode += `  // Action ${index + 1}: Click on ${action.selector}\n`;
        testCode += `  await page.click('${action.selector}');\n`;
        testCode += `  await page.waitForTimeout(1000);\n\n`;
        break;
      case 'input':
        testCode += `  // Action ${index + 1}: Type in ${action.selector}\n`;
        testCode += `  await page.fill('${action.selector}', '${action.value}');\n`;
        testCode += `  await page.waitForTimeout(500);\n\n`;
        break;
      case 'navigate':
        testCode += `  // Action ${index + 1}: Navigate to ${action.url}\n`;
        testCode += `  await page.goto('${action.url}');\n`;
        testCode += `  await page.waitForLoadState('networkidle');\n\n`;
        break;
    }
  });
  
  testCode += `  // Take final screenshot
  await page.screenshot({ path: 'test-result.png' });
});`;

  res.json({
    success: true,
    testCode,
    framework: 'playwright',
    actionsConverted: session.actions.length,
    sessionId
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// Cleanup on exit
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down server...');
  
  // Close all browsers
  for (const [sessionId, browser] of browsers) {
    try {
      await browser.close();
      console.log(`Closed browser for session ${sessionId}`);
    } catch (error) {
      console.error(`Error closing browser for session ${sessionId}:`, error);
    }
  }
  
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 Qestro REAL Recording Server Started!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
  console.log(`🎬 Real browser recording enabled!`);
  console.log(`🌐 Environment: development`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Ready for REAL web recording!');
  console.log('');
  console.log('🎯 This server will:');
  console.log('   • Launch actual Chrome browsers');
  console.log('   • Record real user interactions');
  console.log('   • Capture screenshots');
  console.log('   • Generate test code');
  console.log('');
});