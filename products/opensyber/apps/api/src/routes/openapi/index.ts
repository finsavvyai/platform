/**
 * OpenAPI Spec Route
 *
 * GET /openapi.json — Serve the OpenAPI 3.0 specification
 */
import { Hono } from 'hono';
import type { Env, Variables } from '../../types.js';
import { openApiInfo } from './spec-info.js';
import { openApiPaths } from './spec-paths.js';

const openApiRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

const spec = {
  ...openApiInfo,
  paths: openApiPaths,
  tags: [
    { name: 'Agent Activity', description: 'AI agent runtime monitoring' },
    { name: 'Agent Policies', description: 'Agent behavior policies' },
    { name: 'Cloud Security', description: 'CSPM and cloud account management' },
    { name: 'Attack Graph', description: 'Asset inventory and attack path analysis' },
    { name: 'OASF Compliance', description: 'AI Agent Security Framework compliance' },
    { name: 'Marketplace', description: 'Skill marketplace' },
    { name: 'Alert Channels', description: 'Security alert notifications' },
    { name: 'Organizations', description: 'Organization management' },
    { name: 'Instances', description: 'Agent instance management' },
    { name: 'SCIM', description: 'SCIM 2.0 user provisioning' },
    { name: 'SOC2', description: 'SOC2 Type 1 readiness assessment' },
    { name: 'SLA', description: 'SLA monitoring and metrics' },
    { name: 'Data Room', description: 'Series A investor metrics' },
  ],
};

openApiRoutes.get('/', (c) => {
  return c.json(spec);
});

export { openApiRoutes };
