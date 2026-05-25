/**
 * Agent Monitoring and Management System
 *
 * Provides comprehensive monitoring, health management, and control capabilities
 * for the autonomous agent ecosystem with real-time oversight and intervention.
 */

import { AgentState, AgentMessage, AgentGoal } from './agent-framework';

export interface AgentMetrics {
  agent_id: string;
  agent_type: string;
  timestamp: number;
  performance_metrics: PerformanceMetrics;
  health_metrics: HealthMetrics;
  business_metrics: BusinessMetrics;
  resource_metrics: ResourceMetrics;
}

export interface PerformanceMetrics {
  tasks_completed: number;
  tasks_failed: number;
  average_task_duration: number;
  success_rate: number;
  goal_completion_rate: number;
  accuracy_score: number;
  efficiency_score: number;
  response_time_p95: number;
  throughput_per_hour: number;
}

export interface HealthMetrics {
  status: 'healthy' | 'degraded' | 'critical' | 'offline';
  cpu_usage: number;
  memory_usage: number;
  error_rate: number;
  last_heartbeat: number;
  uptime_percentage: number;
  consecutive_failures: number;
  alert_count: number;
}

export interface BusinessMetrics {
  goals_achieved: number;
  goals_failed: number;
  business_value_created: number;
  cost_savings_generated: number;
  risk_mitigated: number;
  compliance_score: number;
  customer_impact_score: number;
  roi_contribution: number;
}

export interface ResourceMetrics {
  api_calls_made: number;
  api_costs_incurred: number;
  data_processed_mb: number;
  storage_used_mb: number;
  network_requests: number;
  compute_time_ms: number;
  tools_utilized: string[];
  permissions_used: string[];
}

export interface AgentAlert {
  id: string;
  agent_id: string;
  agent_type: string;
  alert_type: 'performance' | 'health' | 'security' | 'business' | 'system';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  description: string;
  timestamp: number;
  metrics_snapshot: any;
  acknowledged: boolean;
  resolved: boolean;
  resolution_notes?: string;
  escalation_level: number;
}

export interface AgentControlCommand {
  id: string;
  agent_id: string;
  command_type: 'pause' | 'resume' | 'restart' | 'shutdown' | 'update_config' | 'override_goal';
  parameters: any;
  issued_by: string;
  timestamp: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: any;
  error_message?: string;
}

export interface AgentPolicy {
  id: string;
  name: string;
  description: string;
  agent_types: string[];
  rules: PolicyRule[];
  enforcement_mode: 'monitor' | 'enforce' | 'block';
  created_at: number;
  updated_at: number;
  active: boolean;
}

