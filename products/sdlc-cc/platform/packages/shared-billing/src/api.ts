import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { WebhookHandler } from '@finsavvyai/pay';
import { BillingManager } from './billing-manager';
import {
  BillingConfig,
  CreateSubscriptionParams,
  UpdateSubscriptionParams,
  CancelSubscriptionParams,
} from './types';

export function createBillingRoutes(config: BillingConfig): Hono {
  const billing = new BillingManager(config);
  const webhookHandler = new WebhookHandler({
    provider: config.processor,
    secret: config.signingSecret,
  });
  const app = new Hono();

  app.use('/*', cors({
    origin: config.webhookUrl
      ? [config.webhookUrl, 'http://localhost:3000', 'http://localhost:3001']
      : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  }));

  app.get('/health', (c) => c.json({
    status: 'healthy',
    service: 'unified-billing',
    processor: config.processor,
    timestamp: new Date().toISOString(),
  }));

  app.post('/checkout', async (c) => {
    try {
      const body = await c.req.json() as CreateSubscriptionParams;
      const session = await billing.createCheckoutSession(body);
      return c.json({ success: true, data: session });
    } catch (error) {
      console.error('Checkout session error:', error);
      return c.json({
        error: 'Failed to create checkout session',
        message: error instanceof Error ? error.message : 'Unknown error',
      }, 400);
    }
  });

  registerSubscriptionRoutes(app, billing);
  registerUsageRoutes(app, billing);
  registerWebhookRoute(app, billing, webhookHandler, config);

  app.onError((err, c) => {
    console.error('Unhandled error:', err);
    return c.json({ error: 'Internal server error', message: 'An unexpected error occurred' }, 500);
  });

  app.notFound((c) => c.json({
    error: 'Not found',
    message: `Route ${c.req.method} ${c.req.path} not found`,
  }, 404));

  return app;
}

function registerSubscriptionRoutes(app: Hono, billing: BillingManager): void {
  app.get('/subscriptions', async (c) => {
    try {
      const token = c.req.header('Authorization')?.replace('Bearer ', '');
      if (!token) return c.json({ error: 'No token provided' }, 401);
      const subscriptions = await billing.getUserSubscriptions(token);
      return c.json({ success: true, data: subscriptions });
    } catch (error) {
      return c.json({ error: 'Failed to get subscriptions', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
    }
  });

  app.put('/subscriptions/:subscriptionId', async (c) => {
    try {
      const subscriptionId = c.req.param('subscriptionId');
      const body = await c.req.json() as UpdateSubscriptionParams;
      const subscription = await billing.updateSubscription({ ...body, subscriptionId });
      return c.json({ success: true, data: subscription });
    } catch (error) {
      return c.json({ error: 'Failed to update subscription', message: error instanceof Error ? error.message : 'Unknown error' }, 400);
    }
  });

  app.delete('/subscriptions/:subscriptionId', async (c) => {
    try {
      const subscriptionId = c.req.param('subscriptionId');
      const body = await c.req.json() as CancelSubscriptionParams;
      await billing.cancelSubscription({ ...body, subscriptionId });
      return c.json({ success: true, message: 'Subscription cancelled successfully' });
    } catch (error) {
      return c.json({ error: 'Failed to cancel subscription', message: error instanceof Error ? error.message : 'Unknown error' }, 400);
    }
  });

  app.get('/invoices', async (c) => {
    try {
      const token = c.req.header('Authorization')?.replace('Bearer ', '');
      if (!token) return c.json({ error: 'No token provided' }, 401);
      const invoices = await billing.getUserInvoices(token);
      return c.json({ success: true, data: invoices });
    } catch (error) {
      return c.json({ error: 'Failed to get invoices', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
    }
  });

  app.get('/bundle-offer', async (c) => {
    try {
      const token = c.req.header('Authorization')?.replace('Bearer ', '');
      if (!token) return c.json({ error: 'No token provided' }, 401);
      const offer = await billing.suggestTierUpgrade(token);
      return c.json({ success: true, data: offer });
    } catch (error) {
      return c.json({ error: 'Failed to calculate bundle offer', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
    }
  });

  app.get('/analytics', async (c) => {
    try {
      const startDate = new Date(c.req.query('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      const endDate = new Date(c.req.query('endDate') || new Date().toISOString());
      const analytics = await billing.getBillingAnalytics(startDate, endDate);
      return c.json({ success: true, data: analytics });
    } catch (error) {
      return c.json({ error: 'Failed to get analytics', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
    }
  });
}

function registerUsageRoutes(app: Hono, billing: BillingManager): void {
  app.get('/usage/quota', async (c) => {
    try {
      const token = c.req.header('Authorization')?.replace('Bearer ', '');
      if (!token) return c.json({ error: 'No token provided' }, 401);
      const quota = await billing.getUsageQuota(token, c.req.query('productId') || 'all', c.req.query('metric') || 'requests');
      return c.json({ success: true, data: quota });
    } catch (error) {
      return c.json({ error: 'Failed to get usage quota', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
    }
  });

  app.post('/usage', async (c) => {
    try {
      await billing.trackUsage(await c.req.json());
      return c.json({ success: true, message: 'Usage tracked successfully' });
    } catch (error) {
      return c.json({ error: 'Failed to track usage', message: error instanceof Error ? error.message : 'Unknown error' }, 400);
    }
  });
}

function registerWebhookRoute(app: Hono, billing: BillingManager, handler: WebhookHandler, config: BillingConfig): void {
  app.post('/webhook', async (c) => {
    try {
      const sigHeader = config.processor === 'stripe' ? 'stripe-signature' : 'X-Signature';
      const signature = c.req.header(sigHeader);
      if (!signature) return c.json({ error: 'No signature provided' }, 401);

      const event = await handler.handle(signature, await c.req.text());
      const result = await billing.handleWebhook(event.type, event.data);
      return c.json({ success: result.success, processed: result.processed, error: result.error });
    } catch (error) {
      console.error('Webhook error:', error);
      return c.json({ error: 'Webhook processing failed', message: error instanceof Error ? error.message : 'Unknown error' }, 400);
    }
  });
}

export function initBillingServer(config: BillingConfig, port: number = 8788) {
  return {
    start: async () => {
      if (!config.apiKey || !config.supabaseUrl || !config.supabaseServiceKey) {
        throw new Error('Missing required configuration');
      }
      return { port, status: 'starting' as const };
    },
    stop: () => { console.log('Unified Billing Server stopped'); },
  };
}
