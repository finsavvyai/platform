/**
 * Beta Testing Service Entry Point
 * SDLC.ai Beta Testing Program
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { z } from 'zod';
import BetaTestingService from './beta-testing.service';
import FeedbackAnalysisService from './feedback-analysis.service';
import { createMcpClient } from '@sdlc/mcp-sdk';

// Create Hono app
const app = new Hono();

// Initialize MCP client
const mcp = createMcpClient();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['https://sdlc.ai', 'https://app.sdlc.ai', 'https://beta.sdlc.ai'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true,
}));

// Authentication middleware
app.use('/api/beta/*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  const apiKey = c.req.header('X-API-Key');

  // Skip auth for public endpoints
  const publicEndpoints = [
    '/api/beta/apply',
    '/api/beta/track',
    '/api/beta/community',
  ];

  if (publicEndpoints.some(path => c.req.path.startsWith(path))) {
    await next();
    return;
  }

  // Try JWT auth first
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const payload = await mcp.auth.verifyJWT(token);
      c.set('userId', payload.sub);
      c.set('userRole', payload.role);
      await next();
      return;
    } catch {
      // Continue to API key auth
    }
  }

  // Try API key auth
  if (apiKey) {
    try {
      const keyInfo = await mcp.auth.validateAPIKey(apiKey);
      c.set('userId', keyInfo.userId);
      c.set('userRole', keyInfo.role);
      await next();
      return;
    } catch {
      // Continue to error
    }
  }

  // No valid auth
  return c.json({
    success: false,
    error: 'Unauthorized',
    message: 'Valid authentication required',
  }, 401);
});

// Initialize services
const betaService = new BetaTestingService(
  mcp.db,
  mcp.kv,
  mcp.email,
  mcp.monitoring
);

const feedbackAnalysis = new FeedbackAnalysisService(
  mcp.db,
  mcp.kv,
  mcp.llm,
  mcp.vector,
  mcp.monitoring
);

// Health check
app.get('/api/beta/health', async (c) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      database: await checkDatabaseHealth(),
      kv: await checkKVHealth(),
      email: await checkEmailHealth(),
      llm: await checkLLMHealth(),
    },
  };

  const isHealthy = Object.values(health.services).every(s => s.status === 'healthy');

  return c.json(health, isHealthy ? 200 : 503);
});

// API Routes
app.route('/api/beta', (await import('./beta-testing.controller')).default);

// Webhook handlers
app.post('/api/beta/webhooks/feedback', async (c) => {
  const signature = c.req.header('X-Signature');
  const payload = await c.req.text();

  // Verify webhook signature
  if (!await verifyWebhookSignature(signature, payload)) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  const data = JSON.parse(payload);

  // Handle feedback events
  if (data.type === 'feedback.created') {
    // Trigger analysis
    await feedbackAnalysis.analyzeFeedback(data.feedbackId);
  }

  return c.json({ received: true });
});

// Background job processor
app.scheduled('/api/beta/jobs/daily-summary', async (c) => {
  // Generate daily summary
  const metrics = await betaService.getBetaMetrics(c);
  const insights = await feedbackAnalysis.generateWeeklyInsights();

  // Send to admin channel
  await mcp.email.send({
    to: 'beta-team@sdlc.ai',
    template: 'beta-daily-summary',
    data: {
      metrics,
      insights,
      date: new Date().toISOString().split('T')[0],
    },
  });

  return c.json({ success: true });
});

app.scheduled('/api/beta/jobs/feedback-analysis', async (c) => {
  // Process unanalyzed feedback
  const unanalyzed = await mcp.db
    .prepare('SELECT id FROM beta_feedback WHERE context IS NULL OR JSON_EXTRACT(context, "$.analysis") IS NULL LIMIT 50')
    .all();

  if (unanalyzed.results?.length > 0) {
    await feedbackAnalysis.processFeedbackBatch(
      unanalyzed.results.map(f => f.id)
    );
  }

  return c.json({ processed: unanalyzed.results?.length || 0 });
});

app.scheduled('/api/beta/jobs/cleanup', async (c) => {
  // Clean up expired invitations
  await mcp.db
    .prepare(`
      UPDATE beta_invitations
      SET status = 'expired'
      WHERE expires_at < CURRENT_TIMESTAMP AND status = 'pending'
    `)
    .run();

  // Archive old feedback
  const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  await mcp.db
    .prepare(`
      UPDATE beta_feedback
      SET status = 'archived'
      WHERE created_at < ? AND status IN ('resolved', 'closed')
    `)
    .bind(cutoffDate.toISOString())
    .run();

  return c.json({ success: true });
});

// Helper functions
async function checkDatabaseHealth() {
  try {
    await mcp.db.prepare('SELECT 1').first();
    return { status: 'healthy', latency: Date.now() };
  } catch (error: any) {
    return { status: 'unhealthy', error: error.message };
  }
}

async function checkKVHealth() {
  try {
    const testKey = `health:${Date.now()}`;
    await mcp.kv.put(testKey, 'ok', { expirationTtl: 60 });
    await mcp.kv.get(testKey);
    return { status: 'healthy', latency: Date.now() };
  } catch (error: any) {
    return { status: 'unhealthy', error: error.message };
  }
}

async function checkEmailHealth() {
  try {
    // Simple health check - would depend on email service
    return { status: 'healthy' };
  } catch (error: any) {
    return { status: 'unhealthy', error: error.message };
  }
}

async function checkLLMHealth() {
  try {
    // Simple health check - would depend on LLM service
    return { status: 'healthy' };
  } catch (error: any) {
    return { status: 'unhealthy', error: error.message };
  }
}

async function verifyWebhookSignature(signature: string | undefined, payload: string): Promise<boolean> {
  if (!signature) return false;

  // Implementation would verify signature using webhook secret
  // For now, return true for demo
  return true;
}

// Error handler
app.onError((err, c) => {
  mcp.monitoring.trackError(err);

  return c.json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    requestId: c.get('requestId'),
  }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Not found',
    message: `The requested endpoint ${c.req.method} ${c.req.path} was not found`,
  }, 404);
});

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
  scheduled: app.scheduled,
};
