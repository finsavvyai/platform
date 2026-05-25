import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { lemonSqueezyWebhookRoutes } from './webhooks-lemonsqueezy.js';
import { agentHealthWebhookRoutes } from './webhooks-agent-health.js';
import { agentProvisionedRoutes } from './webhooks-agent-provisioned.js';

const webhookRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

webhookRoutes.use('*', dbMiddleware);

webhookRoutes.route('/', lemonSqueezyWebhookRoutes);
webhookRoutes.route('/', agentHealthWebhookRoutes);
webhookRoutes.route('/', agentProvisionedRoutes);

export { webhookRoutes };
