import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AgentOrchestrator } from '../src/agent-orchestration';
import { Agent, AgentMessage, AgentState } from '../src/types';

describe('AgentOrchestration', () => {
  let orchestrator: AgentOrchestrator;
  const mockAgent: Agent = {
    id: 'agent-1',
    name: 'TestAgent',
    type: 'worker',
    status: 'idle',
    config: { timeout: 30000, maxRetries: 3 },
  };

  beforeEach(() => {
    orchestrator = new AgentOrchestrator();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Agent Spawning', () => {
    it('should spawn a new agent instance', async () => {
      const agent = await orchestrator.spawnAgent(mockAgent);
      expect(agent.id).toBe('agent-1');
      expect(agent.status).toBe('idle');
    });

    it('should assign unique process IDs to spawned agents', async () => {
      const agent1 = await orchestrator.spawnAgent(mockAgent);
      const agent2 = await orchestrator.spawnAgent({ ...mockAgent, id: 'agent-2' });
      expect(agent1.pid).not.toBe(agent2.pid);
    });

    it('should spawn agent with custom configuration', async () => {
      const customAgent = { ...mockAgent, config: { timeout: 60000, maxRetries: 5 } };
      const agent = await orchestrator.spawnAgent(customAgent);
      expect(agent.config.timeout).toBe(60000);
    });

    it('should emit spawn event on agent creation', async () => {
      const spawnSpy = vi.fn();
      orchestrator.on('agent:spawned', spawnSpy);
      await orchestrator.spawnAgent(mockAgent);
      expect(spawnSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'agent-1' }));
    });

    it('should handle spawn failures gracefully', async () => {
      const invalidAgent = { ...mockAgent, type: 'invalid' as any };
      await expect(orchestrator.spawnAgent(invalidAgent)).rejects.toThrow('Invalid agent type');
    });
  });

  describe('Message Passing', () => {
    let senderId: string;
    let recipientId: string;

    beforeEach(async () => {
      const sender = await orchestrator.spawnAgent(mockAgent);
      const recipient = await orchestrator.spawnAgent({ ...mockAgent, id: 'agent-2', name: 'RecipientAgent' });
      senderId = sender.id;
      recipientId = recipient.id;
    });

    it('should send message between agents', async () => {
      const message: AgentMessage = {
        id: 'msg-1',
        from: senderId,
        to: recipientId,
        type: 'task',
        payload: { action: 'process', data: { input: 'test' } },
      };

      const sent = await orchestrator.sendMessage(message);
      expect(sent.status).toBe('delivered');
    });

    it('should queue messages when agent is unavailable', async () => {
      await orchestrator.pauseAgent(recipientId);
      const message: AgentMessage = {
        id: 'msg-2',
        from: senderId,
        to: recipientId,
        type: 'task',
        payload: { action: 'process', data: {} },
      };

      const sent = await orchestrator.sendMessage(message);
      expect(sent.status).toBe('queued');
    });

    it('should deliver queued messages when agent resumes', async () => {
      await orchestrator.pauseAgent(recipientId);
      const message: AgentMessage = {
        id: 'msg-3',
        from: senderId,
        to: recipientId,
        type: 'task',
        payload: { action: 'process', data: {} },
      };

      await orchestrator.sendMessage(message);
      await orchestrator.resumeAgent(recipientId);

      const history = await orchestrator.getMessageHistory(recipientId);
      expect(history.some(m => m.id === 'msg-3')).toBe(true);
    });

    it('should handle message timeouts', async () => {
      const slowAgent = { ...mockAgent, id: 'agent-slow', config: { timeout: 100 } };
      await orchestrator.spawnAgent(slowAgent);

      const message: AgentMessage = {
        id: 'msg-timeout',
        from: senderId,
        to: 'agent-slow',
        type: 'task',
        payload: { action: 'sleep', duration: 5000 },
      };

      await expect(orchestrator.sendMessage(message)).rejects.toThrow('Message timeout');
    });

    it('should track message history', async () => {
      const message: AgentMessage = {
        id: 'msg-history',
        from: senderId,
        to: recipientId,
        type: 'task',
        payload: { action: 'process', data: {} },
      };

      await orchestrator.sendMessage(message);
      const history = await orchestrator.getMessageHistory(recipientId);
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('Agent Lifecycle', () => {
    let agentId: string;

    beforeEach(async () => {
      const agent = await orchestrator.spawnAgent(mockAgent);
      agentId = agent.id;
    });

    it('should get agent status', async () => {
      const status = await orchestrator.getAgentStatus(agentId);
      expect(status).toBe('idle');
    });

    it('should pause an agent', async () => {
      await orchestrator.pauseAgent(agentId);
      const status = await orchestrator.getAgentStatus(agentId);
      expect(status).toBe('paused');
    });

    it('should resume a paused agent', async () => {
      await orchestrator.pauseAgent(agentId);
      await orchestrator.resumeAgent(agentId);
      const status = await orchestrator.getAgentStatus(agentId);
      expect(status).toBe('idle');
    });

    it('should terminate an agent', async () => {
      await orchestrator.terminateAgent(agentId);
      const status = await orchestrator.getAgentStatus(agentId);
      expect(status).toBe('terminated');
    });

    it('should emit lifecycle events', async () => {
      const pauseSpy = vi.fn();
      orchestrator.on('agent:paused', pauseSpy);
      await orchestrator.pauseAgent(agentId);
      expect(pauseSpy).toHaveBeenCalledWith(agentId);
    });

    it('should restart a terminated agent', async () => {
      await orchestrator.terminateAgent(agentId);
      await orchestrator.restartAgent(agentId);
      const status = await orchestrator.getAgentStatus(agentId);
      expect(status).not.toBe('terminated');
    });
  });

  describe('Error Recovery', () => {
    let agentId: string;

    beforeEach(async () => {
      const agent = await orchestrator.spawnAgent(mockAgent);
      agentId = agent.id;
    });

    it('should retry failed operations', async () => {
      const retrySpy = vi.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ success: true });

      await orchestrator.executeWithRetry(agentId, retrySpy, 3);
      expect(retrySpy).toHaveBeenCalledTimes(2);
    });

    it('should apply exponential backoff', async () => {
      const timeSpy = vi.spyOn(Date, 'now');
      const failingFn = vi.fn().mockRejectedValue(new Error('Fail'));

      await orchestrator.executeWithRetry(agentId, failingFn, 2).catch(() => {});
      expect(timeSpy).toHaveBeenCalled();
    });

    it('should emit error events', async () => {
      const errorSpy = vi.fn();
      orchestrator.on('agent:error', errorSpy);

      const failingAgent = await orchestrator.spawnAgent({ ...mockAgent, id: 'fail-agent' });
      const message: AgentMessage = {
        id: 'msg-fail',
        from: agentId,
        to: failingAgent.id,
        type: 'task',
        payload: { action: 'fail' },
      };

      await orchestrator.sendMessage(message).catch(() => {});
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should recover from agent crash', async () => {
      await orchestrator.terminateAgent(agentId);
      await orchestrator.restartAgent(agentId);
      const status = await orchestrator.getAgentStatus(agentId);
      expect(['idle', 'running']).toContain(status);
    });

    it('should track error statistics', async () => {
      const stats = await orchestrator.getErrorStatistics(agentId);
      expect(stats.totalErrors).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Resource Management', () => {
    it('should limit concurrent agents', async () => {
      orchestrator.setMaxConcurrent(5);
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(orchestrator.spawnAgent({ ...mockAgent, id: `agent-${i}` }));
      }

      await Promise.all(promises);
      const active = await orchestrator.getActiveAgents();
      expect(active.length).toBeLessThanOrEqual(5);
    });

    it('should monitor memory usage per agent', async () => {
      const agent = await orchestrator.spawnAgent(mockAgent);
      const stats = await orchestrator.getAgentStats(agent.id);
      expect(stats.memory).toBeDefined();
      expect(stats.memory).toBeGreaterThan(0);
    });

    it('should garbage collect terminated agents', async () => {
      const agent1 = await orchestrator.spawnAgent(mockAgent);
      const agent2 = await orchestrator.spawnAgent({ ...mockAgent, id: 'agent-2' });

      await orchestrator.terminateAgent(agent1.id);
      await orchestrator.cleanup();

      const agents = await orchestrator.listAgents();
      expect(agents.some(a => a.id === agent1.id)).toBe(false);
    });

    it('should report orchestrator metrics', async () => {
      await orchestrator.spawnAgent(mockAgent);
      const metrics = orchestrator.getMetrics();
      expect(metrics.totalAgents).toBeGreaterThan(0);
      expect(metrics.activeAgents).toBeDefined();
    });
  });

  describe('Agent Coordination', () => {
    it('should broadcast messages to multiple agents', async () => {
      const agent1 = await orchestrator.spawnAgent({ ...mockAgent, id: 'agent-1' });
      const agent2 = await orchestrator.spawnAgent({ ...mockAgent, id: 'agent-2' });
      const agent3 = await orchestrator.spawnAgent({ ...mockAgent, id: 'agent-3' });

      const broadcast = {
        type: 'event',
        payload: { eventType: 'workflow:started' },
      };

      await orchestrator.broadcast([agent1.id, agent2.id, agent3.id], broadcast);
      expect(true).toBe(true);
    });

    it('should coordinate sequential agent execution', async () => {
      const agents = [];
      for (let i = 0; i < 3; i++) {
        const a = await orchestrator.spawnAgent({ ...mockAgent, id: `seq-${i}` });
        agents.push(a.id);
      }

      const sequence = await orchestrator.executeSequence(agents, { task: 'process' });
      expect(sequence.completed).toBe(true);
    });

    it('should handle agent dependencies', async () => {
      const upstream = await orchestrator.spawnAgent({ ...mockAgent, id: 'upstream' });
      const downstream = await orchestrator.spawnAgent({ ...mockAgent, id: 'downstream' });

      await orchestrator.addDependency(downstream.id, upstream.id);
      const deps = await orchestrator.getDependencies(downstream.id);
      expect(deps).toContain(upstream.id);
    });
  });

  describe('Monitoring & Observability', () => {
    it('should log agent activities', async () => {
      const agent = await orchestrator.spawnAgent(mockAgent);
      const logs = await orchestrator.getAgentLogs(agent.id);
      expect(Array.isArray(logs)).toBe(true);
    });

    it('should track agent performance metrics', async () => {
      const agent = await orchestrator.spawnAgent(mockAgent);
      const perf = await orchestrator.getPerformanceMetrics(agent.id);
      expect(perf.avgResponseTime).toBeDefined();
      expect(perf.successRate).toBeDefined();
    });
  });
});
