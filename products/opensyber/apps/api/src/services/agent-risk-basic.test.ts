import { describe, it, expect } from 'vitest';
import { assessAgentRisk } from './agent-registry.js';

describe('Agent Risk Assessment - Basic', () => {
  it('should flag suspended status as risk factor', () => {
    const agent = {
      id: 'agent-1',
      userId: 'user-1',
      name: 'Test',
      source: 'ide' as const,
      permissions: [],
      riskScore: 20,
      status: 'suspended' as const,
      createdAt: '2024-03-20T10:00:00Z',
    };

    const profile = assessAgentRisk(agent);

    expect(profile.factors).toContain('suspended-status');
  });

  it('should increase score for external SDK sources', () => {
    const agent = {
      id: 'agent-1',
      userId: 'user-1',
      name: 'Test',
      source: 'openai-sdk' as const,
      permissions: ['read'],
      riskScore: 50,
      status: 'active' as const,
      createdAt: '2024-03-20T10:00:00Z',
    };

    const profile = assessAgentRisk(agent);

    expect(profile.factors).toContain('external-sdk-source');
    expect(profile.riskScore).toBeGreaterThan(50);
  });

  it('should flag langsmith as external SDK', () => {
    const agent = {
      id: 'agent-1',
      userId: 'user-1',
      name: 'Test',
      source: 'langsmith' as const,
      permissions: [],
      riskScore: 30,
      status: 'active' as const,
      createdAt: '2024-03-20T10:00:00Z',
    };

    const profile = assessAgentRisk(agent);

    expect(profile.factors).toContain('external-sdk-source');
  });

  it('should flag unbound instances', () => {
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

    expect(profile.factors).toContain('unbound-instance');
  });

  it('should recommend review for high-risk agents', () => {
    const agent = {
      id: 'agent-1',
      userId: 'user-1',
      name: 'Test',
      source: 'ide' as const,
      permissions: ['read', 'write'],
      riskScore: 75,
      status: 'active' as const,
      createdAt: '2024-03-20T10:00:00Z',
    };

    const profile = assessAgentRisk(agent);

    expect(profile.recommendations).toContain(
      'Review permissions and consider suspension',
    );
  });

  it('should recommend monitoring for medium-risk agents', () => {
    const agent = {
      id: 'agent-1',
      userId: 'user-1',
      name: 'Test',
      source: 'ide' as const,
      permissions: ['read'],
      riskScore: 50,
      status: 'active' as const,
      createdAt: '2024-03-20T10:00:00Z',
    };

    const profile = assessAgentRisk(agent);

    expect(profile.recommendations).toContain('Increase monitoring frequency');
  });

  it('should recommend defining permissions when empty', () => {
    const agent = {
      id: 'agent-1',
      userId: 'user-1',
      name: 'Test',
      source: 'ide' as const,
      permissions: [],
      riskScore: 10,
      status: 'active' as const,
      createdAt: '2024-03-20T10:00:00Z',
    };

    const profile = assessAgentRisk(agent);

    expect(profile.recommendations).toContain(
      'Define explicit permissions for this agent',
    );
  });

  it('should cap risk score at 100', () => {
    const agent = {
      id: 'agent-1',
      userId: 'user-1',
      name: 'Test',
      source: 'langsmith' as const,
      permissions: [],
      riskScore: 95,
      status: 'suspended' as const,
      createdAt: '2024-03-20T10:00:00Z',
    };

    const profile = assessAgentRisk(agent);

    expect(profile.riskScore).toBeLessThanOrEqual(100);
  });
});
