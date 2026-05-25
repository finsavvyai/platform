/**
 * Mock API Server for OpenSyber Local Development
 * 
 * This server simulates the Cloudflare Workers API endpoints
 * to allow frontend development without requiring live deployments.
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8787;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'mock-api' });
});

// Mock authentication endpoint
app.post('/api/auth/verify', (req, res) => {
  const { token } = req.body;
  // Accept any token for development
  res.json({
    userId: 'user-dev-123',
    orgId: null,
    role: 'owner',
    plan: 'free'
  });
});

// Mock instances endpoints
app.get('/api/instances', (req, res) => {
  res.json({
    data: [
      {
        id: 'inst-dev-1',
        name: 'Development Agent',
        status: 'running',
        agentType: 'cline',
        createdAt: new Date().toISOString(),
      }
    ]
  });
});

// Mock security dashboard
app.get('/api/security/dashboard', (req, res) => {
  res.json({
    data: {
      totalInstances: 1,
      runningInstances: 1,
      totalViolations: 0,
      criticalFindings: 0,
    }
  });
});

// Mock cloud accounts
app.get('/api/cloud/accounts', (req, res) => {
  res.json({ data: [] });
});

// Mock CSPM findings
app.get('/api/cloud/findings', (req, res) => {
  res.json({ data: [] });
});

// Mock agent activity
app.get('/api/agents/activity', (req, res) => {
  res.json({
    data: [],
    hasMore: false
  });
});

// Mock team dashboard
app.get('/api/agents/team', (req, res) => {
  res.json({
    data: {
      members: [],
      totalScore: 100,
      grade: 'A'
    }
  });
});

// Mock policies
app.get('/api/agents/policies', (req, res) => {
  res.json({
    data: [
      {
        id: 'pol-default-1',
        name: 'Default Security Policy',
        severity: 'medium',
        isActive: true,
        rules: []
      }
    ]
  });
});

// Mock reports
app.get('/api/agents/reports', (req, res) => {
  res.json({ data: [] });
});

// Mock score
app.get('/api/score', (req, res) => {
  res.json({
    data: {
      agentScore: 100,
      cspmScore: 100,
      combinedScore: 100,
      grade: 'A'
    }
  });
});

// Mock alert channels
app.get('/api/alert-channels', (req, res) => {
  res.json({ data: [] });
});

// Mock achievements
app.get('/api/achievements', (req, res) => {
  res.json({ data: [] });
});

// Mock threats
app.get('/api/threats', (req, res) => {
  res.json({ data: [] });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Mock endpoint not implemented: ${req.method} ${req.path}`,
    hint: 'This is a development mock API. Implement the endpoint or deploy to Cloudflare Workers.'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Mock API error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    service: 'mock-api'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Mock API server running on http://localhost:${PORT}`);
  console.log(`📋 Mocking Cloudflare Workers endpoints`);
  console.log(`🔧 Development mode only`);
});
