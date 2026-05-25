/**
 * Edge-case coverage for POST /v1/saml/acs/:tenantId.
 * Sibling of saml.test.ts (168L) — pins email/nameId derivation,
 * displayName fallback chain, metadata-shape contract, and
 * issueChallenge call shape.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb) }));
vi.mock('hono/logger', () => ({ logger: () => async (_c: unknown, next: () => Promise<void>) => { await next(); } }));
vi.mock('../middleware/tenant-auth.js', () => ({
  tenantAuth: async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/usage-limit.js', () => ({ usageLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); } }));
vi.mock('../middleware/rate-limit.js', () => ({
  publicRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  apiRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  rateLimit: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/guard.js', () => ({ guardMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); } }));

const { mockDecode, mockParse, mockIssueChallenge } = vi.hoisted(() => ({
  mockDecode: vi.fn(),
  mockParse: vi.fn(),
  mockIssueChallenge: vi.fn(),
}));
vi.mock('../services/saml/metadata.js', () => ({
  generateSpMetadata: vi.fn(() => '<EntityDescriptor>x</EntityDescriptor>'),
}));
vi.mock('../services/saml/assertion-parser.js', () => ({
  decodeSamlResponse: mockDecode,
  parseSamlResponse: mockParse,
}));
vi.mock('@opensyber/tokenforge/server/internal', async (orig) => {
  const actual = await (orig as () => Promise<Record<string, unknown>>)();
  return { ...actual, issueChallenge: mockIssueChallenge };
});

import worker from '../index.js';

async function postAcs(tenantId: string, env: Env): Promise<Response> {
  return worker.fetch(
    new Request(`http://localhost/v1/saml/acs/${tenantId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: 'Bearer tf_test' },
      body: 'SAMLResponse=encoded',
    }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

const okApp = { id: 'wf_1', tenantId: 't1', issuer: 'https://idp.acme/sso', enabled: true };

describe('POST /v1/saml/acs/:tenantId — derivation + shape edges', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;
  let captured: Record<string, unknown> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
    captured = undefined;
    db.insert = vi.fn(() => ({ values: vi.fn(async (v: Record<string, unknown>) => { captured = v; }) }));
    mockDecode.mockReturnValue('<saml:Response>x</saml:Response>');
    mockIssueChallenge.mockResolvedValue({
      challenge: 'c32', record: { purpose: 'register', expiresAt: '2026-05-04T01:00:00Z' },
    });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('email is NULL when nameId does not contain `@` (e.g. SAML transient/unspecified format)', async () => {
    mockParse.mockReturnValue({
      issuer: 'https://idp.acme/sso', nameId: 'transient-id-12345', attributes: {},
    });
    db._setSelectResults([[okApp], []]);
    await postAcs('t1', env);
    expect(captured!.email).toBeNull();
  });

  it('displayName falls back to xmlsoap.org/ws/2005/05/identity/claims/name when displayName absent', async () => {
    mockParse.mockReturnValue({
      issuer: 'https://idp.acme/sso',
      nameId: 'alice@acme.com',
      attributes: { 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Alice Claims' },
    });
    db._setSelectResults([[okApp], []]);
    await postAcs('t1', env);
    expect(captured!.name).toBe('Alice Claims');
  });

  it('name is null when neither displayName nor xmlsoap claims attribute is present', async () => {
    mockParse.mockReturnValue({
      issuer: 'https://idp.acme/sso', nameId: 'alice@acme.com', attributes: { other: 'irrelevant' },
    });
    db._setSelectResults([[okApp], []]);
    await postAcs('t1', env);
    expect(captured!.name).toBeNull();
  });

  it('insert payload metadata is JSON-encoded {samlAttributes: ...}', async () => {
    const attrs = { displayName: 'A', groups: ['eng', 'admin'], dept: 'Security' };
    mockParse.mockReturnValue({
      issuer: 'https://idp.acme/sso', nameId: 'alice@acme.com', attributes: attrs,
    });
    db._setSelectResults([[okApp], []]);
    await postAcs('t1', env);
    const meta = JSON.parse(captured!.metadata as string) as Record<string, unknown>;
    expect(meta.samlAttributes).toEqual(attrs);
  });

  it('issueChallenge is called with purpose="register" + ttlSeconds=120', async () => {
    mockParse.mockReturnValue({
      issuer: 'https://idp.acme/sso', nameId: 'alice@acme.com', attributes: {},
    });
    db._setSelectResults([[okApp], []]);
    await postAcs('t1', env);
    expect(mockIssueChallenge).toHaveBeenCalled();
    const opts = mockIssueChallenge.mock.calls[0]![1] as Record<string, unknown>;
    expect(opts.purpose).toBe('register');
    expect(opts.ttlSeconds).toBe(120);
    expect(opts.tenantId).toBe('t1');
  });
});
