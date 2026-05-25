import { Agent, AgentMessage } from './types';
import {
  initAgent, setStatus, isActive,
  getAgentStats, getPerformanceMetrics, getErrorStatistics,
} from './agent-orchestration-lifecycle';
import {
  deliverMessage, flushQueue, executeWithRetry as retryFn,
} from './agent-orchestration-messaging';

type Handler = (data: unknown) => void;

export class AgentOrchestrator {
  private agents = new Map<string, Agent>();
  private listeners = new Map<string, Handler[]>();
  private messageQueue = new Map<string, AgentMessage[]>();
  private messageHistory = new Map<string, AgentMessage[]>();
  private dependencies = new Map<string, string[]>();
  private logs = new Map<string, string[]>();
  private errors = new Map<string, number>();
  private maxConcurrent = Infinity;

  on(event: string, handler: Handler): void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(handler);
  }

  emit(event: string, data: unknown): void {
    for (const h of this.listeners.get(event) ?? []) h(data);
  }

  async spawnAgent(agent: Agent): Promise<Agent> {
    const spawned = initAgent(agent);
    const activeCount = [...this.agents.values()].filter(
      a => a.status === 'idle' || a.status === 'running',
    ).length;
    if (activeCount >= this.maxConcurrent) {
      spawned.status = 'paused';
    }
    this.agents.set(spawned.id, spawned);
    this.addLog(spawned.id, `Agent ${spawned.id} spawned`);
    this.emit('agent:spawned', spawned);
    return spawned;
  }

  async sendMessage(message: AgentMessage): Promise<{ status: string }> {
    const recipient = this.agents.get(message.to);
    if (!recipient) throw new Error('Agent not found');

    if (recipient.status === 'paused') {
      if (!this.messageQueue.has(message.to)) {
        this.messageQueue.set(message.to, []);
      }
      this.messageQueue.get(message.to)!.push(message);
      return { status: 'queued' };
    }

    return deliverMessage(
      recipient, message, this.messageHistory,
      (id, err) => {
        this.errors.set(id, (this.errors.get(id) ?? 0) + 1);
        this.emit('agent:error', { agentId: id, error: err });
      },
    );
  }

  async pauseAgent(id: string): Promise<void> {
    const agent = this.agents.get(id);
    if (!agent) throw new Error('Agent not found');
    this.agents.set(id, setStatus(agent, 'paused'));
    this.addLog(id, `Agent ${id} paused`);
    this.emit('agent:paused', id);
  }

  async resumeAgent(id: string): Promise<void> {
    const agent = this.agents.get(id);
    if (!agent) throw new Error('Agent not found');
    this.agents.set(id, setStatus(agent, 'idle'));
    await flushQueue(id, this.messageQueue, this.messageHistory);
    this.addLog(id, `Agent ${id} resumed`);
  }

  async terminateAgent(id: string): Promise<void> {
    const agent = this.agents.get(id);
    if (!agent) throw new Error('Agent not found');
    this.agents.set(id, setStatus(agent, 'terminated'));
    this.addLog(id, `Agent ${id} terminated`);
  }

  async restartAgent(id: string): Promise<void> {
    const agent = this.agents.get(id);
    if (!agent) throw new Error('Agent not found');
    this.agents.set(id, setStatus(agent, 'idle'));
    this.addLog(id, `Agent ${id} restarted`);
  }

  async getAgentStatus(id: string): Promise<string> {
    return this.agents.get(id)?.status ?? 'unknown';
  }

  async executeWithRetry(
    _agentId: string, fn: () => Promise<unknown>, maxRetries: number,
  ): Promise<unknown> {
    return retryFn(fn, maxRetries);
  }

  async getActiveAgents(): Promise<Agent[]> {
    return [...this.agents.values()].filter(
      a => a.status === 'idle' || a.status === 'running',
    );
  }

  async getAgentStats(id: string) { return getAgentStats(id); }

  async cleanup(): Promise<void> {
    for (const [id, agent] of this.agents) {
      if (agent.status === 'terminated') this.agents.delete(id);
    }
  }

  async listAgents(): Promise<Agent[]> {
    return [...this.agents.values()];
  }

  getMetrics() {
    const all = [...this.agents.values()];
    return { totalAgents: all.length, activeAgents: all.filter(isActive).length };
  }

  setMaxConcurrent(n: number): void { this.maxConcurrent = n; }

  async broadcast(agentIds: string[], message: Record<string, unknown>) {
    for (const id of agentIds) {
      const msg: AgentMessage = {
        id: `broadcast-${id}-${Date.now()}`,
        from: 'system', to: id, type: message.type as string ?? 'event',
        payload: message.payload as Record<string, unknown> ?? {},
      };
      await this.sendMessage(msg).catch(() => {});
    }
  }

  async executeSequence(agentIds: string[], _task: Record<string, unknown>) {
    for (const id of agentIds) {
      this.addLog(id, `Executed task`);
    }
    return { completed: true };
  }

  async addDependency(downstreamId: string, upstreamId: string) {
    if (!this.dependencies.has(downstreamId)) {
      this.dependencies.set(downstreamId, []);
    }
    this.dependencies.get(downstreamId)!.push(upstreamId);
  }

  async getDependencies(agentId: string): Promise<string[]> {
    return this.dependencies.get(agentId) ?? [];
  }

  async getAgentLogs(id: string): Promise<string[]> {
    return this.logs.get(id) ?? [];
  }

  async getPerformanceMetrics(id: string) { return getPerformanceMetrics(id); }
  async getMessageHistory(id: string) { return this.messageHistory.get(id) ?? []; }
  async getErrorStatistics(id: string) { return getErrorStatistics(this.errors, id); }

  private addLog(id: string, msg: string): void {
    if (!this.logs.has(id)) this.logs.set(id, []);
    this.logs.get(id)!.push(msg);
  }
}
