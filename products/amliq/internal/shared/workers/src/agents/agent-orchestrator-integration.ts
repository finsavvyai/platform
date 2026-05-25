/**
 * Agent Orchestrator Integration
 *
 * Integration layer that connects the agent monitoring, health management,
 * and learning systems with the main orchestrator for seamless operation.
 */

import { BaseAgent, AgentGoal, AgentMessage, AgentState } from './agent-framework';
import { AgentMonitoringSystem, AgentMetrics, AgentAlert } from './agent-monitoring';
import { AgentHealthManager, HealthCheck, HealingAction } from './agent-health-manager';
import { AgentLearningSystem, LearningEvent, FeedbackData } from './learning-system';
import { AgentOrchestrator } from './agent-orchestrator';

export interface IntegratedAgentContext {
  agent: BaseAgent;
  monitoring: AgentMonitoringSystem;
  healthManager: AgentHealthManager;
  learningSystem: AgentLearningSystem;
  orchestrator: AgentOrchestrator;
  organization_id: string;
  user_id: string;
}

export interface AgentLifecycleEvent {
  id: string;
  agent_id: string;
  event_type: 'created' | 'started' | 'stopped' | 'restarted' | 'paused' | 'resumed' | 'destroyed';
  timestamp: number;
  details: any;
  triggered_by: 'system' | 'user' | 'health_manager' | 'learning_system';
  reason?: string;
}

export interface AgentCollaborationEvent {
  id: string;
  from_agent_id: string;
  to_agent_id: string;
  collaboration_type: 'message' | 'task_delegation' | 'resource_sharing' | 'goal_coordination';
  timestamp: number;
  details: any;
  outcome?: any;
}

export interface AgentPerformanceSnapshot {
  agent_id: string;
  timestamp: number;
  state: AgentState;
  current_goals: AgentGoal[];
  recent_messages: AgentMessage[];
  metrics: AgentMetrics;
  health_checks: HealthCheck[];
  learning_events: LearningEvent[];
  alerts: AgentAlert[];
  healing_actions: HealingAction[];
}

/**
 * Integrated Agent Orchestrator
 *
 * This class provides the main integration point for all agent systems,
 * ensuring seamless coordination between monitoring, health management,
 * learning, and orchestration components.
 */
export class IntegratedAgentOrchestrator {
  private agents: Map<string, IntegratedAgentContext> = new Map();
  private lifecycleEvents: AgentLifecycleEvent[] = [];
  private collaborationEvents: AgentCollaborationEvent[] = [];
  private performanceSnapshots: Map<string, AgentPerformanceSnapshot[]> = new Map();
  private monitoringSystem: AgentMonitoringSystem;
  private healthManager: AgentHealthManager;
  private learningSystem: AgentLearningSystem;
  private orchestrator: AgentOrchestrator;

  constructor() {
    this.monitoringSystem = new AgentMonitoringSystem();
    this.healthManager = new AgentHealthManager();
    this.learningSystem = new AgentLearningSystem();
    this.orchestrator = new AgentOrchestrator();

    this.initializeIntegration();
  }

  /**
   * Register a new agent with all integrated systems
   */
  async registerAgent(
    agent: BaseAgent,
    organization_id: string,
    user_id: string
  ): Promise<string> {
    const agentId = agent.getAgentId();

    // Create integrated context
    const context: IntegratedAgentContext = {
      agent,
      monitoring: this.monitoringSystem,
      healthManager: this.healthManager,
      learningSystem: this.learningSystem,
      orchestrator: this.orchestrator,
      organization_id,
      user_id
    };

    this.agents.set(agentId, context);

    // Register with individual systems
    await this.orchestrator.registerAgent(agent);
    await this.healthManager.startHealthMonitoring();

    // Create lifecycle event
    await this.createLifecycleEvent({
      agent_id: agentId,
      event_type: 'created',
      details: { agent_type: agent.constructor.name, organization_id },
      triggered_by: 'user',
      reason: 'Agent registration'
    });

    // Start monitoring
    this.startAgentMonitoring(agentId);

    console.log(`Agent ${agentId} registered and integrated successfully`);
    return agentId;
  }

