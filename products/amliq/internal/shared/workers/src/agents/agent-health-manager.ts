/**
 * Agent Health Manager
 *
 * Automated health management, recovery, and healing system for autonomous agents
 * with predictive failure detection and self-healing capabilities.
 */

import { AgentMetrics, AgentAlert, AgentControlCommand } from './agent-monitoring';

export interface HealthCheck {
  id: string;
  agent_id: string;
  check_type: 'heartbeat' | 'performance' | 'resource' | 'connectivity' | 'business_logic';
  status: 'passing' | 'warning' | 'critical' | 'failing';
  timestamp: number;
  details: any;
  next_check: number;
  retry_count: number;
  max_retries: number;
}

export interface HealthPolicy {
  id: string;
  name: string;
  description: string;
  agent_types: string[];
  health_checks: HealthCheckRule[];
  recovery_actions: RecoveryAction[];
  escalation_rules: EscalationRule[];
  enabled: boolean;
  created_at: number;
  updated_at: number;
}

export interface HealthCheckRule {
  id: string;
  check_type: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  check_interval: number; // minutes
  enabled: boolean;
}

export interface RecoveryAction {
  id: string;
  trigger_condition: string;
  action_type: 'restart' | 'reconfigure' | 'scale_up' | 'scale_down' | 'pause' | 'notify';
  parameters: any;
  max_attempts: number;
  cooldown_period: number; // minutes
  success_criteria: string;
}

export interface EscalationRule {
  id: string;
  condition: string;
  escalation_level: number;
  action: 'notify_admin' | 'create_ticket' | 'shutdown_agent' | 'escalate_manager';
  recipients: string[];
  delay_minutes: number;
}

export interface HealthTrend {
  agent_id: string;
  time_range: string;
  health_score_trend: Array<{
    timestamp: number;
    score: number;
    status: string;
  }>;
  predicted_health: {
    next_hour: number;
    next_24_hours: number;
    confidence: number;
  };
  risk_factors: Array<{
    factor: string;
    impact: number;
    description: string;
  }>;
}

export interface HealingAction {
  id: string;
  agent_id: string;
  action_type: string;
  trigger_reason: string;
  initiated_at: number;
  completed_at?: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  attempt_number: number;
  max_attempts: number;
}

export interface HealthSnapshot {
  agent_id: string;
  timestamp: number;
  overall_health_score: number;
  component_scores: {
    performance: number;
    availability: number;
    resource_utilization: number;
    business_logic: number;
    security: number;
  };
  active_issues: Array<{
    type: string;
    severity: string;
    description: string;
    impact: number;
  }>;
  recent_actions: HealingAction[];
  recommendations: Array<{
    priority: 'low' | 'medium' | 'high' | 'critical';
    action: string;
    description: string;
    estimated_impact: number;
  }>;
}

/**
 * Main health management system
 */
