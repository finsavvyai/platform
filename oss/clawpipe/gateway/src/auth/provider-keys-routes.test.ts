/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handlePutProviderKey, handleDeleteProviderKey, handleListProviderKeys } from './provider-keys-routes';
import type { Env } from '../types';

vi.mock('./rbac', () => ({
  getAuthUser: vi.fn(),
  checkProjectAccess: vi.fn(),
}));
vi.mock('./provider-keys', () => ({
  storeProviderKey: vi.fn().mockResolvedValue(undefined),
  deleteProviderKey: vi.fn().mockResolvedValue(undefined),
}));

import { getAuthUser, checkProjectAccess } from './rbac';
import { storeProviderKey } from './provider-keys';

const SECRET = 'this-is-a-32-char-secret-abcdefgh';

function makeEnv(extra: Partial<Env> = {}): Env {
  const store: Record<string, unknown[]> = {};
  return {
    PROVIDER_KEY_ENCRYPTION_SECRET: SECRET,
    DB: {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          run: async () => { store[sql] = args; },
          first: async <T>(): Promise<T | null> => {
            if (sql.includes('SELECT id FROM projects')) return { id: args[0] } as T;
            return null;
          },
          all: async <T>(): Promise<{ results: T[] }> => {
            if (sql.includes('SELECT provider, created_at')) {
              return { results: [{ provider: 'openai', created_at: '2026-05-02' }] as unknown as T[] };
            }
            return { results: [] };
          },
        }),
      }),
    },
    ...extra,
  } as unknown as Env;
}

function jsonReq(body: unknown, method = 'PUT'): Request {
  return new Request('https://x.test/v1/projects/proj-1/provider-keys/openai', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('handlePutProviderKey', () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockResolvedValue({ sub: 'user-1', email: 'a@b.com', name: 'A' } as ReturnType<typeof vi.mocked<typeof getAuthUser>> extends Promise<infer T> ? T : never);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    vi.mocked(storeProviderKey).mockResolvedValue(undefined);
  });

  it('201 for admin storing a key', async () => {
    const res = await handlePutProviderKey(jsonReq({ value: 'sk-real' }), makeEnv(), 'proj-1', 'openai');
    expect(res.status).toBe(201);
    const body = await res.json() as { ok: boolean; provider: string };
    expect(body.ok).toBe(true);
    expect(body.provider).toBe('openai');
  });

  it('403 when user is not admin', async () => {
    vi.mocked(checkProjectAccess).mockResolvedValue(false);
    const res = await handlePutProviderKey(jsonReq({ value: 'sk-x' }), makeEnv(), 'proj-1', 'openai');
    expect(res.status).toBe(403);
  });

  it('401 when not authenticated', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    const res = await handlePutProviderKey(jsonReq({ value: 'sk-x' }), makeEnv(), 'proj-1', 'openai');
    expect(res.status).toBe(401);
  });

  it('404 when project not found', async () => {
    const env = makeEnv();
    // Override DB to return null for projects query
    (env.DB as unknown as { prepare: (s: string) => unknown }).prepare = (sql: string) => ({
      bind: (..._args: unknown[]) => ({
        first: async () => null,
        run: async () => ({}),
        all: async () => ({ results: [] }),
      }),
    });
    const res = await handlePutProviderKey(jsonReq({ value: 'sk-x' }), env, 'unknown-proj', 'openai');
    expect(res.status).toBe(404);
  });

  it('400 for unknown provider', async () => {
    const res = await handlePutProviderKey(jsonReq({ value: 'sk-x' }), makeEnv(), 'proj-1', 'fakeprovider');
    expect(res.status).toBe(400);
  });

  it('400 when value is missing', async () => {
    const res = await handlePutProviderKey(jsonReq({}), makeEnv(), 'proj-1', 'openai');
    expect(res.status).toBe(400);
  });

  it('503 when encryption secret not configured', async () => {
    const env = makeEnv({ PROVIDER_KEY_ENCRYPTION_SECRET: undefined });
    const res = await handlePutProviderKey(jsonReq({ value: 'sk-x' }), env, 'proj-1', 'openai');
    expect(res.status).toBe(503);
  });
});

describe('handleDeleteProviderKey', () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockResolvedValue({ sub: 'user-1', email: 'a@b.com', name: 'A' } as ReturnType<typeof vi.mocked<typeof getAuthUser>> extends Promise<infer T> ? T : never);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
  });

  it('204 on successful delete', async () => {
    const req = new Request('https://x.test/v1/projects/proj-1/provider-keys/openai', { method: 'DELETE' });
    const res = await handleDeleteProviderKey(req, makeEnv(), 'proj-1', 'openai');
    expect(res.status).toBe(204);
  });

  it('403 when not admin', async () => {
    vi.mocked(checkProjectAccess).mockResolvedValue(false);
    const req = new Request('https://x.test/v1/projects/proj-1/provider-keys/openai', { method: 'DELETE' });
    const res = await handleDeleteProviderKey(req, makeEnv(), 'proj-1', 'openai');
    expect(res.status).toBe(403);
  });
});

describe('handleListProviderKeys', () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockResolvedValue({ sub: 'user-1', email: 'a@b.com', name: 'A' } as ReturnType<typeof vi.mocked<typeof getAuthUser>> extends Promise<infer T> ? T : never);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
  });

  it('returns provider names and created_at, never plaintext', async () => {
    const req = new Request('https://x.test/v1/projects/proj-1/provider-keys', { method: 'GET' });
    const res = await handleListProviderKeys(req, makeEnv(), 'proj-1');
    expect(res.status).toBe(200);
    const body = await res.json() as { providers: Array<{ provider: string; created_at: string }> };
    expect(body.providers).toHaveLength(1);
    expect(body.providers[0].provider).toBe('openai');
    // Ensure no plaintext / ciphertext fields leaked
    const keys = Object.keys(body.providers[0]);
    expect(keys).not.toContain('value');
    expect(keys).not.toContain('ciphertext_b64');
    expect(keys).not.toContain('nonce_b64');
  });

  it('403 when not admin', async () => {
    vi.mocked(checkProjectAccess).mockResolvedValue(false);
    const req = new Request('https://x.test/v1/projects/proj-1/provider-keys', { method: 'GET' });
    const res = await handleListProviderKeys(req, makeEnv(), 'proj-1');
    expect(res.status).toBe(403);
  });
});
