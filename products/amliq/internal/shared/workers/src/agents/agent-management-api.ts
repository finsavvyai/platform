/**
 * Agent Management API
 *
 * REST API endpoints for managing and monitoring autonomous agents
 * with comprehensive control, monitoring, and intervention capabilities.
 */

import { AgentMonitoringSystem, AgentControlCommand, AgentPolicy, AgentAlert } from './agent-monitoring';

export interface ManagementAPIContext {
  monitoring: AgentMonitoringSystem;
  user_id: string;
  permissions: string[];
  organization_id: string;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: number;
}

export interface DashboardResponse {
  overview: any;
  agents: any;
  performance: any;
  health: any;
  alerts: any;
  activities: any;
}

export interface AgentControlRequest {
  agent_id: string;
  command_type: 'pause' | 'resume' | 'restart' | 'shutdown' | 'update_config' | 'override_goal';
  parameters?: any;
  reason?: string;
}

export interface PolicyCreateRequest {
  name: string;
  description: string;
  agent_types: string[];
  rules: Array<{
    condition: string;
    action: 'allow' | 'block' | 'alert' | 'throttle' | 'escalate';
    parameters: any;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  enforcement_mode: 'monitor' | 'enforce' | 'block';
}

/**
 * Agent Management API Controller
 */
export class AgentManagementAPI {
  constructor(private context: ManagementAPIContext) {}

  /**
   * Get comprehensive monitoring dashboard
   */
  async getDashboard(): Promise<APIResponse<DashboardResponse>> {
    try {
      this.checkPermission('monitoring.read');

      const dashboard = await this.context.monitoring.getMonitoringDashboard();

      return {
        success: true,
        data: {
          overview: dashboard.overview,
          agents: dashboard.agent_status,
          performance: dashboard.performance_trends,
          health: dashboard.health_status,
          alerts: dashboard.active_alerts,
          activities: dashboard.recent_activities
        },
        timestamp: Date.now()
      };
    } catch (error) {
      return this.handleError('Failed to get dashboard', error);
    }
  }

  /**
   * Get detailed agent information
   */
  async getAgentDetails(agentId: string): Promise<APIResponse> {
    try {
      this.checkPermission('monitoring.read');

      const details = await this.context.monitoring.getAgentDetails(agentId);

      return {
        success: true,
        data: details,
        timestamp: Date.now()
      };
    } catch (error) {
      return this.handleError('Failed to get agent details', error);
    }
  }

  /**
   * Get all agents with summary information
   */
  async getAllAgents(): Promise<APIResponse> {
    try {
      this.checkPermission('monitoring.read');

      const dashboard = await this.context.monitoring.getMonitoringDashboard();
      const agents = [];

      // Extract agent information from dashboard
      for (const [agentType, typeInfo] of Object.entries(dashboard.agent_status.by_type)) {
        agents.push({
          agent_type: agentType,
          ...typeInfo
        });
      }

      return {
        success: true,
        data: {
          agents: agents,
          total_count: dashboard.overview.total_agents,
          active_count: dashboard.overview.active_agents,
          healthy_count: dashboard.overview.healthy_agents
        },
        timestamp: Date.now()
      };
    } catch (error) {
      return this.handleError('Failed to get agents', error);
    }
  }

  /**
   * Issue control command to agent
   */
  async controlAgent(request: AgentControlRequest): Promise<APIResponse<string>> {
    try {
      this.checkPermission('agent.control');

      const commandId = await this.context.monitoring.issueCommand({
        agent_id: request.agent_id,
        command_type: request.command_type,
        parameters: request.parameters || {},
        issued_by: this.context.user_id
      });

      return {
        success: true,
        data: commandId,
        message: `Command ${request.command_type} issued to agent ${request.agent_id}`,
        timestamp: Date.now()
      };
    } catch (error) {
      return this.handleError('Failed to control agent', error);
    }
  }

