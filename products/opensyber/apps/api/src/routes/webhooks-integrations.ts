import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import { withResilience } from '../middleware/webhook-resilience.js';
import {
  handleGithubWebhook,
  handleGitlabWebhook,
  handleGenericWebhook,
} from './handlers/integration-webhook-handlers.js';

const integrationWebhookRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

integrationWebhookRoutes.use('*', dbMiddleware);

const ghEvent = (c: any) => c.req.header('X-GitHub-Event') || 'unknown';
const glEvent = (c: any) => c.req.header('X-Gitlab-Event') || 'unknown';

integrationWebhookRoutes.use('/github', idempotencyMiddleware({ source: 'github', getEventType: ghEvent }));
integrationWebhookRoutes.use('/gitlab', idempotencyMiddleware({ source: 'gitlab', getEventType: glEvent }));

integrationWebhookRoutes.post('/github', withResilience(handleGithubWebhook, {
  source: 'github', getEventType: ghEvent,
}));
integrationWebhookRoutes.post('/gitlab', withResilience(handleGitlabWebhook, {
  source: 'gitlab', getEventType: glEvent,
}));
integrationWebhookRoutes.post('/:slug', withResilience(handleGenericWebhook, {
  source: 'generic', getEventType: (c) => `${c.req.param('slug')}.webhook`,
}));

export { integrationWebhookRoutes };
