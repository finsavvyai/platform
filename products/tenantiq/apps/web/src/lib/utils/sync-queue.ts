/**
 * Offline action queue using IndexedDB + Background Sync.
 *
 * When a non-GET API call fails because the device is offline, callers can
 * enqueue the action here. On reconnect (online event or SW Background Sync),
 * replayQueue() drains the queue and replays each action. Successful replays
 * remove the entry; failures stay queued for the next attempt.
 *
 * Replays are idempotent: callers should ensure the API endpoint accepts a
 * duplicate request without side effects (or supply a request-id header).
 */
import { toasts } from '$stores/toast';

const DB_NAME = 'tenantiq-sync';
const DB_VERSION = 1;
const STORE = 'actions';

export interface QueuedAction {
	id?: number;
	url: string;
	method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
	headers: Record<string, string>;
	body?: string;
	createdAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve, reject) => {
		if (typeof indexedDB === 'undefined') return reject(new Error('No IndexedDB'));
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE)) {
				db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
	return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>): Promise<T> {
	const db = await openDb();
	return new Promise<T>((resolve, reject) => {
		const t = db.transaction(STORE, mode);
		const store = t.objectStore(STORE);
		const result = fn(store);
		t.oncomplete = () => {
			if (result instanceof IDBRequest) resolve(result.result);
			else Promise.resolve(result).then(resolve, reject);
		};
		t.onerror = () => reject(t.error);
		t.onabort = () => reject(t.error);
	});
}

export async function enqueue(action: Omit<QueuedAction, 'id' | 'createdAt'>): Promise<void> {
	const entry: QueuedAction = { ...action, createdAt: Date.now() };
	await tx<IDBValidKey>('readwrite', (store) => store.add(entry));
	toasts.info('Action queued — will sync when online');

	// Register Background Sync if supported (Chrome/Android). iOS Safari relies
	// on the manual `online` event handler in registerOnlineHandler().
	if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
		try {
			const reg = await navigator.serviceWorker.ready;
			await (reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } })
				.sync.register('tenantiq-action-queue');
		} catch {
			// Permission may be denied — fallback to online event.
		}
	}
}

async function getAll(): Promise<QueuedAction[]> {
	return tx<QueuedAction[]>('readonly', (store) => store.getAll() as IDBRequest<QueuedAction[]>);
}

async function remove(id: number): Promise<void> {
	await tx<undefined>('readwrite', (store) => store.delete(id) as IDBRequest<undefined>);
}

let replaying = false;

export async function replayQueue(): Promise<void> {
	if (replaying) return;
	replaying = true;
	try {
		const items = await getAll();
		if (items.length === 0) return;
		toasts.info(`Syncing ${items.length} queued action${items.length > 1 ? 's' : ''}…`);
		let success = 0;
		let fail = 0;
		for (const item of items) {
			try {
				const res = await fetch(item.url, {
					method: item.method,
					headers: item.headers,
					body: item.body,
					credentials: 'include',
				});
				if (res.ok && item.id != null) {
					await remove(item.id);
					success++;
				} else {
					fail++;
				}
			} catch {
				fail++;
			}
		}
		if (success > 0) toasts.success(`Synced ${success} action${success > 1 ? 's' : ''}`);
		if (fail > 0) toasts.warning(`${fail} action${fail > 1 ? 's' : ''} still queued — will retry`);
	} finally {
		replaying = false;
	}
}

export function registerOnlineHandler(): void {
	if (typeof window === 'undefined') return;
	window.addEventListener('online', () => { replayQueue().catch(() => {}); });
}
