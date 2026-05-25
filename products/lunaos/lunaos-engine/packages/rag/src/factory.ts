import {
  RAGEngine,
  DocumentProcessor,
  SemanticSearchEngine,
  ResponseGenerator,
  ContextBuilder,
  EmbeddingService,
  VectorDatabase,
  RAGEngineConfig,
  VectorDatabaseProvider,
  LLMProvider,
  EmbeddingProvider
} from './interfaces';
import { DocumentProcessorService } from './services/document-processor';
import { SemanticSearchService } from './services/semantic-search';
import { ResponseGeneratorService } from './services/response-generator';
import { ContextBuilderService } from './services/context-builder';
import { VectorDatabaseService } from './services/vector-database';
import { RAGEngineService } from './services/rag-engine';
// Pinecone and Weaviate providers removed — not compatible with Cloudflare Workers bundle
// Use CloudflareVectorizeProvider (VectorDatabaseProvider.CLOUDFLARE) instead
import { OpenAIEmbeddingService } from './services/embedding-service';
import { HuggingFaceEmbeddingService } from './services/embedding-service';
import { CloudflareEmbeddingService } from './services/cf-embedding';
import { CloudflareVectorizeProvider } from './services/cf-vector-store';
import { D1MetadataStore } from './services/metadata-store';
import { SearchCache } from './services/search-cache';
import { SearchRanker } from './services/search-ranker';
import { SearchAnalyticsService } from './services/search-analytics';
import { KeywordSearchService } from './services/keyword-search';

/**
 * RAG Factory - Creates and configures RAG components
 */
export class RAGFactory {
  /**
   * Create a complete RAG engine with default components
   */
  static async createRAGEngine(config: RAGEngineConfig, platform?: any): Promise<RAGEngine> {
    // Create core components
    const embeddingService = await this.createEmbeddingService(config.embeddingService, platform);
    const vectorDatabase = await this.createVectorDatabase(config.vectorDatabase as any, platform);
    const documentProcessor = this.createDocumentProcessor(config.documentProcessing);
    const metadataStore = (vectorDatabase as any).__metadataStore as D1MetadataStore | undefined;
    const searchEngine = this.createSearchEngine(embeddingService, vectorDatabase, config, metadataStore);
    const contextBuilder = this.createContextBuilder(config.contextBuilding);
    const responseGenerator = await this.createResponseGenerator(config.responseGeneration);

    // Create RAG engine
    return new RAGEngineService(
      documentProcessor,
      searchEngine,
      responseGenerator,
      contextBuilder,
      embeddingService,
      vectorDatabase,
      config
    );
  }

  /**
   * Create embedding service
   */
  static async createEmbeddingService(config: {
    provider: EmbeddingProvider | string;
    apiKey?: string;
    model?: string;
    dimensions?: number;
    batchSize?: number;
    cacheSettings?: {
      enabled: boolean;
      maxSize: number;
      ttl: number;
    };
  }, platform?: any): Promise<EmbeddingService> {
    switch (config.provider) {
      case EmbeddingProvider.OPENAI:
        if (!config.apiKey) {
          throw new Error('OpenAI API key is required');
        }
        return new OpenAIEmbeddingService({
          apiKey: config.apiKey,
          model: config.model || 'text-embedding-ada-002',
          dimensions: config.dimensions,
          batchSize: config.batchSize || 100,
          cache: config.cacheSettings
        } as any);

      case EmbeddingProvider.HUGGINGFACE:
        if (!config.apiKey) {
          throw new Error('HuggingFace API key is required');
        }
        return new HuggingFaceEmbeddingService({
          apiKey: config.apiKey,
          model: config.model || 'sentence-transformers/all-MiniLM-L6-v2',
          dimensions: config.dimensions,
          batchSize: config.batchSize || 32,
          cache: config.cacheSettings
        } as any);

      case 'cloudflare':
      case EmbeddingProvider.CLOUDFLARE:
        if (!platform?.env?.AI) {
          throw new Error('Cloudflare AI binding (AI) not provided in platform env');
        }
        return new CloudflareEmbeddingService({
          binding: platform.env.AI,
          model: config.model
        });

      default:
        throw new Error(`Unsupported embedding provider: ${config.provider}`);
    }
  }

  /**
   * Create vector database
   */
  static async createVectorDatabase(config: {
    provider: VectorDatabaseProvider | string;
    apiKey?: string;
    environment?: string;
    indexName?: string;
    namespace?: string;
    dimensions?: number;
    metric?: 'cosine' | 'euclidean' | 'dotproduct';
    cloud?: {
      url: string;
      apiKey: string;
    };
  }, platform?: any): Promise<VectorDatabase> {
    // Note: Wrapping in VectorDatabaseService might handle retries/etc if needed.
    // But CloudflareVectorizeProvider implements VectorDatabase directly.

    switch (config.provider) {
      case VectorDatabaseProvider.PINECONE:
        throw new Error('Pinecone provider is not available in CF Workers. Use VectorDatabaseProvider.CLOUDFLARE instead.');

      case VectorDatabaseProvider.WEAVIATE:
        throw new Error('Weaviate provider is not available in CF Workers. Use VectorDatabaseProvider.CLOUDFLARE instead.');

      case 'cloudflare':
      case VectorDatabaseProvider.CLOUDFLARE:
        if (!platform?.env?.VECTORIZE) {
          throw new Error('Cloudflare Vectorize binding (VECTORIZE) not provided in platform env');
        }
        if (!platform?.env?.DB) {
          throw new Error('D1 binding (DB) not provided in platform env for metadata');
        }

        const metadataStore = new D1MetadataStore(platform.env.DB);
        const cfProvider = new CloudflareVectorizeProvider({
          index: platform.env.VECTORIZE,
          metadataStore
        });

        // Store metadataStore on provider for factory access
        (cfProvider as any).__metadataStore = metadataStore;
        return cfProvider;

      default:
        throw new Error(`Unsupported vector database provider: ${config.provider}`);
    }
  }

