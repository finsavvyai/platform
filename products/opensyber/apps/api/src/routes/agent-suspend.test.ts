/**
 * Agent Suspension Routes Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    const h = c.req.header('Authorization');
    if (!h?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
    c.set('userId', 'user-1');
    await next();
  },
}));

// Mock the agent-suspension service
const executeSuspensionMock = vi.fn();
vi.mock('../services/agent-suspension.js', () => ({
  validateSuspensionAction: (status: string, action: string) => {
    if (action === 'suspend' && status === 'suspended') {
      return { valid: false, error: 'Agent is already suspended' };
    }
    if (action === 'resume' && status === 'running') {
      return { valid: false, error: 'Agent is already running' };
    }
    return { valid: true };
  },
  executeSuspensionAction: (...args: unknown[]) => executeSuspensionMock(...args),
}));

import { agentSuspendRoutes } from './agent-suspend.js';

function createTestApp() {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('userId' as never, 'user-1');
    c.set('orgId' as never, 'org-1');
    c.set('db' as never, {});
    await next();
  });
  app.route('/api/agents', agentSuspendRoutes);
  return app;
}

const authHeaders = { Authorization: 'Bearer valid-token' };

describe('Agent Suspension Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /suspend/:agentId suspends an agent', async () => {
    executeSuspensionMock.mockResolvedValueOnce({
      agentId: 'agent-1', action: 'suspend', success: true,
      previousStatus: 'running', newStatus: 'suspended', reason: 'Policy violation',
    });
    const app = createTestApp();
    const res = await app.request('/api/agents/suspend/agent-1', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentStatus: 'active', reason: 'Policy violation' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.newStatus).toBe('suspended');
  });

  it('POST /suspend/:agentId rejects already suspended', async () => {
    const app = createTestApp();
    const res = await app.request('/api/agents/suspend/agent-1', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentStatus: 'suspended' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /resume/:agentId resumes an agent', async () => {
    executeSuspensionMock.mockResolvedValueOnce({
      agentId: 'agent-1', action: 'resume', success: true,
      previousStatus: 'suspended', newStatus: 'running',
    });
    const app = createTestApp();
    const res = await app.request('/api/agents/resume/agent-1', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentStatus: 'suspended' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.newStatus).toBe('running');
  });

  it('POST /quarantine/:agentId quarantines an agent', async () => {
    executeSuspensionMock.mockResolvedValueOnce({
      agentId: 'agent-1', action: 'quarantine', success: true,
      previousStatus: 'running', newStatus: 'quarantined', reason: 'Compromised',
    });
    const app = createTestApp();
    const res = await app.request('/api/agents/quarantine/agent-1', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentStatus: 'active', reason: 'Compromised' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.newStatus).toBe('quarantined');
  });
});
