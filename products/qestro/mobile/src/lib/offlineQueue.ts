import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'qestro-offline-queue' });

export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  body?: string;
  headers?: Record<string, string>;
  createdAt: number;
}

const QUEUE_KEY = 'pending-requests';
const CACHE_PREFIX = 'cache:';

export function getQueue(): QueuedRequest[] {
  const raw = storage.getString(QUEUE_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as QueuedRequest[]; }
  catch { return []; }
}

export function enqueue(request: Omit<QueuedRequest, 'id' | 'createdAt'>): void {
  const queue = getQueue();
  queue.push({ ...request, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, createdAt: Date.now() });
  storage.set(QUEUE_KEY, JSON.stringify(queue));
}

export function dequeue(id: string): void {
  const queue = getQueue().filter((r) => r.id !== id);
  storage.set(QUEUE_KEY, JSON.stringify(queue));
}

export function clearQueue(): void {
  storage.remove(QUEUE_KEY);
}

export async function replayQueue(): Promise<{ success: number; failed: number }> {
  const queue = getQueue();
  let success = 0;
  let failed = 0;
  for (const req of queue) {
    try {
      const res = await fetch(req.url, { method: req.method, body: req.body, headers: req.headers });
      if (res.ok) { dequeue(req.id); success++; }
      else { failed++; }
    } catch { failed++; }
  }
  return { success, failed };
}

export function cacheResponse(key: string, data: unknown): void {
  storage.set(`${CACHE_PREFIX}${key}`, JSON.stringify({ data, cachedAt: Date.now() }));
}

export function getCachedResponse<T>(key: string, maxAgeMs = 300000): T | null {
  const raw = storage.getString(`${CACHE_PREFIX}${key}`);
  if (!raw) return null;
  try {
    const { data, cachedAt } = JSON.parse(raw) as { data: T; cachedAt: number };
    if (Date.now() - cachedAt > maxAgeMs) return null;
    return data;
  } catch { return null; }
}
