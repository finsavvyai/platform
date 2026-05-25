/**
 * Revolutionary AI Agent Orchestrator
 * Autonomous multi-agent coordination and orchestration with intelligent task management
 */

import { BaseAgent, AgentGoal, AgentMessage, AgentState, AgentContext } from './agent-framework';
import type { Env, AgentTask, AgentMessage as LegacyAgentMessage, AgentState as LegacyAgentState, User, Organization } from '../types';

interface OrchestratorState {
  agents: Map<string, AgentInfo>;
  activeTasks: Map<string, TaskInfo>;
  taskQueue: TaskInfo[];
  collaborationSessions: Map<string, CollaborationSession>;
  performanceMetrics: OrchestratorMetrics;
  lastActivity: string;
}

interface AgentInfo {
  id: string;
  type: 'billing' | 'compliance' | 'intelligence' | 'risk';
  status: 'idle' | 'busy' | 'offline' | 'error';
  currentTask?: string;
  capabilities: string[];
  performance: AgentPerformance;
  lastHeartbeat: string;
  workload: number;
}

interface TaskInfo {
  id: string;
  type: string;
  priority: number;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  assignedAgent?: string;
  input: any;
  output?: any;
  createdAt: string;
  assignedAt?: string;
  startedAt?: string;
  completedAt?: string;
  deadline?: string;
  dependencies: string[];
  collaborationRequired: boolean;
  collaborators: string[];
  retryCount: number;
  maxRetries: number;
  userContext: any;
  organizationId: string;
}

interface CollaborationSession {
  id: string;
  taskId: string;
  participants: string[];
  status: 'initiated' | 'active' | 'completed' | 'failed';
  messages: AgentMessage[];
  sharedContext: any;
  createdAt: string;
  lastActivity: string;
}

interface AgentPerformance {
  tasksCompleted: number;
  averageCompletionTime: number;
  successRate: number;
  errorRate: number;
  collaborationScore: number;
  userSatisfaction: number;
  lastUpdated: string;
}

interface OrchestratorMetrics {
  totalTasksProcessed: number;
  averageTaskDuration: number;
  successRate: number;
  collaborationEfficiency: number;
  agentUtilization: number;
  userSatisfactionScore: number;
  tasksByType: Record<string, number>;
  errorsByType: Record<string, number>;
  lastUpdated: string;
}

