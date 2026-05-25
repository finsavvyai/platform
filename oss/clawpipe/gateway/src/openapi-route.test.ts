/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { getOpenApiDoc, handleOpenApi } from './openapi-route';
import { GATEWAY_VERSION } from './version';

describe('openapi-route', () => {
  it('serves valid JSON with cache-control', async () => {
    const res = handleOpenApi();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(res.headers.get('cache-control')).toContain('max-age=300');
    const body = await res.json() as { openapi: string };
    expect(body.openapi).toBe('3.1.0');
  });

  it('reports the same gateway version as version.ts', () => {
    expect(getOpenApiDoc().info.version).toBe(GATEWAY_VERSION);
  });

  it('declares every implemented public path the SDK and AI agents need', () => {
    const doc = getOpenApiDoc();
    const required = [
      '/v1/prompt',
      '/v1/stream',
      '/v1/weights',
      '/v1/savings',
      '/v1/index',
      '/v1/openapi.json',
      '/v1/billing/checkout',
      '/v1/billing/portal',
      '/v1/webhooks/dlq',
      '/v1/webhooks/dlq/{id}/replay',
    ];
    for (const path of required) {
      expect(Object.keys(doc.paths)).toContain(path);
    }
  });

  it('marks /v1/index and /v1/openapi.json as auth-free', () => {
    const doc = getOpenApiDoc();
    const idx = (doc.paths as Record<string, { get?: { security?: unknown[] } }>)['/v1/index'].get;
    const oas = (doc.paths as Record<string, { get?: { security?: unknown[] } }>)['/v1/openapi.json'].get;
    expect(idx?.security).toEqual([]);
    expect(oas?.security).toEqual([]);
  });

  it('documents Idempotency-Key on /v1/prompt', () => {
    const doc = getOpenApiDoc();
    const prompt = (doc.paths as Record<string, { post?: { parameters?: Array<{ name: string }> } }>)['/v1/prompt'].post;
    const names = prompt?.parameters?.map((p) => p.name) ?? [];
    expect(names).toContain('Idempotency-Key');
  });

  it('documents Last-Event-ID on /v1/stream', () => {
    const doc = getOpenApiDoc();
    const stream = (doc.paths as Record<string, { post?: { parameters?: Array<{ name: string }> } }>)['/v1/stream'].post;
    const names = stream?.parameters?.map((p) => p.name) ?? [];
    expect(names).toContain('Last-Event-ID');
  });

  it('documents RFC 9239 RateLimit headers on /v1/prompt 200', () => {
    const doc = getOpenApiDoc();
    type Resp200 = { headers?: Record<string, unknown> };
    const ok = (doc.paths as Record<string, { post?: { responses?: { '200'?: Resp200 } } }>)['/v1/prompt'].post?.responses?.['200'];
    const headers = ok?.headers ?? {};
    expect(Object.keys(headers)).toEqual(expect.arrayContaining(['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset']));
  });

  it('declares bearer auth scheme on components.securitySchemes', () => {
    const doc = getOpenApiDoc();
    const schemes = doc.components.securitySchemes;
    expect(schemes.bearerAuth.type).toBe('http');
    expect(schemes.bearerAuth.scheme).toBe('bearer');
  });
});
