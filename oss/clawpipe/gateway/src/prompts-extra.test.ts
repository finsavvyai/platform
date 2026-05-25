/** @vitest-environment node */
/** Extra coverage for prompts.ts — branches not exercised by prompts.test.ts:
 *  413 size-cap rejections, batch failure path, listVersions, createVersion,
 *  renderPrompt with explicit version + system + bad template. */

import { describe, it, expect } from 'vitest';
import { createPrompt, listVersions, createVersion, renderPrompt } from './prompts';
import type { Env } from './types';

interface DBState {
  prompt?: { id: string } | null;
  versions?: object[];
  maxVersion?: number;
  renderRow?: { template: string; system: string | null; model: string | null; variables: string | null } | null;
  batchThrows?: boolean;
  insertThrows?: boolean;
}

function makeDB(state: DBState) {
  return {
    prepare: (sql: string) => ({
      bind: (..._b: unknown[]) => ({
        first: async <T>(): Promise<T | null> => {
          if (sql.includes('FROM prompts WHERE id = ?')) return (state.prompt ?? null) as unknown as T;
          if (sql.includes('MAX(version)')) return ({ v: state.maxVersion ?? null } as unknown) as T;
          if (sql.includes('FROM prompt_versions pv JOIN prompts p')) return (state.renderRow ?? null) as unknown as T;
          return null;
        },
        all: async () => ({ results: state.versions ?? [] }),
        run: async () => { if (state.insertThrows) throw new Error('insert constraint'); return { success: true }; },
      }),
    }),
    batch: async () => { if (state.batchThrows) throw new Error('batch constraint'); return []; },
  };
}

const mkEnv = (state: DBState = {}): Env => ({ DB: makeDB(state) as unknown as D1Database } as Env);

function jsonReq(body: unknown, method = 'POST'): Request {
  return new Request('https://x.test/', { method, body: JSON.stringify(body) });
}

describe('createPrompt size + error branches', () => {
  it('413 when name > 100 chars', async () => {
    const res = await createPrompt(jsonReq({ name: 'x'.repeat(101), template: 'hi' }), mkEnv(), 'p1');
    expect(res.status).toBe(413);
  });
  it('413 when template > 50_000 chars', async () => {
    const res = await createPrompt(jsonReq({ name: 'n', template: 'x'.repeat(50_001) }), mkEnv(), 'p1');
    expect(res.status).toBe(413);
  });
  it('400 when DB batch throws', async () => {
    const res = await createPrompt(jsonReq({ name: 'n', template: 'hi' }), mkEnv({ batchThrows: true }), 'p1');
    expect(res.status).toBe(400);
  });
});

describe('listVersions', () => {
  it('404 when prompt not found', async () => {
    const res = await listVersions(mkEnv({ prompt: null }), 'p1', 'pid');
    expect(res.status).toBe(404);
  });
  it('200 returns versions array', async () => {
    const env = mkEnv({ prompt: { id: 'pid' }, versions: [{ id: 'v1', version: 1, notes: 'init', created_at: '2026-01-01' }] });
    const body = await (await listVersions(env, 'p1', 'pid')).json() as { versions: unknown[] };
    expect(body.versions).toHaveLength(1);
  });
});

describe('createVersion', () => {
  it('400 invalid JSON', async () => {
    const req = new Request('https://x.test/', { method: 'POST', body: 'not-json' });
    const res = await createVersion(req, mkEnv(), 'p1', 'pid');
    expect(res.status).toBe(400);
  });
  it('400 missing template', async () => {
    const res = await createVersion(jsonReq({}), mkEnv({ prompt: { id: 'pid' } }), 'p1', 'pid');
    expect(res.status).toBe(400);
  });
  it('404 prompt not found', async () => {
    const res = await createVersion(jsonReq({ template: 'x' }), mkEnv({ prompt: null }), 'p1', 'pid');
    expect(res.status).toBe(404);
  });
  it('201 + computes nextVersion = max + 1', async () => {
    const env = mkEnv({ prompt: { id: 'pid' }, maxVersion: 3 });
    const res = await createVersion(jsonReq({ template: 'hi {x}' }), env, 'p1', 'pid');
    expect(res.status).toBe(201);
    const body = await res.json() as { version: number };
    expect(body.version).toBe(4);
  });
  it('201 with version=1 when no prior versions', async () => {
    const env = mkEnv({ prompt: { id: 'pid' }, maxVersion: undefined });
    const body = await (await createVersion(jsonReq({ template: 'x' }), env, 'p1', 'pid')).json() as { version: number };
    expect(body.version).toBe(1);
  });
  it('400 on insert throw', async () => {
    const env = mkEnv({ prompt: { id: 'pid' }, maxVersion: 1, insertThrows: true });
    const res = await createVersion(jsonReq({ template: 'x' }), env, 'p1', 'pid');
    expect(res.status).toBe(400);
  });
});

describe('renderPrompt branches', () => {
  it('400 invalid JSON', async () => {
    const req = new Request('https://x.test/', { method: 'POST', body: 'not-json' });
    const res = await renderPrompt(req, mkEnv(), 'p1', 'pid');
    expect(res.status).toBe(400);
  });
  it('uses explicit version when supplied', async () => {
    const env = mkEnv({ renderRow: { template: 'hi {{name}}', system: null, model: null, variables: '["name"]' } });
    const res = await renderPrompt(jsonReq({ variables: { name: 'A' }, version: 3 }), env, 'p1', 'pid');
    const body = await res.json() as { prompt: string };
    expect(body.prompt).toBe('hi A');
  });
  it('expands system template too', async () => {
    const env = mkEnv({ renderRow: { template: 'p', system: 'sys {{x}}', model: 'gpt-4o', variables: null } });
    const body = await (await renderPrompt(jsonReq({ variables: { x: 'OK' } }), env, 'p1', 'pid')).json() as { system: string };
    expect(body.system).toBe('sys OK');
  });
  it('returns required as parsed array when variables JSON present', async () => {
    const env = mkEnv({ renderRow: { template: 'p', system: null, model: null, variables: '["a", "b"]' } });
    const body = await (await renderPrompt(jsonReq({ variables: {} }), env, 'p1', 'pid')).json() as { required: string[] };
    expect(body.required).toEqual(['a', 'b']);
  });
  it('400 when expand throws (missing required var)', async () => {
    const env = mkEnv({ renderRow: { template: 'hi {{name}}', system: null, model: null, variables: null } });
    const res = await renderPrompt(jsonReq({ variables: {} }), env, 'p1', 'pid');
    expect(res.status).toBe(400);
  });
});