  /**
   * Unregister an agent from all systems
   */
  async unregisterAgent(agentId: string): Promise<void> {
    const context = this.agents.get(agentId);
    if (!context) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Stop monitoring
    this.stopAgentMonitoring(agentId);

    // Unregister from individual systems
    await this.orchestrator.unregisterAgent(agentId);

    // Create lifecycle event
    await this.createLifecycleEvent({
      agent_id: agentId,
      event_type: 'destroyed',
      details: { agent_type: context.agent.constructor.name },
      triggered_by: 'user',
      reason: 'Agent unregistration'
    });

    // Remove from registry
    this.agents.delete(agentId);

    console.log(`Agent ${agentId} unregistered successfully`);
  }

  /**
   * Start agent execution
   */
  async startAgent(agentId: string, goal: AgentGoal): Promise<void> {
    const context = this.agents.get(agentId);
    if (!context) {
      throw new Error(`Agent ${agentId} not found`);
    }

    try {
      // Start the agent
      await context.agent.executeGoal(goal);

      // Create lifecycle event
      await this.createLifecycleEvent({
        agent_id: agentId,
        event_type: 'started',
        details: { goal_id: goal.id, goal_description: goal.description },
        triggered_by: 'user',
        reason: 'Manual agent start'
      });

      console.log(`Agent ${agentId} started with goal: ${goal.description}`);
    } catch (error) {
      await this.handleAgentError(agentId, error as Error, 'start_execution');
      throw error;
    }
  }

  /**
   * Stop agent execution
   */
  async stopAgent(agentId: string): Promise<void> {
    const context = this.agents.get(agentId);
    if (!context) {
      throw new Error(`Agent ${agentId} not found`);
    }

    try {
      // Stop the agent
      await context.agent.pause();

      // Create lifecycle event
      await this.createLifecycleEvent({
        agent_id: agentId,
        event_type: 'stopped',
        details: {},
        triggered_by: 'user',
        reason: 'Manual agent stop'
      });

      console.log(`Agent ${agentId} stopped`);
    } catch (error) {
      await this.handleAgentError(agentId, error as Error, 'stop_execution');
      throw error;
    }
  }

  /**
   * Restart agent
   */
  async restartAgent(agentId: string, reason?: string): Promise<void> {
    const context = this.agents.get(agentId);
    if (!context) {
      throw new Error(`Agent ${agentId} not found`);
    }

    try {
      // Restart the agent
      await context.agent.restart();

      // Create lifecycle event
      await this.createLifecycleEvent({
        agent_id: agentId,
        event_type: 'restarted',
        details: {},
        triggered_by: 'system',
        reason: reason || 'Manual restart'
      });

      console.log(`Agent ${agentId} restarted`);
    } catch (error) {
      await this.handleAgentError(agentId, error as Error, 'restart');
      throw error;
    }
  }

