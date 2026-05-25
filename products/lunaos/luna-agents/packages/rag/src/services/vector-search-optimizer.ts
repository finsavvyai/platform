/**
 * Vector Search Optimizer — Task 2.3
 * Hybrid search (semantic + keyword), RRF re-ranking, index optimization.
 * Target: < 200ms for 100K vectors.
 */

import type {
  SearchResult,
  HybridSearchOptions,
  HybridSearchResult,
  VectorQuery,
} from '../interfaces/index.js';

export interface VectorSearchConfig {
  /** Weight toward semantic search [0–1]. 1 = pure semantic, 0 = pure keyword. */
  alpha: number;
  /** Reciprocal Rank Fusion k-constant (typically 60). */
  rrfK: number;
  /** Maximum results returned from each search leg. */
  topK: number;
  /** Cache TTL in ms. 0 = disabled. */
  cacheTtl: number;
}

const DEFAULT_CONFIG: VectorSearchConfig = {
  alpha: 0.7,
  rrfK: 60,
  topK: 20,
  cacheTtl: 30_000,
};

type SearchFn = (query: VectorQuery) => Promise<SearchResult[]>;
type KeywordFn = (query: string, topK: number) => Promise<SearchResult[]>;

interface QueryCache {
  results: SearchResult[];
  expiresAt: number;
}

/**
 * Combines semantic vector search with BM25-style keyword search using
 * Reciprocal Rank Fusion for re-ranking, keeping latency < 200ms.
 */
export class VectorSearchOptimizer {
  private config: VectorSearchConfig;
  private cache = new Map<string, QueryCache>();

  constructor(config: Partial<VectorSearchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Hybrid search: runs semantic and keyword legs in parallel then merges.
   */
  async hybridSearch(
    query: string,
    semanticFn: SearchFn,
    keywordFn: KeywordFn,
    options: Partial<HybridSearchOptions> = {}
  ): Promise<HybridSearchResult> {
    const alpha = options.semanticWeight ?? this.config.alpha;
    const topK = this.config.topK;

    const cacheKey = `hybrid:${query}:${alpha}`;
    const cached = this.getCache(cacheKey);
    if (cached) {
      return {
        semanticResults: [],
        keywordResults: [],
        combinedResults: cached,
      };
    }

    const [semanticResults, keywordResults] = await Promise.all([
      semanticFn({ text: query, topK }),
      keywordFn(query, topK),
    ]);

    const combinedResults = this.reciprocalRankFusion(
      semanticResults,
      keywordResults,
      alpha,
      options.rrf ?? this.config.rrfK
    );

    this.setCache(cacheKey, combinedResults);

    return { semanticResults, keywordResults, combinedResults };
  }

  /**
   * Re-rank a result list using Reciprocal Rank Fusion of two result sets.
   * RRF score = Σ 1 / (k + rank_i). Higher score = more relevant.
   */
  reciprocalRankFusion(
    semanticResults: SearchResult[],
    keywordResults: SearchResult[],
    alpha = this.config.alpha,
    k = this.config.rrfK
  ): SearchResult[] {
    const scoreMap = new Map<string, { doc: SearchResult; score: number }>();

    const applyRRF = (results: SearchResult[], weight: number) => {
      results.forEach((result, rank) => {
        const id = result.document.id;
        const rrfScore = weight / (k + rank + 1);
        const existing = scoreMap.get(id);
        if (existing) {
          existing.score += rrfScore;
        } else {
          scoreMap.set(id, { doc: result, score: rrfScore });
        }
      });
    };

    applyRRF(semanticResults, alpha);
    applyRRF(keywordResults, 1 - alpha);

    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .map((entry, idx) => ({
        ...entry.doc,
        score: entry.score,
        rank: idx,
        relevanceScore: entry.score,
      }));
  }

  /**
   * Deduplicate and optimize an index's document list by removing near-
   * duplicates (cosine similarity > threshold) to improve search quality.
   */
  deduplicateResults(
    results: SearchResult[],
    similarityThreshold = 0.95
  ): SearchResult[] {
    const kept: SearchResult[] = [];

    for (const candidate of results) {
      const isDuplicate = kept.some((existing) => {
        if (!existing.document.embedding || !candidate.document.embedding) {
          return false;
        }
        const sim = this.cosineSimilarity(
          existing.document.embedding,
          candidate.document.embedding
        );
        return sim > similarityThreshold;
      });

      if (!isDuplicate) {
        kept.push(candidate);
      }
    }

    return kept;
  }

  /** Cosine similarity between two equal-length vectors. */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  /** Clear expired cache entries. */
  pruneCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  private getCache(key: string): SearchResult[] | null {
    if (this.config.cacheTtl === 0) return null;
    const entry = this.cache.get(key);
    if (!entry || entry.expiresAt < Date.now()) return null;
    return entry.results;
  }

  private setCache(key: string, results: SearchResult[]): void {
    if (this.config.cacheTtl === 0) return;
    this.cache.set(key, {
      results,
      expiresAt: Date.now() + this.config.cacheTtl,
    });
  }
}
