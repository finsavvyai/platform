/**
 * MCP Guardian Scanner Route Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

vi.mock('../middleware/auth.js', async () => {
  const { createMiddleware } = await vi.importActual('hono/factory');
  return {
    authMiddleware: createMiddleware(async (c: any, next: any) => {
      const authHeader = c.req.header('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      c.set('userId', 'user-mcp-1');
      await next();
    }),
  };
});

vi.mock('../middleware/db.js', async () => {
  const { createMiddleware } = await vi.importActual('hono/factory');
  return {
    dbMiddleware: createMiddleware(async (_c: any, next: any) => {
      await next();
    }),
  };
});

import { mcpGuardianRoutes } from './mcp-guardian.js';

const auth = { Authorization: 'Bearer test-token' };

function createMockKV() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    delete: vi.fn(async (key: string) => { store.delete(key); }),
  };
}

function createTestApp() {
  const mockKV = createMockKV();
  const env = { CACHE: mockKV } as Record<string, unknown>;
  const app = new Hono();
  app.route('/api/mcp/guardian', mcpGuardianRoutes);

  const req = (path: string, init?: RequestInit) => app.request(path, init, env);
  const postReq = (path: string, body: unknown) =>
    req(path, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  const getReq = (path: string) => req(path, { headers: auth });

  return { app, env, req: postReq, get: getReq };
}

describe('MCP Guardian Routes', () => {
  it('POST /scan detects critical bind address finding', async () => {
    const { req, get } = createTestApp();
    const res = await req('/api/mcp/guardian/scan', {
      name: 'Risky Server',
      bindAddress: '0.0.0.0',
      port: 8080,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.summary.critical).toBeGreaterThanOrEqual(1);
    expect(body.data.summary.autoQuarantined).toBe(true);
  });

  it('POST /scan detects missing authentication', async () => {
    const { req, get } = createTestApp();
    const res = await req('/api/mcp/guardian/scan', {
      name: 'No Auth Server',
      auth: null,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const authFinding = body.data.findings.find(
      (f: { checkId: string }) => f.checkId === 'MCP-002',
    );
    expect(authFinding).toBeTruthy();
    expect(authFinding.severity).toBe('critical');
  });

  it('POST /scan detects unrestricted file tool', async () => {
    const { req, get } = createTestApp();
    const res = await req('/api/mcp/guardian/scan', {
      name: 'File Server',
      auth: { type: 'token' },
      tools: [{ name: 'file-reader', permissions: [] }],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const fileFinding = body.data.findings.find(
      (f: { checkId: string }) => f.checkId === 'MCP-003',
    );
    expect(fileFinding).toBeTruthy();
  });

  it('POST /scan detects command injection risk', async () => {
    const { req, get } = createTestApp();
    const res = await req('/api/mcp/guardian/scan', {
      name: 'Shell Server',
      auth: { type: 'token' },
      tools: [{ name: 'run-exec', command: 'bash -c' }],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const cmdFinding = body.data.findings.find(
      (f: { checkId: string }) => f.checkId === 'MCP-004',
    );
    expect(cmdFinding).toBeTruthy();
  });

  it('POST /scan detects over-privileged tokens', async () => {
    const { req, get } = createTestApp();
    const res = await req('/api/mcp/guardian/scan', {
      name: 'Admin Server',
      auth: { type: 'token' },
      tokenScopes: ['admin', 'read'],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const scopeFinding = body.data.findings.find(
      (f: { checkId: string }) => f.checkId === 'MCP-005',
    );
    expect(scopeFinding).toBeTruthy();
  });

  it('POST /scan detects malicious dependencies', async () => {
    const { req, get } = createTestApp();
    const res = await req('/api/mcp/guardian/scan', {
      name: 'Bad Deps Server',
      auth: { type: 'token' },
      dependencies: ['mcp-evil-server', 'safe-package'],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const depFinding = body.data.findings.find(
      (f: { checkId: string }) => f.checkId === 'MCP-006',
    );
    expect(depFinding).toBeTruthy();
  });

  it('POST /scan detects unencrypted storage', async () => {
    const { req, get } = createTestApp();
    const res = await req('/api/mcp/guardian/scan', {
      name: 'Unencrypted Server',
      auth: { type: 'token' },
      storage: { encrypted: false, path: '/tmp/convos' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const storageFinding = body.data.findings.find(
      (f: { checkId: string }) => f.checkId === 'MCP-007',
    );
    expect(storageFinding).toBeTruthy();
  });

  it('POST /scan returns clean for secure config', async () => {
    const { req, get } = createTestApp();
    const res = await req('/api/mcp/guardian/scan', {
      name: 'Secure Server',
      bindAddress: '127.0.0.1',
      auth: { type: 'mTLS' },
      tools: [{ name: 'safe-tool', permissions: ['read'] }],
      storage: { encrypted: true },
      tokenScopes: ['read'],
      dependencies: ['safe-package'],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.summary.total).toBe(0);
    expect(body.data.summary.autoQuarantined).toBe(false);
  });

  it('POST /scan rejects invalid input', async () => {
    const { req, get } = createTestApp();
    const res = await req('/api/mcp/guardian/scan', {});
    expect(res.status).toBe(400);
  });

  it('GET /servers lists registered MCP servers', async () => {
    const { req, get } = createTestApp();
    await req('/api/mcp/guardian/scan', {
      name: 'Listed Server',
      auth: { type: 'token' },
    });
    const res = await get('/api/mcp/guardian/servers');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /servers/:id/quarantine quarantines a server', async () => {
    const { req, get } = createTestApp();
    const scanRes = await req('/api/mcp/guardian/scan', {
      name: 'To Quarantine',
      auth: { type: 'token' },
    });
    const { data } = await scanRes.json();

    const res = await req(
      `/api/mcp/guardian/servers/${data.serverId}/quarantine`,
      { reason: 'Suspicious activity detected' },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe('quarantined');
  });

  it('POST /servers/:id/quarantine returns 404 for unknown', async () => {
    const { req, get } = createTestApp();
    const res = await req(
      '/api/mcp/guardian/servers/nonexistent/quarantine',
      { reason: 'Test' },
    );
    expect(res.status).toBe(404);
  });
});
