const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 9000;

// Middleware - Fix CORS for file:// and all origins
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman, or file://)
    if (!origin) return callback(null, true);
    
    // Allow all localhost origins and file protocol
    if (origin.startsWith('http://localhost') || 
        origin.startsWith('https://localhost') || 
        origin.startsWith('file://') ||
        origin === 'null') {
      return callback(null, true);
    }
    
    // Allow all origins for testing
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
    environment: 'development'
  });
});

// Mock authentication
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (email && password) {
    res.json({
      success: true,
      token: 'mock-jwt-token-' + Date.now(),
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

// Mock recording endpoints
app.post('/api/recording/start', (req, res) => {
  const { type, platform, metadata } = req.body;
  
  const sessionId = 'session-' + Date.now();
  
  res.json({
    success: true,
    id: sessionId,
    type: type || 'web',
    platform: platform || 'chrome',
    status: 'recording',
    startTime: new Date().toISOString(),
    metadata: metadata || {}
  });
});

app.post('/api/recording/stop', (req, res) => {
  const { sessionId } = req.body;
  
  res.json({
    success: true,
    sessionId: sessionId,
    status: 'stopped',
    duration: Math.floor(Math.random() * 120) + 10, // Random duration 10-130 seconds
    endTime: new Date().toISOString()
  });
});

app.get('/api/recording/sessions', (req, res) => {
  const mockSessions = [
    {
      id: 'session-1',
      type: 'web',
      platform: 'chrome',
      status: 'completed',
      startTime: new Date(Date.now() - 3600000).toISOString(),
      duration: 45
    },
    {
      id: 'session-2',
      type: 'mobile',
      platform: 'ios',
      status: 'completed',
      startTime: new Date(Date.now() - 7200000).toISOString(),
      duration: 78
    }
  ];
  
  res.json(mockSessions);
});

// Mock cloud recording
app.post('/api/recording/cloud/start', (req, res) => {
  const { browser, url, cloudProvider, cloudCredentials } = req.body;
  
  const sessionId = 'cloud-session-' + Date.now();
  
  res.json({
    success: true,
    sessionId: sessionId,
    browser: browser,
    url: url,
    cloudProvider: cloudProvider,
    status: 'starting',
    startTime: new Date().toISOString()
  });
});

// Mock AI endpoints
app.post('/api/ai/smart-selectors', (req, res) => {
  const selectors = [
    '#login-btn',
    'button[class*="btn-primary"]',
    'button:contains("Login")',
    '//button[@id="login-btn"]'
  ];
  
  res.json({
    success: true,
    selectors: selectors,
    confidence: 0.95
  });
});

app.post('/api/ai/assertions', (req, res) => {
  const assertions = [
    'Element should be visible',
    'Button text should equal "Login"',
    'Element should be clickable',
    'Page should contain login form'
  ];
  
  res.json({
    success: true,
    assertions: assertions,
    confidence: 0.92
  });
});

app.post('/api/ai/parameters', (req, res) => {
  const parameters = [
    { name: 'username', type: 'input', selector: '#username' },
    { name: 'password', type: 'input', selector: '#password' },
    { name: 'rememberMe', type: 'checkbox', selector: '#remember' }
  ];
  
  res.json({
    success: true,
    parameters: parameters,
    confidence: 0.88
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

// Start server
app.listen(PORT, () => {
  console.log('🚀 Questro Test Server Started!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
  console.log(`🌐 Environment: development`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Ready for browser testing!');
});