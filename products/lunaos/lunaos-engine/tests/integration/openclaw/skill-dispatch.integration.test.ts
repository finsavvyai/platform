/**
 * OpenClaw Skill Dispatch Integration Tests
 *
 * Tests OpenClaw gateway registration, status check,
 * and dispatch endpoints. Actual WebSocket connections to
 * gateways are not available in tests, so we verify
 * validation and error handling paths.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestContext,
  type TestContext,
} from '../setup';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.dispose();
});

describe('POST /openclaw/register — gateway registration', () => {
  it('rejects unauthenticated request', async () => {
    const res = await ctx.makeRequest('/openclaw/register', {
      auth: 'none',
      method: 'POST',
      body: JSON.stringify({
        gatewayUrl: 'wss://test.example.com',
        token: 'test-token',
      }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects invalid gateway URL (not wss://)', async () => {
    const res = await ctx.makeRequest('/openclaw/register', {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({
        gatewayUrl: 'https://test.example.com',
        token: 'test-token',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects missing token', async () => {
    const res = await ctx.makeRequest('/openclaw/register', {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({
        gatewayUrl: 'wss://test.example.com',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 502 when gateway is unreachable', async () => {
    const res = await ctx.makeRequest('/openclaw/register', {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({
        gatewayUrl: 'wss://unreachable.test.local',
        token: 'test-token',
        label: 'Test Gateway',
      }),
    });

    // Should fail to connect
    expect(res.status).toBe(502);
    const body = await res.json() as any;
    expect(body.error).toMatch(/connection failed/i);
  });
});

describe('GET /openclaw/status — gateway status', () => {
  it('returns disconnected when no gateway registered', async () => {
    const res = await ctx.makeRequest('/openclaw/status', {
      auth: 'user',
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.connected).toBe(false);
  });

  it('rejects unauthenticated request', async () => {
    const res = await ctx.makeRequest('/openclaw/status', {
      auth: 'none',
    });
    expect(res.status).toBe(401);
  });
});

describe('POST /openclaw/dispatch — agent dispatch', () => {
  it('rejects unauthenticated request', async () => {
    const res = await ctx.makeRequest('/openclaw/dispatch', {
      auth: 'none',
      method: 'POST',
      body: JSON.stringify({
        agent: 'code-reviewer',
        context: 'test',
      }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects missing agent field', async () => {
    const res = await ctx.makeRequest('/openclaw/dispatch', {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({ context: 'test' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects missing context field', async () => {
    const res = await ctx.makeRequest('/openclaw/dispatch', {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({ agent: 'code-reviewer' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns error when no gateway is registered', async () => {
    const res = await ctx.makeRequest('/openclaw/dispatch', {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({
        agent: 'code-reviewer',
        context: 'Review this code',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toMatch(/no.*gateway/i);
  });
});

describe('POST /openclaw/exec — remote execution', () => {
  it('rejects missing command', async () => {
    const res = await ctx.makeRequest('/openclaw/exec', {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns error when no gateway registered', async () => {
    const res = await ctx.makeRequest('/openclaw/exec', {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({ command: 'ls -la' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /openclaw/register/:id — remove gateway', () => {
  it('removes a gateway entry', async () => {
    const res = await ctx.makeRequest('/openclaw/register/test-gw', {
      auth: 'user',
      method: 'DELETE',
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.deleted).toBe('test-gw');
  });
});
