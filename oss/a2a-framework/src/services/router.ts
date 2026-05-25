import { Agent, Message } from './agent';

export interface RoutingRule {
  topic: string;
  targetAgentId: string;
  priority: number;
}

export class MessageRouter {
  private agents: Map<string, Agent> = new Map();
  private routingRules: RoutingRule[] = [];
  private messageQueue: Message[] = [];

  public registerAgent(agent: Agent): void {
    if (!agent.id) {
      throw new Error('Agent must have an id');
    }
    this.agents.set(agent.id, agent);
  }

  public unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
  }

  public getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  public getAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  public addRoutingRule(rule: RoutingRule): void {
    if (!rule.topic || !rule.targetAgentId) {
      throw new Error('Invalid routing rule: missing topic or targetAgentId');
    }
    this.routingRules.push(rule);
    this.routingRules.sort((a, b) => b.priority - a.priority);
  }

  public removeRoutingRule(topic: string, targetAgentId: string): void {
    this.routingRules = this.routingRules.filter(
      (r) => !(r.topic === topic && r.targetAgentId === targetAgentId)
    );
  }

  public async routeMessage(msg: Message): Promise<boolean> {
    const targetAgent = this.agents.get(msg.to);
    if (!targetAgent) {
      this.messageQueue.push(msg);
      return false;
    }
    await targetAgent.receiveMessage(msg);
    return true;
  }

  public async routeByTopic(topic: string, msg: Message): Promise<number> {
    const rules = this.routingRules.filter((r) => r.topic === topic);
    let count = 0;
    for (const rule of rules) {
      const agent = this.agents.get(rule.targetAgentId);
      if (agent) {
        await agent.receiveMessage(msg);
        count++;
      }
    }
    return count;
  }

  public getPendingMessages(): Message[] {
    return [...this.messageQueue];
  }

  public clearPendingMessages(): void {
    this.messageQueue = [];
  }

  public flushQueue(): Message[] {
    const pending = [...this.messageQueue];
    this.messageQueue = [];
    return pending;
  }
}
