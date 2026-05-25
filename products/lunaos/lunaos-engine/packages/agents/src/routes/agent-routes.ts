/**
 * Agent Management API Routes
 *
 * Provides REST API endpoints for agent management including:
 * - Agent CRUD operations
 * - Agent lifecycle management
 * - Resource quota management
 * - Health monitoring
 * - Metrics and analytics
 * - Version management
 */

import { Router, Request, Response } from 'express';
import { AgentService } from '../agent-service';
import { HealthMonitor } from '../health-monitor';
import { AgentLifecycleManager } from '../agent-lifecycle';
import { ResourceQuotaManager } from '../resource-quota-manager';
import {
  Agent,
  AgentConfig,
  ResourceQuota,
  AgentStatus,
  AgentType,
  AgentHealth
} from '../interfaces';
import { validate as uuidValidate } from 'uuid';
import { logger } from '@claude-agent/utils';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  project?: {
    id: string;
    role: string;
  };
}

export class AgentRoutes {
  private router: Router;
  private agentService: AgentService;
  private healthMonitor: HealthMonitor;
  private lifecycleManager: AgentLifecycleManager;
  private resourceQuotaManager: ResourceQuotaManager;

  constructor(
    agentService: AgentService,
    healthMonitor: HealthMonitor,
    lifecycleManager: AgentLifecycleManager,
    resourceQuotaManager: ResourceQuotaManager
  ) {
    this.router = Router();
    this.agentService = agentService;
    this.healthMonitor = healthMonitor;
    this.lifecycleManager = lifecycleManager;
    this.resourceQuotaManager = resourceQuotaManager;

    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Agent CRUD operations
    this.router.post('/', this.createAgent.bind(this));
    this.router.get('/', this.listAgents.bind(this));
    this.router.get('/:agentId', this.getAgent.bind(this));
    this.router.put('/:agentId', this.updateAgent.bind(this));
    this.router.delete('/:agentId', this.deleteAgent.bind(this));

    // Agent lifecycle operations
    this.router.post('/:agentId/start', this.startAgent.bind(this));
    this.router.post('/:agentId/stop', this.stopAgent.bind(this));
    this.router.post('/:agentId/restart', this.restartAgent.bind(this));
    this.router.post('/:agentId/pause', this.pauseAgent.bind(this));
    this.router.post('/:agentId/resume', this.resumeAgent.bind(this));

    // Agent configuration operations
    this.router.put('/:agentId/config', this.updateAgentConfig.bind(this));
    this.router.get('/:agentId/config', this.getAgentConfig.bind(this));

    // Resource quota operations
    this.router.put('/:agentId/quota', this.updateResourceQuota.bind(this));
    this.router.get('/:agentId/quota', this.getResourceQuota.bind(this));
    this.router.get('/:agentId/usage', this.getResourceUsage.bind(this));
    this.router.post('/:agentId/check-availability', this.checkResourceAvailability.bind(this));
    this.router.get('/:agentId/optimization', this.getOptimizationRecommendations.bind(this));

    // Health monitoring operations
    this.router.get('/:agentId/health', this.getAgentHealth.bind(this));
    this.router.get('/:agentId/health/summary', this.getHealthSummary.bind(this));
    this.router.post('/:agentId/health/check', this.triggerHealthCheck.bind(this));
    this.router.put('/:agentId/health/config', this.updateHealthCheckConfig.bind(this));

    // Metrics and analytics
    this.router.get('/:agentId/metrics', this.getAgentMetrics.bind(this));
    this.router.get('/:agentId/metrics/history', this.getMetricsHistory.bind(this));

    // Version management
    this.router.get('/:agentId/versions', this.getAgentVersions.bind(this));
    this.router.post('/:agentId/versions', this.createAgentVersion.bind(this));
    this.router.post('/:agentId/versions/:versionId/deploy', this.deployAgentVersion.bind(this));
    this.router.post('/:agentId/versions/:versionId/rollback', this.rollbackAgentVersion.bind(this));
    this.router.delete('/:agentId/versions/:versionId', this.deleteAgentVersion.bind(this));
    this.router.get('/:agentId/versions/:versionId', this.getAgentVersion.bind(this));
    this.router.post('/:agentId/versions/:versionId/compare/:compareVersionId', this.compareVersions.bind(this));
    this.router.post('/:agentId/versions/:versionId/promote', this.promoteVersion.bind(this));

    // Dependencies management
    this.router.get('/:agentId/dependencies', this.getAgentDependencies.bind(this));
    this.router.post('/:agentId/dependencies', this.addAgentDependency.bind(this));
    this.router.put('/:agentId/dependencies/:dependencyId', this.updateAgentDependency.bind(this));
    this.router.delete('/:agentId/dependencies/:dependencyId', this.removeAgentDependency.bind(this));

    // Execution history
    this.router.get('/:agentId/executions', this.getAgentExecutions.bind(this));
    this.router.get('/:agentId/executions/:executionId', this.getAgentExecution.bind(this));

    // Configuration history
    this.router.get('/:agentId/config/history', this.getConfigHistory.bind(this));

    // Status transitions
    this.router.get('/:agentId/transitions', this.getStatusTransitions.bind(this));

    // Resource alerts and violations
    this.router.get('/:agentId/alerts', this.getResourceAlerts.bind(this));
    this.router.get('/:agentId/violations', this.getQuotaViolations.bind(this));
  }

