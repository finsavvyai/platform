import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SemanticSearchService } from './semantic-search';
import { SearchCache } from './search-cache';
import { SearchRanker } from './search-ranker';
import { SearchAnalyticsService } from './search-analytics';
import { KeywordSearchService } from './keyword-search';
import { EmbeddingService, VectorDatabase, RAGEngineConfig, SearchRankingAlgorithm } from '../interfaces';

function createMockEmbedding(): EmbeddingService {
  return {
    generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    generateBatchEmbeddings: vi.fn().mockResolvedValue([[0.1, 0.2]]),
    getDimension: vi.fn().mockReturnValue(3),
    getModelInfo: vi.fn().mockReturnValue({ name: 'mock', dimension: 3, maxTokens: 100, capabilities: [] }),
  };
}

function createMockVectorDB(): VectorDatabase {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    createIndex: vi.fn(),
    indexDocuments: vi.fn(),
    search: vi.fn().mockResolvedValue([
      { id: 'r1', score: 0.95, rank: 1, content: 'result one', document: { id: 'r1', content: 'result one', metadata: { type: 'text' }, source: 'local', createdAt: new Date(), updatedAt: new Date() } },
      { id: 'r2', score: 0.85, rank: 2, content: 'result two', document: { id: 'r2', content: 'result two', metadata: { type: 'text' }, source: 'local', createdAt: new Date(), updatedAt: new Date() } },
    ]),
    deleteDocument: vi.fn(),
    updateDocument: vi.fn(),
    get: vi.fn(),
    getIndexStats: vi.fn(),
    listIndices: vi.fn(),
  };
}

function createMockConfig(): RAGEngineConfig {
  return {
    vectorDatabase: { provider: 'cloudflare', dimension: 3, metric: 'cosine', indexName: 'test' },
    embeddingService: { provider: 'cloudflare', model: 'test', dimension: 3, batchSize: 10, cache: true },
    documentProcessor: {} as any,
    documentProcessing: {} as any,
    cache: { enabled: true, provider: 'memory', ttl: 3600, maxSize: 100 },
    security: {} as any,
    monitoring: {} as any,
    maxRetrievedDocuments: 10,
  };
}

describe('SemanticSearchService', () => {
  let service: SemanticSearchService;
  let embeddingService: EmbeddingService;
  let vectorDB: VectorDatabase;
  let cache: SearchCache;
  let analytics: SearchAnalyticsService;
  let keywordSearch: KeywordSearchService;

  beforeEach(() => {
    embeddingService = createMockEmbedding();
    vectorDB = createMockVectorDB();
    cache = new SearchCache();
    analytics = { recordSearch: vi.fn().mockResolvedValue(undefined) } as any;
    keywordSearch = { search: vi.fn().mockResolvedValue([]) } as any;

    service = new SemanticSearchService(
      embeddingService, vectorDB, createMockConfig(),
      { cache, ranker: new SearchRanker(), analytics, keywordSearch }
    );
  });

  describe('search', () => {
    it('generates embedding and queries vector DB', async () => {
      const results = await service.search({ text: 'hello world' });
      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith('hello world');
      expect(vectorDB.search).toHaveBeenCalled();
      expect(results.length).toBe(2);
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    });

    it('returns cached results on second call', async () => {
      await service.search({ text: 'cached query' });
      const result2 = await service.search({ text: 'cached query' });
      // Embedding should only be generated once
      expect(embeddingService.generateEmbedding).toHaveBeenCalledTimes(1);
      expect(result2.length).toBe(2);
    });

    it('skips cache when skipCache is true', async () => {
      await service.search({ text: 'q' });
      await service.search({ text: 'q' }, { skipCache: true });
      expect(embeddingService.generateEmbedding).toHaveBeenCalledTimes(1); // embedding is still cached
      expect(vectorDB.search).toHaveBeenCalledTimes(2); // but vector search runs twice
    });

    it('records analytics on search', async () => {
      await service.search({ text: 'analytics test' });
      expect(analytics.recordSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          queryText: 'analytics test',
          searchType: 'semantic',
          cacheHit: false,
        })
      );
    });

    it('records cache hit in analytics', async () => {
      await service.search({ text: 'hit test' });
      vi.mocked(analytics.recordSearch).mockClear();
      await service.search({ text: 'hit test' });
      expect(analytics.recordSearch).toHaveBeenCalledWith(
        expect.objectContaining({ cacheHit: true })
      );
    });
  });

  describe('hybridSearch', () => {
    it('combines semantic and keyword results', async () => {
      vi.mocked(keywordSearch.search).mockResolvedValue([
        { id: 'k1', score: 0.8, rank: 1, content: 'keyword match', document: { id: 'k1', content: 'keyword match', metadata: { type: 'text' } as any, source: 'local' as any, createdAt: new Date(), updatedAt: new Date() } },
      ]);

      const results = await service.hybridSearch({ text: 'hybrid test' });
      expect(keywordSearch.search).toHaveBeenCalled();
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('contextualSearch', () => {
    it('expands query with conversation history', async () => {
      const results = await service.contextualSearch(
        { text: 'current question' },
        ['previous topic about auth', 'discussed login flow']
      );
      expect(results.length).toBe(2);
      // The expanded query should include context keywords
      expect(embeddingService.generateEmbedding).toHaveBeenCalled();
    });
  });

  describe('getCache', () => {
    it('exposes cache for external stats', () => {
      const c = service.getCache();
      expect(c).toBe(cache);
      expect(c.getStats().entries).toBe(0);
    });
  });

  describe('embedding caching', () => {
    it('caches embeddings for repeated queries', async () => {
      await service.search({ text: 'same query' });
      await service.search({ text: 'same query' }, { skipCache: true });
      // Embedding generated only once, reused from cache
      expect(embeddingService.generateEmbedding).toHaveBeenCalledTimes(1);
    });
  });
});
