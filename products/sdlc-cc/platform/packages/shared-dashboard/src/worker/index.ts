/**
 * Unified Dashboard API Worker
 * Aggregates data from all enterprise products and provides real-time analytics
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import authRoutes from './auth-routes';
import billingRoutes from './billing-routes';
import adminRoutes from './admin-routes';
import apiKeyRoutes from './api-key-routes';
import dashboardApiRoutes from './dashboard-api-routes';
import productRoutes from './product-routes';
import realtimeRoutes from './realtime-routes';
import operationalRoutes from './operational-routes';
import { DashboardRealtime } from './realtime';
import { landingPageHTML } from './landing-page';
import { integrationsPageHTML } from './integrations-page';
import { registerPageHTML, loginPageHTML } from './auth-pages';
import { pricingPageHTML } from './pricing-page';
import { dashboardPageHTML } from './dashboard-page';
import { earlyAccessPageHTML } from './early-access-page';
import { generateDocsPageHTML } from './docs-page';
import { setJWTSecret } from './crypto-utils';

// Export Durable Object
export { DashboardRealtime };

// Type definitions for environment bindings
interface Env {
  SDLC_GATEWAY?: Fetcher;
  SDLC_RAG?: Fetcher;
  SDLC_VECTOR?: Fetcher;
  DASHBOARD_CACHE?: KVNamespace;
  DASHBOARD_DB: D1Database;
  DASHBOARD_ASSETS: R2Bucket;
  DASHBOARD_ANALYTICS?: AnalyticsEngineDataset;
  DASHBOARD_REALTIME: DurableObjectNamespace;
  ENVIRONMENT: string;
  API_VERSION: string;
  ENABLE_ANALYTICS: string;
  ENABLE_CACHING: string;
  CACHE_TTL: string;
  RATE_LIMIT_PER_MINUTE: string;
  CORS_ALLOWED_ORIGINS: string;
  JWT_SECRET?: string;
  LEMONSQUEEZY_API_KEY?: string;
  LEMONSQUEEZY_STORE_ID?: string;
  LEMONSQUEEZY_WEBHOOK_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}

// Initialize Hono app
const app = new Hono<{ Bindings: Env }>();

// Initialize authentication before processing any requests
app.use('*', async (c, next) => {
  if (c.env.JWT_SECRET) {
    setJWTSecret(c.env.JWT_SECRET);
  }
  await next();
});

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: (origin) => {
    const allowed = ['https://app.sdlc.cc', 'https://dashboard.sdlc.cc', 'http://localhost:9999'];
    return allowed.includes(origin) ? origin : 'https://app.sdlc.cc';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 600,
  credentials: true,
}));

// Rate limiting
app.use('*', async (_c, next) => {
  // TODO: Implement rate limiting logic here
  await next();
});

// Mount API routes
app.route('/api/v1/auth', authRoutes);
app.route('/api/v1/billing', billingRoutes);
app.route('/api/v1/admin', adminRoutes);
app.route('/api/v1/api-keys', apiKeyRoutes);
app.route('/api/v1/dashboard', dashboardApiRoutes);
app.route('/api/v1/products', productRoutes);
app.route('/api/v1/realtime', realtimeRoutes);
app.route('/api/v1', operationalRoutes);

// Page routes
app.get('/', async (c) => c.html(landingPageHTML));
app.get('/integrations', async (c) => c.html(integrationsPageHTML));
app.get('/auth/register', async (c) => c.html(registerPageHTML));
app.get('/auth/login', async (c) => c.html(loginPageHTML));
app.get('/auth/pricing', async (c) => c.html(pricingPageHTML));
app.get('/pricing', async (c) => c.html(pricingPageHTML));
app.get('/dashboard', async (c) => c.html(dashboardPageHTML));
app.get('/early-access', async (c) => c.html(earlyAccessPageHTML));

// API Documentation page
app.get('/api/v1/docs', (c) => {
  const docsHTML = generateDocsPageHTML({
    baseUrl: c.req.url.split('/api')[0],
    apiVersion: c.env.API_VERSION || 'v1',
    environment: c.env.ENVIRONMENT || 'production',
    rateLimitPerMinute: c.env.RATE_LIMIT_PER_MINUTE || '120',
  });
  return c.html(docsHTML);
});

// OAuth callback redirects
app.get('/auth/google/callback', async (c) => {
  const url = new URL(c.req.url);
  return c.redirect(`/api/v1/auth/google/callback${url.search}`);
});

app.get('/auth/github/callback', async (c) => {
  const url = new URL(c.req.url);
  return c.redirect(`/api/v1/auth/github/callback${url.search}`);
});

// Health check endpoint (public)
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    version: c.env.API_VERSION || 'v1',
    environment: c.env.ENVIRONMENT || 'production',
    timestamp: new Date().toISOString(),
  });
});

// Export the app
export default app;
