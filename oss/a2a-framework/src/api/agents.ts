import { Agent, Capability } from '../services/agent';
import { MessageRouter } from '../services/router';
import { A2AProtocol } from '../services/protocol';

export interface RegisterRequest {
  agentId?: string;
  capabilities: Capability[];
}

export interface DiscoverResponse {
  agents: Array<{
    id: string;
    capabilities: Capability[];
  }>;
}

export interface SendMessageRequest {
  from: string;
  to: string;
  type: string;
  payload: Record<string, unknown>;
}

export class AgentAPI {
  constructor(
    private router: MessageRouter,
    private protocol: A2AProtocol
  ) {}

  public register(req: RegisterRequest): Agent {
    const agent = new Agent(req.agentId);
    for (const cap of req.capabilities) {
      agent.registerCapability(cap);
    }
    this.router.registerAgent(agent);
    return agent;
  }

  public unregister(agentId: string): boolean {
    const agent = this.router.getAgent(agentId);
    if (!agent) return false;
    this.router.unregisterAgent(agentId);
    return true;
  }

  public discover(): DiscoverResponse {
    const agents = this.router.getAgents();
    return {
      agents: agents.map((a) => ({
        id: a.id,
        capabilities: a.getCapabilities(),
      })),
    };
  }

  public async sendMessage(req: SendMessageRequest): Promise<string> {
    const msg = await this.router
      .getAgent(req.from)
      ?.sendMessage(req.to, req.type, req.payload);
    if (!msg) throw new Error(`Agent ${req.from} not found`);
    return msg.id;
  }

  public getAgent(agentId: string): Agent | undefined {
    return this.router.getAgent(agentId);
  }

  public getAgentDetails(agentId: string): unknown {
    const agent = this.router.getAgent(agentId);
    if (!agent) return null;
    return {
      id: agent.id,
      capabilities: agent.getCapabilities(),
      messageHistory: agent.getMessageHistory(10),
    };
  }
}
