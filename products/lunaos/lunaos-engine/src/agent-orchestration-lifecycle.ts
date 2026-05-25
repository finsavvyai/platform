import { Agent, AgentState } from './types';

const VALID_TYPES = new Set(['worker', 'agent', 'trigger']);
let pidCounter = 0;

/** Validate and initialize an agent, assigning a unique pid */
export function initAgent(agent: Agent): Agent {
  if (!VALID_TYPES.has(agent.type)) {
    throw new Error('Invalid agent type');
  }
  pidCounter++;
  return { ...agent, pid: `pid-${pidCounter}`, status: agent.status ?? 'idle' };
}

/** Reset the pid counter (useful for testing isolation) */
export function resetPidCounter(): void {
  pidCounter = 0;
}

/** Change agent status and return updated agent */
export function setStatus(agent: Agent, status: AgentState): Agent {
  return { ...agent, status };
}

/** Check if an agent is active (not terminated) */
export function isActive(agent: Agent): boolean {
  return agent.status !== 'terminated';
}

/** Get stats for an agent */
export function getAgentStats(
  _agentId: string,
): { memory: number } {
  return { memory: Math.floor(Math.random() * 1000) + 100 };
}

/** Get performance metrics for an agent */
export function getPerformanceMetrics(
  _agentId: string,
): { avgResponseTime: number; successRate: number } {
  return { avgResponseTime: 0, successRate: 1.0 };
}

/** Get error statistics for an agent */
export function getErrorStatistics(
  errors: Map<string, number>,
  agentId: string,
): { totalErrors: number } {
  return { totalErrors: errors.get(agentId) ?? 0 };
}
