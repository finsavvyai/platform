import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb),
}));
vi.mock('hono/logger', () => ({
  logger: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/tenant-auth.js', () => ({
  tenantAuth: async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/usage-limit.js', () => ({ usageLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); } }));
vi.mock('../middleware/rate-limit.js', () => ({
  publicRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  apiRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  rateLimit: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/guard.js', () => ({
  guardMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));

const { mockGenMeta, mockDecode, mockParse, mockIssueChallenge } = vi.hoisted(() => ({
  mockGenMeta: vi.fn(() => '<EntityDescriptor>fake-saml-metadata</EntityDescriptor>'),
  mockDecode: vi.fn(),
  mockParse: vi.fn(),
  mockIssueChallenge: vi.fn(),
}));
vi.mock('../services/saml/metadata.js', () => ({ generateSpMetadata: mockGenMeta }));
vi.mock('../services/saml/assertion-parser.js', () => ({
  decodeSamlResponse: mockDecode,
  parseSamlResponse: mockParse,
}));
vi.mock('@opensyber/tokenforge/server/internal', async (orig) => {
  const actual = await (orig as () => Promise<Record<string, unknown>>)();
  return { ...actual, issueChallenge: mockIssueChallenge };
});

import worker from '../index.js';

async function postAcs(tenantId: string, formBody: string, env: Env): Promise<Response> {
  return worker.fetch(
    new Request(`http://localhost/v1/saml/acs/${tenantId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: 'Bearer tf_test' },
      body: formBody,
    }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

describe('GET /v1/saml/metadata/:tenantId', () => {
  let env: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    (globalThis as Record<string, unknown>).__mockDb = createMockDb();
  });

  it('returns 200 with samlmetadata XML for the tenant', async () => {
    const res = await worker.fetch(
      new Request('http://localhost/v1/saml/metadata/tf_acme', { headers: { authorization: 'Bearer tf_test' } }),
      env,
      { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('samlmetadata+xml');
    const body = await res.text();
    expect(body).toContain('EntityDescriptor');
    expect(mockGenMeta).toHaveBeenCalledWith('tf_acme');
  });
});

describe('POST /v1/saml/acs/:tenantId', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
    mockDecode.mockReturnValue('<saml:Response>...</saml:Response>');
    mockParse.mockReturnValue({
      issuer: 'https://idp.acme/sso',
      nameId: 'alice@acme.com',
      notOnOrAfter: new Date(Date.now() + 60_000).toISOString(),
      attributes: { displayName: 'Alice Example' },
    });
    mockIssueChallenge.mockResolvedValue({
      challenge: 'ch_random32bytes',
      record: { purpose: 'register', expiresAt: '2026-05-04T01:00:00.000Z' },
    });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('returns 400 missing_saml_response when form has no SAMLResponse field', async () => {
    const res = await postAcs('tf_acme', '', env);
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('missing_saml_response');
  });

  it('returns 400 invalid_saml_encoding when decode returns null', async () => {
    mockDecode.mockReturnValueOnce(null);
    const res = await postAcs('tf_acme', 'SAMLResponse=garbage', env);
    expect((await res.json() as { error: string }).error).toBe('invalid_saml_encoding');
  });

  it('returns 400 saml_parse_failed when assertion has no nameId', async () => {
    mockParse.mockReturnValueOnce({ issuer: 'x', attributes: {} });
    const res = await postAcs('tf_acme', 'SAMLResponse=encoded', env);
    expect((await res.json() as { error: string }).error).toBe('saml_parse_failed');
  });

  it('returns 401 saml_assertion_expired when notOnOrAfter is in the past', async () => {
    mockParse.mockReturnValueOnce({
      issuer: 'https://idp.acme/sso',
      nameId: 'alice@acme.com',
      notOnOrAfter: new Date(Date.now() - 1000).toISOString(),
      attributes: {},
    });
    const res = await postAcs('tf_acme', 'SAMLResponse=encoded', env);
    expect((await res.json() as { error: string }).error).toBe('saml_assertion_expired');
  });

  it('returns 401 unknown_saml_issuer when no workforce app matches issuer', async () => {
    db._setSelectResult([]);
    const res = await postAcs('tf_acme', 'SAMLResponse=encoded', env);
    expect((await res.json() as { error: string }).error).toBe('unknown_saml_issuer');
  });

  it('returns 401 workforce_app_disabled when matching app has enabled=false', async () => {
    db._setSelectResult([{ id: 'wf_1', tenantId: 'tf_acme', issuer: 'https://idp.acme/sso', enabled: false }]);
    const res = await postAcs('tf_acme', 'SAMLResponse=encoded', env);
    expect((await res.json() as { error: string }).error).toBe('workforce_app_disabled');
  });

  it('inserts a new subject + returns challenge on first SAML login', async () => {
    db._setSelectResults([
      [{ id: 'wf_1', tenantId: 'tf_acme', issuer: 'https://idp.acme/sso', enabled: true }],
      [], // no existing subject
    ]);
    const res = await postAcs('tf_acme', 'SAMLResponse=encoded', env);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { data: { subjectId: string; nameId: string; challenge: string; registerUrl: string } };
    expect(j.data.subjectId).toMatch(/^tf-sub-/);
    expect(j.data.nameId).toBe('alice@acme.com');
    expect(j.data.challenge).toBe('ch_random32bytes');
    expect(j.data.registerUrl).toBe('/v1/dbsc/register');
    expect(db.insert).toHaveBeenCalled();
  });

  it('updates existing subject + returns same subjectId on repeat SAML login', async () => {
    db._setSelectResults([
      [{ id: 'wf_1', tenantId: 'tf_acme', issuer: 'https://idp.acme/sso', enabled: true }],
      [{ id: 'tf-sub-existing', externalSubject: 'alice@acme.com', workforceAppId: 'wf_1' }],
    ]);
    const res = await postAcs('tf_acme', 'SAMLResponse=encoded', env);
    const j = (await res.json()) as { data: { subjectId: string } };
    expect(j.data.subjectId).toBe('tf-sub-existing');
    expect(db.update).toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });
});
