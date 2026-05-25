/**
 * Remediation Playbook Routes Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

vi.mock('../middleware/db.js', () => ({ dbMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()) }));
vi.mock('../middleware/auth.js', () => ({ authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()) }));
vi.mock('../middleware/rbac.js', () => ({
  resolveOrgContext: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
  requirePermission: () => vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
}));

import { remediationPlaybookRoutes } from './remediation-playbooks.js';

vi.stubGlobal('fetch', vi.fn(async () =>
  new Response(JSON.stringify({ keys: [{ id: 'key_test' }] })),
));

function createMockDb(results: unknown[] = []) {
  let idx = 0;
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve(results[idx++] ?? []),
        }),
      }),
    }),
    insert: vi.fn(() => ({ values: vi.fn(async () => ({})) })),
    delete: () => ({ where: vi.fn(async () => ({})) }),
  };
}

function createTestApp(db: ReturnType<typeof createMockDb>) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('userId' as never, 'user-1');
    c.set('orgId' as never, 'org-1');
    c.set('db' as never, db);
    await next();
  });
  app.route('/api/remediation', remediationPlaybookRoutes);
  return app;
}

describe('Remediation Playbook Routes', () => {
  it('GET /playbooks lists playbooks', async () => {
    const db = createMockDb([[{ id: 'pb-1', name: 'Suspend Agent' }]]);
    const app = createTestApp(db);
    const res = await app.request('/api/remediation/playbooks');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it('POST /playbooks creates a playbook', async () => {
    const db = createMockDb([]);
    const app = createTestApp(db);
    const res = await app.request('/api/remediation/playbooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Agent Compromise Response',
        triggerType: 'manual',
        steps: [{ name: 'Suspend', type: 'suspend_agent', config: {} }],
      }),
    });
    expect(res.status).toBe(201);
  });

  it('DELETE /playbooks/:id deletes', async () => {
    const db = createMockDb([]);
    const app = createTestApp(db);
    const res = await app.request('/api/remediation/playbooks/pb-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
  });
});
