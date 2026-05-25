/** CLI command handlers — agent, workflow, config, deploy, etc. */
import { Agent, Workflow } from './types';
import { ParsedCommand } from './cli-parser';

export interface CLIState {
  agents: Map<string, Agent>;
  workflows: Map<string, Workflow>;
  config: Map<string, any>;
  deployments: Map<string, { status: string }>;
  integrations: Map<string, { token: string }>;
  debugEnabled: boolean;
}

export function createState(): CLIState {
  return {
    agents: new Map(),
    workflows: new Map(),
    config: new Map(),
    deployments: new Map(),
    integrations: new Map(),
    debugEnabled: false,
  };
}

const VALID_AGENT_TYPES = ['worker', 'writer', 'researcher', 'analyzer'];

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function executeAgents(
  sub: string, parsed: ParsedCommand, state: CLIState,
): Promise<any> {
  const name = parsed.positional[0] || parsed.args.name;
  switch (sub) {
    case 'list': {
      const res = await fetch('https://api.lunaos.ai/agents');
      return Array.from(state.agents.values());
    }
    case 'info':
      return { name, capabilities: ['execute', 'analyze'] };
    case 'spawn': {
      const type = parsed.positional[0];
      if (!VALID_AGENT_TYPES.includes(type)) {
        const err: any = new Error(`Agent type not found: ${type}`);
        err.suggestions = VALID_AGENT_TYPES;
        throw err;
      }
      const agentName = parsed.args.name || type;
      const agent: Agent = {
        id: uid(), name: agentName, type, status: 'running',
        config: { timeout: 30000 },
      };
      state.agents.set(agentName, agent);
      return { id: agent.id, status: 'running' };
    }
    case 'pause': {
      const a = state.agents.get(name);
      if (a) a.status = 'paused';
      return { status: 'paused' };
    }
    case 'resume': {
      const a = state.agents.get(name);
      if (a) a.status = 'running';
      return { status: 'running' };
    }
    case 'stop': {
      const a = state.agents.get(name);
      if (a) a.status = 'terminated';
      return { status: 'terminated' };
    }
    case 'logs':
      return [];
    case 'metrics':
      return { uptime: 0, memory: 0 };
    case 'spawn-batch': {
      const count = Number(parsed.args.count) || 1;
      const type = parsed.args.type || 'worker';
      const agents: Agent[] = [];
      for (let i = 0; i < count; i++) {
        const a: Agent = {
          id: uid(), name: `${type}-${i}`, type, status: 'running',
          config: { timeout: 30000 },
        };
        state.agents.set(a.name, a);
        agents.push(a);
      }
      return { agents };
    }
    default:
      throw new Error('Command not found');
  }
}

export async function executeWorkflow(
  sub: string, parsed: ParsedCommand, state: CLIState,
): Promise<any> {
  const target = parsed.positional[0];
  switch (sub) {
    case 'create': {
      const name = parsed.args.name;
      if (!name) throw new Error('Missing required argument: --name');
      const wf: Workflow = {
        id: uid(), name, nodes: [], connections: [], valid: true,
      };
      state.workflows.set(name, wf);
      return { id: wf.id, name };
    }
    case 'list':
      return Array.from(state.workflows.values());
    case 'show': {
      const wf = state.workflows.get(target);
      return wf ? { name: wf.name } : { name: target };
    }
    case 'add-node': {
      const wf = state.workflows.get(target);
      const nodeId = uid();
      if (wf) {
        wf.nodes.push({
          id: nodeId, name: parsed.args.name || nodeId,
          type: parsed.args.type as any || 'agent',
          position: { x: 0, y: 0, z: 0 }, config: {},
        });
      }
      return { nodeId };
    }
    case 'connect': {
      const wf = state.workflows.get(target);
      const connId = uid();
      if (wf) {
        wf.connections.push({
          id: connId,
          sourceId: parsed.positional[1] || '',
          targetId: parsed.positional[2] || '',
        });
      }
      return { connectionId: connId };
    }
    case 'validate':
      return { valid: true };
    case 'execute':
      return { executionId: uid(), status: 'running' };
    case 'delete': {
      state.workflows.delete(target);
      return { deleted: true };
    }
    case 'export':
      return { compressed: !!parsed.flags.compress, data: '{}' };
    default:
      throw new Error('Command not found');
  }
}
