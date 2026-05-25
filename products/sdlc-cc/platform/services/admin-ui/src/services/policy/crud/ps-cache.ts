// @ts-nocheck
/**
 * Cache helpers for PolicyService
 */

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

export function getFromCache<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

export function setCache<T>(key: string, data: T, ttl: number = CACHE_TTL): void {
  cache.set(key, { data, timestamp: Date.now(), ttl });
}

export function clearCachePattern(pattern: string): void {
  const regex = new RegExp(pattern.replace(/\*/g, '.*'));
  for (const key of cache.keys()) {
    if (regex.test(key)) {
      cache.delete(key);
    }
  }
}

export function isRateLimited(key: string, limit: number, window: number): boolean {
  const now = Date.now();
  const windowStart = now - window * 1000;
  const requests = cache.get(`${key}:requests`)?.data || [];
  const validRequests = requests.filter((timestamp: number) => timestamp > windowStart);

  if (validRequests.length >= limit) return true;

  validRequests.push(now);
  setCache(`${key}:requests`, validRequests, window * 1000);
  return false;
}