export interface PolicyRule {
  id: string;
  condition: string; // JSON logic expression
  action: 'allow' | 'block' | 'alert' | ' throttle' | 'escalate';
  parameters: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface MonitoringDashboard {
  overview: SystemOverview;
  agent_status: AgentStatusSummary;
  performance_trends: PerformanceTrends;
  health_status: HealthStatusSummary;
  active_alerts: AgentAlert[];
  recent_activities: ActivityLog[];
  system_metrics: SystemMetrics;
}

export interface SystemOverview {
  total_agents: number;
  active_agents: number;
  healthy_agents: number;
  degraded_agents: number;
  critical_agents: number;
  total_goals_today: number;
  completed_goals_today: number;
  success_rate_today: number;
  business_value_today: number;
}

export interface AgentStatusSummary {
  by_type: Record<string, {
    total: number;
    active: number;
    healthy: number;
    avg_performance: number;
    avg_success_rate: number;
  }>;
  top_performers: Array<{
    agent_id: string;
    agent_type: string;
    performance_score: number;
    success_rate: number;
    business_value: number;
  }>;
  needs_attention: Array<{
    agent_id: string;
    agent_type: string;
    issues: string[];
    last_failure: number;
  }>;
}

export interface PerformanceTrends {
  hourly_performance: Array<{
    hour: number;
    avg_success_rate: number;
    avg_response_time: number;
    total_tasks: number;
    completed_tasks: number;
  }>;
  daily_trends: Array<{
    date: string;
    success_rate: number;
    business_value: number;
    agent_health: number;
  }>;
  goal_completion_trends: Array<{
    date: string;
    goals_set: number;
    goals_completed: number;
    completion_rate: number;
  }>;
}

export interface HealthStatusSummary {
  overall_health_score: number;
  health_distribution: Record<string, number>;
  critical_issues: Array<{
    agent_id: string;
    issue: string;
    severity: string;
    duration: number;
  }>;
  resource_utilization: {
    avg_cpu_usage: number;
    avg_memory_usage: number;
    avg_error_rate: number;
  };
}

export interface ActivityLog {
  id: string;
  timestamp: number;
  agent_id: string;
  agent_type: string;
  activity_type: 'goal_created' | 'goal_completed' | 'agent_restarted' | 'alert_triggered' | 'policy_violation';
  description: string;
  details: any;
  impact: 'low' | 'medium' | 'high';
}

export interface SystemMetrics {
  total_api_calls: number;
  total_compute_time: number;
  total_cost_incurred: number;
  total_data_processed: number;
  uptime_percentage: number;
  average_response_time: number;
  error_rate: number;
  throughput: number;
}

/**
 * Main monitoring and management system for autonomous agents
 */
export class AgentMonitoringSystem {
  private metrics: Map<string, AgentMetrics[]> = new Map();
  private alerts: Map<string, AgentAlert> = new Map();
  private activeCommands: Map<string, AgentControlCommand> = new Map();
  private policies: Map<string, AgentPolicy> = new Map();
  private activityLog: ActivityLog[] = [];
  private systemStartTime: number = Date.now();

  constructor() {
    this.initializeDefaultPolicies();
  }

  /**
   * Collect and store agent metrics
   */
  async collectMetrics(agentId: string, agentType: string, metrics: Partial<AgentMetrics>): Promise<void> {
    const timestamp = Date.now();
    const fullMetrics: AgentMetrics = {
      agent_id: agentId,
      agent_type: agentType,
      timestamp,
      performance_metrics: metrics.performance_metrics || this.getDefaultPerformanceMetrics(),
      health_metrics: metrics.health_metrics || this.getDefaultHealthMetrics(),
      business_metrics: metrics.business_metrics || this.getDefaultBusinessMetrics(),
      resource_metrics: metrics.resource_metrics || this.getDefaultResourceMetrics(),
    };

    // Store metrics
    if (!this.metrics.has(agentId)) {
      this.metrics.set(agentId, []);
    }
    this.metrics.get(agentId)!.push(fullMetrics);

    // Keep only last 24 hours of data
    const cutoff = timestamp - (24 * 60 * 60 * 1000);
    this.metrics.set(agentId, this.metrics.get(agentId)!.filter(m => m.timestamp > cutoff));

    // Check for alerts
    await this.checkForAlerts(fullMetrics);

    // Log activity
    await this.logActivity({
      id: this.generateId(),
      timestamp,
      agent_id: agentId,
      agent_type: agentType,
      activity_type: 'goal_completed',
      description: 'Metrics collected',
      details: { success_rate: fullMetrics.performance_metrics.success_rate },
      impact: 'low'
    });
  }

  /**
   * Get comprehensive monitoring dashboard
   */
  async getMonitoringDashboard(): Promise<MonitoringDashboard> {
    const overview = await this.getSystemOverview();
    const agentStatus = await this.getAgentStatusSummary();
    const performanceTrends = await this.getPerformanceTrends();
    const healthStatus = await this.getHealthStatusSummary();
    const activeAlerts = Array.from(this.alerts.values()).filter(a => !a.resolved);
    const recentActivities = this.activityLog.slice(-50).reverse();
    const systemMetrics = await this.getSystemMetrics();

    return {
      overview,
      agent_status: agentStatus,
      performance_trends: performanceTrends,
      health_status: healthStatus,
      active_alerts: activeAlerts.sort((a, b) => this.getAlertSeverityScore(b) - this.getAlertSeverityScore(a)),
      recent_activities: recentActivities,
      system_metrics: systemMetrics
    };
  }

