import { vi } from 'vitest';
import type { Env } from '../types.js';

/**
 * Create a mock Env bindings object for tests
 */
export function createMockEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    CACHE: createMockKV(),
    ENVIRONMENT: 'test',
    LEMONSQUEEZY_API_KEY: 'ls_test_fake',
    LEMONSQUEEZY_WEBHOOK_SECRET: 'ls-webhook-secret',
    RESEND_API_KEY: 'resend_test_fake',
    TF_LS_VARIANT_PRO: '100',
    TF_LS_VARIANT_TEAM: '200',
    TF_LS_VARIANT_ENTERPRISE: '300',
    TF_LS_PRODUCT_ID: '999',
    CF_API_TOKEN: 'cf_test_fake',
    CF_ZONE_ID: 'zone_test_fake',
    INTERNAL_API_SECRET: 'test_internal_secret',
    ...overrides,
  };
}

/**
 * Create a mock KV namespace
 */
export function createMockKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async () => ({
      keys: [],
      list_complete: true,
      cacheStatus: null,
    })),
    getWithMetadata: vi.fn(async () => ({
      value: null,
      metadata: null,
      cacheStatus: null,
    })),
  } as unknown as KVNamespace;
}

/**
 * Create a mock Drizzle DB that returns controlled data.
 * Chainable AND thenable to match Drizzle's query builder API.
 */
export function createMockDb() {
  let selectResults: unknown[][] = [[]];
  let selectCallIndex = 0;

  const consumeResult = () => {
    const result = selectResults[selectCallIndex] || [];
    selectCallIndex++;
    return result;
  };

  const makeThenable = (): Record<string, unknown> => {
    const obj: Record<string, unknown> = {};
    obj.from = vi.fn(() => makeThenable());
    obj.where = vi.fn(() => makeThenable());
    obj.orderBy = vi.fn(() => makeThenable());
    obj.limit = vi.fn(() => makeThenable());
    obj.innerJoin = vi.fn(() => makeThenable());
    obj.leftJoin = vi.fn(() => makeThenable());
    obj.groupBy = vi.fn(() => makeThenable());
    obj.having = vi.fn(() => makeThenable());
    obj.$dynamic = vi.fn(() => makeThenable());
    obj.then = (
      resolve: (value: unknown) => unknown,
      reject?: (err: unknown) => unknown,
    ) => {
      return Promise.resolve().then(() => {
        try {
          return resolve(consumeResult());
        } catch (err) {
          if (reject) return reject(err);
          throw err;
        }
      });
    };
    return obj;
  };

  const insertChain = {
    values: vi.fn().mockResolvedValue(undefined),
  };

  const updateSetChain = {
    where: vi.fn().mockResolvedValue(undefined),
  };

  const updateChain = {
    set: vi.fn().mockReturnValue(updateSetChain),
  };

  const deleteChain = {
    where: vi.fn().mockResolvedValue(undefined),
  };

  return {
    select: vi.fn(() => makeThenable()),
    insert: vi.fn().mockReturnValue(insertChain),
    update: vi.fn().mockReturnValue(updateChain),
    delete: vi.fn().mockReturnValue(deleteChain),
    _insertChain: insertChain,
    _updateChain: updateChain,
    _updateSetChain: updateSetChain,
    _deleteChain: deleteChain,
    _setSelectResult: (data: unknown[]) => {
      selectResults = [data];
      selectCallIndex = 0;
    },
    _setSelectResults: (results: unknown[][]) => {
      selectResults = results;
      selectCallIndex = 0;
    },
    _reset: () => {
      selectResults = [[]];
      selectCallIndex = 0;
      vi.clearAllMocks();
    },
  };
}
