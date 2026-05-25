/**
 * Binding storage adapters.
 *
 * `IndexedDBBindingStorage` is the production path — IndexedDB
 * structured-clones the `CryptoKey` reference natively, so the
 * non-extractable private key never leaves the browser key store.
 *
 * `MemoryBindingStorage` is for tests and for SSR-rendered pages
 * before the browser bootstrap finishes.
 */

import type { BindingStorage, BoundSessionRecord } from '../types.js';

const DB_NAME = 'tokenforge';
const DB_VERSION = 1;
const STORE = 'bindings';
const KEY = 'current';

export class MemoryBindingStorage implements BindingStorage {
  private record: BoundSessionRecord | null = null;

  async putSession(record: BoundSessionRecord): Promise<void> {
    this.record = record;
  }

  async getSession(): Promise<BoundSessionRecord | null> {
    return this.record;
  }

  async updateChallenge(challenge: string): Promise<void> {
    if (this.record) this.record.lastChallenge = challenge;
  }

  async clear(): Promise<void> {
    this.record = null;
  }
}

export class IndexedDBBindingStorage implements BindingStorage {
  constructor(private readonly factory: IDBFactory = globalThis.indexedDB) {}

  async putSession(record: BoundSessionRecord): Promise<void> {
    const db = await this.open();
    await tx(db, 'readwrite', (store) => store.put(record, KEY));
  }

  async getSession(): Promise<BoundSessionRecord | null> {
    const db = await this.open();
    return await tx(db, 'readonly', (store) => store.get(KEY)) as BoundSessionRecord | null;
  }

  async updateChallenge(challenge: string): Promise<void> {
    const existing = await this.getSession();
    if (!existing) return;
    existing.lastChallenge = challenge;
    await this.putSession(existing);
  }

  async clear(): Promise<void> {
    const db = await this.open();
    await tx(db, 'readwrite', (store) => store.delete(KEY));
  }

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = this.factory.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
}

function tx<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const req = work(store);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export function defaultStorage(): BindingStorage {
  return typeof globalThis.indexedDB !== 'undefined'
    ? new IndexedDBBindingStorage()
    : new MemoryBindingStorage();
}