export class AgentOrchestrator implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private orchestratorState: OrchestratorState;
  private initialized: boolean = false;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.orchestratorState = {
      agents: new Map(),
      activeTasks: new Map(),
      taskQueue: [],
      collaborationSessions: new Map(),
      performanceMetrics: {
        totalTasksProcessed: 0,
        averageTaskDuration: 0,
        successRate: 0,
        collaborationEfficiency: 0,
        agentUtilization: 0,
        userSatisfactionScore: 0,
        tasksByType: {},
        errorsByType: {},
        lastUpdated: new Date().toISOString()
      },
      lastActivity: new Date().toISOString()
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.split('/').filter(Boolean);

    try {
      // Initialize on first access
      if (!this.initialized) {
        await this.loadState();
        this.initialized = true;
      }

      // Route requests
      if (request.method === 'POST' && path[0] === 'execute') {
        return this.executeTask(request);
      } else if (request.method === 'POST' && path[0] === 'coordinate') {
        return this.coordinateAgents(request);
      } else if (request.method === 'GET' && path[0] === 'status') {
        return this.getStatus(request);
      } else if (request.method === 'POST' && path[0] === 'register') {
        return this.registerAgent(request);
      } else if (request.method === 'POST' && path[0] === 'heartbeat') {
        return this.agentHeartbeat(request);
      } else if (request.method === 'GET' && path[0] === 'metrics') {
        return this.getMetrics(request);
      } else if (request.method === 'POST' && path[0] === 'collaborate') {
        return this.initiateCollaboration(request);
      } else if (request.method === 'GET' && path[0] === 'health') {
        return this.healthCheck();
      } else {
        return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      console.error('Orchestrator error:', error);
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async executeTask(request: Request): Promise<Response> {
    const data = await request.json();
    const { action, task, agent_type, priority, user_context, request_id, timestamp } = data;

    if (action !== 'execute_task') {
      return new Response('Invalid action', { status: 400 });
    }

    try {
      // Create task
      const taskInfo: TaskInfo = {
        id: request_id || crypto.randomUUID(),
        type: task.type || task.task_type || 'general',
        priority: this.mapPriority(priority || 'medium'),
        status: 'pending',
        input: task,
        createdAt: timestamp || new Date().toISOString(),
        dependencies: task.dependencies || [],
        collaborationRequired: task.collaboration_required || false,
        collaborators: [],
        retryCount: 0,
        maxRetries: task.max_retries || 3,
        userContext: user_context,
        organizationId: user_context?.organization_id || 'default'
      };

      // Determine if collaboration is needed
      if (this.requiresCollaboration(task.type)) {
        taskInfo.collaborationRequired = true;
        taskInfo.collaborators = this.determineCollaborators(task.type);
      }

      // Add to queue
      this.orchestratorState.taskQueue.push(taskInfo);
      this.orchestratorState.activeTasks.set(taskInfo.id, taskInfo);

      // Process queue
      this.processTaskQueue();

      // Save state
      await this.saveState();

      return new Response(JSON.stringify({
        success: true,
        task_id: taskInfo.id,
        status: 'queued',
        estimated_completion: this.estimateCompletionTime(taskInfo),
        queue_position: this.orchestratorState.taskQueue.indexOf(taskInfo) + 1
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Task execution failed:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async coordinateAgents(request: Request): Promise<Response> {
    const data = await request.json();
    const { action, collaboration_request, request_id, timestamp } = data;

    if (action !== 'coordinate_agents') {
      return new Response('Invalid action', { status: 400 });
    }

    try {
      const sessionId = crypto.randomUUID();
      const collaborationSession: CollaborationSession = {
        id: sessionId,
        taskId: collaboration_request.task_id || 'unknown',
        participants: collaboration_request.agents || [],
        status: 'initiated',
        messages: [],
        sharedContext: collaboration_request.context || {},
        createdAt: timestamp || new Date().toISOString(),
        lastActivity: new Date().toISOString()
      };

      this.orchestratorState.collaborationSessions.set(sessionId, collaborationSession);

      // Notify participants
      for (const agentId of collaborationSession.participants) {
        await this.notifyAgent(agentId, {
          type: 'collaboration_request',
          sessionId: sessionId,
          task: collaboration_request,
          context: collaborationSession.sharedContext
        });
      }

      await this.saveState();

      return new Response(JSON.stringify({
        success: true,
        session_id: sessionId,
        participants: collaborationSession.participants,
        status: 'initiated'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Agent coordination failed:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async getStatus(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const taskId = url.searchParams.get('task_id');
    const agentId = url.searchParams.get('agent_id');

    if (taskId) {
      const task = this.orchestratorState.activeTasks.get(taskId);
      if (!task) {
        return new Response(JSON.stringify({ error: 'Task not found' }), { status: 404 });
      }

      return new Response(JSON.stringify({
        task_id: task.id,
        status: task.status,
        assigned_agent: task.assignedAgent,
        created_at: task.createdAt,
        started_at: task.startedAt,
        completed_at: task.completedAt,
        progress: this.calculateTaskProgress(task)
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (agentId) {
      const agent = this.orchestratorState.agents.get(agentId);
      if (!agent) {
        return new Response(JSON.stringify({ error: 'Agent not found' }), { status: 404 });
      }

      return new Response(JSON.stringify({
        agent_id: agent.id,
        type: agent.type,
        status: agent.status,
        current_task: agent.currentTask,
        workload: agent.workload,
        performance: agent.performance,
        last_heartbeat: agent.lastHeartbeat
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Overall status
    return new Response(JSON.stringify({
      agents: Array.from(this.orchestratorState.agents.values()).map(agent => ({
        id: agent.id,
        type: agent.type,
        status: agent.status,
        workload: agent.workload
      })),
      active_tasks: this.orchestratorState.activeTasks.size,
      queued_tasks: this.orchestratorState.taskQueue.length,
      active_collaborations: this.orchestratorState.collaborationSessions.size,
      metrics: this.orchestratorState.performanceMetrics
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async registerAgent(request: Request): Promise<Response> {
    const data = await request.json();
    const { agent_id, agent_type, capabilities, organization_id } = data;

    try {
      const agentInfo: AgentInfo = {
        id: agent_id,
        type: agent_type,
        status: 'idle',
        capabilities: capabilities || [],
        performance: {
          tasksCompleted: 0,
          averageCompletionTime: 0,
          successRate: 1.0,
          errorRate: 0.0,
          collaborationScore: 0.5,
          userSatisfaction: 0.0,
          lastUpdated: new Date().toISOString()
        },
        lastHeartbeat: new Date().toISOString(),
        workload: 0
      };

      this.orchestratorState.agents.set(agent_id, agentInfo);
      await this.saveState();

      return new Response(JSON.stringify({
        success: true,
        agent_id: agent_id,
        status: 'registered'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Agent registration failed:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async agentHeartbeat(request: Request): Promise<Response> {
    const data = await request.json();
    const { agent_id, status, current_task, workload } = data;

    try {
      const agent = this.orchestratorState.agents.get(agent_id);
      if (!agent) {
        return new Response(JSON.stringify({ error: 'Agent not found' }), { status: 404 });
      }

      agent.status = status || agent.status;
      agent.currentTask = current_task;
      agent.workload = workload || agent.workload;
      agent.lastHeartbeat = new Date().toISOString();

      await this.saveState();

      return new Response(JSON.stringify({
        success: true,
        status: 'heartbeat_received'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Heartbeat failed:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async getMetrics(request: Request): Promise<Response> {
    return new Response(JSON.stringify({
      metrics: this.orchestratorState.performanceMetrics,
      agent_performance: Array.from(this.orchestratorState.agents.values()).map(agent => ({
        id: agent.id,
        type: agent.type,
        performance: agent.performance
      }))
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async initiateCollaboration(request: Request): Promise<Response> {
    const data = await request.json();
    const { task_id, agents, context } = data;

    try {
      const sessionId = crypto.randomUUID();
      const collaborationSession: CollaborationSession = {
        id: sessionId,
        taskId: task_id,
        participants: agents,
        status: 'active',
        messages: [],
        sharedContext: context || {},
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      };

      this.orchestratorState.collaborationSessions.set(sessionId, collaborationSession);

      // Notify all participants
      for (const agentId of agents) {
        await this.notifyAgent(agentId, {
          type: 'collaboration_start',
          sessionId: sessionId,
          taskId: task_id,
          participants: agents,
          context: context
        });
      }

      await this.saveState();

      return new Response(JSON.stringify({
        success: true,
        session_id: sessionId
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Collaboration initiation failed:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private healthCheck(): Response {
    const uptime = Date.now() - new Date(this.orchestratorState.lastActivity).getTime();
    const activeAgents = Array.from(this.orchestratorState.agents.values())
      .filter(agent => agent.status !== 'offline').length;

    return new Response(JSON.stringify({
      status: 'healthy',
      uptime_ms: uptime,
      active_agents: activeAgents,
      active_tasks: this.orchestratorState.activeTasks.size,
      queued_tasks: this.orchestratorState.taskQueue.length,
      last_activity: this.orchestratorState.lastActivity
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Private helper methods
  private async loadState(): Promise<void> {
    try {
      const savedState = await this.state.storage.get<OrchestratorState>('orchestrator_state');
      if (savedState) {
        this.orchestratorState = savedState;
        this.orchestratorState.agents = new Map(Object.entries(savedState.agents));
        this.orchestratorState.activeTasks = new Map(Object.entries(savedState.activeTasks));
        this.orchestratorState.collaborationSessions = new Map(Object.entries(savedState.collaborationSessions));
      }

      // Check for stale agents
      await this.checkAgentHealth();

      // Restart processing if there are pending tasks
      if (this.orchestratorState.taskQueue.length > 0) {
        this.processTaskQueue();
      }
    } catch (error) {
      console.error('Failed to load orchestrator state:', error);
    }
  }

  private async saveState(): Promise<void> {
    try {
      const stateToSave = {
        ...this.orchestratorState,
        agents: Object.fromEntries(this.orchestratorState.agents),
        activeTasks: Object.fromEntries(this.orchestratorState.activeTasks),
        collaborationSessions: Object.fromEntries(this.orchestratorState.collaborationSessions)
      };

      await this.state.storage.put('orchestrator_state', stateToSave);
      this.orchestratorState.lastActivity = new Date().toISOString();
    } catch (error) {
      console.error('Failed to save orchestrator state:', error);
    }
  }

  private async processTaskQueue(): Promise<void> {
    while (this.orchestratorState.taskQueue.length > 0) {
      const task = this.orchestratorState.taskQueue.shift();
      if (!task) break;

      // Check dependencies
      if (!this.areDependenciesMet(task)) {
        // Put back in queue
        this.orchestratorState.taskQueue.push(task);
        break;
      }

      // Find suitable agent
      const agent = this.findBestAgent(task);
      if (!agent) {
        // Put back in queue if no agent available
        this.orchestratorState.taskQueue.push(task);
        break;
      }

      // Assign task
      await this.assignTaskToAgent(task, agent);
    }
  }

  private findBestAgent(task: TaskInfo): AgentInfo | null {
    const availableAgents = Array.from(this.orchestratorState.agents.values())
      .filter(agent => agent.status === 'idle' || agent.status === 'busy')
      .filter(agent => this.canHandleTask(agent, task))
      .sort((a, b) => {
        // Sort by performance and workload
        const scoreA = a.performance.successRate * (1 - a.workload);
        const scoreB = b.performance.successRate * (1 - b.workload);
        return scoreB - scoreA;
      });

    return availableAgents[0] || null;
  }

  private canHandleTask(agent: AgentInfo, task: TaskInfo): boolean {
    // Check if agent has required capabilities
    if (task.type === 'billing' && agent.type !== 'billing') return false;
    if (task.type === 'compliance' && agent.type !== 'compliance') return false;
    if (task.type === 'intelligence' && agent.type !== 'intelligence') return false;
    if (task.type === 'risk' && agent.type !== 'risk') return false;

    // Check workload capacity
    return agent.workload < 0.8; // Don't overload agents
  }

  private async assignTaskToAgent(task: TaskInfo, agent: AgentInfo): Promise<void> {
    task.status = 'assigned';
    task.assignedAgent = agent.id;
    task.assignedAt = new Date().toISOString();

    agent.status = 'busy';
    agent.currentTask = task.id;
    agent.workload = Math.min(1.0, agent.workload + 0.2);

    // Notify agent
    await this.notifyAgent(agent.id, {
      type: 'task_assignment',
      task: task
    });

    // Update metrics
    this.updateMetrics('task_assigned', task);
  }

  private async notifyAgent(agentId: string, message: any): Promise<void> {
    try {
      const agentNamespace = this.getAgentNamespace(agentId);
      if (!agentNamespace) return;

      const agentDo = agentNamespace.idFromName(agentId);
      const agentStub = agentNamespace.get(agentDo);

      await agentStub.fetch(new Request('https://orchestrator.local/notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      }));
    } catch (error) {
      console.error(`Failed to notify agent ${agentId}:`, error);
    }
  }

  private getAgentNamespace(agentId: string): DurableObjectNamespace | null {
    if (agentId.startsWith('billing-')) return this.env.BILLING_AGENT;
    if (agentId.startsWith('compliance-')) return this.env.COMPLIANCE_AGENT;
    if (agentId.startsWith('intelligence-')) return this.env.INTELLIGENCE_AGENT;
    if (agentId.startsWith('risk-')) return this.env.RISK_AGENT;
    return null;
  }

  private mapPriority(priority: string): number {
    const priorityMap: Record<string, number> = {
      'low': 1,
      'medium': 2,
      'high': 3,
      'critical': 4
    };
    return priorityMap[priority] || 2;
  }

  private requiresCollaboration(taskType: string): boolean {
    const collaborativeTasks = [
      'complex_invoice_analysis',
      'multi_regulatory_compliance',
      'cross_departmental_intelligence',
      'comprehensive_risk_assessment'
    ];
    return collaborativeTasks.includes(taskType);
  }

  private determineCollaborators(taskType: string): string[] {
    const collaborationMap: Record<string, string[]> = {
      'complex_invoice_analysis': ['intelligence', 'risk'],
      'multi_regulatory_compliance': ['risk', 'intelligence'],
      'cross_departmental_intelligence': ['billing', 'compliance', 'risk'],
      'comprehensive_risk_assessment': ['billing', 'compliance', 'intelligence']
    };
    return collaborationMap[taskType] || [];
  }

  private areDependenciesMet(task: TaskInfo): boolean {
    for (const dependencyId of task.dependencies) {
      const dependency = this.orchestratorState.activeTasks.get(dependencyId);
      if (!dependency || dependency.status !== 'completed') {
        return false;
      }
    }
    return true;
  }

  private calculateTaskProgress(task: TaskInfo): number {
    if (task.status === 'completed') return 100;
    if (task.status === 'failed') return 0;
    if (task.status === 'cancelled') return 0;
    if (task.status === 'pending') return 0;
    if (task.status === 'assigned') return 10;
    if (task.status === 'in_progress') return 50;
    return 0;
  }

  private estimateCompletionTime(task: TaskInfo): string {
    const baseTime = 5 * 60 * 1000; // 5 minutes base
    const priorityMultiplier = task.priority / 2.0;
    const complexityMultiplier = this.getTaskComplexity(task.type);
    const estimatedMs = baseTime * priorityMultiplier * complexityMultiplier;

    const estimatedDate = new Date(Date.now() + estimatedMs);
    return estimatedDate.toISOString();
  }

  private getTaskComplexity(taskType: string): number {
    const complexityMap: Record<string, number> = {
      'simple_query': 1.0,
      'data_analysis': 1.5,
      'invoice_processing': 2.0,
      'compliance_check': 2.5,
      'risk_assessment': 3.0,
      'complex_analysis': 4.0,
      'multi_agent_coordination': 5.0
    };
    return complexityMap[taskType] || 2.0;
  }

  private async checkAgentHealth(): Promise<void> {
    const now = new Date();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [agentId, agent] of this.orchestratorState.agents) {
      const lastHeartbeat = new Date(agent.lastHeartbeat);
      if (now.getTime() - lastHeartbeat.getTime() > staleThreshold) {
        agent.status = 'offline';
        agent.currentTask = undefined;
        agent.workload = 0;

        // Reassign any active tasks
        for (const [taskId, task] of this.orchestratorState.activeTasks) {
          if (task.assignedAgent === agentId && task.status === 'in_progress') {
            task.status = 'pending';
            task.assignedAgent = undefined;
            this.orchestratorState.taskQueue.push(task);
          }
        }
      }
    }
  }

  private updateMetrics(event: string, data: any): void {
    const metrics = this.orchestratorState.performanceMetrics;

    switch (event) {
      case 'task_assigned':
        metrics.tasksByType[data.type] = (metrics.tasksByType[data.type] || 0) + 1;
        break;
      case 'task_completed':
        metrics.totalTasksProcessed++;
        break;
      case 'task_failed':
        metrics.errorsByType[data.type] = (metrics.errorsByType[data.type] || 0) + 1;
        break;
    }

    metrics.lastUpdated = new Date().toISOString();

    // Calculate derived metrics
    const totalTasks = Object.values(metrics.tasksByType).reduce((sum, count) => sum + count, 0);
    const totalErrors = Object.values(metrics.errorsByType).reduce((sum, count) => sum + count, 0);
    metrics.successRate = totalTasks > 0 ? (totalTasks - totalErrors) / totalTasks : 1.0;

    // Calculate agent utilization
    const activeAgents = Array.from(this.orchestratorState.agents.values())
      .filter(agent => agent.status !== 'offline').length;
    const busyAgents = Array.from(this.orchestratorState.agents.values())
      .filter(agent => agent.status === 'busy').length;
    metrics.agentUtilization = activeAgents > 0 ? busyAgents / activeAgents : 0;
  }
}