  /**
   * Coordinate collaboration between agents
   */
  async coordinateAgentCollaboration(
    fromAgentId: string,
    toAgentId: string,
    collaborationType: AgentCollaborationEvent['collaboration_type'],
    details: any
  ): Promise<any> {
    const fromContext = this.agents.get(fromAgentId);
    const toContext = this.agents.get(toAgentId);

    if (!fromContext || !toContext) {
      throw new Error('One or both agents not found');
    }

    const collaborationEvent: AgentCollaborationEvent = {
      id: this.generateId(),
      from_agent_id: fromAgentId,
      to_agent_id: toAgentId,
      collaboration_type: collaborationType,
      timestamp: Date.now(),
      details
    };

    try {
      let outcome: any;

      switch (collaborationType) {
        case 'message':
          outcome = await this.handleAgentMessage(fromContext, toContext, details);
          break;
        case 'task_delegation':
          outcome = await this.handleTaskDelegation(fromContext, toContext, details);
          break;
        case 'resource_sharing':
          outcome = await this.handleResourceSharing(fromContext, toContext, details);
          break;
        case 'goal_coordination':
          outcome = await this.handleGoalCoordination(fromContext, toContext, details);
          break;
        default:
          throw new Error(`Unknown collaboration type: ${collaborationType}`);
      }

      collaborationEvent.outcome = outcome;
      this.collaborationEvents.push(collaborationEvent);

      return outcome;
    } catch (error) {
      collaborationEvent.outcome = { error: String(error) };
      this.collaborationEvents.push(collaborationEvent);
      throw error;
    }
  }

  /**
   * Get comprehensive agent status
   */
  async getAgentStatus(agentId: string): Promise<AgentPerformanceSnapshot | null> {
    const context = this.agents.get(agentId);
    if (!context) {
      return null;
    }

    const snapshots = this.performanceSnapshots.get(agentId) || [];
    return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  }

  /**
   * Get all agents with their integrated status
   */
  async getAllAgentsStatus(): Promise<Map<string, AgentPerformanceSnapshot>> {
    const statusMap = new Map<string, AgentPerformanceSnapshot>();

    for (const [agentId, context] of this.agents.entries()) {
      const status = await this.getAgentStatus(agentId);
      if (status) {
        statusMap.set(agentId, status);
      }
    }

    return statusMap;
  }

  /**
   * Get system-wide overview
   */
  async getSystemOverview(): Promise<{
    total_agents: number;
    active_agents: number;
    healthy_agents: number;
    system_health: number;
    recent_events: AgentLifecycleEvent[];
    collaboration_summary: any;
    performance_summary: any;
  }> {
    const totalAgents = this.agents.size;
    const statusMap = await this.getAllAgentsStatus();

    let activeAgents = 0;
    let healthyAgents = 0;
    let totalHealthScore = 0;

    for (const [agentId, snapshot] of statusMap.entries()) {
      if (snapshot.state.status === 'active') {
        activeAgents++;
      }

      const healthScore = this.calculateOverallHealthScore(snapshot);
      totalHealthScore += healthScore;

      if (healthScore >= 80) {
        healthyAgents++;
      }
    }

    const systemHealth = totalAgents > 0 ? totalHealthScore / totalAgents : 100;

    const recentEvents = this.lifecycleEvents.slice(-20).reverse();
    const collaborationSummary = this.summarizeCollaborations();
    const performanceSummary = this.summarizePerformance(statusMap);

    return {
      total_agents: totalAgents,
      active_agents: activeAgents,
      healthy_agents: healthyAgents,
      system_health: systemHealth,
      recent_events: recentEvents,
      collaboration_summary: collaborationSummary,
      performance_summary: performanceSummary
    };
  }

  /**
   * Start monitoring for a specific agent
   */
  private startAgentMonitoring(agentId: string): void {
    const context = this.agents.get(agentId);
    if (!context) return;

    // Schedule periodic data collection
    setInterval(async () => {
      await this.collectAgentMetrics(agentId);
    }, 60 * 1000); // Every minute
  }

  /**
   * Stop monitoring for a specific agent
   */
  private stopAgentMonitoring(agentId: string): void {
    // In a real implementation, this would stop the monitoring interval
    console.log(`Stopped monitoring for agent ${agentId}`);
  }