  /**
   * Get detailed agent information
   */
  async getAgentDetails(agentId: string): Promise<{
    agent: AgentMetrics | null;
    history: AgentMetrics[];
    alerts: AgentAlert[];
    performance_summary: any;
    health_summary: any;
    business_impact: any;
  }> {
    const history = this.metrics.get(agentId) || [];
    const currentAgent = history[history.length - 1] || null;
    const alerts = Array.from(this.alerts.values()).filter(a => a.agent_id === agentId);

    if (!currentAgent) {
      return {
        agent: null,
        history: [],
        alerts: [],
        performance_summary: {},
        health_summary: {},
        business_impact: {}
      };
    }

    return {
      agent: currentAgent,
      history: history.slice(-100), // Last 100 entries
      alerts: alerts.sort((a, b) => b.timestamp - a.timestamp),
      performance_summary: this.calculatePerformanceSummary(history),
      health_summary: this.calculateHealthSummary(history),
      business_impact: this.calculateBusinessImpact(history)
    };
  }

  /**
   * Issue control command to agent
   */
  async issueCommand(command: Omit<AgentControlCommand, 'id' | 'timestamp' | 'status'>): Promise<string> {
    const fullCommand: AgentControlCommand = {
      id: this.generateId(),
      timestamp: Date.now(),
      status: 'pending',
      ...command
    };

    this.activeCommands.set(fullCommand.id, fullCommand);

    // Log command issuance
    await this.logActivity({
      id: this.generateId(),
      timestamp: Date.now(),
      agent_id: command.agent_id,
      agent_type: 'system',
      activity_type: 'agent_restarted',
      description: `Command issued: ${command.command_type}`,
      details: { command_id: fullCommand.id, parameters: command.parameters },
      impact: command.command_type === 'shutdown' ? 'high' : 'medium'
    });

    return fullCommand.id;
  }

  /**
   * Create and manage alerts
   */
  async createAlert(alert: Omit<AgentAlert, 'id' | 'timestamp' | 'acknowledged' | 'resolved' | 'escalation_level'>): Promise<string> {
    const fullAlert: AgentAlert = {
      id: this.generateId(),
      timestamp: Date.now(),
      acknowledged: false,
      resolved: false,
      escalation_level: 1,
      ...alert
    };

    this.alerts.set(fullAlert.id, fullAlert);

    // Check for escalation
    await this.checkAlertEscalation(fullAlert);

    return fullAlert.id;
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;

      await this.logActivity({
        id: this.generateId(),
        timestamp: Date.now(),
        agent_id: alert.agent_id,
        agent_type: alert.agent_type,
        activity_type: 'alert_triggered',
        description: `Alert acknowledged by ${userId}`,
        details: { alert_id: alertId, alert_type: alert.alert_type },
        impact: 'low'
      });
    }
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string, resolutionNotes: string, userId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolution_notes = resolutionNotes;