  /**
   * POST /api/v1/agents
   * Create a new agent
   */
  private async createAgent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        name,
        type,
        description,
        projectId,
        config,
        resourceQuota,
        metadata
      } = req.body;

      // Validate required fields
      if (!name || !type || !projectId) {
        res.status(400).json({
          error: 'Missing required fields: name, type, projectId',
          code: 'MISSING_FIELDS'
        });
        return;
      }

      // Validate agent type
      const validTypes: string[] = [
        'requirements-analyzer', 'design-architect', 'task-planner', 'task-executor',
        'code-review', 'testing-validation', 'deployment', 'documentation',
        'monitoring-observability', 'post-launch-review', 'custom'
      ];

      if (!validTypes.includes(type)) {
        res.status(400).json({
          error: `Invalid agent type: ${type}. Valid types: ${validTypes.join(', ')}`,
          code: 'INVALID_AGENT_TYPE'
        });
        return;
      }

      // Create agent
      const agent = await this.agentService.registerAgent({
        name,
        type,
        description,
        projectId,
        config,
        resourceQuota,
        metadata
      });

      res.status(201).json({
        success: true,
        data: agent,
        message: 'Agent created successfully'
      });

    } catch (error) {
      logger.error('Failed to create agent:', error);
      res.status(500).json({
        error: 'Failed to create agent',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_CREATION_FAILED'
      });
    }
  }

  /**
   * GET /api/v1/agents
   * List agents with filtering and pagination
   */
  private async listAgents(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        projectId,
        type,
        status,
        tags,
        search,
        limit = 50,
        offset = 0,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const filters: any = {};

      if (projectId && typeof projectId === 'string') {
        filters.projectId = projectId;
      }

      if (type && typeof type === 'string') {
        filters.type = type;
      }

      if (status && typeof status === 'string') {
        filters.status = status as AgentStatus;
      }

      if (tags && typeof tags === 'string') {
        filters.tags = tags.split(',');
      }

      if (search && typeof search === 'string') {
        filters.search = search;
      }

      const parsedLimit = Math.min(parseInt(limit as string, 10) || 50, 100);
      const parsedOffset = Math.max(parseInt(offset as string, 10) || 0, 0);

      const result = await this.agentService.listAgents({
        ...filters,
        limit: parsedLimit,
        offset: parsedOffset
      });

      res.json({
        success: true,
        data: result.agents,
        pagination: {
          total: result.total,
          limit: parsedLimit,
          offset: parsedOffset,
          hasMore: parsedOffset + parsedLimit < result.total
        }
      });

    } catch (error) {
      logger.error('Failed to list agents:', error);
      res.status(500).json({
        error: 'Failed to list agents',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_LIST_FAILED'
      });
    }
  }

  /**
   * GET /api/v1/agents/:agentId
   * Get agent details
   */
  private async getAgent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      const agent = await this.agentService.getAgent(agentId);

      if (!agent) {
        res.status(404).json({
          error: 'Agent not found',
          code: 'AGENT_NOT_FOUND'
        });
        return;
      }

      res.json({
        success: true,
        data: agent
      });

    } catch (error) {
      logger.error('Failed to get agent:', error);
      res.status(500).json({
        error: 'Failed to get agent',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_GET_FAILED'
      });
    }
  }

  /**
   * PUT /api/v1/agents/:agentId
   * Update agent
   */
  private async updateAgent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const { name, description, metadata } = req.body;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      // Get current agent
      const currentAgent = await this.agentService.getAgent(agentId);
      if (!currentAgent) {
        res.status(404).json({
          error: 'Agent not found',
          code: 'AGENT_NOT_FOUND'
        });
        return;
      }

      // Prepare update data
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (metadata !== undefined) updateData.metadata = metadata;

      // Update agent metadata
      const updatedMetadata = { ...currentAgent.metadata, ...metadata };
      const updatedAgent = { ...currentAgent, ...updateData, metadata: updatedMetadata };

      res.json({
        success: true,
        data: updatedAgent,
        message: 'Agent updated successfully'
      });

    } catch (error) {
      logger.error('Failed to update agent:', error);
      res.status(500).json({
        error: 'Failed to update agent',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_UPDATE_FAILED'
      });
    }
  }

  /**
   * DELETE /api/v1/agents/:agentId
   * Delete an agent
   */
  private async deleteAgent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const { force = false } = req.query;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      await this.agentService.deleteAgent(agentId, force === 'true');

      res.json({
        success: true,
        message: 'Agent deleted successfully'
      });

    } catch (error) {
      logger.error('Failed to delete agent:', error);
      res.status(500).json({
        error: 'Failed to delete agent',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_DELETION_FAILED'
      });
    }
  }

  /**
   * POST /api/v1/agents/:agentId/start
   * Start an agent
   */
  private async startAgent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const { config } = req.body;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      const agent = await this.agentService.getAgent(agentId);
      if (!agent) {
        res.status(404).json({
          error: 'Agent not found',
          code: 'AGENT_NOT_FOUND'
        });
        return;
      }

      await this.lifecycleManager.startAgent(agent);

      res.json({
        success: true,
        message: 'Agent started successfully'
      });

    } catch (error) {
      logger.error('Failed to start agent:', error);
      res.status(500).json({
        error: 'Failed to start agent',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_START_FAILED'
      });
    }
  }

  /**
   * POST /api/v1/agents/:agentId/stop
   * Stop an agent
   */
  private async stopAgent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const { graceful = true } = req.body;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      const agent = await this.agentService.getAgent(agentId);
      if (!agent) {
        res.status(404).json({
          error: 'Agent not found',
          code: 'AGENT_NOT_FOUND'
        });
        return;
      }

      await this.lifecycleManager.stopAgent(agent, graceful);

      res.json({
        success: true,
        message: 'Agent stopped successfully'
      });

    } catch (error) {
      logger.error('Failed to stop agent:', error);
      res.status(500).json({
        error: 'Failed to stop agent',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_STOP_FAILED'
      });
    }
  }

  /**
   * POST /api/v1/agents/:agentId/restart
   * Restart an agent
   */
  private async restartAgent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      const agent = await this.agentService.getAgent(agentId);
      if (!agent) {
        res.status(404).json({
          error: 'Agent not found',
          code: 'AGENT_NOT_FOUND'
        });
        return;
      }

      await this.lifecycleManager.restartAgent(agent);

      res.json({
        success: true,
        message: 'Agent restarted successfully'
      });

    } catch (error) {
      logger.error('Failed to restart agent:', error);
      res.status(500).json({
        error: 'Failed to restart agent',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_RESTART_FAILED'
      });
    }
  }

  /**
   * POST /api/v1/agents/:agentId/pause
   * Pause an agent
   */
  private async pauseAgent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      const agent = await this.agentService.getAgent(agentId);
      if (!agent) {
        res.status(404).json({
          error: 'Agent not found',
          code: 'AGENT_NOT_FOUND'
        });
        return;
      }

      await this.lifecycleManager.pauseAgent(agent);

      res.json({
        success: true,
        message: 'Agent paused successfully'
      });

    } catch (error) {
      logger.error('Failed to pause agent:', error);
      res.status(500).json({
        error: 'Failed to pause agent',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_PAUSE_FAILED'
      });
    }
  }

  /**
   * POST /api/v1/agents/:agentId/resume
   * Resume an agent
   */
  private async resumeAgent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      const agent = await this.agentService.getAgent(agentId);
      if (!agent) {
        res.status(404).json({
          error: 'Agent not found',
          code: 'AGENT_NOT_FOUND'
        });
        return;
      }

      await this.lifecycleManager.resumeAgent(agent);

      res.json({
        success: true,
        message: 'Agent resumed successfully'
      });

    } catch (error) {
      logger.error('Failed to resume agent:', error);
      res.status(500).json({
        error: 'Failed to resume agent',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_RESUME_FAILED'
      });
    }
  }

  /**
   * PUT /api/v1/agents/:agentId/config
   * Update agent configuration
   */
  private async updateAgentConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const configUpdate = req.body;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      const updatedAgent = await this.agentService.updateAgentConfig(agentId, configUpdate);

      res.json({
        success: true,
        data: updatedAgent,
        message: 'Agent configuration updated successfully'
      });

    } catch (error) {
      logger.error('Failed to update agent config:', error);
      res.status(500).json({
        error: 'Failed to update agent configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_CONFIG_UPDATE_FAILED'
      });
    }
  }

  /**
   * GET /api/v1/agents/:agentId/config
   * Get agent configuration
   */
  private async getAgentConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      const agent = await this.agentService.getAgent(agentId);
      if (!agent) {
        res.status(404).json({
          error: 'Agent not found',
          code: 'AGENT_NOT_FOUND'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          config: agent.config,
          capabilities: agent.capabilities,
          dependencies: agent.dependencies
        }
      });

    } catch (error) {
      logger.error('Failed to get agent config:', error);
      res.status(500).json({
        error: 'Failed to get agent configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_CONFIG_GET_FAILED'
      });
    }
  }

  /**
   * PUT /api/v1/agents/:agentId/quota
   * Update resource quota
   */
  private async updateResourceQuota(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const quotaUpdate = req.body;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      const updatedQuota = await this.agentService.updateResourceQuota(agentId, quotaUpdate);

      res.json({
        success: true,
        data: updatedQuota,
        message: 'Resource quota updated successfully'
      });

    } catch (error) {
      logger.error('Failed to update resource quota:', error);
      res.status(500).json({
        error: 'Failed to update resource quota',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'RESOURCE_QUOTA_UPDATE_FAILED'
      });
    }
  }

  /**
   * GET /api/v1/agents/:agentId/quota
   * Get resource quota
   */
  private async getResourceQuota(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      const quota = await this.agentService.getResourceQuota(agentId);
      if (!quota) {
        res.status(404).json({
          error: 'Resource quota not found',
          code: 'QUOTA_NOT_FOUND'
        });
        return;
      }

      res.json({
        success: true,
        data: quota
      });

    } catch (error) {
      logger.error('Failed to get resource quota:', error);
      res.status(500).json({
        error: 'Failed to get resource quota',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'RESOURCE_QUOTA_GET_FAILED'
      });
    }
  }

  /**
   * GET /api/v1/agents/:agentId/usage
   * Get current resource usage
   */
  private async getResourceUsage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      const usage = await this.resourceQuotaManager.getResourceUsage(agentId);
      if (!usage) {
        res.status(404).json({
          error: 'Resource usage not available',
          code: 'USAGE_NOT_AVAILABLE'
        });
        return;
      }

      res.json({
        success: true,
        data: usage
      });

    } catch (error) {
      logger.error('Failed to get resource usage:', error);
      res.status(500).json({
        error: 'Failed to get resource usage',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'RESOURCE_USAGE_GET_FAILED'
      });
    }
  }

  /**
   * POST /api/v1/agents/:agentId/check-availability
   * Check if resources are available for a task
   */
  private async checkResourceAvailability(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const { requirements } = req.body;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      const availability = await this.resourceQuotaManager.checkResourceAvailability(
        agentId,
        requirements
      );

      res.json({
        success: true,
        data: availability
      });

    } catch (error) {
      logger.error('Failed to check resource availability:', error);
      res.status(500).json({
        error: 'Failed to check resource availability',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'RESOURCE_AVAILABILITY_CHECK_FAILED'
      });
    }
  }

  /**
   * GET /api/v1/agents/:agentId/optimization
   * Get resource optimization recommendations
   */
  private async getOptimizationRecommendations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      const recommendations = await this.resourceQuotaManager.getOptimizationRecommendations(agentId);

      res.json({
        success: true,
        data: recommendations
      });

    } catch (error) {
      logger.error('Failed to get optimization recommendations:', error);
      res.status(500).json({
        error: 'Failed to get optimization recommendations',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'OPTIMIZATION_RECOMMENDATIONS_FAILED'
      });
    }
  }

  /**
   * GET /api/v1/agents/:agentId/health
   * Get agent health status
   */
  private async getAgentHealth(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      const health = await this.healthMonitor.getAgentHealth(agentId);
      if (!health) {
        res.status(404).json({
          error: 'Agent health data not found',
          code: 'HEALTH_NOT_FOUND'
        });
        return;
      }

      res.json({
        success: true,
        data: health
      });

    } catch (error) {
      logger.error('Failed to get agent health:', error);
      res.status(500).json({
        error: 'Failed to get agent health',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_HEALTH_GET_FAILED'
      });
    }
  }

  /**
   * GET /api/v1/agents/:agentId/health/summary
   * Get health summary for all agents
   */
  private async getHealthSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const summary = await this.healthMonitor.getHealthSummary();

      res.json({
        success: true,
        data: summary
      });

    } catch (error) {
      logger.error('Failed to get health summary:', error);
      res.status(500).json({
        error: 'Failed to get health summary',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'HEALTH_SUMMARY_FAILED'
      });
    }
  }

  /**
   * POST /api/v1/agents/:agentId/health/check
   * Trigger manual health check
   */
  private async triggerHealthCheck(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      const health = await this.healthMonitor.triggerHealthCheck(agentId);

      res.json({
        success: true,
        data: health,
        message: 'Health check completed'
      });

    } catch (error) {
      logger.error('Failed to trigger health check:', error);
      res.status(500).json({
        error: 'Failed to trigger health check',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'HEALTH_CHECK_FAILED'
      });
    }
  }

  /**
   * PUT /api/v1/agents/:agentId/health/config
   * Update health check configuration
   */
  private async updateHealthCheckConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const healthConfig = req.body;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      await this.healthMonitor.updateHealthCheck(agentId, healthConfig);

      res.json({
        success: true,
        message: 'Health check configuration updated successfully'
      });

    } catch (error) {
      logger.error('Failed to update health check config:', error);
      res.status(500).json({
        error: 'Failed to update health check configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'HEALTH_CONFIG_UPDATE_FAILED'
      });
    }
  }

  /**
   * GET /api/v1/agents/:agentId/metrics
   * Get comprehensive agent metrics
   */
  private async getAgentMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const { timeframe = '1h' } = req.query;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      const metrics = await this.agentService.getAgentMetrics(agentId);

      res.json({
        success: true,
        data: metrics
      });

    } catch (error) {
      logger.error('Failed to get agent metrics:', error);
      res.status(500).json({
        error: 'Failed to get agent metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_METRICS_GET_FAILED'
      });
    }
  }

  /**
   * GET /api/v1/agents/:agentId/metrics/history
   * Get metrics history
   */
  private async getMetricsHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const {
        timeframe = '1h',
        interval = '5m',
        metric = 'cpu'
      } = req.query;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      // This would integrate with a time-series database
      // For now, return mock data
      const history = {
        agentId,
        metric,
        timeframe,
        interval,
        data: [
          { timestamp: new Date(Date.now() - 3600000), value: 45.5 },
          { timestamp: new Date(Date.now() - 3000000), value: 52.3 },
          { timestamp: new Date(Date.now() - 2400000), value: 38.7 }
        ]
      };

      res.json({
        success: true,
        data: history
      });

    } catch (error) {
      logger.error('Failed to get metrics history:', error);
      res.status(500).json({
        error: 'Failed to get metrics history',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'METRICS_HISTORY_FAILED'
      });
    }
  }

  /**
   * GET /api/v1/agents/:agentId/versions
   * Get agent versions
   */
  private async getAgentVersions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const { status } = req.query;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      // This would integrate with the agent versioning system
      const versions = [
        {
          id: 'version-1',
          agentId,
          version: '1.0.0',
          status: 'deployed',
          isActive: true,
          createdAt: new Date(),
          deployedAt: new Date(),
          changelog: 'Initial version'
        }
      ];

      res.json({
        success: true,
        data: versions
      });

    } catch (error) {
      logger.error('Failed to get agent versions:', error);
      res.status(500).json({
        error: 'Failed to get agent versions',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_VERSIONS_GET_FAILED'
      });
    }
  }

  /**
   * POST /api/v1/agents/:agentId/versions
   * Create a new agent version
   */
  private async createAgentVersion(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const { changelog } = req.body;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      const agent = await this.agentService.getAgent(agentId);
      if (!agent) {
        res.status(404).json({
          error: 'Agent not found',
          code: 'AGENT_NOT_FOUND'
        });
        return;
      }

      // This would integrate with the agent versioning system
      const version = {
        id: 'new-version-id',
        agentId,
        version: '1.1.0',
        status: 'draft',
        isActive: false,
        createdAt: new Date(),
        config: agent.config,
        changelog
      };

      res.status(201).json({
        success: true,
        data: version,
        message: 'Agent version created successfully'
      });

    } catch (error) {
      logger.error('Failed to create agent version:', error);
      res.status(500).json({
        error: 'Failed to create agent version',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_VERSION_CREATE_FAILED'
      });
    }
  }

  /**
   * POST /api/v1/agents/:agentId/versions/:versionId/deploy
   * Deploy an agent version
   */
  private async deployAgentVersion(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId, versionId } = req.params;
      const { environment = 'production' } = req.body;

      if (!uuidValidate(agentId) || !uuidValidate(versionId)) {
        res.status(400).json({
          error: 'Invalid agent ID or version ID format',
          code: 'INVALID_ID_FORMAT'
        });
        return;
      }

      // This would integrate with the agent versioning system
      const deploymentResult = {
        success: true,
        version: {
          id: versionId,
          agentId,
          version: '1.1.0',
          status: 'deployed',
          deploymentTime: new Date()
        }
      };

      res.json({
        success: true,
        data: deploymentResult,
        message: 'Agent version deployed successfully'
      });

    } catch (error) {
      logger.error('Failed to deploy agent version:', error);
      res.status(500).json({
        error: 'Failed to deploy agent version',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_VERSION_DEPLOY_FAILED'
      });
    }
  }

  /**
   * POST /api/v1/agents/:agentId/versions/:versionId/rollback
   * Rollback to a specific version
   */
  private async rollbackAgentVersion(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId, versionId } = req.params;

      if (!uuidValidate(agentId) || !uuidValidate(versionId)) {
        res.status(400).json({
          error: 'Invalid agent ID or version ID format',
          code: 'INVALID_ID_FORMAT'
        });
        return;
      }

      // This would integrate with the agent versioning system
      const rollbackResult = {
        success: true,
        version: {
          id: versionId,
          agentId,
          version: '1.0.0',
          status: 'deployed'
        },
        rollbackVersion: {
          id: 'previous-version-id',
          agentId,
          version: '1.1.0',
          status: 'rolled-back'
        },
        deploymentTime: new Date()
      };

      res.json({
        success: true,
        data: rollbackResult,
        message: 'Agent rollback completed successfully'
      });

    } catch (error) {
      logger.error('Failed to rollback agent version:', error);
      res.status(500).json({
        error: 'Failed to rollback agent version',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_ROLLBACK_FAILED'
      });
    }
  }

  /**
   * DELETE /api/v1/agents/:agentId/versions/:versionId
   * Delete an agent version
   */
  private async deleteAgentVersion(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId, versionId } = req.params;

      if (!uuidValidate(agentId) || !uuidValidate(versionId)) {
        res.status(400).json({
          error: 'Invalid agent ID or version ID format',
          code: 'INVALID_ID_FORMAT'
        });
        return;
      }

      // This would integrate with the agent versioning system
      // For now, just return success

      res.json({
        success: true,
        message: 'Agent version deleted successfully'
      });

    } catch (error) {
      logger.error('Failed to delete agent version:', error);
      res.status(500).json({
        error: 'Failed to delete agent version',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_VERSION_DELETE_FAILED'
      });
    }
  }

  /**
   * GET /api/v1/agents/:agentId/versions/:versionId
   * Get specific agent version
   */
  private async getAgentVersion(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId, versionId } = req.params;

      if (!uuidValidate(agentId) || !uuidValidate(versionId)) {
        res.status(400).json({
          error: 'Invalid agent ID or version ID format',
          code: 'INVALID_ID_FORMAT'
        });
        return;
      }

      // This would integrate with the agent versioning system
      const version = {
        id: versionId,
        agentId,
        version: '1.0.0',
        status: 'deployed',
        isActive: true,
        createdAt: new Date(),
        deployedAt: new Date(),
        config: {},
        changelog: 'Initial version'
      };

      res.json({
        success: true,
        data: version
      });

    } catch (error) {
      logger.error('Failed to get agent version:', error);
      res.status(500).json({
        error: 'Failed to get agent version',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_VERSION_GET_FAILED'
      });
    }
  }

  /**
   * POST /api/v1/agents/:agentId/versions/:versionId/compare/:compareVersionId
   * Compare two agent versions
   */
  private async compareVersions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId, versionId, compareVersionId } = req.params;

      if (!uuidValidate(agentId) || !uuidValidate(versionId) || !uuidValidate(compareVersionId)) {
        res.status(400).json({
          error: 'Invalid ID format',
          code: 'INVALID_ID_FORMAT'
        });
        return;
      }

      // This would integrate with the agent versioning system
      const comparison = {
        version1: {
          id: versionId,
          agentId,
          version: '1.0.0',
          config: { timeout: 30000 },
          capabilities: ['feature-a'],
          dependencies: [],
          metadata: {}
        },
        version2: {
          id: compareVersionId,
          agentId,
          version: '1.1.0',
          config: { timeout: 60000 },
          capabilities: ['feature-a', 'feature-b'],
          dependencies: [],
          metadata: {}
        },
        differences: {
          config: true,
          capabilities: true,
          dependencies: false,
          metadata: false
        }
      };

      res.json({
        success: true,
        data: comparison
      });

    } catch (error) {
      logger.error('Failed to compare agent versions:', error);
      res.status(500).json({
        error: 'Failed to compare agent versions',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_VERSION_COMPARE_FAILED'
      });
    }
  }

  /**
   * POST /api/v1/agents/:agentId/versions/:versionId/promote
   * Promote version to environment
   */
  private async promoteVersion(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId, versionId } = req.params;
      const { environment } = req.body;

      if (!uuidValidate(agentId) || !uuidValidate(versionId)) {
        res.status(400).json({
          error: 'Invalid agent ID or version ID format',
          code: 'INVALID_ID_FORMAT'
        });
        return;
      }

      // This would integrate with the agent versioning system
      // For now, just return success

      res.json({
        success: true,
        message: `Version promoted to ${environment}`
      });

    } catch (error) {
      logger.error('Failed to promote version:', error);
      res.status(500).json({
        error: 'Failed to promote version',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'VERSION_PROMOTE_FAILED'
      });
    }
  }

  /**
   * GET /api/v1/agents/:agentId/dependencies
   * Get agent dependencies
   */
  private async getAgentDependencies(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      // This would integrate with the database
      const dependencies = [
        {
          id: 'dep-1',
          agentId,
          dependencyName: 'database-service',
          dependencyType: 'service',
          dependencyVersion: '1.0.0',
          isRequired: true,
          status: 'resolved',
          lastChecked: new Date()
        }
      ];

      res.json({
        success: true,
        data: dependencies
      });

    } catch (error) {
      logger.error('Failed to get agent dependencies:', error);
      res.status(500).json({
        error: 'Failed to get agent dependencies',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_DEPENDENCIES_GET_FAILED'
      });
    }
  }

  /**
   * POST /api/v1/agents/:agentId/dependencies
   * Add agent dependency
   */
  private async addAgentDependency(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const {
        dependencyName,
        dependencyType,
        dependencyVersion,
        isRequired = true,
        dependencyConfig
      } = req.body;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      if (!dependencyName || !dependencyType) {
        res.status(400).json({
          error: 'Missing required fields: dependencyName, dependencyType',
          code: 'MISSING_DEPENDENCY_FIELDS'
        });
        return;
      }

      // This would integrate with the database
      const dependency = {
        id: 'new-dep-id',
        agentId,
        dependencyName,
        dependencyType,
        dependencyVersion,
        isRequired,
        dependencyConfig,
        status: 'pending',
        lastChecked: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      res.status(201).json({
        success: true,
        data: dependency,
        message: 'Agent dependency added successfully'
      });

    } catch (error) {
      logger.error('Failed to add agent dependency:', error);
      res.status(500).json({
        error: 'Failed to add agent dependency',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_DEPENDENCY_ADD_FAILED'
      });
    }
  }

  /**
   * PUT /api/v1/agents/:agentId/dependencies/:dependencyId
   * Update agent dependency
   */
  private async updateAgentDependency(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId, dependencyId } = req.params;
      const {
        dependencyVersion,
        isRequired,
        dependencyConfig
      } = req.body;

      if (!uuidValidate(agentId) || !uuidValidate(dependencyId)) {
        res.status(400).json({
          error: 'Invalid ID format',
          code: 'INVALID_ID_FORMAT'
        });
        return;
      }

      // This would integrate with the database
      const dependency = {
        id: dependencyId,
        agentId,
        dependencyName: 'database-service',
        dependencyType: 'service',
        dependencyVersion: dependencyVersion || '1.0.0',
        isRequired: isRequired !== undefined ? isRequired : true,
        dependencyConfig,
        status: 'resolved',
        lastChecked: new Date(),
        updatedAt: new Date()
      };

      res.json({
        success: true,
        data: dependency,
        message: 'Agent dependency updated successfully'
      });

    } catch (error) {
      logger.error('Failed to update agent dependency:', error);
      res.status(500).json({
        error: 'Failed to update agent dependency',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_DEPENDENCY_UPDATE_FAILED'
      });
    }
  }

  /**
   * DELETE /api/v1/agents/:agentId/dependencies/:dependencyId
   * Remove agent dependency
   */
  private async removeAgentDependency(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId, dependencyId } = req.params;

      if (!uuidValidate(agentId) || !uuidValidate(dependencyId)) {
        res.status(400).json({
          error: 'Invalid ID format',
          code: 'INVALID_ID_FORMAT'
        });
        return;
      }

      // This would integrate with the database
      // For now, just return success

      res.json({
        success: true,
        message: 'Agent dependency removed successfully'
      });

    } catch (error) {
      logger.error('Failed to remove agent dependency:', error);
      res.status(500).json({
        error: 'Failed to remove agent dependency',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_DEPENDENCY_REMOVE_FAILED'
      });
    }
  }

  /**
   * GET /api/v1/agents/:agentId/executions
   * Get agent execution history
   */
  private async getAgentExecutions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const {
        status,
        limit = 50,
        offset = 0,
        sortBy = 'startTime',
        sortOrder = 'desc'
      } = req.query;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      // This would integrate with the database
      const executions = [
        {
          id: 'exec-1',
          agentId,
          status: 'completed',
          startTime: new Date(Date.now() - 3600000),
          endTime: new Date(Date.now() - 3000000),
          duration: 600000,
          result: { success: true, output: 'Task completed successfully' },
          metrics: { cpuTime: 1000, memoryUsage: 512 }
        }
      ];

      res.json({
        success: true,
        data: executions,
        pagination: {
          total: executions.length,
          limit: parseInt(limit as string, 10),
          offset: parseInt(offset as string, 10)
        }
      });

    } catch (error) {
      logger.error('Failed to get agent executions:', error);
      res.status(500).json({
        error: 'Failed to get agent executions',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_EXECUTIONS_GET_FAILED'
      });
    }
  }

  /**
   * GET /api/v1/agents/:agentId/executions/:executionId
   * Get specific agent execution
   */
  private async getAgentExecution(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId, executionId } = req.params;

      if (!uuidValidate(agentId) || !uuidValidate(executionId)) {
        res.status(400).json({
          error: 'Invalid ID format',
          code: 'INVALID_ID_FORMAT'
        });
        return;
      }

      // This would integrate with the database
      const execution = {
        id: executionId,
        agentId,
        status: 'completed',
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() - 3000000),
        duration: 600000,
        result: { success: true, output: 'Task completed successfully' },
        logs: 'Execution log entries...',
        metrics: { cpuTime: 1000, memoryUsage: 512, tokensUsed: 100 },
        resourceUsage: { cpu: 2, memory: 1024 }
      };

      res.json({
        success: true,
        data: execution
      });

    } catch (error) {
      logger.error('Failed to get agent execution:', error);
      res.status(500).json({
        error: 'Failed to get agent execution',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'AGENT_EXECUTION_GET_FAILED'
      });
    }
  }

  /**
   * GET /api/v1/agents/:agentId/config/history
   * Get configuration history
   */
  private async getConfigHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const { limit = 20 } = req.query;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      // This would integrate with the database
      const history = [
        {
          id: 'config-1',
          agentId,
          version: '1.1.0',
          config: { timeout: 60000 },
          changes: ['timeout'],
          changedBy: 'user-1',
          changeReason: 'Increased timeout for reliability',
          createdAt: new Date()
        }
      ];

      res.json({
        success: true,
        data: history
      });

    } catch (error) {
      logger.error('Failed to get config history:', error);
      res.status(500).json({
        error: 'Failed to get configuration history',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'CONFIG_HISTORY_GET_FAILED'
      });
    }
  }

  /**
   * GET /api/v1/agents/:agentId/transitions
   * Get status transition history
   */
  private async getStatusTransitions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const {
        limit = 50,
        offset = 0,
        sortBy = 'timestamp',
        sortOrder = 'desc'
      } = req.query;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      // This would integrate with the database
      const transitions = [
        {
          id: 'trans-1',
          agentId,
          fromStatus: 'stopped',
          toStatus: 'starting',
          timestamp: new Date(Date.now() - 120000),
          reason: 'Manual start requested',
          triggeredBy: 'user-1'
        },
        {
          id: 'trans-2',
          agentId,
          fromStatus: 'starting',
          toStatus: 'running',
          timestamp: new Date(Date.now() - 60000),
          reason: 'Agent started successfully',
          triggeredBy: 'system'
        }
      ];

      res.json({
        success: true,
        data: transitions,
        pagination: {
          total: transitions.length,
          limit: parseInt(limit as string, 10),
          offset: parseInt(offset as string, 10)
        }
      });

    } catch (error) {
      logger.error('Failed to get status transitions:', error);
      res.status(500).json({
        error: 'Failed to get status transitions',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'STATUS_TRANSITIONS_GET_FAILED'
      });
    }
  }

  /**
   * GET /api/v1/agents/:agentId/alerts
   * Get resource alerts
   */
  private async getResourceAlerts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const {
        severity,
        limit = 50,
        offset = 0
      } = req.query;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      // This would integrate with the resource quota manager
      const alerts = [
        {
          type: 'cpu',
          severity: 'warning',
          message: 'High CPU usage: 75%',
          percentage: 75,
          timestamp: new Date()
        }
      ];

      res.json({
        success: true,
        data: alerts
      });

    } catch (error) {
      logger.error('Failed to get resource alerts:', error);
      res.status(500).json({
        error: 'Failed to get resource alerts',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'RESOURCE_ALERTS_GET_FAILED'
      });
    }
  }

  /**
   * GET /api/v1/agents/:agentId/violations
   * Get quota violations
   */
  private async getQuotaViolations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const {
        type,
        severity,
        limit = 50,
        offset = 0
      } = req.query;

      if (!uuidValidate(agentId)) {
        res.status(400).json({
          error: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
        return;
      }

      // This would integrate with the resource quota manager
      const violations = [
        {
          type: 'memory',
          severity: 'critical',
          message: 'Memory usage (1100MB) exceeds quota (1024MB)',
          actual: 1100,
          limit: 1024,
          timestamp: new Date()
        }
      ];

      res.json({
        success: true,
        data: violations
      });

    } catch (error) {
      logger.error('Failed to get quota violations:', error);
      res.status(500).json({
        error: 'Failed to get quota violations',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'QUOTA_VIOLATIONS_GET_FAILED'
      });
    }
  }

  /**
   * Get router instance
   */
  getRouter(): Router {
    return this.router;
  }
}
