import type { StoredDevice } from '../shared/types-internal.js';

const DB_NAME = 'tokenforge';
const STORE_NAME = 'device_keys';

/**
 * Store keypair in IndexedDB.
 * IndexedDB can store CryptoKey objects directly (structured clone).
 * The non-extractable property is preserved across storage.
 */
export async function storeDeviceKey(device: StoredDevice): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(device, 'current');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Retrieve stored keypair from IndexedDB.
 * Returns the CryptoKey handle — still non-extractable.
 */
export async function getDeviceKey(): Promise<StoredDevice | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get('current');
    req.onsuccess = () => resolve((req.result as StoredDevice) || null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Clear all stored keys (on logout or re-bind).
 */
export async function clearDeviceKeys(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
