/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { authenticate } from './auth';
import type { Env } from './types';

function makeDB(opts: { lookupReturns?: { id: string; name: string } | null } = {}) {
  return {
    prepare: () => ({
      bind: () => ({
        first: async () => opts.lookupReturns ?? null,
      }),
    }),
  };
}

const mkEnv = (opts = {}): Env => ({ DB: makeDB(opts) as unknown as D1Database } as Env);

function req(headers: Record<string, string>): Request {
  return new Request('https://api.clawpipe.ai/v1/prompt', { headers });
}

describe('authenticate', () => {
  it('rejects missing Authorization header', async () => {
    const r = await authenticate(req({}), mkEnv());
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Missing Authorization');
  });

  it('rejects non-Bearer schemes', async () => {
    const r = await authenticate(req({ Authorization: 'Basic abc' }), mkEnv());
    expect(r.valid).toBe(false);
  });

  it('rejects too-short API keys', async () => {
    const r = await authenticate(req({ Authorization: 'Bearer x', 'X-Project-Id': 'p1' }), mkEnv());
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Invalid API key format');
  });

  it('rejects missing X-Project-Id', async () => {
    const r = await authenticate(req({ Authorization: 'Bearer cp_live_aaaaaaaa' }), mkEnv());
    expect(r.valid).toBe(false);
    expect(r.error).toContain('X-Project-Id');
  });

  it('rejects when DB lookup returns no row', async () => {
    const r = await authenticate(
      req({ Authorization: 'Bearer cp_live_aaaaaaaa', 'X-Project-Id': 'p1' }),
      mkEnv({ lookupReturns: null }),
    );
    expect(r.valid).toBe(false);
    expect(r.error).toBe('Invalid API key');
  });

  it('returns valid + projectId on a known key', async () => {
    const r = await authenticate(
      req({ Authorization: 'Bearer cp_live_aaaaaaaa', 'X-Project-Id': 'p1' }),
      mkEnv({ lookupReturns: { id: 'real-pid', name: 'My Project' } }),
    );
    expect(r.valid).toBe(true);
    expect(r.projectId).toBe('real-pid');
    expect(r.error).toBeNull();
  });
});