  /**
   * Collect comprehensive metrics for agent
   */
  private async collectAgentMetrics(agentId: string): Promise<void> {
    const context = this.agents.get(agentId);
    if (!context) return;

    try {
      // Collect basic metrics
      const state = context.agent.getState();
      const metrics = await this.buildAgentMetrics(context, state);

      // Submit to monitoring system
      await this.monitoringSystem.collectMetrics(agentId, context.agent.constructor.name, metrics);

      // Perform health checks
      const healthChecks = await this.healthManager.performHealthCheck(
        agentId,
        context.agent.constructor.name,
        metrics
      );

      // Create performance snapshot
      const snapshot: AgentPerformanceSnapshot = {
        agent_id: agentId,
        timestamp: Date.now(),
        state: state,
        current_goals: context.agent.getCurrentGoals(),
        recent_messages: context.agent.getRecentMessages(),
        metrics: metrics,
        health_checks: healthChecks,
        learning_events: await this.learningSystem.getRecentLearningEvents(agentId, 10),
        alerts: [], // Would be populated from monitoring system
        healing_actions: await this.healthManager.getHealingHistory(agentId)
      };

      // Store snapshot
      if (!this.performanceSnapshots.has(agentId)) {
        this.performanceSnapshots.set(agentId, []);
      }
      this.performanceSnapshots.get(agentId)!.push(snapshot);

      // Keep only last 24 hours of snapshots
      const cutoff = Date.now() - (24 * 60 * 60 * 1000);
      this.performanceSnapshots.set(agentId,
        this.performanceSnapshots.get(agentId)!.filter(s => s.timestamp > cutoff)
      );

    } catch (error) {
      console.error(`Error collecting metrics for agent ${agentId}:`, error);
      await this.handleAgentError(agentId, error as Error, 'metrics_collection');
    }
  }

  /**
   * Build agent metrics from state and context
   */
  private async buildAgentMetrics(context: IntegratedAgentContext, state: AgentState): Promise<AgentMetrics> {
    return {
      agent_id: context.agent.getAgentId(),
      agent_type: context.agent.constructor.name,
      timestamp: Date.now(),
      performance_metrics: {
        tasks_completed: state.goals_completed,
        tasks_failed: state.goals_failed,
        average_task_duration: state.average_task_completion_time || 0,
        success_rate: state.goals_completed + state.goals_failed > 0
          ? state.goals_completed / (state.goals_completed + state.goals_failed)
          : 1.0,
        goal_completion_rate: state.goals_completed + state.goals_failed > 0
          ? state.goals_completed / (state.goals_completed + state.goals_failed)
          : 1.0,
        accuracy_score: state.performance_score || 0.9,
        efficiency_score: state.efficiency_score || 0.9,
        response_time_p95: state.average_response_time || 100,
        throughput_per_hour: state.throughput_per_hour || 10
      },
      health_metrics: {
        status: state.status === 'active' ? 'healthy' : 'degraded',
        cpu_usage: Math.random() * 80, // Would come from actual monitoring
        memory_usage: Math.random() * 80,
        error_rate: state.error_rate || 0,
        last_heartbeat: Date.now(),
        uptime_percentage: state.uptime_percentage || 99.9,
        consecutive_failures: state.consecutive_failures || 0,
        alert_count: state.active_alerts || 0
      },
      business_metrics: {
        goals_achieved: state.goals_completed,
        goals_failed: state.goals_failed,
        business_value_created: state.business_value_created || 0,
        cost_savings_generated: state.cost_savings || 0,
        risk_mitigated: state.risk_mitigated || 0,
        compliance_score: state.compliance_score || 1.0,
        customer_impact_score: state.customer_impact_score || 0,
        roi_contribution: state.roi_contribution || 0
      },
      resource_metrics: {
        api_calls_made: state.api_calls_count || 0,
        api_costs_incurred: state.api_costs || 0,
        data_processed_mb: state.data_processed_mb || 0,
        storage_used_mb: state.storage_used_mb || 0,
        network_requests: state.network_requests || 0,
        compute_time_ms: state.compute_time_ms || 0,
        tools_utilized: state.tools_utilized || [],
        permissions_used: state.permissions_used || []
      }
    };
  }

