/**
 * Platform Health Endpoint
 *
 * Unified health check for all platform subsystems.
 */
import { Hono } from 'hono';
import { aggregatePlatformHealth, getDefaultSubsystems } from '../services/platform-health.js';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';

export const platformHealthRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

platformHealthRoutes.use('*', dbMiddleware, authMiddleware);

platformHealthRoutes.get('/health', async (c) => {
  const subsystems = getDefaultSubsystems();
  const health = aggregatePlatformHealth(subsystems);
  return c.json({ data: health });
});
