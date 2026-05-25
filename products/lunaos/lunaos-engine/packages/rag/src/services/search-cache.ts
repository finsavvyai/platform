import { SearchResult, SearchCacheStats } from '../interfaces';

interface CacheEntry {
  results: SearchResult[];
  timestamp: number;
}

export class SearchCache {
  private resultCache: Map<string, CacheEntry> = new Map();
  private embeddingCache: Map<string, number[]> = new Map();
  private maxSize: number;
  private ttlMs: number;
  private hitCount = 0;
  private missCount = 0;
  private embeddingMaxSize: number;

  constructor(options?: { maxSize?: number; ttlMs?: number; embeddingMaxSize?: number }) {
    this.maxSize = options?.maxSize ?? 1000;
    this.ttlMs = options?.ttlMs ?? 5 * 60 * 1000;
    this.embeddingMaxSize = options?.embeddingMaxSize ?? 500;
  }

  getResults(query: string, filters?: Record<string, unknown>): SearchResult[] | null {
    const key = this.buildKey(query, filters);
    const entry = this.resultCache.get(key);
    if (!entry) {
      this.missCount++;
      return null;
    }
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.resultCache.delete(key);
      this.missCount++;
      return null;
    }
    this.hitCount++;
    return entry.results;
  }

  setResults(query: string, filters: Record<string, unknown> | undefined, results: SearchResult[]): void {
    const key = this.buildKey(query, filters);
    if (this.resultCache.size >= this.maxSize) {
      this.evictOldest();
    }
    this.resultCache.set(key, { results, timestamp: Date.now() });
  }

  getEmbedding(text: string): number[] | null {
    return this.embeddingCache.get(text) ?? null;
  }

  setEmbedding(text: string, embedding: number[]): void {
    if (this.embeddingCache.size >= this.embeddingMaxSize) {
      const firstKey = this.embeddingCache.keys().next().value;
      if (firstKey) this.embeddingCache.delete(firstKey);
    }
    this.embeddingCache.set(text, embedding);
  }

  clear(): void {
    this.resultCache.clear();
    this.embeddingCache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  getStats(): SearchCacheStats {
    const total = this.hitCount + this.missCount;
    return {
      entries: this.resultCache.size,
      maxSize: this.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: total > 0 ? this.hitCount / total : 0,
      embeddingCacheSize: this.embeddingCache.size,
    };
  }

  private buildKey(query: string, filters?: Record<string, unknown>): string {
    const filterStr = filters ? JSON.stringify(filters) : '';
    return `${query}::${filterStr}`;
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.resultCache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    if (oldestKey) this.resultCache.delete(oldestKey);
  }
}
