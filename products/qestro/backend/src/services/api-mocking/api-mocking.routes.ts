/**
 * API Mocking Routes
 * Endpoints for creating and managing mock servers and scenarios
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { mockEngine } from './MockEngine.js';
import { mockScenarioManager } from './MockScenarioManager.js';
import type { MockServerConfig } from './types.js';
import { authenticateUser } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';

export const apiMockingRouter = Router();
apiMockingRouter.use(authenticateUser);

const createServerSchema = z.object({
  projectId: z.string().uuid(),
  baseUrl: z.string().url().optional(),
  port: z.number().int().min(1000).max(65535).optional(),
  enableLogging: z.boolean().optional(),
});

const createEndpointSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
  path: z.string().min(1),
  description: z.string().optional(),
  defaultResponse: z.object({
    statusCode: z.number().int().min(100).max(599),
    headers: z.record(z.string()).optional(),
    body: z.unknown().optional(),
    delay: z.number().int().min(0).optional(),
  }),
  rules: z.array(z.unknown()).optional(),
  stateful: z.boolean().optional(),
  responseSequence: z.array(z.unknown()).optional(),
});

const createScenarioSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(255),
  endpoints: z.array(z.unknown()),
});

apiMockingRouter.post('/servers', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const config = createServerSchema.parse(req.body);
    const server = await mockEngine.createMockServer(config.projectId, config as MockServerConfig);
    res.status(201).json(server);
  } catch (error) {
    logger.error('Create mock server error:', error);
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid request', details: error.errors });
    res.status(500).json({ error: 'Failed to create mock server' });
  }
});

apiMockingRouter.get('/servers/:serverId', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const server = await mockEngine.getServer(req.params.serverId);
    if (!server) return res.status(404).json({ error: 'Server not found' });
    res.json(server);
  } catch (error) {
    logger.error('Get mock server error:', error);
    res.status(500).json({ error: 'Failed to fetch mock server' });
  }
});

apiMockingRouter.post('/servers/:serverId/endpoints', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const endpoint = createEndpointSchema.parse(req.body);
    await mockEngine.addEndpoint(req.params.serverId, endpoint as any);
    res.status(201).json({ success: true, message: 'Endpoint added' });
  } catch (error) {
    logger.error('Add endpoint error:', error);
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid request', details: error.errors });
    res.status(500).json({ error: 'Failed to add endpoint' });
  }
});

apiMockingRouter.delete('/servers/:serverId/endpoints/:endpointId', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    await mockEngine.removeEndpoint(req.params.serverId, req.params.endpointId);
    res.json({ success: true, message: 'Endpoint removed' });
  } catch (error) {
    logger.error('Remove endpoint error:', error);
    res.status(500).json({ error: 'Failed to remove endpoint' });
  }
});

apiMockingRouter.get('/servers/:serverId/logs', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const logs = await mockEngine.getRequestLogs(req.params.serverId);
    res.json({ logs, count: logs.length });
  } catch (error) {
    logger.error('Get logs error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

apiMockingRouter.delete('/servers/:serverId/logs', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    await mockEngine.clearLogs(req.params.serverId);
    res.json({ success: true, message: 'Logs cleared' });
  } catch (error) {
    logger.error('Clear logs error:', error);
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

apiMockingRouter.delete('/servers/:serverId', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    await mockEngine.deleteServer(req.params.serverId);
    res.json({ success: true, message: 'Server deleted' });
  } catch (error) {
    logger.error('Delete server error:', error);
    res.status(500).json({ error: 'Failed to delete server' });
  }
});

apiMockingRouter.post('/scenarios', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const data = createScenarioSchema.parse(req.body);
    const scenario = await mockScenarioManager.createScenario(data.projectId, data.name, data.endpoints as any);
    res.status(201).json(scenario);
  } catch (error) {
    logger.error('Create scenario error:', error);
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid request', details: error.errors });
    res.status(500).json({ error: 'Failed to create scenario' });
  }
});

apiMockingRouter.get('/scenarios', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId required' });
    const scenarios = await mockScenarioManager.getScenarios(projectId as string);
    res.json({ scenarios, count: scenarios.length });
  } catch (error) {
    logger.error('Get scenarios error:', error);
    res.status(500).json({ error: 'Failed to fetch scenarios' });
  }
});

apiMockingRouter.post('/scenarios/:scenarioId/activate', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId required' });
    await mockScenarioManager.activateScenario(req.params.scenarioId, projectId);
    res.json({ success: true, message: 'Scenario activated' });
  } catch (error) {
    logger.error('Activate scenario error:', error);
    res.status(500).json({ error: 'Failed to activate scenario' });
  }
});

apiMockingRouter.post('/scenarios/preset/:type', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const { projectId } = req.body;
    const { type } = req.params;
    if (!projectId) return res.status(400).json({ error: 'projectId required' });
    let scenario;
    switch (type) {
      case 'happy-path':
        scenario = await mockScenarioManager.createHappyPathScenario(projectId);
        break;
      case 'errors':
        scenario = await mockScenarioManager.createErrorScenario(projectId);
        break;
      case 'slow-network':
        scenario = await mockScenarioManager.createSlowNetworkScenario(projectId);
        break;
      case 'auth-failures':
        scenario = await mockScenarioManager.createAuthFailureScenario(projectId);
        break;
      default:
        return res.status(400).json({ error: `Unknown scenario type: ${type}` });
    }
    res.status(201).json(scenario);
  } catch (error) {
    logger.error('Create preset scenario error:', error);
    res.status(500).json({ error: 'Failed to create scenario' });
  }
});

apiMockingRouter.delete('/scenarios/:scenarioId', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    await mockScenarioManager.deleteScenario(req.params.scenarioId);
    res.json({ success: true, message: 'Scenario deleted' });
  } catch (error) {
    logger.error('Delete scenario error:', error);
    res.status(500).json({ error: 'Failed to delete scenario' });
  }
});
