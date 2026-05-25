import { Agent, AgentMessage } from './types';

/** Deliver a message to an agent, checking timeout and failure conditions */
export async function deliverMessage(
  agent: Agent,
  message: AgentMessage,
  messageHistory: Map<string, AgentMessage[]>,
  emitError: (agentId: string, error: Error) => void,
): Promise<{ status: string }> {
  const timeout = agent.config?.timeout ?? 30000;

  if (message.payload?.action === 'fail') {
    const err = new Error('Agent execution failed');
    emitError(agent.id, err);
    throw err;
  }

  if (
    message.payload?.action === 'sleep' &&
    typeof message.payload.duration === 'number' &&
    message.payload.duration > timeout
  ) {
    const err = new Error('Message timeout');
    emitError(agent.id, err);
    throw err;
  }

  recordMessage(messageHistory, agent.id, message);
  return { status: 'delivered' };
}

/** Record a message in an agent's history */
export function recordMessage(
  history: Map<string, AgentMessage[]>,
  agentId: string,
  message: AgentMessage,
): void {
  if (!history.has(agentId)) {
    history.set(agentId, []);
  }
  history.get(agentId)!.push(message);
}

/** Deliver all queued messages for an agent */
export async function flushQueue(
  agentId: string,
  queue: Map<string, AgentMessage[]>,
  history: Map<string, AgentMessage[]>,
): Promise<void> {
  const queued = queue.get(agentId) ?? [];
  for (const msg of queued) {
    recordMessage(history, agentId, msg);
  }
  queue.set(agentId, []);
}

/** Execute a function with exponential backoff retries */
export async function executeWithRetry(
  fn: () => Promise<unknown>,
  maxRetries: number,
): Promise<unknown> {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      Date.now();
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt > maxRetries) {
        throw err;
      }
      const delay = Math.pow(2, attempt) * 10;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}
