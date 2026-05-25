import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
const configuredOrigins = process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean) || [];
const allowedOrigins = new Set([
  ...configuredOrigins,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);
const isLocalDevOrigin = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || isLocalDevOrigin(origin) || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.get('/api', (req, res) => {
  res.json({
    message: 'Questro API Server',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    features: {
      recording: process.env.ENABLE_RECORDING === 'true',
      mobileeTesting: process.env.ENABLE_MOBILE_TESTING === 'true',
      webTesting: process.env.ENABLE_WEB_TESTING === 'true',
      aiGeneration: process.env.ENABLE_AI_GENERATION === 'true'
    }
  });
});

// Mock authentication endpoints
app.post('/api/auth/register', (req, res) => {
  const { email, password, firstName, lastName } = req.body;
  
  // Mock validation
  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password are required'
    });
  }
  
  // Mock user creation
  const mockUser = {
    id: 'mock-user-' + Date.now(),
    email,
    firstName: firstName || 'Test',
    lastName: lastName || 'User',
    role: 'user',
    subscription: 'free',
    createdAt: new Date().toISOString()
  };
  
  res.status(201).json({
    message: 'User registered successfully',
    user: mockUser,
    tokens: {
      accessToken: 'mock-jwt-access-' + Date.now(),
      refreshToken: 'mock-jwt-refresh-' + Date.now()
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  // Mock validation
  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password are required'
    });
  }
  
  // Mock user authentication
  const mockUser = {
    id: 'mock-user-123',
    email,
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    subscription: 'free'
  };
  
  const ts = Date.now();
  res.json({
    message: 'Login successful',
    user: mockUser,
    tokens: {
      accessToken: 'mock-jwt-access-' + ts,
      refreshToken: 'mock-jwt-refresh-' + ts
    }
  });
});

// Mock auth check endpoint (validates session on page load)
app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Return mock user for any valid-looking token
  res.json({
    id: 'mock-user-123',
    email: 'test@qestro.io',
    name: 'Test User',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    subscription: 'free'
  });
});

// Mock token refresh endpoint
app.post('/api/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }

  const ts = Date.now();
  res.json({
    tokens: {
      accessToken: 'mock-jwt-access-' + ts,
      refreshToken: 'mock-jwt-refresh-' + ts
    }
  });
});

// Mock AI test generation endpoint
app.post('/api/ai/generate-test', (req, res) => {
  const { description, framework, testType } = req.body;
  
  // Mock AI response
  const mockTestCode = `
// Generated test for: ${description}
// Framework: ${framework || 'playwright'}
// Type: ${testType || 'e2e'}

import { test, expect } from '@playwright/test';

test('${description || 'sample test'}', async ({ page }) => {
  // Navigate to the application
  await page.goto('https://example.com');
  
  // Perform test actions
  await page.click('button[data-testid="submit"]');
  
  // Assert expected results
  await expect(page.locator('.success-message')).toBeVisible();
});
`;
  
  setTimeout(() => {
    res.json({
      success: true,
      testCode: mockTestCode,
      framework: framework || 'playwright',
      confidence: 0.95,
      suggestions: [
        'Add more specific selectors',
        'Include error handling',
        'Add performance checks'
      ]
    });
  }, 1000); // Simulate AI processing time
});

// Mock recording endpoints
app.post('/api/recording/start', (req, res) => {
  const { projectId, type, platform } = req.body;
  
  const mockSession = {
    id: 'session-' + Date.now(),
    projectId: projectId || 'mock-project',
    type: type || 'web',
    platform: platform || 'chrome',
    status: 'recording',
    startTime: new Date().toISOString(),
    actionsCount: 0
  };
  
  res.json({
    success: true,
    session: mockSession
  });
});

app.post('/api/recording/:sessionId/stop', (req, res) => {
  const { sessionId } = req.params;
  
  res.json({
    success: true,
    session: {
      id: sessionId,
      status: 'completed',
      endTime: new Date().toISOString(),
      duration: 45000, // 45 seconds
      actionsCount: 12
    }
  });
});

// Mock subscription endpoints
app.get('/api/subscriptions/plans', (req, res) => {
  res.json({
    plans: [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        features: ['100 AI tests', '10 recordings', 'Basic support']
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 29,
        features: ['1000 AI tests', '100 recordings', 'Priority support']
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 99,
        features: ['Unlimited tests', 'Unlimited recordings', 'Dedicated support']
      }
    ]
  });
});

// ─── Core CRUD Routes (in-memory mock) ──────────────────────────────
import testCaseRoutes from './routes/test-cases.mock.routes.js';
import projectRoutes from './routes/projects.mock.routes.js';

app.use('/api/test-cases', testCaseRoutes);
app.use('/api/projects', projectRoutes);

console.log('✅ Core routes loaded: test-cases, projects');

// ─── New Feature Routes ─────────────────────────────────────────────
// Analytics, Scheduling, CI/CD, Self-Healing, OpenClaw
import analyticsRoutes from './routes/analytics.routes.js';
import schedulingRoutes from './routes/scheduling.routes.js';
import cicdRoutes from './routes/cicd.routes.js';
import selfHealingRoutes from './routes/self-healing.routes.js';
import openclawRoutes from './routes/openclaw.routes.js';
import aiTestingRoutes from './routes/ai-testing.routes.js';
import automationRunsRoutes from './routes/automation-runs.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';

app.use('/api/analytics', analyticsRoutes);
app.use('/api/schedules', schedulingRoutes);
app.use('/api/cicd', cicdRoutes);
app.use('/api/self-healing', selfHealingRoutes);
app.use('/api/openclaw', openclawRoutes);
app.use('/api/ai', aiTestingRoutes);
app.use('/api/automation-runs', automationRunsRoutes);
app.use('/api/dashboard', dashboardRoutes);

console.log('✅ All feature routes loaded: analytics, scheduling, cicd, self-healing, openclaw');

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
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
  console.log('🚀 Questro Backend Server Started!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
  console.log(`🔧 API: http://localhost:${PORT}/api`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💡 CORS: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Ready for development!');
});

export default app;