  /**
   * Get active alerts
   */
  async getAlerts(severity?: string, agentType?: string): Promise<APIResponse> {
    try {
      this.checkPermission('monitoring.read');

      const dashboard = await this.context.monitoring.getMonitoringDashboard();
      let alerts = dashboard.active_alerts;

      // Filter by severity
      if (severity) {
        alerts = alerts.filter(alert => alert.severity === severity);
      }

      // Filter by agent type
      if (agentType) {
        alerts = alerts.filter(alert => alert.agent_type === agentType);
      }

      return {
        success: true,
        data: {
          alerts: alerts,
          total_count: alerts.length,
          critical_count: alerts.filter(a => a.severity === 'critical').length,
          warning_count: alerts.filter(a => a.severity === 'warning').length
        },
        timestamp: Date.now()
      };
    } catch (error) {
      return this.handleError('Failed to get alerts', error);
    }
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string): Promise<APIResponse> {
    try {
      this.checkPermission('alerts.acknowledge');

      await this.context.monitoring.acknowledgeAlert(alertId, this.context.user_id);

      return {
        success: true,
        message: `Alert ${alertId} acknowledged`,
        timestamp: Date.now()
      };
    } catch (error) {
      return this.handleError('Failed to acknowledge alert', error);
    }
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string, resolutionNotes: string): Promise<APIResponse> {
    try {
      this.checkPermission('alerts.resolve');

      await this.context.monitoring.resolveAlert(alertId, resolutionNotes, this.context.user_id);

      return {
        success: true,
        message: `Alert ${alertId} resolved`,
        timestamp: Date.now()
      };
    } catch (error) {
      return this.handleError('Failed to resolve alert', error);
    }
  }

  /**
   * Create policy
   */
  async createPolicy(request: PolicyCreateRequest): Promise<APIResponse<string>> {
    try {
      this.checkPermission('policies.create');

      const policyId = await this.context.monitoring.createPolicy({
        name: request.name,
        description: request.description,
        agent_types: request.agent_types,
        rules: request.rules,
        enforcement_mode: request.enforcement_mode,
        active: true
      });

      return {
        success: true,
        data: policyId,
        message: `Policy "${request.name}" created successfully`,
        timestamp: Date.now()
      };
    } catch (error) {
      return this.handleError('Failed to create policy', error);
    }
  }

  /**
   * Get all policies
   */
  async getPolicies(): Promise<APIResponse> {
    try {
      this.checkPermission('policies.read');

      const policies = await this.context.monitoring.getPolicies();

      return {
        success: true,
        data: {
          policies: policies,
          total_count: policies.length,
          active_count: policies.filter(p => p.active).length
        },
        timestamp: Date.now()
      };
    } catch (error) {
      return this.handleError('Failed to get policies', error);
    }
  }

  /**
   * Update policy
   */
  async updatePolicy(policyId: string, updates: Partial<AgentPolicy>): Promise<APIResponse> {
    try {
      this.checkPermission('policies.update');

      await this.context.monitoring.updatePolicy(policyId, updates);

      return {
        success: true,
        message: `Policy ${policyId} updated successfully`,
        timestamp: Date.now()
      };
    } catch (error) {
      return this.handleError('Failed to update policy', error);
    }
  }

