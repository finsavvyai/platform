/**
 * SemanticCache — embedding-based similarity cache (gateway-local copy).
 *
 * Unlike the hash-based Cache, this matches prompts by meaning.
 * "Explain recursion" and "What is recursion?" hit the same entry.
 * Falls back to the regular cache when embeddings are unavailable.
 */

export interface SemanticCacheConfig {
  similarityThreshold?: number;
  maxEntries?: number;
  ttlMs?: number;
  embeddingFn?: (text: string) => Promise<number[]>;
}

interface CacheEntry {
  text: string;
  embedding: number[];
  response: string;
  createdAt: number;
  hits: number;
}

export class SemanticCache {
  private entries: CacheEntry[] = [];
  private threshold: number;
  private maxEntries: number;
  private ttlMs: number;
  private embed: ((text: string) => Promise<number[]>) | null;
  private stats = { hits: 0, misses: 0, semanticHits: 0 };

  constructor(config: SemanticCacheConfig = {}) {
    this.threshold = config.similarityThreshold ?? 0.92;
    this.maxEntries = config.maxEntries ?? 5000;
    this.ttlMs = config.ttlMs ?? 300_000;
    this.embed = config.embeddingFn ?? null;
  }

  /** Look up a prompt by semantic similarity. */
  async get(prompt: string): Promise<string | null> {
    if (!this.embed) return null;
    this.prune();
    const embedding = await this.embed(prompt);
    let bestMatch: CacheEntry | null = null;
    let bestScore = 0;
    for (const entry of this.entries) {
      const score = cosineSimilarity(embedding, entry.embedding);
      if (score >= this.threshold && score > bestScore) { bestScore = score; bestMatch = entry; }
    }
    if (bestMatch) { bestMatch.hits++; this.stats.hits++; this.stats.semanticHits++; return bestMatch.response; }
    this.stats.misses++;
    return null;
  }

  /** Store a prompt-response pair with its embedding. */
  async set(prompt: string, response: string): Promise<void> {
    if (!this.embed) return;
    if (this.entries.length >= this.maxEntries) this.evict();
    const embedding = await this.embed(prompt);
    this.entries.push({ text: prompt, embedding, response, createdAt: Date.now(), hits: 0 });
  }

  isAvailable(): boolean { return this.embed !== null; }

  private prune(): void {
    const cutoff = Date.now() - this.ttlMs;
    this.entries = this.entries.filter((e) => e.createdAt >= cutoff);
  }

  private evict(): void {
    this.entries.sort((a, b) => a.hits - b.hits);
    this.entries = this.entries.slice(Math.ceil(this.entries.length * 0.1));
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i]; }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
