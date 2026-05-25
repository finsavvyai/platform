import { vi } from 'vitest';

/**
 * Shared test helpers for sample project integration tests.
 * Provides mock factories for all OpenSyber platform services.
 */

/** Simulates a user on a specific plan */
export interface TestUser {
  id: string;
  email: string;
  orgId: string;
  plan: 'free' | 'pro' | 'team' | 'enterprise';
  role: 'owner' | 'admin' | 'member' | 'viewer';
}

/** Create a test user for a specific persona */
export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: `user_${crypto.randomUUID().slice(0, 8)}`,
    email: 'test@opensyber.cloud',
    orgId: `org_${crypto.randomUUID().slice(0, 8)}`,
    plan: 'free',
    role: 'owner',
    ...overrides,
  };
}

/** Mock database with chainable query builder */
export function createMockDb() {
  let selectResults: unknown[][] = [[]];
  let selectCallIndex = 0;

  const consumeResult = () => {
    const result = selectResults[selectCallIndex] ?? [];
    selectCallIndex++;
    return result;
  };

  const makeThenable = (): Record<string, unknown> => {
    const obj: Record<string, unknown> = {};
    const chainMethods = [
      'from', 'where', 'groupBy', 'orderBy', 'limit',
      'offset', 'innerJoin', 'leftJoin', '$dynamic',
    ];
    for (const m of chainMethods) {
      obj[m] = vi.fn(() => makeThenable());
    }
    obj.then = (resolve: (v: unknown) => void) => {
      return Promise.resolve().then(() => resolve(consumeResult()));
    };
    return obj;
  };

  return {
    select: vi.fn(() => makeThenable()),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
    batch: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
    _setSelectResult: (data: unknown[]) => {
      selectResults = [data];
      selectCallIndex = 0;
    },
    _setSelectResults: (results: unknown[][]) => {
      selectResults = results;
      selectCallIndex = 0;
    },
  };
}

/** Mock KV namespace backed by a Map */
export function createMockKV(): Record<string, unknown> {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string, format?: string) => {
      const value = store.get(key);
      if (value === undefined) return null;
      return format === 'json' ? JSON.parse(value) : value;
    }),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async () => ({
      keys: [...store.keys()].map((k) => ({ name: k })),
      list_complete: true,
    })),
    _store: store,
  };
}

/** Mock R2 bucket for skill packages and logs */
export function createMockR2(): Record<string, unknown> {
  const objects = new Map<string, { body: string; size: number }>();
  return {
    head: vi.fn(async (key: string) => {
      return objects.has(key)
        ? { key, size: objects.get(key)!.size }
        : null;
    }),
    get: vi.fn(async (key: string) => {
      const obj = objects.get(key);
      if (!obj) return null;
      return {
        key,
        body: new ReadableStream(),
        text: async () => obj.body,
        size: obj.size,
      };
    }),
    put: vi.fn(async (key: string, value: string) => {
      objects.set(key, { body: value, size: value.length });
    }),
    delete: vi.fn(async (key: string) => {
      objects.delete(key);
    }),
    _objects: objects,
  };
}

/** Mock Hetzner Cloud API for server management */
export function createMockHetzner() {
  const servers = new Map<string, Record<string, unknown>>();
  return {
    createServer: vi.fn(async (opts: Record<string, unknown>) => {
      const id = `srv_${crypto.randomUUID().slice(0, 8)}`;
      const server = {
        id,
        name: opts.name ?? 'agent-vm',
        status: 'running',
        public_net: { ipv4: { ip: '203.0.113.1' } },
        server_type: { name: 'cx11', cores: 1, memory: 1 },
        created: new Date().toISOString(),
      };
      servers.set(id, server);
      return { server };
    }),
    getServer: vi.fn(async (id: string) => servers.get(id) ?? null),
    deleteServer: vi.fn(async (id: string) => {
      servers.delete(id);
      return { success: true };
    }),
    listServers: vi.fn(async () => [...servers.values()]),
    _servers: servers,
  };
}

/** Mock LemonSqueezy billing API */
export function createMockBilling() {
  const subscriptions = new Map<string, Record<string, unknown>>();
  return {
    createSubscription: vi.fn(async (opts: Record<string, unknown>) => {
      const sub = {
        id: `sub_${crypto.randomUUID().slice(0, 8)}`,
        status: 'active',
        plan: opts.plan ?? 'free',
        ...opts,
      };
      subscriptions.set(sub.id as string, sub);
      return sub;
    }),
    getSubscription: vi.fn(async (id: string) => subscriptions.get(id)),
    cancelSubscription: vi.fn(async (id: string) => {
      const sub = subscriptions.get(id);
      if (sub) sub.status = 'cancelled';
      return sub;
    }),
    _subscriptions: subscriptions,
  };
}

/** Mock Resend email API */
export function createMockEmail() {
  const sent: Array<Record<string, unknown>> = [];
  return {
    send: vi.fn(async (opts: Record<string, unknown>) => {
      sent.push(opts);
      return { id: `email_${crypto.randomUUID().slice(0, 8)}` };
    }),
    _sent: sent,
  };
}

/** Mock WebSocket for real-time monitoring */
export function createMockWebSocket() {
  const messages: string[] = [];
  return {
    send: vi.fn((msg: string) => { messages.push(msg); }),
    close: vi.fn(),
    onmessage: vi.fn(),
    _messages: messages,
  };
}

/** Mock LLM client for AI skill testing */
export function createMockLLM() {
  return {
    askLLM: vi.fn(async (_system: string, prompt: string) => ({
      text: JSON.stringify({
        prioritized: [
          { id: 'finding-1', adjustedSeverity: 'critical', priority: 1 },
        ],
      }),
      usage: { input_tokens: 100, output_tokens: 50 },
    })),
    parseJSON: vi.fn((text: string) => {
      try { return JSON.parse(text); } catch { return null; }
    }),
  };
}
