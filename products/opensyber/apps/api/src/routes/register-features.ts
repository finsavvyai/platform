/**
 * Feature Route Registration
 *
 * NHI Manager, Cost Bomb Protection, MCP Guardian routes.
 * Extracted from register.ts to stay under 200-line limit.
 */
import type { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { nhiRoutes } from './nhi.js';
import { costRoutes } from './costs.js';
import { mcpGuardianRoutes } from './mcp-guardian.js';
import { bundleRoutes, userBundleRoutes } from './bundles.js';

type App = Hono<{ Bindings: Env; Variables: Variables }>;

export function registerFeatureRoutes(app: App): void {
  app.route('/api/nhi/agents', nhiRoutes);
  app.route('/api/costs', costRoutes);
  app.route('/api/mcp/guardian', mcpGuardianRoutes);
  app.route('/api/bundles', bundleRoutes);
  app.route('/api/user/bundles', userBundleRoutes);
}
