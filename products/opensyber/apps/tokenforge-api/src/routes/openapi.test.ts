import { describe, it, expect, vi, beforeEach } from 'vitest';
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

import worker from '../index.js';

async function getOpenApi(env: Env): Promise<Response> {
  return worker.fetch(
    new Request('http://localhost/v1/openapi.json', { headers: { authorization: 'Bearer tf_test' } }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

interface OpenApiSpec {
  openapi: string;
  info: { title: string; version: string; description: string; contact: { url: string } };
  servers: Array<{ url: string }>;
  paths: Record<string, Record<string, unknown>>;
  components: {
    securitySchemes: { bearerAuth: { type: string; scheme: string } };
    schemas: Record<string, { type: string; required?: string[]; properties: Record<string, unknown> }>;
  };
}

describe('GET /v1/openapi.json', () => {
  let env: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    (globalThis as Record<string, unknown>).__mockDb = createMockDb();
  });

  it('returns 200 with JSON content type', async () => {
    const res = await getOpenApi(env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');
  });

  it('sets Cache-Control public + max-age=300 (5min CDN-cacheable)', async () => {
    const res = await getOpenApi(env);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300');
  });

  it('declares openapi 3.1.0 with the canonical info block', async () => {
    const j = (await (await getOpenApi(env)).json()) as OpenApiSpec;
    expect(j.openapi).toBe('3.1.0');
    expect(j.info.title).toBe('TokenForge API');
    expect(j.info.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(j.info.contact.url).toBe('https://tokenforge.opensyber.cloud');
    expect(j.servers[0]!.url).toBe('https://tokenforge-api.opensyber.cloud');
  });

  it('lists the core DBSC paths', async () => {
    const j = (await (await getOpenApi(env)).json()) as OpenApiSpec;
    expect(j.paths['/v1/dbsc/challenge']).toBeDefined();
    expect(j.paths['/v1/dbsc/register']).toBeDefined();
    expect(j.paths['/v1/dbsc/refresh']).toBeDefined();
    expect(j.paths['/v1/dbsc/sessions']).toBeDefined();
    expect(j.paths['/v1/dbsc/sessions/{id}/revoke']).toBeDefined();
  });

  it('lists workforce + SAML + SCIM endpoints (workforce SSO surface)', async () => {
    const j = (await (await getOpenApi(env)).json()) as OpenApiSpec;
    expect(j.paths['/v1/workforce/apps']).toBeDefined();
    expect(j.paths['/v1/workforce/sso/{appId}/exchange']).toBeDefined();
    expect(j.paths['/v1/saml/metadata/{tenantId}']).toBeDefined();
    expect(j.paths['/v1/saml/acs/{tenantId}']).toBeDefined();
    expect(j.paths['/scim/v2/Users']).toBeDefined();
  });

  it('lists discovery endpoints (.well-known JWKS + DBSC descriptor)', async () => {
    const j = (await (await getOpenApi(env)).json()) as OpenApiSpec;
    expect(j.paths['/.well-known/tokenforge/jwks']).toBeDefined();
    expect(j.paths['/.well-known/tokenforge/dbsc']).toBeDefined();
  });

  it('declares bearerAuth security scheme used by authenticated endpoints', async () => {
    const j = (await (await getOpenApi(env)).json()) as OpenApiSpec;
    expect(j.components.securitySchemes.bearerAuth).toBeDefined();
    expect(j.components.securitySchemes.bearerAuth.type).toBe('http');
    expect(j.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
  });

  it('defines the ChallengeRequest + RegisterRequest schema components', async () => {
    const j = (await (await getOpenApi(env)).json()) as OpenApiSpec;
    expect(j.components.schemas.ChallengeRequest).toBeDefined();
    expect(j.components.schemas.ChallengeRequest!.required).toContain('purpose');
    expect(j.components.schemas.RegisterRequest).toBeDefined();
    expect(j.components.schemas.RegisterRequest!.required?.sort())
      .toEqual(['alg', 'challenge', 'challengeResponse', 'publicKey']);
  });

  it('ChallengeRequest.purpose enum is exactly [register, refresh, step_up] (matches runtime)', async () => {
    const j = (await (await getOpenApi(env)).json()) as OpenApiSpec;
    const purpose = (j.components.schemas.ChallengeRequest!.properties.purpose as { enum: string[] });
    expect(purpose.enum.sort()).toEqual(['refresh', 'register', 'step_up']);
  });

  it('RegisterRequest.alg enum is exactly [ES256] (algorithm pinning at the doc level)', async () => {
    const j = (await (await getOpenApi(env)).json()) as OpenApiSpec;
    const alg = (j.components.schemas.RegisterRequest!.properties.alg as { enum: string[] });
    expect(alg.enum).toEqual(['ES256']);
  });

  it('ChallengeRequest.ttlSeconds bounds are 15..300 inclusive (matches challenge-store TTL clamp)', async () => {
    const j = (await (await getOpenApi(env)).json()) as OpenApiSpec;
    const ttl = (j.components.schemas.ChallengeRequest!.properties.ttlSeconds as { minimum: number; maximum: number });
    expect(ttl.minimum).toBe(15);
    expect(ttl.maximum).toBe(300);
  });

  it('every authenticated path operation declares bearerAuth security; .well-known paths do NOT', async () => {
    const j = (await (await getOpenApi(env)).json()) as OpenApiSpec;
    const flatten = (path: string): Array<Record<string, unknown>> =>
      Object.values(j.paths[path]!) as Array<Record<string, unknown>>;
    // Authenticated DBSC routes
    for (const op of flatten('/v1/dbsc/register')) expect(op.security).toEqual([{ bearerAuth: [] }]);
    for (const op of flatten('/v1/policies')) expect(op.security).toEqual([{ bearerAuth: [] }]);
    // Public discovery routes
    for (const op of flatten('/.well-known/tokenforge/jwks')) expect(op.security).toBeUndefined();
    for (const op of flatten('/.well-known/tokenforge/dbsc')) expect(op.security).toBeUndefined();
    // SAML metadata is also public (IdP needs to fetch without bearer)
    for (const op of flatten('/v1/saml/metadata/{tenantId}')) expect(op.security).toBeUndefined();
  });

  it('lists policies + webhooks management paths with both list + create operations', async () => {
    const j = (await (await getOpenApi(env)).json()) as OpenApiSpec;
    expect(Object.keys(j.paths['/v1/policies']!).sort()).toEqual(['get', 'post']);
    expect(Object.keys(j.paths['/v1/policies/{id}']!).sort()).toEqual(['delete', 'patch']);
    expect(Object.keys(j.paths['/v1/webhooks']!).sort()).toEqual(['get', 'post']);
  });
});