export class AgentHealthManager {
  private healthChecks: Map<string, HealthCheck[]> = new Map();
  private healthPolicies: Map<string, HealthPolicy> = new Map();
  private healingActions: Map<string, HealingAction> = new Map();
  private healthSnapshots: Map<string, HealthSnapshot[]> = new Map();
  private healthMonitoringActive: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeDefaultHealthPolicies();
  }

  /**
   * Start health monitoring
   */
  async startHealthMonitoring(): Promise<void> {
    if (this.healthMonitoringActive) {
      return;
    }

    this.healthMonitoringActive = true;

    // Schedule periodic health checks
    this.monitoringInterval = setInterval(async () => {
      await this.performPeriodicHealthChecks();
    }, 60 * 1000); // Every minute

    console.log('Agent health monitoring started');
  }

  /**
   * Stop health monitoring
   */
  async stopHealthMonitoring(): Promise<void> {
    this.healthMonitoringActive = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('Agent health monitoring stopped');
  }

  /**
   * Perform health check for specific agent
   */
  async performHealthCheck(agentId: string, agentType: string, metrics: AgentMetrics): Promise<HealthCheck[]> {
    const healthChecks: HealthCheck[] = [];
    const applicablePolicies = Array.from(this.healthPolicies.values())
      .filter(policy => policy.enabled && policy.agent_types.includes(agentType));

    for (const policy of applicablePolicies) {
      for (const checkRule of policy.health_checks.filter(r => r.enabled)) {
        const healthCheck = await this.executeHealthCheck(agentId, checkRule, metrics);
        healthChecks.push(healthCheck);
      }
    }

    // Store health checks
    if (!this.healthChecks.has(agentId)) {
      this.healthChecks.set(agentId, []);
    }
    this.healthChecks.get(agentId)!.push(...healthChecks);

    // Trigger recovery actions if needed
    await this.triggerRecoveryActions(agentId, healthChecks, policy);

    return healthChecks;
  }

  /**
   * Get health snapshot for agent
   */
  async getHealthSnapshot(agentId: string): Promise<HealthSnapshot | null> {
    const snapshots = this.healthSnapshots.get(agentId) || [];
    return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  }

  /**
   * Get health trends for agent
   */
  async getHealthTrends(agentId: string, timeRange: string = '24h'): Promise<HealthTrend | null> {
    const snapshots = this.healthSnapshots.get(agentId) || [];
    const now = Date.now();
    let cutoffTime: number;

    switch (timeRange) {
      case '1h':
        cutoffTime = now - (60 * 60 * 1000);
        break;
      case '24h':
        cutoffTime = now - (24 * 60 * 60 * 1000);
        break;
      case '7d':
        cutoffTime = now - (7 * 24 * 60 * 60 * 1000);
        break;
      default:
        cutoffTime = now - (24 * 60 * 60 * 1000);
    }

    const recentSnapshots = snapshots.filter(s => s.timestamp >= cutoffTime);

    if (recentSnapshots.length === 0) {
      return null;
    }

    const healthScoreTrend = recentSnapshots.map(s => ({
      timestamp: s.timestamp,
      score: s.overall_health_score,
      status: this.getHealthStatusFromScore(s.overall_health_score)
    }));

    // Predict future health (simplified linear prediction)
    const predictedHealth = this.predictHealthTrend(healthScoreTrend);

    // Analyze risk factors
    const riskFactors = this.analyzeRiskFactors(recentSnapshots);

    return {
      agent_id: agentId,
      time_range,
      health_score_trend: healthScoreTrend,
      predicted_health: predictedHealth,
      risk_factors: riskFactors
    };
  }

  /**
   * Create custom health policy
   */
  async createHealthPolicy(policy: Omit<HealthPolicy, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const fullPolicy: HealthPolicy = {
      id: this.generateId(),
      created_at: Date.now(),
      updated_at: Date.now(),
      ...policy
    };

    this.healthPolicies.set(fullPolicy.id, fullPolicy);
    return fullPolicy.id;
  }

  /**
   * Update health policy
   */
  async updateHealthPolicy(policyId: string, updates: Partial<HealthPolicy>): Promise<void> {
    const policy = this.healthPolicies.get(policyId);
    if (policy) {
      Object.assign(policy, updates, { updated_at: Date.now() });
    }
  }

  /**
   * Delete health policy
   */
  async deleteHealthPolicy(policyId: string): Promise<void> {
    this.healthPolicies.delete(policyId);
  }

  /**
   * Get all health policies
   */
  async getHealthPolicies(): Promise<HealthPolicy[]> {
    return Array.from(this.healthPolicies.values());
  }

  /**
   * Get healing history
   */
  async getHealingHistory(agentId?: string): Promise<HealingAction[]> {
    const allActions = Array.from(this.healingActions.values());

    if (agentId) {
      return allActions.filter(action => action.agent_id === agentId)
        .sort((a, b) => b.initiated_at - a.initiated_at);
    }

    return allActions.sort((a, b) => b.initiated_at - a.initiated_at);
  }

  /**
   * Manually trigger healing action
   */
  async triggerHealingAction(agentId: string, actionType: string, reason: string): Promise<string> {
    const healingAction: HealingAction = {
      id: this.generateId(),
      agent_id: agentId,
      action_type: actionType,
      trigger_reason: reason,
      initiated_at: Date.now(),
      status: 'pending',
      attempt_number: 1,
      max_attempts: 3
    };

    this.healingActions.set(healingAction.id, healingAction);

    // Execute the healing action
    await this.executeHealingAction(healingAction);

    return healingAction.id;
  }

  /**
   * Execute specific health check
   */
  private async executeHealthCheck(agentId: string, checkRule: HealthCheckRule, metrics: AgentMetrics): Promise<HealthCheck> {
    const healthCheck: HealthCheck = {
      id: this.generateId(),
      agent_id: agentId,
      check_type: checkRule.check_type as any,
      status: 'passing',
      timestamp: Date.now(),
      details: {},
      next_check: Date.now() + (checkRule.check_interval * 60 * 1000),
      retry_count: 0,
      max_retries: 3
    };

    try {
      switch (checkRule.check_type) {
        case 'heartbeat':
          healthCheck.status = this.checkHeartbeat(metrics, checkRule.threshold);
          break;
        case 'performance':
          healthCheck.status = this.checkPerformance(metrics, checkRule.threshold);
          break;
        case 'resource':
          healthCheck.status = this.checkResourceUtilization(metrics, checkRule.threshold);
          break;
        case 'connectivity':
          healthCheck.status = this.checkConnectivity(metrics, checkRule.threshold);
          break;
        case 'business_logic':
          healthCheck.status = this.checkBusinessLogic(metrics, checkRule.threshold);
          break;
        default:
          healthCheck.status = 'passing';
      }

      healthCheck.details = {
        threshold: checkRule.threshold,
        actual_value: this.getActualValue(checkRule.check_type, metrics),
        rule_id: checkRule.id
      };
    } catch (error) {
      healthCheck.status = 'failing';
      healthCheck.details.error = String(error);
    }

    return healthCheck;
  }

  /**
   * Check heartbeat
   */
  private checkHeartbeat(metrics: AgentMetrics, threshold: number): 'passing' | 'warning' | 'critical' | 'failing' {
    const timeSinceLastMetric = Date.now() - metrics.timestamp;
    const thresholdMs = threshold * 60 * 1000; // Convert minutes to ms

    if (timeSinceLastMetric > thresholdMs * 3) {
      return 'failing';
    } else if (timeSinceLastMetric > thresholdMs * 2) {
      return 'critical';
    } else if (timeSinceLastMetric > thresholdMs) {
      return 'warning';
    }
    return 'passing';
  }

  /**
   * Check performance
   */
  private checkPerformance(metrics: AgentMetrics, threshold: number): 'passing' | 'warning' | 'critical' | 'failing' {
    const successRate = metrics.performance_metrics.success_rate;

    if (successRate < threshold * 0.5) {
      return 'failing';
    } else if (successRate < threshold * 0.7) {
      return 'critical';
    } else if (successRate < threshold) {
      return 'warning';
    }
    return 'passing';
  }

  /**
   * Check resource utilization
   */
  private checkResourceUtilization(metrics: AgentMetrics, threshold: number): 'passing' | 'warning' | 'critical' | 'failing' {
    const cpuUsage = metrics.health_metrics.cpu_usage;
    const memoryUsage = metrics.health_metrics.memory_usage;
    const maxUsage = Math.max(cpuUsage, memoryUsage);

    if (maxUsage > 95) {
      return 'failing';
    } else if (maxUsage > 85) {
      return 'critical';
    } else if (maxUsage > threshold) {
      return 'warning';
    }
    return 'passing';
  }

  /**
   * Check connectivity
   */
  private checkConnectivity(metrics: AgentMetrics, threshold: number): 'passing' | 'warning' | 'critical' | 'failing' {
    const errorRate = metrics.health_metrics.error_rate;

    if (errorRate > threshold * 2) {
      return 'failing';
    } else if (errorRate > threshold * 1.5) {
      return 'critical';
    } else if (errorRate > threshold) {
      return 'warning';
    }
    return 'passing';
  }

  /**
   * Check business logic
   */
  private checkBusinessLogic(metrics: AgentMetrics, threshold: number): 'passing' | 'warning' | 'critical' | 'failing' {
    const businessValueRate = metrics.business_metrics.business_value_created / Math.max(1, metrics.business_metrics.goals_achieved);

    if (businessValueRate < threshold * 0.3) {
      return 'failing';
    } else if (businessValueRate < threshold * 0.6) {
      return 'critical';
    } else if (businessValueRate < threshold) {
      return 'warning';
    }
    return 'passing';
  }

  /**
   * Get actual value for health check
   */
  private getActualValue(checkType: string, metrics: AgentMetrics): number {
    switch (checkType) {
      case 'heartbeat':
        return (Date.now() - metrics.timestamp) / (60 * 1000); // minutes
      case 'performance':
        return metrics.performance_metrics.success_rate * 100;
      case 'resource':
        return Math.max(metrics.health_metrics.cpu_usage, metrics.health_metrics.memory_usage);
      case 'connectivity':
        return metrics.health_metrics.error_rate;
      case 'business_logic':
        return metrics.business_metrics.goals_achieved > 0
          ? metrics.business_metrics.business_value_created / metrics.business_metrics.goals_achieved
          : 0;
      default:
        return 0;
    }
  }

  /**
   * Trigger recovery actions based on health checks
   */
  private async triggerRecoveryActions(agentId: string, healthChecks: HealthCheck[], policy: HealthPolicy): Promise<void> {
    const criticalChecks = healthChecks.filter(check =>
      check.status === 'critical' || check.status === 'failing'
    );

    if (criticalChecks.length === 0) {
      return;
    }

    for (const recoveryAction of policy.recovery_actions) {
      if (this.shouldTriggerRecoveryAction(recoveryAction, criticalChecks)) {
        await this.triggerRecoveryAction(agentId, recoveryAction, criticalChecks);
      }
    }
  }

  /**
   * Determine if recovery action should be triggered
   */
  private shouldTriggerRecoveryAction(recoveryAction: RecoveryAction, healthChecks: HealthCheck[]): boolean {
    // Check cooldown period
    const recentActions = Array.from(this.healingActions.values())
      .filter(action =>
        action.agent_id === healthChecks[0].agent_id &&
        action.action_type === recoveryAction.action_type &&
        action.status === 'completed' &&
        Date.now() - action.completed_at! < recoveryAction.cooldown_period * 60 * 1000
      );

    if (recentActions.length > 0) {
      return false;
    }

    // Check trigger condition (simplified)
    return healthChecks.some(check => check.status === 'critical' || check.status === 'failing');
  }

  /**
   * Trigger specific recovery action
   */
  private async triggerRecoveryAction(agentId: string, recoveryAction: RecoveryAction, healthChecks: HealthCheck[]): Promise<void> {
    const healingAction: HealingAction = {
      id: this.generateId(),
      agent_id: agentId,
      action_type: recoveryAction.action_type,
      trigger_reason: `Health check failures: ${healthChecks.map(c => c.check_type).join(', ')}`,
      initiated_at: Date.now(),
      status: 'pending',
      attempt_number: 1,
      max_attempts: recoveryAction.max_attempts
    };

    this.healingActions.set(healingAction.id, healingAction);

    // Execute the recovery action
    await this.executeRecoveryAction(healingAction, recoveryAction);
  }

  /**
   * Execute recovery action
   */
  private async executeRecoveryAction(healingAction: HealingAction, recoveryAction: RecoveryAction): Promise<void> {
    healingAction.status = 'executing';

    try {
      // Simulate recovery action execution
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate work

      // In a real implementation, this would interface with the agent control system
      switch (recoveryAction.action_type) {
        case 'restart':
          // Issue restart command to agent
          break;
        case 'reconfigure':
          // Update agent configuration
          break;
        case 'scale_up':
          // Scale up agent resources
          break;
        case 'scale_down':
          // Scale down agent resources
          break;
        case 'pause':
          // Pause agent operations
          break;
        case 'notify':
          // Send notification
          break;
      }

      healingAction.status = 'completed';
      healingAction.completed_at = Date.now();
      healingAction.result = { success: true, action: recoveryAction.action_type };
    } catch (error) {
      healingAction.status = 'failed';
      healingAction.error = String(error);

      // Retry if attempts remain
      if (healingAction.attempt_number < healingAction.max_attempts) {
        healingAction.attempt_number++;
        healingAction.status = 'pending';
        setTimeout(() => this.executeRecoveryAction(healingAction, recoveryAction), 5000);
      }
    }
  }

  /**
   * Execute healing action
   */
  private async executeHealingAction(healingAction: HealingAction): Promise<void> {
    healingAction.status = 'executing';

    try {
      // Simulate healing action
      await new Promise(resolve => setTimeout(resolve, 2000));

      healingAction.status = 'completed';
      healingAction.completed_at = Date.now();
      healingAction.result = {
        success: true,
        action: healingAction.action_type,
        message: `Manual healing action ${healingAction.action_type} completed successfully`
      };
    } catch (error) {
      healingAction.status = 'failed';
      healingAction.error = String(error);
    }
  }

  /**
   * Perform periodic health checks
   */
  private async performPeriodicHealthChecks(): Promise<void> {
    // This would be implemented to check all registered agents
    // For now, it's a placeholder that would integrate with the agent monitoring system
  }

  /**
   * Create health snapshot
   */
  private async createHealthSnapshot(agentId: string, metrics: AgentMetrics, healthChecks: HealthCheck[]): Promise<void> {
    const overallHealthScore = this.calculateOverallHealthScore(metrics, healthChecks);

    const healthSnapshot: HealthSnapshot = {
      agent_id: agentId,
      timestamp: Date.now(),
      overall_health_score: overallHealthScore,
      component_scores: {
        performance: this.calculatePerformanceScore(metrics),
        availability: this.calculateAvailabilityScore(metrics, healthChecks),
        resource_utilization: this.calculateResourceScore(metrics),
        business_logic: this.calculateBusinessScore(metrics),
        security: this.calculateSecurityScore(metrics)
      },
      active_issues: this.identifyActiveIssues(healthChecks),
      recent_actions: Array.from(this.healingActions.values())
        .filter(action => action.agent_id === agentId)
        .slice(-5),
      recommendations: this.generateHealthRecommendations(overallHealthScore, healthChecks)
    };

    if (!this.healthSnapshots.has(agentId)) {
      this.healthSnapshots.set(agentId, []);
    }
    this.healthSnapshots.get(agentId)!.push(healthSnapshot);

    // Keep only last 7 days of snapshots
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
    this.healthSnapshots.set(agentId,
      this.healthSnapshots.get(agentId)!.filter(s => s.timestamp > cutoff)
    );
  }

  /**
   * Calculate overall health score
   */
  private calculateOverallHealthScore(metrics: AgentMetrics, healthChecks: HealthCheck[]): number {
    const weights = {
      performance: 0.25,
      availability: 0.25,
      resources: 0.2,
      business: 0.2,
      security: 0.1
    };

    const scores = {
      performance: this.calculatePerformanceScore(metrics),
      availability: this.calculateAvailabilityScore(metrics, healthChecks),
      resources: this.calculateResourceScore(metrics),
      business: this.calculateBusinessScore(metrics),
      security: this.calculateSecurityScore(metrics)
    };

    return Object.entries(weights).reduce((total, [key, weight]) =>
      total + (scores[key as keyof typeof scores] * weight), 0
    );
  }

  /**
   * Calculate performance score
   */
  private calculatePerformanceScore(metrics: AgentMetrics): number {
    const successRate = metrics.performance_metrics.success_rate;
    const efficiencyScore = metrics.performance_metrics.efficiency_score;
    return (successRate + efficiencyScore) / 2;
  }

  /**
   * Calculate availability score
   */
  private calculateAvailabilityScore(metrics: AgentMetrics, healthChecks: HealthCheck[]): number {
    const uptimePercentage = metrics.health_metrics.uptime_percentage;
    const heartbeatChecks = healthChecks.filter(c => c.check_type === 'heartbeat');

    if (heartbeatChecks.length === 0) return uptimePercentage;

    const failedHeartbeats = heartbeatChecks.filter(c => c.status === 'failing' || c.status === 'critical').length;
    const heartbeatScore = Math.max(0, 100 - (failedHeartbeats * 20));

    return (uptimePercentage + heartbeatScore) / 2;
  }

  /**
   * Calculate resource score
   */
  private calculateResourceScore(metrics: AgentMetrics): number {
    const cpuUsage = metrics.health_metrics.cpu_usage;
    const memoryUsage = metrics.health_metrics.memory_usage;
    const avgUsage = (cpuUsage + memoryUsage) / 2;

    return Math.max(0, 100 - avgUsage);
  }

  /**
   * Calculate business score
   */
  private calculateBusinessScore(metrics: AgentMetrics): number {
    const complianceScore = metrics.business_metrics.compliance_score;
    const goalCompletionRate = metrics.business_metrics.goals_achieved /
      Math.max(1, metrics.business_metrics.goals_achieved + metrics.business_metrics.goals_failed);

    return (complianceScore + goalCompletionRate) / 2;
  }

  /**
   * Calculate security score
   */
  private calculateSecurityScore(metrics: AgentMetrics): number {
    const errorRate = metrics.health_metrics.error_rate;
    const consecutiveFailures = metrics.health_metrics.consecutive_failures;

    let securityScore = 100;
    securityScore -= errorRate * 10;
    securityScore -= consecutiveFailures * 5;

    return Math.max(0, securityScore);
  }

  /**
   * Identify active issues
   */
  private identifyActiveIssues(healthChecks: HealthCheck[]): Array<{
    type: string;
    severity: string;
    description: string;
    impact: number;
  }> {
    return healthChecks
      .filter(check => check.status !== 'passing')
      .map(check => ({
        type: check.check_type,
        severity: check.status,
        description: `${check.check_type} check ${check.status}`,
        impact: check.status === 'failing' ? 100 : check.status === 'critical' ? 70 : 30
      }));
  }

  /**
   * Generate health recommendations
   */
  private generateHealthRecommendations(healthScore: number, healthChecks: HealthCheck[]): Array<{
    priority: 'low' | 'medium' | 'high' | 'critical';
    action: string;
    description: string;
    estimated_impact: number;
  }> {
    const recommendations = [];

    if (healthScore < 50) {
      recommendations.push({
        priority: 'critical',
        action: 'restart_agent',
        description: 'Agent health is critical. Consider restarting the agent.',
        estimated_impact: 40
      });
    }

    const failedChecks = healthChecks.filter(c => c.status === 'failing' || c.status === 'critical');
    for (const check of failedChecks) {
      recommendations.push({
        priority: check.status === 'failing' ? 'high' : 'medium',
        action: `address_${check.check_type}`,
        description: `Address ${check.check_type} issues immediately.`,
        estimated_impact: 25
      });
    }

    return recommendations;
  }

  /**
   * Predict health trend
   */
  private predictHealthTrend(healthScoreTrend: Array<{timestamp: number, score: number}>): {
    next_hour: number;
    next_24_hours: number;
    confidence: number;
  } {
    if (healthScoreTrend.length < 2) {
      return { next_hour: 75, next_24_hours: 75, confidence: 0.3 };
    }

    // Simple linear prediction
    const recentTrend = healthScoreTrend.slice(-6); // Last 6 data points
    const slope = this.calculateLinearTrend(recentTrend.map(t => t.score));

    const currentScore = healthScoreTrend[healthScoreTrend.length - 1].score;
    const nextHour = Math.max(0, Math.min(100, currentScore + slope));
    const next24Hours = Math.max(0, Math.min(100, currentScore + (slope * 24)));

    const variance = this.calculateVariance(recentTrend.map(t => t.score));
    const confidence = Math.max(0.1, Math.min(1, 1 - (variance / 100)));

    return {
      next_hour: nextHour,
      next_24_hours: next24Hours,
      confidence: confidence
    };
  }

  /**
   * Analyze risk factors
   */
  private analyzeRiskFactors(snapshots: HealthSnapshot[]): Array<{
    factor: string;
    impact: number;
    description: string;
  }> {
    const riskFactors = [];

    if (snapshots.length < 2) return riskFactors;

    const latest = snapshots[snapshots.length - 1];
    const previous = snapshots[snapshots.length - 2];

    // Check for declining performance
    if (latest.component_scores.performance < previous.component_scores.performance) {
      riskFactors.push({
        factor: 'performance_decline',
        impact: previous.component_scores.performance - latest.component_scores.performance,
        description: 'Performance score has declined'
      });
    }

    // Check for resource pressure
    if (latest.component_scores.resource_utilization < 50) {
      riskFactors.push({
        factor: 'resource_pressure',
        impact: 50 - latest.component_scores.resource_utilization,
        description: 'Resource utilization is high'
      });
    }

    // Check for business logic issues
    if (latest.component_scores.business_logic < 70) {
      riskFactors.push({
        factor: 'business_logic_issues',
        impact: 70 - latest.component_scores.business_logic,
        description: 'Business logic score is below acceptable threshold'
      });
    }

    return riskFactors.sort((a, b) => b.impact - a.impact);
  }

  /**
   * Calculate linear trend
   */
  private calculateLinearTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, index) => sum + (index * val), 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  /**
   * Calculate variance
   */
  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return variance;
  }

  /**
   * Get health status from score
   */
  private getHealthStatusFromScore(score: number): string {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    if (score >= 40) return 'poor';
    return 'critical';
  }

  /**
   * Initialize default health policies
   */
  private initializeDefaultHealthPolicies(): void {
    const defaultPolicy: HealthPolicy = {
      id: 'default-health-policy',
      name: 'Default Health Policy',
      description: 'Default health monitoring and recovery policy for all agents',
      agent_types: ['BillingAgent', 'ComplianceAgent', 'IntelligenceAgent', 'RiskAgent'],
      health_checks: [
        {
          id: 'heartbeat-check',
          check_type: 'heartbeat',
          condition: 'time_since_last_metric > 5',
          threshold: 5, // 5 minutes
          severity: 'high',
          check_interval: 1,
          enabled: true
        },
        {
          id: 'performance-check',
          check_type: 'performance',
          condition: 'success_rate < 0.8',
          threshold: 0.8,
          severity: 'medium',
          check_interval: 5,
          enabled: true
        },
        {
          id: 'resource-check',
          check_type: 'resource',
          condition: 'cpu_usage > 85 || memory_usage > 85',
          threshold: 85,
          severity: 'medium',
          check_interval: 2,
          enabled: true
        },
        {
          id: 'connectivity-check',
          check_type: 'connectivity',
          condition: 'error_rate > 10',
          threshold: 10,
          severity: 'high',
          check_interval: 3,
          enabled: true
        },
        {
          id: 'business-logic-check',
          check_type: 'business_logic',
          condition: 'compliance_score < 0.7',
          threshold: 0.7,
          severity: 'high',
          check_interval: 10,
          enabled: true
        }
      ],
      recovery_actions: [
        {
          id: 'restart-on-failure',
          trigger_condition: 'health_check_status == "failing"',
          action_type: 'restart',
          parameters: {},
          max_attempts: 3,
          cooldown_period: 15,
          success_criteria: 'health_check_status == "passing"'
        },
        {
          id: 'reconfigure-on-critical',
          trigger_condition: 'health_check_status == "critical"',
          action_type: 'reconfigure',
          parameters: { reduce_complexity: true },
          max_attempts: 2,
          cooldown_period: 30,
          success_criteria: 'health_check_status != "critical"'
        },
        {
          id: 'notify-on-warning',
          trigger_condition: 'health_check_status == "warning"',
          action_type: 'notify',
          parameters: { notification_level: 'warning' },
          max_attempts: 1,
          cooldown_period: 60,
          success_criteria: 'notification_sent == true'
        }
      ],
      escalation_rules: [
        {
          id: 'escalate-after-failures',
          condition: 'consecutive_failures > 3',
          escalation_level: 2,
          action: 'notify_admin',
          recipients: ['admin@company.com'],
          delay_minutes: 5
        }
      ],
      enabled: true,
      created_at: Date.now(),
      updated_at: Date.now()
    };

    this.healthPolicies.set(defaultPolicy.id, defaultPolicy);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}