  /**
   * Delete policy
   */
  async deletePolicy(policyId: string): Promise<APIResponse> {
    try {
      this.checkPermission('policies.delete');

      await this.context.monitoring.deletePolicy(policyId);

      return {
        success: true,
        message: `Policy ${policyId} deleted successfully`,
        timestamp: Date.now()
      };
    } catch (error) {
      return this.handleError('Failed to delete policy', error);
    }
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(timeRange?: string): Promise<APIResponse> {
    try {
      this.checkPermission('monitoring.read');

      const dashboard = await this.context.monitoring.getMonitoringDashboard();

      return {
        success: true,
        data: {
          metrics: dashboard.system_metrics,
          time_range: timeRange || '24h',
          overview: dashboard.overview
        },
        timestamp: Date.now()
      };
    } catch (error) {
      return this.handleError('Failed to get system metrics', error);
    }
  }

  /**
   * Get performance trends
   */
  async getPerformanceTrends(timeRange?: string): Promise<APIResponse> {
    try {
      this.checkPermission('monitoring.read');

      const dashboard = await this.context.monitoring.getMonitoringDashboard();

      return {
        success: true,
        data: {
          trends: dashboard.performance_trends,
          time_range: timeRange || '24h'
        },
        timestamp: Date.now()
      };
    } catch (error) {
      return this.handleError('Failed to get performance trends', error);
    }
  }

  /**
   * Get audit log
   */
  async getAuditLog(limit?: number, offset?: number): Promise<APIResponse> {
    try {
      this.checkPermission('audit.read');

      const dashboard = await this.context.monitoring.getMonitoringDashboard();
      let activities = dashboard.recent_activities;

      // Apply pagination
      if (offset) {
        activities = activities.slice(offset);
      }
      if (limit) {
        activities = activities.slice(0, limit);
      }

      return {
        success: true,
        data: {
          activities: activities,
          total_count: dashboard.recent_activities.length,
          limit: limit || 50,
          offset: offset || 0
        },
        timestamp: Date.now()
      };
    } catch (error) {
      return this.handleError('Failed to get audit log', error);
    }
  }

  /**
   * Get compliance report
   */
  async getComplianceReport(timeRange?: string): Promise<APIResponse> {
    try {
      this.checkPermission('compliance.read');

      const dashboard = await this.context.monitoring.getMonitoringDashboard();

      // Calculate compliance metrics
      const totalAgents = dashboard.overview.total_agents;
      const healthyAgents = dashboard.overview.healthy_agents;
      const complianceScore = totalAgents > 0 ? (healthyAgents / totalAgents) * 100 : 0;

      const complianceReport = {
        overall_compliance_score: complianceScore,
        agent_compliance: dashboard.agent_status,
        policy_violations: dashboard.active_alerts.filter(a => a.alert_type === 'security'),
        health_status: dashboard.health_status,
        time_range: timeRange || '24h'
      };

      return {
        success: true,
        data: complianceReport,
        timestamp: Date.now()
      };
    } catch (error) {
      return this.handleError('Failed to get compliance report', error);
    }
  }

  /**
   * Batch operations on multiple agents
   */
  async batchAgentOperation(request: {
    agent_ids: string[];
    operation: 'pause' | 'resume' | 'restart' | 'shutdown';
    reason?: string;
  }): Promise<APIResponse<string[]>> {
    try {
      this.checkPermission('agent.control');

      const results = [];

      for (const agentId of request.agent_ids) {
        try {
          const commandId = await this.context.monitoring.issueCommand({
            agent_id: agentId,
            command_type: request.operation,
            parameters: { reason: request.reason },
            issued_by: this.context.user_id
          });
          results.push({ agent_id: agentId, command_id: commandId, success: true });
        } catch (error) {
          results.push({ agent_id: agentId, error: String(error), success: false });
        }
      }

      return {
        success: true,
        data: results,
        message: `Batch ${request.operation} completed for ${request.agent_ids.length} agents`,
        timestamp: Date.now()
      };
    } catch (error) {
      return this.handleError('Failed to execute batch operation', error);
    }
  }

  /**
   * Get agent health recommendations
   */
  async getHealthRecommendations(): Promise<APIResponse> {
    try {
      this.checkPermission('monitoring.read');

      const dashboard = await this.context.monitoring.getMonitoringDashboard();
      const recommendations = [];

      // Analyze system health and generate recommendations
      if (dashboard.overview.healthy_agents < dashboard.overview.total_agents * 0.8) {
        recommendations.push({
          type: 'system',
          priority: 'high',
          title: 'Low System Health',
          description: 'Only 80% of agents are healthy. Consider restarting degraded agents.',
          action: 'review_agent_health'
        });
      }

      if (dashboard.active_alerts.filter(a => a.severity === 'critical').length > 0) {
        recommendations.push({
          type: 'alerts',
          priority: 'critical',
          title: 'Critical Alerts Active',
          description: `${dashboard.active_alerts.filter(a => a.severity === 'critical').length} critical alerts require immediate attention.`,
          action: 'review_critical_alerts'
        });
      }

      if (dashboard.system_metrics.error_rate > 5) {
        recommendations.push({
          type: 'performance',
          priority: 'medium',
          title: 'High Error Rate',
          description: `System error rate is ${dashboard.system_metrics.error_rate.toFixed(1)}%. Review agent configurations.`,
          action: 'investigate_errors'
        });
      }

      return {
        success: true,
        data: {
          recommendations: recommendations,
          total_count: recommendations.length,
          critical_count: recommendations.filter(r => r.priority === 'critical').length
        },
        timestamp: Date.now()
      };
    } catch (error) {
      return this.handleError('Failed to get health recommendations', error);
    }
  }

  /**
   * Export monitoring data
   */
  async exportData(format: 'json' | 'csv', timeRange?: string): Promise<APIResponse> {
    try {
      this.checkPermission('monitoring.export');

      const dashboard = await this.context.monitoring.getMonitoringDashboard();

      const exportData = {
        timestamp: Date.now(),
        time_range: timeRange || '24h',
        overview: dashboard.overview,
        system_metrics: dashboard.system_metrics,
        alerts: dashboard.active_alerts,
        agent_status: dashboard.agent_status,
        performance_trends: dashboard.performance_trends,
        health_status: dashboard.health_status
      };

      if (format === 'csv') {
        // Convert to CSV format (simplified)
        const csvData = this.convertToCSV(exportData);
        return {
          success: true,
          data: csvData,
          message: 'Data exported as CSV',
          timestamp: Date.now()
        };
      }

      return {
        success: true,
        data: exportData,
        message: 'Data exported as JSON',
        timestamp: Date.now()
      };
    } catch (error) {
      return this.handleError('Failed to export data', error);
    }
  }

  /**
   * Check user permission
   */
  private checkPermission(permission: string): void {
    if (!this.context.permissions.includes(permission) && !this.context.permissions.includes('admin')) {
      throw new Error(`Insufficient permissions: ${permission} required`);
    }
  }

  /**
   * Handle API errors
   */
  private handleError(message: string, error: any): APIResponse {
    console.error(`${message}:`, error);
    return {
      success: false,
      error: message,
      message: error instanceof Error ? error.message : String(error),
      timestamp: Date.now()
    };
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: any): string {
    // Simplified CSV conversion - in production, use a proper CSV library
    const lines = [];
    lines.push('Metric,Value,Timestamp');

    if (data.overview) {
      lines.push(`Total Agents,${data.overview.total_agents},${Date.now()}`);
      lines.push(`Active Agents,${data.overview.active_agents},${Date.now()}`);
      lines.push(`Healthy Agents,${data.overview.healthy_agents},${Date.now()}`);
      lines.push(`Success Rate,${data.overview.success_rate_today},${Date.now()}`);
    }

    return lines.join('\n');
  }
}

/**
 * Cloudflare Workers API Handler
 */
export class AgentManagementWorkerHandler {
  private api: AgentManagementAPI;