  /**
   * Handle agent message collaboration
   */
  private async handleAgentMessage(
    fromContext: IntegratedAgentContext,
    toContext: IntegratedAgentContext,
    details: any
  ): Promise<any> {
    const message: AgentMessage = {
      id: this.generateId(),
      from_agent_id: fromContext.agent.getAgentId(),
      to_agent_id: toContext.agent.getAgentId(),
      message_type: details.message_type || 'collaboration',
      content: details.content,
      timestamp: Date.now(),
      priority: details.priority || 'normal',
      metadata: details.metadata || {}
    };

    await toContext.agent.sendMessage(message);
    return { message_id: message.id, status: 'delivered' };
  }

  /**
   * Handle task delegation collaboration
   */
  private async handleTaskDelegation(
    fromContext: IntegratedAgentContext,
    toContext: IntegratedAgentContext,
    details: any
  ): Promise<any> {
    const delegatedGoal: AgentGoal = {
      id: this.generateId(),
      description: details.description,
      priority: details.priority || 'medium',
      goal_type: details.goal_type || 'delegated_task',
      target_agent: toContext.agent.getAgentId(),
      parameters: details.parameters || {},
      deadline: details.deadline,
      dependencies: details.dependencies || [],
      constraints: details.constraints || [],
      success_criteria: details.success_criteria || [],
      created_at: Date.now(),
      created_by: fromContext.agent.getAgentId()
    };

    await toContext.agent.receiveGoal(delegatedGoal);
    return { goal_id: delegatedGoal.id, status: 'delegated' };
  }

  /**
   * Handle resource sharing collaboration
   */
  private async handleResourceSharing(
    fromContext: IntegratedAgentContext,
    toContext: IntegratedAgentContext,
    details: any
  ): Promise<any> {
    // Simulate resource sharing
    const resourceId = this.generateId();
    return { resource_id: resourceId, status: 'shared', resource_type: details.resource_type };
  }

  /**
   * Handle goal coordination collaboration
   */
  private async handleGoalCoordination(
    fromContext: IntegratedAgentContext,
    toContext: IntegratedAgentContext,
    details: any
  ): Promise<any> {
    // Simulate goal coordination
    const coordinationId = this.generateId();
    return { coordination_id: coordinationId, status: 'coordinated', goals: details.goals };
  }

  /**
   * Handle agent errors
   */
  private async handleAgentError(agentId: string, error: Error, context: string): Promise<void> {
    console.error(`Agent ${agentId} error in ${context}:`, error);

    // Log learning event
    await this.learningSystem.processLearningEvent(
      agentId,
      'error_occurred',
      { error_context: context, error_message: error.message },
      { success: false, error: error.message },
      0.8,
      0.2
    );

    // Trigger health manager if needed
    if (context !== 'restart') {
      await this.healthManager.triggerHealingAction(
        agentId,
        'restart',
        `Error in ${context}: ${error.message}`
      );
    }
  }

  /**
   * Create lifecycle event
   */
  private async createLifecycleEvent(event: Omit<AgentLifecycleEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: AgentLifecycleEvent = {
      id: this.generateId(),
      timestamp: Date.now(),
      ...event
    };

    this.lifecycleEvents.push(fullEvent);

    // Keep only last 1000 events
    if (this.lifecycleEvents.length > 1000) {
      this.lifecycleEvents = this.lifecycleEvents.slice(-1000);
    }

    // Log learning event for lifecycle changes
    if (this.agents.has(event.agent_id)) {
      await this.learningSystem.processLearningEvent(
        event.agent_id,
        'lifecycle_change',
        { event_type: event.event_type, reason: event.reason },
        { success: true },
        0.9,
        0.9
      );
    }
  }

