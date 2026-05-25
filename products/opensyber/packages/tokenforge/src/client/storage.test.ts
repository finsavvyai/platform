/**
 * Unit tests for `client/storage.ts`. Vitest's default node env does not
 * provide IndexedDB, so we wire a minimal in-memory mock matching the
 * narrow surface the production code uses (open, put, get, clear,
 * createObjectStore + the request/transaction event hooks).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { StoredDevice } from '../shared/types-internal.js';

interface PendingReq<T> {
  result?: T;
  error?: Error | null;
  onsuccess?: () => void;
  onerror?: () => void;
}

function makeReq<T>(resolve: T): PendingReq<T> {
  const req: PendingReq<T> = {};
  queueMicrotask(() => {
    req.result = resolve;
    req.onsuccess?.();
  });
  return req;
}

interface FakeStore {
  store: Map<string, unknown>;
  put: (value: unknown, key: string) => PendingReq<undefined>;
  get: (key: string) => PendingReq<unknown>;
  clear: () => PendingReq<undefined>;
}

function makeStore(map: Map<string, unknown>): FakeStore {
  return {
    store: map,
    put: (value, key) => {
      map.set(key, value);
      return makeReq(undefined);
    },
    get: (key) => makeReq(map.get(key)),
    clear: () => {
      map.clear();
      return makeReq(undefined);
    },
  };
}

interface FakeDb {
  closed: boolean;
  transaction: (name: string, _mode: string) => { objectStore: () => FakeStore; oncomplete?: () => void };
  close: () => void;
  createObjectStore: (name: string) => void;
}

function makeFakeIndexedDB() {
  const stores = new Map<string, Map<string, unknown>>();

  const open = (_name: string, _version: number) => {
    const req: PendingReq<FakeDb> & { onupgradeneeded?: () => void } = {};
    queueMicrotask(() => {
      const map = stores.get('device_keys') ?? new Map<string, unknown>();
      stores.set('device_keys', map);
      const db: FakeDb = {
        closed: false,
        transaction: () => {
          const tx: { objectStore: () => FakeStore; oncomplete?: () => void } = {
            objectStore: () => makeStore(map),
          };
          queueMicrotask(() => tx.oncomplete?.());
          return tx;
        },
        close: function () { this.closed = true; },
        createObjectStore: (name: string) => {
          if (!stores.has(name)) stores.set(name, new Map());
        },
      };
      // Real IndexedDB sets req.result before onupgradeneeded fires.
      req.result = db;
      const wasFreshlyCreated = !stores.has('_initialized');
      if (wasFreshlyCreated) {
        stores.set('_initialized', new Map());
        req.onupgradeneeded?.();
      }
      req.onsuccess?.();
    });
    return req;
  };

  return { open, stores };
}

let fakeIDB: ReturnType<typeof makeFakeIndexedDB>;

beforeEach(async () => {
  fakeIDB = makeFakeIndexedDB();
  vi.stubGlobal('indexedDB', { open: fakeIDB.open });
});

afterEach(() => { vi.unstubAllGlobals(); });

const fakeStored: StoredDevice = {
  deviceId: 'dev_1',
  keyPair: { privateKey: {} as CryptoKey, publicKey: {} as CryptoKey } as CryptoKeyPair,
  createdAt: 1_700_000_000_000,
  sessionId: 'sess_1',
};

describe('storage.ts (IndexedDB-backed)', () => {
  it('storeDeviceKey persists under the "current" key', async () => {
    const { storeDeviceKey } = await import('./storage.js');
    await storeDeviceKey(fakeStored);
    const map = fakeIDB.stores.get('device_keys')!;
    expect(map.get('current')).toEqual(fakeStored);
  });

  it('getDeviceKey returns null when nothing has been stored', async () => {
    const { getDeviceKey } = await import('./storage.js');
    const r = await getDeviceKey();
    expect(r).toBeNull();
  });

  it('getDeviceKey returns the stored device after storeDeviceKey', async () => {
    const { storeDeviceKey, getDeviceKey } = await import('./storage.js');
    await storeDeviceKey(fakeStored);
    const r = await getDeviceKey();
    expect(r).toEqual(fakeStored);
  });

  it('clearDeviceKeys empties the store so getDeviceKey returns null again', async () => {
    const { storeDeviceKey, getDeviceKey, clearDeviceKeys } = await import('./storage.js');
    await storeDeviceKey(fakeStored);
    await clearDeviceKeys();
    const r = await getDeviceKey();
    expect(r).toBeNull();
  });

  it('storeDeviceKey overwrites an existing entry (single "current" slot, not append)', async () => {
    const { storeDeviceKey, getDeviceKey } = await import('./storage.js');
    await storeDeviceKey(fakeStored);
    const newer: StoredDevice = { ...fakeStored, deviceId: 'dev_2', sessionId: 'sess_2' };
    await storeDeviceKey(newer);
    const r = await getDeviceKey();
    expect(r?.deviceId).toBe('dev_2');
    expect(r?.sessionId).toBe('sess_2');
  });
});
