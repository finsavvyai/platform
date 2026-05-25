import type { Hono } from 'hono';
import webhooks from '../routes/webhooks';
import openclawWebhookRoutes from '../routes/webhooks/openclaw';
import openclawIntegrationRoutes from '../routes/integrations/openclaw';
import { connectwiseRoutes } from '../routes/integrations-connectwise';
import { connectwiseWebhookRoutes } from '../routes/webhooks-connectwise';
import { dattoRoutes } from '../routes/integrations-datto';
import { kaseyaRoutes } from '../routes/integrations-kaseya';
import { graphWebhookRoutes } from '../routes/graph-webhook';
import { marketplaceRoutes } from '../routes/marketplace';
import { billingRoutes } from '../routes/billing';
import { partnerRoutes } from '../routes/partners';
import { websocketRoutes } from '../routes/websocket';
import type { AppEnv } from './types';

export function registerIntegrationRoutes(app: Hono<AppEnv>) {
	app.route('/api/webhooks', webhooks);
	app.route('/api/webhooks/openclaw', openclawWebhookRoutes);
	app.route('/api/integrations/openclaw', openclawIntegrationRoutes);
	app.route('/api/integrations/connectwise', connectwiseRoutes);
	app.route('/api/integrations/datto', dattoRoutes);
	app.route('/api/integrations/kaseya', kaseyaRoutes);
	app.route('/api/webhooks/connectwise', connectwiseWebhookRoutes);
	app.route('/api/graph', graphWebhookRoutes);
	app.route('/api/marketplace', marketplaceRoutes);
	app.route('/api/billing', billingRoutes);
	app.route('/api/partners', partnerRoutes);
	app.route('/api', websocketRoutes);
}
