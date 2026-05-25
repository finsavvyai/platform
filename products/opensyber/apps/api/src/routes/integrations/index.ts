/**
 * Integrations Routes
 *
 * Central router for all third-party integrations.
 * - POST /api/integrations/pipewarden/findings - CI/CD security findings
 * - POST /api/integrations/pipewarden/audit    - audit events
 * - GET  /api/integrations/pipewarden/status   - PipeWarden health
 * - POST /api/integrations/pipewarden/scan     - trigger remote scan
 * - POST /api/integrations/tenantiq/findings   - M365 alerts from tenantiq
 * - POST /api/integrations/sdlc/violations     - DLP violations from sdlc.cc
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../../types.js';
import { dbMiddleware } from '../../middleware/db.js';
import { authMiddleware } from '../../middleware/auth.js';
import { pipewardenWebhookRoutes } from './pipewarden.js';
import { tenantiqWebhookRoutes } from './tenantiq.js';
import { sdlcWebhookRoutes } from './sdlc.js';
import {
  handlePipewardenAudit,
  handlePipewardenStatus,
  handlePipewardenScan,
} from './handlers/pipewarden-proxy.js';

export const integrationRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

integrationRoutes.use('*', dbMiddleware);

integrationRoutes.post('/pipewarden/findings', async (c) => {
  const response = await pipewardenWebhookRoutes.fetch(c.req.raw, c.env);
  return response;
});

integrationRoutes.post('/pipewarden/audit', handlePipewardenAudit);
integrationRoutes.get('/pipewarden/status', authMiddleware, handlePipewardenStatus);
integrationRoutes.post('/pipewarden/scan', authMiddleware, handlePipewardenScan);

integrationRoutes.post('/tenantiq/findings', async (c) => {
  const response = await tenantiqWebhookRoutes.fetch(c.req.raw, c.env);
  return response;
});

integrationRoutes.post('/sdlc/violations', async (c) => {
  const response = await sdlcWebhookRoutes.fetch(c.req.raw, c.env);
  return response;
});

export { pipewardenWebhookRoutes, tenantiqWebhookRoutes, sdlcWebhookRoutes };
export const integrations = integrationRoutes;
