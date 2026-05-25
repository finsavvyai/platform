import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';

export const healthRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

healthRoutes.get('/', (c) => {
  return c.json({
    status: 'healthy',
    service: 'tokenforge-api',
    timestamp: new Date().toISOString(),
  });
});
