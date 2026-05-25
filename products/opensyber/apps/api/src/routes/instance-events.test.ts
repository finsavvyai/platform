import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockDb, createMockEnv } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as { __mockDb?: unknown }).__mockDb),
}));

vi.mock('hono/logger', () => ({
  logger: () => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
}));

import worker from '../index.js';

const INSTANCE_ID = 'inst_events_1';
const TOKEN = 'valid-gateway-token-xyz';

type MockDb = ReturnType<typeof createMockDb>;

async function post(
  instanceId: string,
  body: unknown,
  headers: Record<string, string>,
  env: Env,
): Promise<Response> {
  const req = new Request(`http://localhost/api/instances/${instanceId}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return worker.fetch(req, env, {
    waitUntil: vi.fn(), passThroughOnException: vi.fn(),
  } as unknown as ExecutionContext);
}

function validEvent(overrides: Record<string, unknown> = {}) {
  return { eventType: 'cli.command.executed', severity: 'info', details: 'ran', ...overrides };
}

function authHeaders(token = TOKEN, instanceId = INSTANCE_ID) {
  return { 'X-Gateway-Token': token, 'X-Instance-Id': instanceId };
}

describe('POST /api/instances/:id/events', () => {
  let env: Env;
  let mockDb: MockDb;

  beforeEach(async () => {
    vi.clearAllMocks();
    env = createMockEnv();
    mockDb = createMockDb();
    (globalThis as { __mockDb?: unknown }).__mockDb = mockDb;
    await env.CREDENTIAL_VAULT.put(`gateway:${INSTANCE_ID}`, TOKEN);
  });

  it('returns 401 when gateway token header is missing', async () => {
    const res = await post(INSTANCE_ID, validEvent(), {}, env);
    expect(res.status).toBe(401);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('returns 403 when gateway token is wrong for instance', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await post(
      INSTANCE_ID,
      validEvent(),
      authHeaders('wrong-token-completely-different'),
      env,
    );
    expect(res.status).toBe(403);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('returns 403 when X-Instance-Id does not match path id', async () => {
    const res = await post(
      INSTANCE_ID, validEvent(), authHeaders(TOKEN, 'inst_other'), env,
    );
    expect(res.status).toBe(403);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('returns 400 when eventType is missing', async () => {
    const res = await post(INSTANCE_ID, { severity: 'info' }, authHeaders(), env);
    expect(res.status).toBe(400);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('returns 400 when severity is invalid', async () => {
    const res = await post(
      INSTANCE_ID,
      { eventType: 'cli.ran', severity: 'nope' },
      authHeaders(),
      env,
    );
    expect(res.status).toBe(400);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('returns 201 for a single valid event and writes to DB', async () => {
    const res = await post(
      INSTANCE_ID, validEvent({ severity: 'warning' }), authHeaders(), env,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { inserted: number; eventIds: string[] };
    expect(body.inserted).toBe(1);
    expect(body.eventIds).toHaveLength(1);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(mockDb._insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: INSTANCE_ID,
        eventType: 'anomaly_detected',
        severity: 'warning',
      }),
    );
    const persisted = mockDb._insertChain.values.mock.calls[0]?.[0] as { details: string };
    const detailsJson = JSON.parse(persisted.details);
    expect(detailsJson.source).toBe('user_cli');
    expect(detailsJson.reportedEventType).toBe('cli.command.executed');
  });

  it('returns 201 for a batched array of events', async () => {
    const batch = [
      validEvent({ eventType: 'cli.login', severity: 'ok' }),
      validEvent({ eventType: 'cli.deploy', severity: 'blocked' }),
      validEvent({ eventType: 'cli.scan', severity: 'critical' }),
    ];
    const res = await post(INSTANCE_ID, batch, authHeaders(), env);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { inserted: number; eventIds: string[] };
    expect(body.inserted).toBe(3);
    expect(body.eventIds).toHaveLength(3);
    expect(mockDb.insert).toHaveBeenCalledTimes(3);
  });

  it('rate-limits at 60 events/minute per instance (61st returns 429)', async () => {
    let lastStatus = 0;
    for (let i = 0; i < 61; i++) {
      const res = await post(INSTANCE_ID, validEvent(), authHeaders(), env);
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
