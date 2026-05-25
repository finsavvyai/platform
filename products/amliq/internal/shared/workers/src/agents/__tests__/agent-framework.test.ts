/**
 * Agent Framework Tests
 *
 * Comprehensive test suite for the autonomous agent framework
 * covering base functionality, goal execution, and agent lifecycle.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BaseAgent, AgentGoal, AgentState, AgentMessage, AgentCapability } from '../agent-framework';

// Test implementation of BaseAgent for testing
class TestAgent extends BaseAgent {
  private testCapabilities: AgentCapability[] = [];
  private executionResults: any[] = [];

  constructor(agentId: string, organizationId: string) {
    super(agentId, 'TestAgent', organizationId);
    this.testCapabilities = [
      {
        name: 'test_capability',
        description: 'A test capability for unit testing',
        enabled: true,
        confidence: 1.0,
        tools: ['test_tool'],
        permissions: ['test.read'],
        parameters: {
          test_param: 'test_value'
        },
        examples: ['test example 1', 'test example 2']
      }
    ];
  }

  protected async getCapabilities(): Promise<AgentCapability[]> {
    return this.testCapabilities;
  }

  protected async executeCapability(capabilityName: string, parameters: any): Promise<any> {
    const result = {
      capability: capabilityName,
      parameters,
      execution_time: Date.now(),
      success: true,
      result: `Executed ${capabilityName} successfully`
    };

    this.executionResults.push(result);
    return result;
  }

  protected async planExecution(goal: AgentGoal): Promise<any> {
    return {
      steps: [
        {
          step_id: 'step_1',
          capability: 'test_capability',
          parameters: goal.parameters,
          expected_duration: 1000
        }
      ],
      estimated_duration: 1000,
      confidence_score: 0.95
    };
  }

  public getExecutionResults(): any[] {
    return this.executionResults;
  }

  public clearExecutionResults(): void {
    this.executionResults = [];
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;
  const organizationId = 'test-org-123';
  const agentId = 'test-agent-456';

  beforeEach(() => {
    agent = new TestAgent(agentId, organizationId);
  });

  afterEach(() => {
    agent.clearExecutionResults();
  });

  describe('Agent Initialization', () => {
    it('should initialize with correct properties', () => {
      expect(agent.getAgentId()).toBe(agentId);
      expect(agent.getAgentType()).toBe('TestAgent');
      expect(agent.getOrganizationId()).toBe(organizationId);
    });

    it('should start in idle state', () => {
      const state = agent.getState();
      expect(state.status).toBe('idle');
      expect(state.agent_id).toBe(agentId);
      expect(state.agent_type).toBe('TestAgent');
    });

    it('should have correct initial state values', () => {
      const state = agent.getState();
      expect(state.goals_completed).toBe(0);
      expect(state.goals_failed).toBe(0);
      expect(state.error_count).toBe(0);
      expect(state.performance_score).toBe(0);
      expect(state.efficiency_score).toBe(0);
    });
  });

  describe('Goal Management', () => {
    it('should execute a simple goal successfully', async () => {
      const goal: AgentGoal = {
        id: 'goal-1',
        description: 'Test goal execution',
        priority: 'medium',
        goal_type: 'test_goal',
        parameters: { test_input: 'test_value' },
        created_at: Date.now(),
        created_by: 'test-user'
      };

      const result = await agent.executeGoal(goal);

      expect(result.success).toBe(true);
      expect(result.goal_id).toBe(goal.id);
      expect(result.execution_time).toBeGreaterThan(0);
      expect(agent.getState().goals_completed).toBe(1);
    });

    it('should handle multiple goals in sequence', async () => {
      const goals: AgentGoal[] = [
        {
          id: 'goal-1',
          description: 'First test goal',
          priority: 'high',
          goal_type: 'test_goal',
          parameters: { order: 1 },
          created_at: Date.now(),
          created_by: 'test-user'
        },
        {
          id: 'goal-2',
          description: 'Second test goal',
          priority: 'medium',
          goal_type: 'test_goal',
          parameters: { order: 2 },
          created_at: Date.now(),
          created_by: 'test-user'
        }
      ];

      for (const goal of goals) {
        const result = await agent.executeGoal(goal);
        expect(result.success).toBe(true);
      }

      const state = agent.getState();
      expect(state.goals_completed).toBe(2);
    });

    it('should reject goals with missing required fields', async () => {
      const invalidGoal = {
        description: 'Invalid goal without id'
      } as AgentGoal;

      await expect(agent.executeGoal(invalidGoal)).rejects.toThrow();
    });

    it('should handle goal execution timeout', async () => {
      const goal: AgentGoal = {
        id: 'goal-timeout',
        description: 'Goal that should timeout',
        priority: 'low',
        goal_type: 'test_goal',
        parameters: { should_timeout: true },
        deadline: Date.now() + 100, // Very short deadline
        created_at: Date.now(),
        created_by: 'test-user'
      };

      // Mock the capability execution to simulate timeout
      const originalExecute = agent['executeCapability'];
      agent['executeCapability'] = async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return { success: true };
      };

      await expect(agent.executeGoal(goal)).rejects.toThrow();
    });
  });

  describe('Agent State Management', () => {
    it('should update state after goal execution', async () => {
      const goal: AgentGoal = {
        id: 'goal-state-test',
        description: 'Test state updates',
        priority: 'medium',
        goal_type: 'test_goal',
        parameters: {},
        created_at: Date.now(),
        created_by: 'test-user'
      };

      await agent.executeGoal(goal);

      const state = agent.getState();
      expect(state.status).toBe('idle'); // Should return to idle after completion
      expect(state.last_activity).toBeInstanceOf(Date);
      expect(state.uptime_percentage).toBeGreaterThan(0);
    });

    it('should handle pause and resume operations', async () => {
      await agent.pause();
      expect(agent.getState().status).toBe('paused');

      await agent.resume();
      expect(agent.getState().status).toBe('idle');
    });

    it('should handle restart operation', async () => {
      // Execute a goal first
      const goal: AgentGoal = {
        id: 'goal-before-restart',
        description: 'Goal before restart',
        priority: 'medium',
        goal_type: 'test_goal',
        parameters: {},
        created_at: Date.now(),
        created_by: 'test-user'
      };

      await agent.executeGoal(goal);
      expect(agent.getState().goals_completed).toBe(1);

      // Restart the agent
      await agent.restart();

      const state = agent.getState();
      expect(state.status).toBe('idle');
      // Reset should maintain goal count but reset other metrics
      expect(state.goals_completed).toBe(0);
    });
  });

  describe('Message Handling', () => {
    it('should send and receive messages correctly', async () => {
      const message: AgentMessage = {
        id: 'msg-1',
        from_agent_id: 'sender-123',
        to_agent_id: agentId,
        message_type: 'test_message',
        content: 'Hello from sender',
        timestamp: Date.now(),
        priority: 'normal'
      };

      await agent.receiveMessage(message);

      const recentMessages = agent.getRecentMessages();
      expect(recentMessages).toHaveLength(1);
      expect(recentMessages[0].content).toBe('Hello from sender');
    });

    it('should prioritize messages correctly', async () => {
      const messages: AgentMessage[] = [
        {
          id: 'msg-low',
          from_agent_id: 'sender-123',
          to_agent_id: agentId,
          message_type: 'test_message',
          content: 'Low priority message',
          timestamp: Date.now(),
          priority: 'low'
        },
        {
          id: 'msg-high',
          from_agent_id: 'sender-456',
          to_agent_id: agentId,
          message_type: 'test_message',
          content: 'High priority message',
          timestamp: Date.now() + 1000,
          priority: 'high'
        }
      ];

      for (const message of messages) {
        await agent.receiveMessage(message);
      }

      const recentMessages = agent.getRecentMessages();
      expect(recentMessages).toHaveLength(2);
      // High priority message should be processed first (appear first in recent messages)
      expect(recentMessages[0].priority).toBe('high');
    });

    it('should handle message sending to other agents', async () => {
      const targetAgentId = 'target-agent-789';

      const message: Omit<AgentMessage, 'id' | 'timestamp' | 'from_agent_id'> = {
        to_agent_id: targetAgentId,
        message_type: 'collaboration',
        content: 'Request for collaboration',
        priority: 'normal'
      };

      // This would normally send to another agent
      // For testing, we'll just verify the message structure
      await expect(agent.sendMessage(message)).resolves.toBeUndefined();
    });
  });

  describe('Capability Management', () => {
    it('should return available capabilities', async () => {
      const capabilities = await agent.getCapabilities();
      expect(capabilities).toHaveLength(1);
      expect(capabilities[0].name).toBe('test_capability');
      expect(capabilities[0].enabled).toBe(true);
    });

    it('should execute capabilities with correct parameters', async () => {
      const result = await agent['executeCapability']('test_capability', {
        test_param: 'test_value'
      });

      expect(result.capability).toBe('test_capability');
      expect(result.parameters.test_param).toBe('test_value');
      expect(result.success).toBe(true);

      const executionResults = agent.getExecutionResults();
      expect(executionResults).toHaveLength(1);
    });

    it('should handle capability execution failures', async () => {
      // Mock a failing capability
      const originalExecute = agent['executeCapability'];
      agent['executeCapability'] = async () => {
        throw new Error('Capability execution failed');
      };

      const goal: AgentGoal = {
        id: 'goal-failing-capability',
        description: 'Goal with failing capability',
        priority: 'medium',
        goal_type: 'test_goal',
        parameters: {},
        created_at: Date.now(),
        created_by: 'test-user'
      };

      await expect(agent.executeGoal(goal)).rejects.toThrow('Capability execution failed');

      const state = agent.getState();
      expect(state.goals_failed).toBe(1);
      expect(state.error_count).toBe(1);
    });
  });

  describe('Performance Metrics', () => {
    it('should track performance metrics correctly', async () => {
      const startTime = Date.now();

      const goal: AgentGoal = {
        id: 'goal-performance',
        description: 'Test performance tracking',
        priority: 'medium',
        goal_type: 'test_goal',
        parameters: {},
        created_at: Date.now(),
        created_by: 'test-user'
      };

      await agent.executeGoal(goal);

      const state = agent.getState();
      expect(state.performance_score).toBeGreaterThan(0);
      expect(state.efficiency_score).toBeGreaterThan(0);
      expect(state.average_response_time).toBeGreaterThan(0);
      expect(state.uptime_percentage).toBeGreaterThan(0);
    });

    it('should calculate success rate correctly', async () => {
      // Execute successful goals
      const successfulGoals: AgentGoal[] = [
        {
          id: 'goal-success-1',
          description: 'Successful goal 1',
          priority: 'medium',
          goal_type: 'test_goal',
          parameters: {},
          created_at: Date.now(),
          created_by: 'test-user'
        },
        {
          id: 'goal-success-2',
          description: 'Successful goal 2',
          priority: 'medium',
          goal_type: 'test_goal',
          parameters: {},
          created_at: Date.now(),
          created_by: 'test-user'
        }
      ];

      for (const goal of successfulGoals) {
        await agent.executeGoal(goal);
      }

      // Execute a failing goal
      const originalExecute = agent['executeCapability'];
      agent['executeCapability'] = async () => {
        throw new Error('Simulated failure');
      };

      const failingGoal: AgentGoal = {
        id: 'goal-failure',
        description: 'Failing goal',
        priority: 'medium',
        goal_type: 'test_goal',
        parameters: {},
        created_at: Date.now(),
        created_by: 'test-user'
      };

      try {
        await agent.executeGoal(failingGoal);
      } catch (error) {
        // Expected to fail
      }

      const state = agent.getState();
      expect(state.goals_completed).toBe(2);
      expect(state.goals_failed).toBe(1);
      expect(state.success_rate).toBeCloseTo(2/3, 2);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid goal parameters gracefully', async () => {
      const goal: AgentGoal = {
        id: 'goal-invalid-params',
        description: 'Goal with invalid parameters',
        priority: 'medium',
        goal_type: 'test_goal',
        parameters: null as any, // Invalid parameters
        created_at: Date.now(),
        created_by: 'test-user'
      };

      await expect(agent.executeGoal(goal)).rejects.toThrow();
    });

    it('should handle concurrent goal execution attempts', async () => {
      const goal: AgentGoal = {
        id: 'goal-concurrent',
        description: 'Test concurrent execution',
        priority: 'high',
        goal_type: 'test_goal',
        parameters: {},
        created_at: Date.now(),
        created_by: 'test-user'
      };

      // Start first execution
      const firstExecution = agent.executeGoal(goal);

      // Try to start second execution while first is running
      // Mock the agent to be busy
      agent['state'].status = 'executing';

      await expect(agent.executeGoal(goal)).rejects.toThrow();

      // Wait for first execution to complete
      await firstExecution;
    });

    it('should handle resource cleanup on errors', async () => {
      const goal: AgentGoal = {
        id: 'goal-cleanup-test',
        description: 'Test resource cleanup on error',
        priority: 'medium',
        goal_type: 'test_goal',
        parameters: {},
        created_at: Date.now(),
        created_by: 'test-user'
      };

      // Mock capability execution to fail
      agent['executeCapability'] = async () => {
        throw new Error('Resource cleanup test error');
      };

      try {
        await agent.executeGoal(goal);
      } catch (error) {
        // Expected to fail
      }

      // Agent should return to idle state
      const state = agent.getState();
      expect(state.status).toBe('idle');
      expect(state.current_goal).toBeNull();
    });
  });

  describe('Integration with Other Systems', () => {
    it('should handle goals from orchestrator correctly', async () => {
      const orchestratorGoal: AgentGoal = {
        id: 'orchestrator-goal',
        description: 'Goal from orchestrator',
        priority: 'high',
        goal_type: 'orchestrated_task',
        parameters: { source: 'orchestrator' },
        created_at: Date.now(),
        created_by: 'agent-orchestrator'
      };

      const result = await agent.executeGoal(orchestratorGoal);
      expect(result.success).toBe(true);
      expect(result.goal_id).toBe(orchestratorGoal.id);
    });

    it('should handle learning system integration', async () => {
      const goal: AgentGoal = {
        id: 'learning-goal',
        description: 'Goal for learning system',
        priority: 'medium',
        goal_type: 'learning_task',
        parameters: { learning_data: 'test_data' },
        created_at: Date.now(),
        created_by: 'learning-system'
      };

      const result = await agent.executeGoal(goal);

      // After execution, agent should be ready to provide learning data
      const state = agent.getState();
      expect(state.goals_completed).toBe(1);

      // Execution results should be available for learning
      const executionResults = agent.getExecutionResults();
      expect(executionResults).toHaveLength(1);
      expect(executionResults[0].success).toBe(true);
    });
  });
});