  /**
   * Calculate overall health score
   */
  private calculateOverallHealthScore(snapshot: AgentPerformanceSnapshot): number {
    const weights = {
      performance: 0.3,
      health: 0.3,
      learning: 0.2,
      business: 0.2
    };

    const performanceScore = snapshot.metrics.performance_metrics.success_rate * 100;
    const healthScore = snapshot.health_checks.filter(c => c.status === 'passing').length /
                       Math.max(1, snapshot.health_checks.length) * 100;
    const learningScore = snapshot.learning_events.filter(e => e.outcome.confidence_after > 0.8).length /
                         Math.max(1, snapshot.learning_events.length) * 100;
    const businessScore = snapshot.metrics.business_metrics.compliance_score * 100;

    return (
      performanceScore * weights.performance +
      healthScore * weights.health +
      learningScore * weights.learning +
      businessScore * weights.business
    );
  }

  /**
   * Summarize collaborations
   */
  private summarizeCollaborations(): any {
    const recentCollaborations = this.collaborationEvents.slice(-100);

    const summary = {
      total_collaborations: recentCollaborations.length,
      by_type: {} as Record<string, number>,
      success_rate: 0,
      most_active_agents: [] as Array<{ agent_id: string, collaborations: number }>
    };

    for (const collaboration of recentCollaborations) {
      summary.by_type[collaboration.collaboration_type] =
        (summary.by_type[collaboration.collaboration_type] || 0) + 1;
    }

    const successfulCollaborations = recentCollaborations.filter(c =>
      c.outcome && !c.outcome.error
    );
    summary.success_rate = recentCollaborations.length > 0
      ? successfulCollaborations.length / recentCollaborations.length
      : 0;

    // Count collaborations per agent
    const agentCollaborationCounts = new Map<string, number>();
    for (const collaboration of recentCollaborations) {
      agentCollaborationCounts.set(collaboration.from_agent_id,
        (agentCollaborationCounts.get(collaboration.from_agent_id) || 0) + 1);
      agentCollaborationCounts.set(collaboration.to_agent_id,
        (agentCollaborationCounts.get(collaboration.to_agent_id) || 0) + 1);
    }

    summary.most_active_agents = Array.from(agentCollaborationCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([agent_id, collaborations]) => ({ agent_id, collaborations }));

    return summary;
  }

  /**
   * Summarize performance
   */
  private summarizePerformance(statusMap: Map<string, AgentPerformanceSnapshot>): any {
    const snapshots = Array.from(statusMap.values());

    if (snapshots.length === 0) {
      return {
        total_agents: 0,
        average_success_rate: 0,
        average_health_score: 0,
        total_goals_completed: 0,
        total_business_value: 0
      };
    }

    const totalSuccessRate = snapshots.reduce((sum, s) =>
      sum + s.metrics.performance_metrics.success_rate, 0);
    const totalHealthScore = snapshots.reduce((sum, s) =>
      sum + this.calculateOverallHealthScore(s), 0);
    const totalGoalsCompleted = snapshots.reduce((sum, s) =>
      sum + s.metrics.business_metrics.goals_achieved, 0);
    const totalBusinessValue = snapshots.reduce((sum, s) =>
      sum + s.metrics.business_metrics.business_value_created, 0);

    return {
      total_agents: snapshots.length,
      average_success_rate: totalSuccessRate / snapshots.length,
      average_health_score: totalHealthScore / snapshots.length,
      total_goals_completed: totalGoalsCompleted,
      total_business_value: totalBusinessValue
    };
  }

  /**
   * Initialize integration systems
   */
  private initializeIntegration(): void {
    // Start health monitoring
    this.healthManager.startHealthMonitoring();

    // Set up event handlers
    this.setupEventHandlers();

    console.log('Agent orchestrator integration initialized');
  }

  /**
   * Set up event handlers for cross-system communication
   */
  private setupEventHandlers(): void {
    // In a real implementation, this would set up event listeners and handlers
    // for communication between monitoring, health, learning, and orchestration systems
    console.log('Event handlers configured for agent integration');
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}