/**
 * Cloudflare Worker entry point for Unified Billing API
 * Composed from route modules for maintainability
 */

import { createBillingApp } from './billing-types';
import type { BillingEnv } from './billing-types';
import { registerSubscriptionRoutes } from './routes-subscription';
import { registerWebhookRoutes } from './routes-webhook';
import { registerAnalyticsRoutes } from './routes-analytics';

const app = createBillingApp();

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'unified-billing',
    processor: 'lemonsqueezy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: [
      'Real R2 storage persistence',
      'Subscription tier upgrades',
      'Webhook signature verification',
      'Analytics with real revenue data',
      'Secure cancellation processing',
    ],
  });
});

// Register route groups
registerSubscriptionRoutes(app);
registerWebhookRoutes(app);
registerAnalyticsRoutes(app);

// Default route
app.all('*', (c) => {
  return c.json(
    {
      error: 'Not Found',
      message: 'The requested endpoint does not exist',
      availableEndpoints: [
        'GET /health',
        'GET /tiers',
        'POST /checkout',
        'GET /subscription/:userId',
        'POST /subscription/:userId/upgrade',
        'POST /subscription/:userId/cancel',
        'POST /webhook',
        'GET /analytics/:userId',
      ],
    },
    404,
  );
});

// Export for Cloudflare Workers
export default app;

// Export fetch handler for Workers
export const fetch = app.fetch;

// Export scheduled handler for billing tasks
export const scheduled = async (event: {
  cron: string;
  env?: BillingEnv;
}) => {
  console.log(`Scheduled billing task: ${event.cron}`, {
    timestamp: new Date().toISOString(),
    environment: event.env?.ENVIRONMENT || 'unknown',
  });
};