      await this.logActivity({
        id: this.generateId(),
        timestamp: Date.now(),
        agent_id: alert.agent_id,
        agent_type: alert.agent_type,
        activity_type: 'alert_triggered',
        description: `Alert resolved by ${userId}`,
        details: { alert_id: alertId, resolution_notes },
        impact: 'low'
      });
    }
  }

  /**
   * Agent policy management
   */
  async createPolicy(policy: Omit<AgentPolicy, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const fullPolicy: AgentPolicy = {
      id: this.generateId(),
      created_at: Date.now(),
      updated_at: Date.now(),
      ...policy
    };

    this.policies.set(fullPolicy.id, fullPolicy);
    return fullPolicy.id;
  }

  async updatePolicy(policyId: string, updates: Partial<AgentPolicy>): Promise<void> {
    const policy = this.policies.get(policyId);
    if (policy) {
      Object.assign(policy, updates, { updated_at: Date.now() });
    }
  }

  async deletePolicy(policyId: string): Promise<void> {
    this.policies.delete(policyId);
  }

  async getPolicies(): Promise<AgentPolicy[]> {
    return Array.from(this.policies.values());
  }

  /**
   * Check agent compliance with policies
   */
  async checkPolicyCompliance(agentId: string, agentType: string, action: any): Promise<{
    compliant: boolean;
    violations: Array<{
      policy_id: string;
      policy_name: string;
      rule_id: string;
      action: string;
      severity: string;
    }>;
  }> {
    const violations = [];
    const applicablePolicies = Array.from(this.policies.values()).filter(p =>
      p.active && p.agent_types.includes(agentType)
    );

    for (const policy of applicablePolicies) {
      for (const rule of policy.rules) {
        if (this.evaluateRuleCondition(rule.condition, action)) {
          if (policy.enforcement_mode === 'block' || policy.enforcement_mode === 'enforce') {
            violations.push({
              policy_id: policy.id,
              policy_name: policy.name,
              rule_id: rule.id,
              action: rule.action,
              severity: rule.severity
            });
          }
        }
      }
    }

    return {
      compliant: violations.length === 0,
      violations
    };
  }

  /**
   * Get system overview
   */
  private async getSystemOverview(): Promise<SystemOverview> {
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);

    let totalAgents = 0;
    let activeAgents = 0;
    let healthyAgents = 0;
    let degradedAgents = 0;
    let criticalAgents = 0;
    let totalGoalsToday = 0;
    let completedGoalsToday = 0;
    let totalSuccessRate = 0;
    let totalBusinessValue = 0;

    for (const [agentId, agentMetrics] of this.metrics.entries()) {
      if (agentMetrics.length === 0) continue;

      totalAgents++;
      const latestMetrics = agentMetrics[agentMetrics.length - 1];

      // Check activity status
      const timeSinceLastMetric = now - latestMetrics.timestamp;
      if (timeSinceLastMetric < 5 * 60 * 1000) { // Active in last 5 minutes
        activeAgents++;
      }

      // Check health status
      if (latestMetrics.health_metrics.status === 'healthy') {
        healthyAgents++;
      } else if (latestMetrics.health_metrics.status === 'degraded') {
        degradedAgents++;
      } else if (latestMetrics.health_metrics.status === 'critical') {
        criticalAgents++;
      }

      // Today's metrics
      const todayMetrics = agentMetrics.filter(m => m.timestamp >= todayStart);
      if (todayMetrics.length > 0) {
        const completedToday = todayMetrics.reduce((sum, m) => sum + m.business_metrics.goals_achieved, 0);
        const failedToday = todayMetrics.reduce((sum, m) => sum + m.business_metrics.goals_failed, 0);
        const businessValueToday = todayMetrics.reduce((sum, m) => sum + m.business_metrics.business_value_created, 0);
        const avgSuccessRate = todayMetrics.reduce((sum, m) => sum + m.performance_metrics.success_rate, 0) / todayMetrics.length;

        totalGoalsToday += completedToday + failedToday;
        completedGoalsToday += completedToday;
        totalBusinessValue += businessValueToday;
        totalSuccessRate += avgSuccessRate;
      }
    }

    return {
      total_agents: totalAgents,
      active_agents: activeAgents,
      healthy_agents: healthyAgents,
      degraded_agents: degradedAgents,
      critical_agents: criticalAgents,
      total_goals_today: totalGoalsToday,
      completed_goals_today: completedGoalsToday,
      success_rate_today: totalAgents > 0 ? totalSuccessRate / totalAgents : 0,
      business_value_today: totalBusinessValue
    };
  }

  /**
   * Get agent status summary
   */
  private async getAgentStatusSummary(): Promise<AgentStatusSummary> {
    const byType: Record<string, any> = {};
    const allAgents: Array<any> = [];

    for (const [agentId, agentMetrics] of this.metrics.entries()) {
      if (agentMetrics.length === 0) continue;

      const latestMetrics = agentMetrics[agentMetrics.length - 1];
      const agentType = latestMetrics.agent_type;

      if (!byType[agentType]) {
        byType[agentType] = {
          total: 0,
          active: 0,
          healthy: 0,
          avg_performance: 0,
          avg_success_rate: 0
        };
      }

      const timeSinceLastMetric = Date.now() - latestMetrics.timestamp;
      const isActive = timeSinceLastMetric < 5 * 60 * 1000;
      const isHealthy = latestMetrics.health_metrics.status === 'healthy';

      byType[agentType].total++;
      if (isActive) byType[agentType].active++;
      if (isHealthy) byType[agentType].healthy++;
      byType[agentType].avg_performance += latestMetrics.performance_metrics.efficiency_score;
      byType[agentType].avg_success_rate += latestMetrics.performance_metrics.success_rate;

      allAgents.push({
        agent_id: agentId,
        agent_type: agentType,
        performance_score: latestMetrics.performance_metrics.efficiency_score,
        success_rate: latestMetrics.performance_metrics.success_rate,
        business_value: latestMetrics.business_metrics.business_value_created,
        health_status: latestMetrics.health_metrics.status,
        consecutive_failures: latestMetrics.health_metrics.consecutive_failures
      });
    }

    // Calculate averages
    for (const type in byType) {
      const typeData = byType[type];
      typeData.avg_performance = typeData.avg_performance / typeData.total;
      typeData.avg_success_rate = typeData.avg_success_rate / typeData.total;
    }

    // Get top performers and agents needing attention
    const topPerformers = allAgents
      .sort((a, b) => b.performance_score - a.performance_score)
      .slice(0, 10);

    const needsAttention = allAgents
      .filter(a => a.consecutive_failures > 3 || a.health_status !== 'healthy')
      .sort((a, b) => b.consecutive_failures - a.consecutive_failures)
      .slice(0, 10)
      .map(a => ({
        ...a,
        issues: a.consecutive_failures > 3 ? ['Consecutive failures'] : ['Health degraded'],
        last_failure: Date.now()
      }));

    return {
      by_type: byType,
      top_performers: topPerformers,
      needs_attention: needsAttention
    };
  }

  /**
   * Get performance trends
   */
  private async getPerformanceTrends(): Promise<PerformanceTrends> {
    const hourlyPerformance: any[] = [];
    const dailyTrends: any[] = [];
    const goalCompletionTrends: any[] = [];

    // Generate hourly data for last 24 hours
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date();
      hourStart.setHours(hourStart.getHours() - i, 0, 0, 0);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

      let totalTasks = 0;
      let completedTasks = 0;
      let totalSuccessRate = 0;
      let totalResponseTime = 0;
      let metricCount = 0;

      for (const agentMetrics of this.metrics.values()) {
        const hourMetrics = agentMetrics.filter(m =>
          m.timestamp >= hourStart.getTime() && m.timestamp < hourEnd.getTime()
        );

        for (const metrics of hourMetrics) {
          totalTasks += metrics.performance_metrics.tasks_completed + metrics.performance_metrics.tasks_failed;
          completedTasks += metrics.performance_metrics.tasks_completed;
          totalSuccessRate += metrics.performance_metrics.success_rate;
          totalResponseTime += metrics.performance_metrics.response_time_p95;
          metricCount++;
        }
      }

      hourlyPerformance.push({
        hour: hourStart.getHours(),
        avg_success_rate: metricCount > 0 ? totalSuccessRate / metricCount : 0,
        avg_response_time: metricCount > 0 ? totalResponseTime / metricCount : 0,
        total_tasks: totalTasks,
        completed_tasks: completedTasks
      });
    }

    return {
      hourly_performance: hourlyPerformance,
      daily_trends: dailyTrends,
      goal_completion_trends: goalCompletionTrends
    };
  }

  /**
   * Get health status summary
   */
  private async getHealthStatusSummary(): Promise<HealthStatusSummary> {
    let totalHealthScore = 0;
    let agentCount = 0;
    const healthDistribution: Record<string, number> = {
      healthy: 0,
      degraded: 0,
      critical: 0,
      offline: 0
    };
    let totalCpuUsage = 0;
    let totalMemoryUsage = 0;
    let totalErrorRate = 0;

    const criticalIssues: any[] = [];

    for (const [agentId, agentMetrics] of this.metrics.entries()) {
      if (agentMetrics.length === 0) continue;

      const latestMetrics = agentMetrics[agentMetrics.length - 1];
      const healthStatus = latestMetrics.health_metrics;

      healthDistribution[healthStatus.status]++;
      totalCpuUsage += healthStatus.cpu_usage;
      totalMemoryUsage += healthStatus.memory_usage;
      totalErrorRate += healthStatus.error_rate;
      agentCount++;

      // Calculate health score
      let healthScore = 100;
      if (healthStatus.status === 'degraded') healthScore = 70;
      if (healthStatus.status === 'critical') healthScore = 30;
      if (healthStatus.status === 'offline') healthScore = 0;

      totalHealthScore += healthScore;

      // Add critical issues
      if (healthStatus.status === 'critical') {
        criticalIssues.push({
          agent_id: agentId,
          issue: healthStatus.consecutive_failures > 5 ? 'Multiple consecutive failures' : 'Health critical',
          severity: 'critical',
          duration: Date.now() - healthStatus.last_heartbeat
        });
      }
    }

    return {
      overall_health_score: agentCount > 0 ? totalHealthScore / agentCount : 0,
      health_distribution: healthDistribution,
      critical_issues: criticalIssues.slice(0, 10),
      resource_utilization: {
        avg_cpu_usage: agentCount > 0 ? totalCpuUsage / agentCount : 0,
        avg_memory_usage: agentCount > 0 ? totalMemoryUsage / agentCount : 0,
        avg_error_rate: agentCount > 0 ? totalErrorRate / agentCount : 0
      }
    };
  }

  /**
   * Get system metrics
   */
  private async getSystemMetrics(): Promise<SystemMetrics> {
    let totalApiCalls = 0;
    let totalComputeTime = 0;
    let totalCost = 0;
    let totalDataProcessed = 0;
    let totalTasks = 0;
    let completedTasks = 0;
    let totalResponseTime = 0;
    let errorCount = 0;

    for (const agentMetrics of this.metrics.values()) {
      for (const metrics of agentMetrics) {
        totalApiCalls += metrics.resource_metrics.api_calls_made;
        totalComputeTime += metrics.resource_metrics.compute_time_ms;
        totalCost += metrics.resource_metrics.api_costs_incurred;
        totalDataProcessed += metrics.resource_metrics.data_processed_mb;
        totalTasks += metrics.performance_metrics.tasks_completed + metrics.performance_metrics.tasks_failed;
        completedTasks += metrics.performance_metrics.tasks_completed;
        totalResponseTime += metrics.performance_metrics.response_time_p95;
        errorCount += metrics.performance_metrics.tasks_failed;
      }
    }

    const uptime = ((Date.now() - this.systemStartTime) / (Date.now() - this.systemStartTime)) * 100;
    const successRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    const avgResponseTime = totalTasks > 0 ? totalResponseTime / totalTasks : 0;
    const errorRate = totalTasks > 0 ? (errorCount / totalTasks) * 100 : 0;
    const throughput = totalTasks / Math.max(1, (Date.now() - this.systemStartTime) / (1000 * 60 * 60)); // per hour

    return {
      total_api_calls: totalApiCalls,
      total_compute_time: totalComputeTime,
      total_cost_incurred: totalCost,
      total_data_processed: totalDataProcessed,
      uptime_percentage: uptime,
      average_response_time: avgResponseTime,
      error_rate: errorRate,
      throughput: throughput
    };
  }

  /**
   * Check for alerts based on metrics
   */
  private async checkForAlerts(metrics: AgentMetrics): Promise<void> {
    // Performance alerts
    if (metrics.performance_metrics.success_rate < 0.8) {
      await this.createAlert({
        agent_id: metrics.agent_id,
        agent_type: metrics.agent_type,
        alert_type: 'performance',
        severity: metrics.performance_metrics.success_rate < 0.5 ? 'critical' : 'warning',
        title: 'Low Success Rate',
        description: `Agent success rate dropped to ${(metrics.performance_metrics.success_rate * 100).toFixed(1)}%`,
        metrics_snapshot: metrics
      });
    }

    // Health alerts
    if (metrics.health_metrics.consecutive_failures > 5) {
      await this.createAlert({
        agent_id: metrics.agent_id,
        agent_type: metrics.agent_type,
        alert_type: 'health',
        severity: 'critical',
        title: 'Multiple Consecutive Failures',
        description: `Agent has ${metrics.health_metrics.consecutive_failures} consecutive failures`,
        metrics_snapshot: metrics
      });
    }

    // Business alerts
    if (metrics.business_metrics.compliance_score < 0.7) {
      await this.createAlert({
        agent_id: metrics.agent_id,
        agent_type: metrics.agent_type,
        alert_type: 'business',
        severity: 'warning',
        title: 'Compliance Score Low',
        description: `Agent compliance score dropped to ${(metrics.business_metrics.compliance_score * 100).toFixed(1)}%`,
        metrics_snapshot: metrics
      });
    }

    // Resource alerts
    if (metrics.resource_metrics.api_costs_incurred > 100) {
      await this.createAlert({
        agent_id: metrics.agent_id,
        agent_type: metrics.agent_type,
        alert_type: 'system',
        severity: 'warning',
        title: 'High API Costs',
        description: `Agent has incurred $${metrics.resource_metrics.api_costs_incurred.toFixed(2)} in API costs`,
        metrics_snapshot: metrics
      });
    }
  }

  /**
   * Check alert escalation
   */
  private async checkAlertEscalation(alert: AgentAlert): Promise<void> {
    const timeSinceAlert = Date.now() - alert.timestamp;

    // Auto-escalate critical alerts after 30 minutes
    if (alert.severity === 'critical' && timeSinceAlert > 30 * 60 * 1000 && alert.escalation_level < 3) {
      alert.escalation_level = 3;
    }

    // Auto-escalate warning alerts after 2 hours
    if (alert.severity === 'warning' && timeSinceAlert > 2 * 60 * 60 * 1000 && alert.escalation_level < 2) {
      alert.escalation_level = 2;
    }
  }

  /**
   * Evaluate policy rule condition
   */
  private evaluateRuleCondition(condition: string, context: any): boolean {
    // Simple implementation - in production, use a proper JSON logic evaluator
    try {
      // This is a simplified evaluation
      return true; // Placeholder
    } catch (error) {
      console.error('Error evaluating policy condition:', error);
      return false;
    }
  }

  /**
   * Calculate performance summary
   */
  private calculatePerformanceSummary(history: AgentMetrics[]): any {
    if (history.length === 0) return {};

    const recent = history.slice(-10);
    return {
      avg_success_rate: recent.reduce((sum, m) => sum + m.performance_metrics.success_rate, 0) / recent.length,
      avg_efficiency_score: recent.reduce((sum, m) => sum + m.performance_metrics.efficiency_score, 0) / recent.length,
      avg_response_time: recent.reduce((sum, m) => sum + m.performance_metrics.response_time_p95, 0) / recent.length,
      total_tasks_completed: recent.reduce((sum, m) => sum + m.performance_metrics.tasks_completed, 0),
      total_tasks_failed: recent.reduce((sum, m) => sum + m.performance_metrics.tasks_failed, 0)
    };
  }

  /**
   * Calculate health summary
   */
  private calculateHealthSummary(history: AgentMetrics[]): any {
    if (history.length === 0) return {};

    const recent = history.slice(-10);
    const statusCounts = recent.reduce((acc, m) => {
      acc[m.health_metrics.status] = (acc[m.health_metrics.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      current_status: recent[recent.length - 1].health_metrics.status,
      status_distribution: statusCounts,
      avg_cpu_usage: recent.reduce((sum, m) => sum + m.health_metrics.cpu_usage, 0) / recent.length,
      avg_memory_usage: recent.reduce((sum, m) => sum + m.health_metrics.memory_usage, 0) / recent.length,
      avg_error_rate: recent.reduce((sum, m) => sum + m.health_metrics.error_rate, 0) / recent.length
    };
  }

  /**
   * Calculate business impact
   */
  private calculateBusinessImpact(history: AgentMetrics[]): any {
    if (history.length === 0) return {};

    const recent = history.slice(-10);
    return {
      total_business_value: recent.reduce((sum, m) => sum + m.business_metrics.business_value_created, 0),
      total_cost_savings: recent.reduce((sum, m) => sum + m.business_metrics.cost_savings_generated, 0),
      total_risk_mitigated: recent.reduce((sum, m) => sum + m.business_metrics.risk_mitigated, 0),
      avg_compliance_score: recent.reduce((sum, m) => sum + m.business_metrics.compliance_score, 0) / recent.length,
      total_goals_achieved: recent.reduce((sum, m) => sum + m.business_metrics.goals_achieved, 0),
      total_goals_failed: recent.reduce((sum, m) => sum + m.business_metrics.goals_failed, 0)
    };
  }

  /**
   * Get alert severity score for sorting
   */
  private getAlertSeverityScore(alert: AgentAlert): number {
    const severityScores = { critical: 4, error: 3, warning: 2, info: 1 };
    return severityScores[alert.severity] * alert.escalation_level;
  }

  /**
   * Log activity
   */
  private async logActivity(activity: ActivityLog): Promise<void> {
    this.activityLog.push(activity);

    // Keep only last 1000 activities
    if (this.activityLog.length > 1000) {
      this.activityLog = this.activityLog.slice(-1000);
    }
  }

  /**
   * Initialize default policies
   */
  private initializeDefaultPolicies(): void {
    // Performance policy
    this.policies.set('perf-001', {
      id: 'perf-001',
      name: 'Performance Thresholds',
      description: 'Ensure agents maintain minimum performance standards',
      agent_types: ['BillingAgent', 'ComplianceAgent', 'IntelligenceAgent', 'RiskAgent'],
      rules: [
        {
          id: 'perf-001-1',
          condition: '{"success_rate": {"<": 0.8}}',
          action: 'alert',
          parameters: { threshold: 0.8 },
          severity: 'high'
        }
      ],
      enforcement_mode: 'monitor',
      created_at: Date.now(),
      updated_at: Date.now(),
      active: true
    });

    // Security policy
    this.policies.set('sec-001', {
      id: 'sec-001',
      name: 'Security Constraints',
      description: 'Security constraints for agent operations',
      agent_types: ['BillingAgent', 'ComplianceAgent', 'IntelligenceAgent', 'RiskAgent'],
      rules: [
        {
          id: 'sec-001-1',
          condition: '{"data_access": {"contains": "sensitive_pii"}}',
          action: 'block',
          parameters: { require_approval: true },
          severity: 'critical'
        }
      ],
      enforcement_mode: 'enforce',
      created_at: Date.now(),
      updated_at: Date.now(),
      active: true
    });
  }

  /**
   * Default metrics getters
   */
  private getDefaultPerformanceMetrics(): PerformanceMetrics {
    return {
      tasks_completed: 0,
      tasks_failed: 0,
      average_task_duration: 0,
      success_rate: 1.0,
      goal_completion_rate: 1.0,
      accuracy_score: 1.0,
      efficiency_score: 1.0,
      response_time_p95: 0,
      throughput_per_hour: 0
    };
  }

  private getDefaultHealthMetrics(): HealthMetrics {
    return {
      status: 'healthy',
      cpu_usage: 0,
      memory_usage: 0,
      error_rate: 0,
      last_heartbeat: Date.now(),
      uptime_percentage: 100,
      consecutive_failures: 0,
      alert_count: 0
    };
  }

  private getDefaultBusinessMetrics(): BusinessMetrics {
    return {
      goals_achieved: 0,
      goals_failed: 0,
      business_value_created: 0,
      cost_savings_generated: 0,
      risk_mitigated: 0,
      compliance_score: 1.0,
      customer_impact_score: 0,
      roi_contribution: 0
    };
  }

  private getDefaultResourceMetrics(): ResourceMetrics {
    return {
      api_calls_made: 0,
      api_costs_incurred: 0,
      data_processed_mb: 0,
      storage_used_mb: 0,
      network_requests: 0,
      compute_time_ms: 0,
      tools_utilized: [],
      permissions_used: []
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}