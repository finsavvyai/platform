/**
 * Supply Chain Security Routes
 * Customer-facing endpoints for supply chain risk visibility.
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import {
  scanSkillSource,
  auditManifestDomains,
  generateSupplyChainEvidence,
} from '../services/supply-chain-security.js';
import { detectMcpCommandInjection, scanAllMcpConfigs } from '../services/mcp-command-guard.js';
import type { McpServerConfig } from '../services/mcp-monitor.js';
import { scanSkillSchema, scanMcpSchema } from './validation/supply-chain.js';

export const supplyChainRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();
supplyChainRoutes.use('*', dbMiddleware, authMiddleware);

// GET /status — supply chain security posture overview
supplyChainRoutes.get('/status', async (c) => {
  const evidence = generateSupplyChainEvidence();
  const passCount = evidence.controls.filter((ctrl) => ctrl.status === 'pass').length;
  const totalCount = evidence.controls.length;

  return c.json({
    data: {
      score: Math.round((passCount / totalCount) * 100),
      controls: evidence.controls,
      summary: {
        total: totalCount,
        passing: passCount,
        partial: totalCount - passCount,
      },
    },
  });
});

// POST /scan-skill — scan skill source code for risks
supplyChainRoutes.post('/scan-skill', async (c) => {
  const parsed = scanSkillSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Invalid input', details: parsed.error.issues[0]?.message }, 400);
  const body = parsed.data;

  const sourceRisks = scanSkillSource(body.source);
  const domainRisks = body.domains
    ? auditManifestDomains(body.domains)
    : [];

  return c.json({
    data: {
      risks: [...sourceRisks, ...domainRisks],
      riskCount: sourceRisks.length + domainRisks.length,
      hasCritical: [...sourceRisks, ...domainRisks].some(
        (r) => r.severity === 'critical',
      ),
    },
  });
});

// POST /scan-mcp — scan MCP server configs for CursorJack
supplyChainRoutes.post('/scan-mcp', async (c) => {
  const parsedMcp = scanMcpSchema.safeParse(await c.req.json());
  if (!parsedMcp.success) return c.json({ error: 'Invalid input', details: parsedMcp.error.issues[0]?.message }, 400);

  const alerts = scanAllMcpConfigs(parsedMcp.data.configs as unknown as McpServerConfig[]);

  return c.json({
    data: {
      alerts,
      alertCount: alerts.length,
      hasCritical: alerts.some((a) => a.severity === 'critical'),
    },
  });
});
