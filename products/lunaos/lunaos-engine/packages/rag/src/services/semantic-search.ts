import {
  SemanticSearchEngine,
  SearchQuery,
  SearchResult,
  SearchOptions,
  EmbeddingService,
  VectorDatabase,
  RAGEngineConfig,
  SearchRankingAlgorithm,
} from '../interfaces';
import { EventEmitter } from 'events';
import { SearchCache } from './search-cache';
import { SearchRanker } from './search-ranker';
import { SearchAnalyticsService } from './search-analytics';
import { KeywordSearchService } from './keyword-search';

export class SemanticSearchService extends EventEmitter implements SemanticSearchEngine {
  private embeddingService: EmbeddingService;
  private vectorDatabase: VectorDatabase;
  private config: RAGEngineConfig;
  private cache: SearchCache;
  private ranker: SearchRanker;
  private analytics: SearchAnalyticsService | null;
  private keywordSearch: KeywordSearchService | null;

  constructor(
    embeddingService: EmbeddingService,
    vectorDatabase: VectorDatabase,
    config: RAGEngineConfig,
    options?: {
      cache?: SearchCache;
      ranker?: SearchRanker;
      analytics?: SearchAnalyticsService;
      keywordSearch?: KeywordSearchService;
    }
  ) {
    super();
    this.embeddingService = embeddingService;
    this.vectorDatabase = vectorDatabase;
    this.config = config;
    this.cache = options?.cache ?? new SearchCache();
    this.ranker = options?.ranker ?? new SearchRanker();
    this.analytics = options?.analytics ?? null;
    this.keywordSearch = options?.keywordSearch ?? null;
  }

  async search(query: SearchQuery, options: SearchOptions = {}): Promise<SearchResult[]> {
    const startTime = Date.now();
    this.emit('search:start', { query, options });

    try {
      if (!options.skipCache) {
        const cached = this.cache.getResults(query.text, options as Record<string, unknown>);
        if (cached) {
          this.emit('search:cached', { query, resultCount: cached.length });
          await this.recordAnalytics(query.text, cached.length, Date.now() - startTime, true, 'semantic');
          return cached;
        }
      }

      const queryEmbedding = await this.getOrCacheEmbedding(query.text);
      const indexName = this.config.vectorDatabase.indexName || 'default-index';

      const vectorResults = await this.vectorDatabase.search(
        indexName,
        {
          vector: queryEmbedding,
          topK: options.maxResults || this.config.maxRetrievedDocuments,
          ...(query.filters && { filter: this.buildFilter(query.filters) }),
        },
        { includeMetadata: true, namespace: options.namespace }
      );

      const algorithm = (options.rankingAlgorithm as SearchRankingAlgorithm) || SearchRankingAlgorithm.SEMANTIC;
      let ranked = this.ranker.rankResults(vectorResults, query, algorithm);
      ranked = this.postProcess(ranked, options);

      const searchTime = Date.now() - startTime;
      const results = ranked.map((r, i) => ({ ...r, rank: i + 1, searchTime, query: query.text }));

      this.cache.setResults(query.text, options as Record<string, unknown>, results);
      this.emit('search:complete', { query, resultCount: results.length, searchTime });
      await this.recordAnalytics(query.text, results.length, searchTime, false, 'semantic');

      return results;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown search error';
      this.emit('search:error', { query, error: msg });
      throw new Error(`Search failed: ${msg}`);
    }
  }

  async hybridSearch(
    query: SearchQuery,
    options: SearchOptions & { semanticWeight?: number; keywordWeight?: number } = {}
  ): Promise<SearchResult[]> {
    const startTime = Date.now();
    const sw = options.semanticWeight ?? 0.7;
    const kw = options.keywordWeight ?? 0.3;
    const maxResults = options.maxResults || 10;

    const [semanticResults, keywordResults] = await Promise.all([
      this.search(query, { ...options, maxResults: Math.ceil(maxResults * 1.5) }),
      this.keywordSearch?.search(query.text, maxResults) ?? [],
    ]);

    const combined = this.ranker.combineHybridResults(semanticResults, keywordResults, sw, kw);
    const results = combined.slice(0, maxResults);
    await this.recordAnalytics(query.text, results.length, Date.now() - startTime, false, 'hybrid');
    return results;
  }

  async contextualSearch(
    query: SearchQuery,
    conversationHistory: string[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const expanded = this.expandWithContext(query, conversationHistory);
    const maxResults = Math.ceil((options.maxResults || 10) * 1.2);
    const results = await this.search(expanded, { ...options, maxResults });
    return this.rerankByContext(results, conversationHistory);
  }

  getCache(): SearchCache {
    return this.cache;
  }

  private async getOrCacheEmbedding(text: string): Promise<number[]> {
    const cached = this.cache.getEmbedding(text);
    if (cached) return cached;
    const embedding = await this.embeddingService.generateEmbedding(text);
    this.cache.setEmbedding(text, embedding);
    return embedding;
  }

  private postProcess(results: SearchResult[], options: SearchOptions): SearchResult[] {
    let processed = this.removeDuplicates(results);
    if (options.minRelevanceScore) {
      processed = processed.filter(r => r.score >= options.minRelevanceScore!);
    }
    if (options.maxResults) {
      processed = processed.slice(0, options.maxResults);
    }
    return processed;
  }

  private removeDuplicates(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter(r => {
      const hash = this.hashContent(r.content ?? '');
      if (seen.has(hash)) return false;
      seen.add(hash);
      return true;
    });
  }

  private hashContent(content: string): string {
    let h = 0;
    for (let i = 0; i < content.length; i++) {
      h = ((h << 5) - h) + content.charCodeAt(i);
      h = h & h;
    }
    return h.toString();
  }

  private expandWithContext(query: SearchQuery, history: string[]): SearchQuery {
    if (history.length === 0) return query;
    const contextKeys = this.ranker.extractKeywords(history.slice(-3).join(' '));
    const queryKeys = this.ranker.extractKeywords(query.text);
    const all = [...new Set([...contextKeys, ...queryKeys])];
    return { ...query, text: all.join(' '), originalText: query.text };
  }

  private rerankByContext(results: SearchResult[], history: string[]): SearchResult[] {
    const ctx = history.join(' ');
    return results
      .map(r => {
        const overlap = this.ranker.calculateKeywordOverlap(r.content ?? '', ctx);
        return { ...r, score: r.score * 0.7 + overlap * 0.3 };
      })
      .sort((a, b) => b.score - a.score);
  }

  private buildFilter(filters?: any): any {
    if (!filters) return undefined;
    if (filters.operator && filters.conditions) return filters;
    const c: any[] = [];
    if (filters.documentTypes?.length) c.push({ field: 'type', operator: 'in', value: filters.documentTypes });
    if (filters.tags?.length) c.push({ field: 'tags', operator: 'in', value: filters.tags });
    if (filters.language) c.push({ field: 'language', operator: 'eq', value: filters.language });
    return c.length > 0 ? { operator: 'AND', conditions: c } : undefined;
  }

  private async recordAnalytics(
    queryText: string, resultCount: number, latencyMs: number,
    cacheHit: boolean, searchType: 'semantic' | 'hybrid' | 'keyword' | 'contextual'
  ): Promise<void> {
    try { await this.analytics?.recordSearch({ queryText, resultCount, latencyMs, cacheHit, searchType }); } catch { /* non-critical */ }
  }
}