  /**
   * Create document processor
   */
  static createDocumentProcessor(config?: {
    chunkSize?: number;
    chunkOverlap?: number;
    minChunkSize?: number;
    maxChunkSize?: number;
    supportedLanguages?: string[];
  }): DocumentProcessor {
    return new DocumentProcessorService({
      chunkSize: config?.chunkSize || 1000,
      chunkOverlap: config?.chunkOverlap || 200,
      minChunkSize: config?.minChunkSize || 200,
      maxChunkSize: config?.maxChunkSize || 2000,
      supportedLanguages: config?.supportedLanguages as any
    });
  }

  /**
   * Create semantic search engine with optimized dependencies
   */
  static createSearchEngine(
    embeddingService: EmbeddingService,
    vectorDatabase: VectorDatabase,
    config: RAGEngineConfig,
    metadataStore?: D1MetadataStore
  ): SemanticSearchEngine {
    const cache = new SearchCache();
    const ranker = new SearchRanker();
    const analytics = metadataStore ? new SearchAnalyticsService(metadataStore) : undefined;
    const keywordSearch = metadataStore ? new KeywordSearchService(metadataStore) : undefined;
    return new SemanticSearchService(embeddingService, vectorDatabase, config, {
      cache, ranker, analytics, keywordSearch,
    });
  }

  /**
   * Create context builder
   */
  static createContextBuilder(config?: {
    maxTokens?: number;
    defaultStrategy?: string;
    defaultCompression?: string;
    tokenEstimator?: (text: string) => number;
  }): ContextBuilder {
    return new ContextBuilderService({
      maxTokens: config?.maxTokens || 4000,
      defaultStrategy: config?.defaultStrategy as any,
      defaultCompression: config?.defaultCompression as any,
      tokenEstimator: config?.tokenEstimator
    });
  }

