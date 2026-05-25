import { describe, it, expect } from 'vitest';
import { assessAgentRisk } from './agent-registry.js';

describe('Agent Risk Assessment - Advanced', () => {
  it('should not recommend review for low-risk agents', () => {
    const agent = {
      id: 'agent-1',
      userId: 'user-1',
      name: 'Test',
      source: 'ide' as const,
      permissions: ['read'],
      riskScore: 20,
      status: 'active' as const,
      createdAt: '2024-03-20T10:00:00Z',
    };

    const profile = assessAgentRisk(agent);

    expect(profile.recommendations).not.toContain(
      'Review permissions and consider suspension',
    );
  });

  it('should aggregate multiple risk factors correctly', () => {
    const agent = {
      id: 'agent-1',
      userId: 'user-1',
      name: 'Test',
      source: 'openai-sdk' as const,
      permissions: [],
      riskScore: 40,
      status: 'suspended' as const,
      createdAt: '2024-03-20T10:00:00Z',
    };

    const profile = assessAgentRisk(agent);

    expect(profile.factors).toContain('suspended-status');
    expect(profile.factors).toContain('external-sdk-source');
    expect(profile.factors).toContain('unbound-instance');
    expect(profile.riskScore).toBeGreaterThan(40);
  });

  it('should include agentId in profile', () => {
    const agent = {
      id: 'agent-xyz-123',
      userId: 'user-1',
      name: 'Test',
      source: 'ide' as const,
      permissions: [],
      riskScore: 10,
      status: 'active' as const,
      createdAt: '2024-03-20T10:00:00Z',
    };

    const profile = assessAgentRisk(agent);

    expect(profile.agentId).toBe('agent-xyz-123');
  });

  it('should return profile with all expected fields', () => {
    const agent = {
      id: 'agent-test',
      userId: 'user-test',
      name: 'Test Agent',
      source: 'copilot' as const,
      permissions: ['read'],
      riskScore: 35,
      status: 'active' as const,
      createdAt: '2024-03-20T10:00:00Z',
    };

    const profile = assessAgentRisk(agent);

    expect(profile.agentId).toBeDefined();
    expect(profile.riskScore).toBeDefined();
    expect(profile.factors).toBeDefined();
    expect(profile.recommendations).toBeDefined();
  });
});