  constructor(monitoring: AgentMonitoringSystem) {
    this.api = new AgentManagementAPI({
      monitoring,
      user_id: 'system', // Will be extracted from request
      permissions: ['admin'], // Will be extracted from auth
      organization_id: 'default' // Will be extracted from request
    });
  }

  /**
   * Handle incoming requests
   */
  async handleRequest(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // Extract user info from request (simplified)
      const userId = request.headers.get('x-user-id') || 'anonymous';
      const permissions = this.extractPermissions(request);
      const orgId = request.headers.get('x-org-id') || 'default';

      // Update API context
      this.api = new AgentManagementAPI({
        monitoring: (this.api as any).context.monitoring,
        user_id: userId,
        permissions,
        organization_id: orgId
      });

      let result;

      // Route the request
      if (path === '/api/agents/dashboard' && method === 'GET') {
        result = await this.api.getDashboard();
      } else if (path.startsWith('/api/agents/') && path.endsWith('/details') && method === 'GET') {
        const agentId = path.split('/')[3];
        result = await this.api.getAgentDetails(agentId);
      } else if (path === '/api/agents' && method === 'GET') {
        result = await this.api.getAllAgents();
      } else if (path === '/api/agents/control' && method === 'POST') {
        const body = await request.json() as AgentControlRequest;
        result = await this.api.controlAgent(body);
      } else if (path === '/api/alerts' && method === 'GET') {
        const severity = url.searchParams.get('severity') || undefined;
        const agentType = url.searchParams.get('agentType') || undefined;
        result = await this.api.getAlerts(severity, agentType);
      } else if (path.match(/^\/api\/alerts\/[^\/]+\/acknowledge$/) && method === 'POST') {
        const alertId = path.split('/')[3];
        result = await this.api.acknowledgeAlert(alertId);
      } else if (path.match(/^\/api\/alerts\/[^\/]+\/resolve$/) && method === 'POST') {
        const alertId = path.split('/')[3];
        const body = await request.json();
        result = await this.api.resolveAlert(alertId, body.resolutionNotes);
      } else if (path === '/api/policies' && method === 'GET') {
        result = await this.api.getPolicies();
      } else if (path === '/api/policies' && method === 'POST') {
        const body = await request.json() as PolicyCreateRequest;
        result = await this.api.createPolicy(body);
      } else if (path.match(/^\/api\/policies\/[^\/]+$/) && method === 'PUT') {
        const policyId = path.split('/')[3];
        const body = await request.json();
        result = await this.api.updatePolicy(policyId, body);
      } else if (path.match(/^\/api\/policies\/[^\/]+$/) && method === 'DELETE') {
        const policyId = path.split('/')[3];
        result = await this.api.deletePolicy(policyId);
      } else if (path === '/api/system/metrics' && method === 'GET') {
        const timeRange = url.searchParams.get('timeRange') || undefined;
        result = await this.api.getSystemMetrics(timeRange);
      } else if (path === '/api/system/performance' && method === 'GET') {
        const timeRange = url.searchParams.get('timeRange') || undefined;
        result = await this.api.getPerformanceTrends(timeRange);
      } else if (path === '/api/system/audit' && method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        result = await this.api.getAuditLog(limit, offset);
      } else if (path === '/api/system/compliance' && method === 'GET') {
        const timeRange = url.searchParams.get('timeRange') || undefined;
        result = await this.api.getComplianceReport(timeRange);
      } else if (path === '/api/agents/batch' && method === 'POST') {
        const body = await request.json();
        result = await this.api.batchAgentOperation(body);
      } else if (path === '/api/system/recommendations' && method === 'GET') {
        result = await this.api.getHealthRecommendations();
      } else if (path === '/api/system/export' && method === 'GET') {
        const format = (url.searchParams.get('format') || 'json') as 'json' | 'csv';
        const timeRange = url.searchParams.get('timeRange') || undefined;
        result = await this.api.exportData(format, timeRange);
      } else {
        return new Response('Not Found', { status: 404 });
      }

      return new Response(JSON.stringify(result), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-user-id, x-org-id, authorization'
        }
      });
    } catch (error) {
      console.error('API Error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Extract permissions from request
   */
  private extractPermissions(request: Request): string[] {
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      // In production, decode JWT and extract permissions
      try {
        const token = authHeader.replace('Bearer ', '');
        // Simplified - decode JWT and extract permissions
        return ['admin']; // Placeholder
      } catch (error) {
        return [];
      }
    }
    return [];
  }
}