  /**
   * Create response generator
   */
  static async createResponseGenerator(config?: {
    llmProvider?: LLMProvider;
    apiKey?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<ResponseGenerator> {
    // This would need to be implemented based on your LLM provider
    // For now, return a mock implementation
    return new MockResponseGenerator();
  }
}

/**
 * Mock Response Generator for demonstration
 */
class MockResponseGenerator implements ResponseGenerator {
  async generateResponse(request: {
    query: string;
    context: string[];
    conversationHistory?: any[];
    options?: any;
  }): Promise<any> {
    const contextText = request.context.join('\n\n');

    return {
      answer: `Based on the provided context, here's an answer to "${request.query}". [This is a mock response - integrate with your preferred LLM provider for actual responses]`,
      confidence: 0.8,
      citations: request.context.map((_, index) => ({
        documentIndex: index,
        snippet: request.context[index].substring(0, 100) + '...',
        confidence: 0.7
      })),
      followUpQuestions: [
        'Can you provide more details about this topic?',
        'How does this relate to other concepts?'
      ],
      relatedDocuments: [],
      metadata: {
        model: 'mock-model',
        temperature: 0.7,
        maxTokens: 1000,
        totalTokens: 150,
        processingTime: 500,
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Quick setup method for common configurations
 */
export class QuickRAG {
  /**
   * Quick setup for OpenAI + Pinecone
   */
  static async openaiPinecone(config: {
    openaiApiKey: string;
    pineconeApiKey: string;
    pineconeEnvironment?: string;
    pineconeIndex?: string;
    model?: string;
  }): Promise<RAGEngine> {
    return await RAGFactory.createRAGEngine({
      embeddingService: {
        provider: EmbeddingProvider.OPENAI,
        apiKey: config.openaiApiKey,
        model: config.model || 'text-embedding-ada-002',
        dimension: 1536,
        batchSize: 100,
        cache: true
      } as any,
      vectorDatabase: {
        provider: VectorDatabaseProvider.PINECONE,
        apiKey: config.pineconeApiKey,
        environment: config.pineconeEnvironment || 'us-west1-gcp',
        indexName: config.pineconeIndex || 'rag-index',
        dimension: 1536,
        metric: 'cosine'
      } as any,
      documentProcessing: {
        chunkSize: 1000,
        chunkOverlap: 200,
        chunkingStrategy: 'semantic',
        maxChunkSize: 2000,
        extractMetadata: true,
        detectLanguage: true,
        extractEntities: false
      } as any,
      maxRetrievedDocuments: 10,
      maxContextLength: 4000,
      defaultRankingAlgorithm: 'semantic'
    } as any);
  }

  /**
   * Quick setup for HuggingFace + Weaviate
   */
  static async huggingfaceWeaviate(config: {
    huggingfaceApiKey: string;
    weaviateUrl?: string;
    weaviateApiKey?: string;
    model?: string;
  }): Promise<RAGEngine> {
    return await RAGFactory.createRAGEngine({
      embeddingService: {
        provider: EmbeddingProvider.HUGGINGFACE,
        apiKey: config.huggingfaceApiKey,
        model: config.model || 'sentence-transformers/all-MiniLM-L6-v2',
        dimension: 384,
        batchSize: 32,
        cache: true
      } as any,
      vectorDatabase: {
        provider: VectorDatabaseProvider.WEAVIATE,
        cloud: {
          url: config.weaviateUrl || 'http://localhost:8080',
          apiKey: config.weaviateApiKey
        },
        dimension: 384,
        metric: 'cosine'
      } as any,
      documentProcessing: {
        chunkSize: 800,
        chunkOverlap: 150,
        chunkingStrategy: 'semantic',
        maxChunkSize: 1000,
        extractMetadata: true,
        detectLanguage: true,
        extractEntities: false
      } as any,
      maxRetrievedDocuments: 15,
      maxContextLength: 3000,
      defaultRankingAlgorithm: 'semantic'
    } as any);
  }

  /**
   * Create a simple local RAG setup (for development/testing)
   */
  static async local(config?: {
    embeddingModel?: string;
    chunkSize?: number;
  }): Promise<RAGEngine> {
    const mockEmbeddingService = new MockEmbeddingService();
    const mockVectorDB = new MockVectorDatabase();
    const documentProcessor = RAGFactory.createDocumentProcessor(config);
    const searchEngine = RAGFactory.createSearchEngine(
      mockEmbeddingService,
      mockVectorDB,
      {} as any
    );
    const contextBuilder = RAGFactory.createContextBuilder();
    const responseGenerator = new MockResponseGenerator();

    return new RAGEngineService(
      documentProcessor,
      searchEngine,
      responseGenerator,
      contextBuilder,
      mockEmbeddingService,
      mockVectorDB,
      {
        maxRetrievedDocuments: 10,
        maxContextLength: 4000
      } as any
    );
  }
}

/**
 * Mock implementations for testing
 */
class MockEmbeddingService implements EmbeddingService {
  async generateEmbedding(text: string): Promise<number[]> {
    const hash = this.simpleHash(text);
    const embedding = [];
    for (let i = 0; i < 1536; i++) {
      embedding.push(Math.sin(hash + i) * 0.5 + 0.5);
    }
    return embedding;
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(text => this.generateEmbedding(text)));
  }

  getDimension(model?: string): number {
    return 1536;
  }

  getModelInfo(model?: string): { name: string; dimension: number; maxTokens: number; capabilities: string[] } {
    return {
      name: 'mock',
      dimension: 1536,
      maxTokens: 4096,
      capabilities: ['text']
    };
  }

  private simpleHash(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }
}

class MockVectorDatabase implements VectorDatabase {
  private vectors: Map<string, { values: number[]; metadata?: any }> = new Map();

  async connect(): Promise<void> { }
  async disconnect(): Promise<void> { }

  async createIndex(indexName: string, dimension: number, options?: any): Promise<void> { }

  async indexDocuments(indexName: string, documents: any[]): Promise<string[]> {
    documents.forEach(doc => {
      this.vectors.set(doc.id, { values: doc.embedding || [], metadata: doc.metadata });
    });
    return documents.map(d => d.id);
  }

  async search(indexName: string, query: any, options?: any): Promise<any[]> {
    const queryVector = query.vector;
    if (!queryVector) return [];

    // Simple cosine sim (mock)
    const results = Array.from(this.vectors.entries())
      .map(([id, vec]) => ({
        document: { id, content: '', metadata: vec.metadata },
        score: this.cosineSimilarity(queryVector, vec.values),
        rank: 0,
        metadata: vec.metadata
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, query.topK || 10);

    return results;
  }

  async deleteDocument(indexName: string, documentId: string): Promise<void> {
    this.vectors.delete(documentId);
  }

  async updateDocument(indexName: string, document: any): Promise<void> {
    this.vectors.set(document.id, { values: document.embedding || [], metadata: document.metadata });
  }

  async get(indexName: string, documentId: string): Promise<any> {
    const vector = this.vectors.get(documentId);
    if (!vector) return null;
    return {
      id: documentId,
      content: '',
      metadata: vector.metadata,
      embedding: vector.values,
      source: vector.metadata?.source || 'mock',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async getIndexStats(indexName: string): Promise<any> {
    return {
      documentCount: this.vectors.size,
      vectorCount: this.vectors.size,
      indexSize: 0,
      status: 'ready',
      lastUpdated: new Date()
    };
  }

  async listIndices(): Promise<any[]> { return []; }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b) return 0; // Guard
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
