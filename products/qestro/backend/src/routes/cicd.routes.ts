/**
 * CI/CD Integration Routes
 * Handles webhook integration with GitHub, GitLab, and other CI/CD platforms
 */

import { Router, Request, Response } from 'express';
import { authenticateUser, requireRole } from '../middleware/auth.js';
import { cicdIntegrationService } from '../services/CICDIntegrationService.js';
import type { CICDProvider } from '../services/CICDIntegrationService.js';
import { logger } from '../utils/logger.js';

const router = Router();

const formatResponse = (data: unknown, message?: string) => ({
  success: true,
  data,
  message,
  timestamp: new Date().toISOString(),
});

const handleError = (res: Response, error: unknown, statusCode = 500) => {
  const msg = error instanceof Error ? error.message : 'Unknown error';
  logger.error('CI/CD error:', { error: msg });
  res.status(statusCode).json({ success: false, error: msg, timestamp: new Date().toISOString() });
};

// POST /api/cicd/webhook/:provider - Receive CI/CD webhooks
router.post('/webhook/:provider', async (req: Request, res: Response) => {
  try {
    const provider = req.params.provider as CICDProvider;
    const signature = (req.headers['x-hub-signature-256'] || req.headers['x-gitlab-token']) as string | undefined;

    const event = await cicdIntegrationService.handleWebhook(req.body, provider, signature);
    if (!event) return res.status(204).json({ success: true, message: 'No action taken' });

    res.status(202).json(formatResponse({ event: event.event, repo: event.repoUrl, branch: event.branch }, `Webhook from ${provider} received`));
  } catch (error) {
    handleError(res, error, 400);
  }
});

// GET /api/cicd/integrations - List configured integrations
router.get('/integrations', authenticateUser, async (_req: Request, res: Response) => {
  try {
    const configs = cicdIntegrationService.listConfigs();
    res.json(formatResponse({ integrations: configs, total: configs.length }, 'Integrations retrieved'));
  } catch (error) {
    handleError(res, error);
  }
});

// POST /api/cicd/integrations - Register new CI/CD integration
router.post('/integrations', authenticateUser, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { projectId, provider, repoUrl, webhookSecret, triggerEvents, branchFilter, testSuiteIds, authToken, postResults } = req.body;
    if (!projectId || !provider || !repoUrl)
      return res.status(400).json({ success: false, error: 'projectId, provider, and repoUrl required' });

    const valid = ['github', 'gitlab', 'generic'];
    if (!valid.includes(provider))
      return res.status(400).json({ success: false, error: `Invalid provider. Supported: ${valid.join(', ')}` });

    await cicdIntegrationService.registerIntegration({
      projectId,
      provider,
      repoUrl,
      authToken: authToken || '',
      webhookSecret,
      triggerEvents: triggerEvents || ['push', 'pull_request'],
      branchFilter: branchFilter ? new RegExp(branchFilter) : undefined,
      testSuiteIds: testSuiteIds || [],
      postResults: postResults !== false,
    });

    res.status(201).json(formatResponse({ projectId, provider, repoUrl }, 'Integration registered'));
  } catch (error) {
    handleError(res, error, 400);
  }
});

// GET /api/cicd/integrations/:id/status - Check integration status
router.get('/integrations/:id/status', authenticateUser, async (req: Request, res: Response) => {
  try {
    const config = cicdIntegrationService.getConfig(req.params.id);
    if (!config) return res.status(404).json({ success: false, error: 'Integration not found' });
    res.json(formatResponse({ config, status: 'active' }, 'Integration status'));
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
