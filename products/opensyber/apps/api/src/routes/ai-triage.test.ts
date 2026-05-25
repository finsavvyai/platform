/**
 * AI Triage Routes Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    const h = c.req.header('Authorization');
    if (!h?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
    c.set('userId', 'user-1');
    await next();
  },
}));

vi.stubGlobal('fetch', vi.fn(async () =>
  new Response(JSON.stringify({ keys: [{ id: 'key_test' }] })),
));

import { aiTriageRoutes } from './ai-triage.js';

function createTestApp() {
  const app = new Hono();
  app.route('/api/ai', aiTriageRoutes);
  return app;
}

const authHeaders = { Authorization: 'Bearer valid-token' };

function makeRequest(body: Record<string, unknown>) {
  return {
    method: 'POST' as const,
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

describe('AI Triage Routes', () => {
  it('POST /triage classifies a single event', async () => {
    const app = createTestApp();
    const res = await app.request('/api/ai/triage', makeRequest({
      eventType: 'file_read', filePath: '.env',
      riskLevel: 'critical', timestamp: new Date().toISOString(),
    }), {});
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.classification).toBe('real_threat');
    expect(body.data.source).toBe('heuristic');
  });

  it('POST /triage returns 400 without eventType', async () => {
    const app = createTestApp();
    const res = await app.request('/api/ai/triage', makeRequest({}), {});
    expect(res.status).toBe(400);
  });

  it('POST /triage/batch classifies multiple events', async () => {
    const app = createTestApp();
    const res = await app.request('/api/ai/triage/batch', makeRequest({
      events: [
        { eventType: 'file_read', filePath: '.env', riskLevel: 'critical', timestamp: new Date().toISOString() },
        { eventType: 'bash_command', command: 'ls', riskLevel: 'low', timestamp: new Date().toISOString() },
      ],
    }), {});
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toHaveLength(2);
  });

  it('uses AI when binding is available and confidence is low', async () => {
    const mockAI = {
      run: vi.fn().mockResolvedValue({
        response: '{"classification":"suspicious","reason":"AI detected unusual pattern"}',
      }),
    };
    const app = createTestApp();
    const res = await app.request('/api/ai/triage', makeRequest({
      eventType: 'bash_command', command: 'python3 -c "import socket"',
      riskLevel: 'high', timestamp: new Date().toISOString(),
    }), { AI: mockAI });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.source).toBe('ai');
    expect(body.data.classification).toBe('suspicious');
    expect(mockAI.run).toHaveBeenCalled();
  });

  it('returns heuristic source when AI is not available', async () => {
    const app = createTestApp();
    const res = await app.request('/api/ai/triage', makeRequest({
      eventType: 'bash_command', command: 'git status',
      riskLevel: 'low', timestamp: new Date().toISOString(),
    }), {});
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.source).toBe('heuristic');
  });

  it('skips AI for high-confidence heuristic results even with AI binding', async () => {
    const mockAI = {
      run: vi.fn().mockResolvedValue({ response: '{"classification":"real_threat"}' }),
    };
    const app = createTestApp();
    const res = await app.request('/api/ai/triage', makeRequest({
      eventType: 'bash_command', command: 'git status',
      riskLevel: 'low', timestamp: new Date().toISOString(),
    }), { AI: mockAI });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.source).toBe('heuristic');
    expect(mockAI.run).not.toHaveBeenCalled();
  });
});
