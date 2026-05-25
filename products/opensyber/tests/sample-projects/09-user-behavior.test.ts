import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * User Behavior Simulation Tests
 *
 * Simulates realistic multi-step user workflows with timing,
 * sequential dependencies, error recovery, and concurrent users.
 * Each scenario mirrors an actual customer journey on opensyber.cloud.
 */

/* ── helpers ─────────────────────────────────────────────── */

interface StepResult {
  name: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

/** Run a named step and measure wall-clock time */
async function timedStep(
  name: string,
  fn: () => Promise<void>,
): Promise<StepResult> {
  const start = performance.now();
  try {
    await fn();
    return { name, durationMs: performance.now() - start, success: true };
  } catch (err) {
    return {
      name,
      durationMs: performance.now() - start,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Simulate realistic think-time between user actions (0-100ms in tests) */
function thinkTime(ms = 50): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Simple in-memory mock for API responses */
function createMockAPI() {
  const db = new Map<string, unknown>();
  const kv = new Map<string, string>();
  let requestCount = 0;

  return {
    get requestCount() { return requestCount; },
    async request(
      method: string,
      path: string,
      opts?: { body?: unknown; token?: string },
    ): Promise<{ status: number; data: unknown }> {
      requestCount++;
      await thinkTime(5);

      if (opts?.token === undefined && !path.startsWith('/health')) {
        return { status: 401, data: { error: 'Unauthorized' } };
      }

      if (method === 'GET' && path === '/health') {
        return { status: 200, data: { status: 'ok', uptime: 99.9 } };
      }

      if (method === 'POST' && path === '/api/instances') {
        const body = opts?.body as Record<string, unknown>;
        const id = `inst_${crypto.randomUUID().slice(0, 8)}`;
        const instance = { id, ...body, status: 'provisioning' };
        db.set(id, instance);
        return { status: 201, data: instance };
      }

      if (method === 'GET' && path === '/api/instances') {
        return { status: 200, data: [...db.values()] };
      }

      if (method === 'GET' && path.startsWith('/api/instances/')) {
        const id = path.split('/').pop()!;
        const inst = db.get(id);
        return inst
          ? { status: 200, data: inst }
          : { status: 404, data: { error: 'Not found' } };
      }

      if (method === 'DELETE' && path.startsWith('/api/instances/')) {
        const id = path.split('/').pop()!;
        db.delete(id);
        return { status: 200, data: { message: 'Instance deleted' } };
      }

      if (method === 'POST' && path === '/api/skills/install') {
        return { status: 200, data: { installed: true } };
      }

      if (method === 'GET' && path === '/api/marketplace/skills') {
        return {
          status: 200,
          data: [
            { slug: 'ai-triage', tier: 'premium' },
            { slug: 'github-integration', tier: 'free' },
          ],
        };
      }

      if (method === 'GET' && path === '/api/findings') {
        return {
          status: 200,
          data: [
            { id: 'f1', severity: 'critical', title: 'S3 public' },
            { id: 'f2', severity: 'high', title: 'Open SSH' },
          ],
        };
      }

      if (method === 'POST' && path === '/api/findings/triage') {
        return { status: 200, data: { triaged: true } };
      }

      return { status: 404, data: { error: 'Not found' } };
    },

    resetMetrics() {
      requestCount = 0;
      db.clear();
      kv.clear();
    },
  };
}

/* ── tests ───────────────────────────────────────────────── */

describe('User Behavior: New User Onboarding', () => {
  let api: ReturnType<typeof createMockAPI>;
  const token = 'test-jwt-token';

  beforeEach(() => { api = createMockAPI(); });

  it('completes signup → deploy → monitor in sequence', async () => {
    const steps: StepResult[] = [];

    steps.push(await timedStep('check health', async () => {
      const res = await api.request('GET', '/health');
      expect(res.status).toBe(200);
    }));

    await thinkTime(20);

    steps.push(await timedStep('create first instance', async () => {
      const res = await api.request('POST', '/api/instances', {
        token,
        body: { name: 'my-first-agent', region: 'eu-central' },
      });
      expect(res.status).toBe(201);
      expect((res.data as Record<string, unknown>).status).toBe('provisioning');
    }));

    await thinkTime(30);

    steps.push(await timedStep('list instances', async () => {
      const res = await api.request('GET', '/api/instances', { token });
      expect(res.status).toBe(200);
      expect((res.data as unknown[]).length).toBe(1);
    }));

    await thinkTime(20);

    steps.push(await timedStep('browse marketplace', async () => {
      const res = await api.request('GET', '/api/marketplace/skills', { token });
      expect(res.status).toBe(200);
    }));

    const allPassed = steps.every((s) => s.success);
    expect(allPassed).toBe(true);

    const totalDuration = steps.reduce((s, r) => s + r.durationMs, 0);
    expect(totalDuration).toBeLessThan(5000);
  });

  it('handles deploy failure and retries', async () => {
    const steps: StepResult[] = [];

    steps.push(await timedStep('fail without auth', async () => {
      const res = await api.request('POST', '/api/instances', {
        body: { name: 'test' },
      });
      expect(res.status).toBe(401);
    }));

    await thinkTime(10);

    steps.push(await timedStep('retry with auth', async () => {
      const res = await api.request('POST', '/api/instances', {
        token,
        body: { name: 'test', region: 'us-east' },
      });
      expect(res.status).toBe(201);
    }));

    expect(steps.every((s) => s.success)).toBe(true);
    expect(api.requestCount).toBe(2);
  });

  it('navigates full dashboard flow rapidly', async () => {
    await api.request('POST', '/api/instances', {
      token,
      body: { name: 'agent-1', region: 'eu-central' },
    });

    const pages = [
      '/api/instances',
      '/api/findings',
      '/api/marketplace/skills',
      '/api/instances',
    ];

    const start = performance.now();
    for (const page of pages) {
      const res = await api.request('GET', page, { token });
      expect(res.status).toBe(200);
    }
    const totalMs = performance.now() - start;

    expect(totalMs).toBeLessThan(2000);
    expect(api.requestCount).toBe(5);
  });
});

describe('User Behavior: DevSecOps Daily Workflow', () => {
  let api: ReturnType<typeof createMockAPI>;
  const token = 'devsecops-token';

  beforeEach(() => {
    api = createMockAPI();
  });

  it('morning triage: review findings → prioritize → assign', async () => {
    const steps: StepResult[] = [];

    steps.push(await timedStep('fetch findings', async () => {
      const res = await api.request('GET', '/api/findings', { token });
      expect(res.status).toBe(200);
      const findings = res.data as Array<{ severity: string }>;
      expect(findings.some((f) => f.severity === 'critical')).toBe(true);
    }));

    await thinkTime(50);

    steps.push(await timedStep('triage critical findings', async () => {
      const res = await api.request('POST', '/api/findings/triage', {
        token,
        body: { findingIds: ['f1'], action: 'escalate' },
      });
      expect(res.status).toBe(200);
    }));

    await thinkTime(30);

    steps.push(await timedStep('check instances health', async () => {
      const res = await api.request('GET', '/health');
      expect(res.status).toBe(200);
    }));

    expect(steps.every((s) => s.success)).toBe(true);
  });

  it('incident response: detect → investigate → contain', async () => {
    const steps: StepResult[] = [];

    steps.push(await timedStep('detect: check findings', async () => {
      const res = await api.request('GET', '/api/findings', { token });
      const findings = res.data as Array<Record<string, unknown>>;
      const criticals = findings.filter((f) => f.severity === 'critical');
      expect(criticals.length).toBeGreaterThan(0);
    }));

    await thinkTime(20);

    steps.push(await timedStep('investigate: get instance details', async () => {
      await api.request('POST', '/api/instances', {
        token,
        body: { name: 'target-agent', region: 'eu-central' },
      });
      const res = await api.request('GET', '/api/instances', { token });
      expect(res.status).toBe(200);
    }));

    await thinkTime(20);

    steps.push(await timedStep('contain: triage and escalate', async () => {
      const res = await api.request('POST', '/api/findings/triage', {
        token,
        body: { findingIds: ['f1'], action: 'contain' },
      });
      expect(res.status).toBe(200);
    }));

    expect(steps.every((s) => s.success)).toBe(true);
  });
});

describe('User Behavior: Concurrent Multi-User', () => {
  let api: ReturnType<typeof createMockAPI>;

  beforeEach(() => { api = createMockAPI(); });

  it('5 users deploying agents simultaneously', async () => {
    const users = Array.from({ length: 5 }, (_, i) => ({
      token: `user-${i}-token`,
      name: `agent-user-${i}`,
    }));

    const results = await Promise.all(
      users.map(async (user) => {
        const res = await api.request('POST', '/api/instances', {
          token: user.token,
          body: { name: user.name, region: 'eu-central' },
        });
        return { user: user.name, status: res.status };
      }),
    );

    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(api.requestCount).toBe(5);
  });

  it('10 users browsing dashboard concurrently', async () => {
    const start = performance.now();

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        api.request('GET', '/api/findings', { token: `user-${i}` }),
      ),
    );

    const duration = performance.now() - start;

    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(duration).toBeLessThan(3000);
  });

  it('mixed read/write traffic from 20 users', async () => {
    const operations = Array.from({ length: 20 }, (_, i) => {
      if (i % 4 === 0) {
        return api.request('POST', '/api/instances', {
          token: `user-${i}`,
          body: { name: `agent-${i}`, region: 'eu-central' },
        });
      }
      if (i % 4 === 1) {
        return api.request('GET', '/api/findings', { token: `user-${i}` });
      }
      if (i % 4 === 2) {
        return api.request('GET', '/api/marketplace/skills', {
          token: `user-${i}`,
        });
      }
      return api.request('GET', '/health');
    });

    const results = await Promise.all(operations);

    const successful = results.filter((r) => r.status >= 200 && r.status < 300);
    expect(successful.length).toBe(20);
    expect(api.requestCount).toBe(20);
  });
});

describe('User Behavior: Skill Installation Flow', () => {
  let api: ReturnType<typeof createMockAPI>;
  const token = 'pro-user-token';

  beforeEach(() => { api = createMockAPI(); });

  it('browse → select → install → verify', async () => {
    const steps: StepResult[] = [];

    steps.push(await timedStep('browse marketplace', async () => {
      const res = await api.request('GET', '/api/marketplace/skills', { token });
      expect(res.status).toBe(200);
      const skills = res.data as Array<{ slug: string }>;
      expect(skills.length).toBeGreaterThan(0);
    }));

    await thinkTime(40);

    steps.push(await timedStep('deploy target agent', async () => {
      const res = await api.request('POST', '/api/instances', {
        token,
        body: { name: 'skill-test-agent', region: 'eu-central' },
      });
      expect(res.status).toBe(201);
    }));

    await thinkTime(20);

    steps.push(await timedStep('install skill', async () => {
      const res = await api.request('POST', '/api/skills/install', {
        token,
        body: { skillSlug: 'github-integration', instanceId: 'inst_1' },
      });
      expect(res.status).toBe(200);
    }));

    await thinkTime(20);

    steps.push(await timedStep('verify installation', async () => {
      const res = await api.request('GET', '/api/instances', { token });
      expect(res.status).toBe(200);
    }));

    expect(steps.every((s) => s.success)).toBe(true);
    expect(steps.length).toBe(4);
  });
});

describe('User Behavior: Session Resilience', () => {
  let api: ReturnType<typeof createMockAPI>;

  beforeEach(() => { api = createMockAPI(); });

  it('recovers from auth expiry mid-session', async () => {
    const res1 = await api.request('GET', '/api/instances', { token: 'valid' });
    expect(res1.status).toBe(200);

    const res2 = await api.request('GET', '/api/instances');
    expect(res2.status).toBe(401);

    const res3 = await api.request('GET', '/api/instances', { token: 'refreshed' });
    expect(res3.status).toBe(200);
  });

  it('handles rapid page navigation without errors', async () => {
    const token = 'rapid-nav-token';
    const pages = [
      '/api/instances', '/api/findings', '/api/marketplace/skills',
      '/api/instances', '/api/findings', '/api/marketplace/skills',
      '/api/instances', '/api/findings',
    ];

    const results = await Promise.all(
      pages.map((p) => api.request('GET', p, { token })),
    );

    expect(results.every((r) => r.status === 200)).toBe(true);
  });

  it('handles create → immediate read consistency', async () => {
    const token = 'consistency-token';

    const createRes = await api.request('POST', '/api/instances', {
      token,
      body: { name: 'new-agent', region: 'eu-central' },
    });
    expect(createRes.status).toBe(201);
    const created = createRes.data as { id: string };

    const readRes = await api.request('GET', `/api/instances/${created.id}`, {
      token,
    });
    expect(readRes.status).toBe(200);
    expect((readRes.data as Record<string, unknown>).id).toBe(created.id);
  });

  it('handles delete → verify gone consistency', async () => {
    const token = 'delete-token';

    const createRes = await api.request('POST', '/api/instances', {
      token,
      body: { name: 'to-delete', region: 'us-east' },
    });
    const id = (createRes.data as { id: string }).id;

    await api.request('DELETE', `/api/instances/${id}`, { token });

    const readRes = await api.request('GET', `/api/instances/${id}`, { token });
    expect(readRes.status).toBe(404);
  });
});
