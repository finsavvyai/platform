/**
 * RAG System Interfaces
 * Core interfaces for Retrieval-Augmented Generation functionality
 */

export interface VectorDatabase {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  createIndex(
    indexName: string,
    dimension: number,
    options?: IndexOptions
  ): Promise<void>;
  indexDocuments(indexName: string, documents: Document[]): Promise<string[]>;
  search(
    indexName: string,
    query: VectorQuery,
    options?: SearchOptions
  ): Promise<SearchResult[]>;
  deleteDocument(indexName: string, documentId: string): Promise<void>;
  updateDocument(indexName: string, document: Document): Promise<void>;
  get(indexName: string, documentId: string): Promise<Document | null>;
  getIndexStats(indexName: string): Promise<IndexStats>;
  listIndices(): Promise<IndexInfo[]>;
}

export interface EmbeddingService {
  generateEmbedding(text: string, model?: string): Promise<number[]>;
  generateBatchEmbeddings(texts: string[], model?: string): Promise<number[][]>;
  getDimension(model?: string): number;
  getModelInfo(model?: string): ModelInfo;
}

export interface DocumentProcessor {
  processDocument(
    content: string,
    options?: {
      documentId?: string;
      title?: string;
      source?: string;
      metadata?: DocumentMetadata;
      chunkingStrategy?: ChunkingStrategy;
    }
  ): Promise<ProcessedDocument>;

  // Keep existing methods if they are implemented or needed, 
  // but Service implements slice of this? Service implements extractEntities, extractKeywords.
  // Service does NOT implement chunkDocument (it has createChunks). 
  // I will make interface compatible with Service.
  createChunks(
    content: string,
    strategy: ChunkingStrategy,
    document: Document,
    language: Language
  ): Promise<DocumentChunk[]>;

  extractEntities(text: string, language: Language): Promise<Entity[]>;
  extractKeywords(text: string, language: Language, limit?: number): Promise<string[]>;

  // Helpers
  updateOptions?(options: Partial<ProcessingOptions>): void;
}

export interface RAGEngine {
  initialize(config: RAGConfig): Promise<void>;
  ingestDocuments(
    documents: RawDocument[],
    options?: IngestionOptions
  ): Promise<IngestionResult>;
  query(query: RAGQuery, options?: QueryOptions): Promise<RAGResponse>;
  hybridSearch(
    query: RAGQuery,
    options?: HybridSearchOptions
  ): Promise<HybridSearchResult>;
  reIndex(indexName?: string): Promise<void>;
  getStats(): Promise<RAGStats>;
  clearCache(): Promise<void>;
}

export interface VectorQuery {
  vector?: number[];
  text?: string;
  topK?: number;
  filter?: FilterExpression;
  includeMetadata?: boolean;
  includeValues?: boolean;
}

export interface Document {
  id: string;
  content: string;
  title?: string;
  metadata: DocumentMetadata;
  embedding?: number[];
  chunkIndex?: number;
  parentDocumentId?: string;
  source: DocumentSource;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentChunk extends Document {
  chunkIndex: number;
  index: number; // For compatibility
  totalChunks?: number;
  position?: {
    start: number;
    end: number;
  };
  context?: string;
  score?: number;
  documentId?: string;
}

export interface SearchResult {
  document: Document;
  score: number;
  metadata?: Record<string, any>;
  relevanceScore?: number;
  rank: number;

  // Flattened properties used by SemanticSearchService
  id: string;
  documentId?: string;
  content?: string;
  documentTitle?: string;
  documentSource?: string;
  url?: string;
  author?: string;
  publishedAt?: Date;
  tags?: string[];
  language?: string;
  mimeType?: string;
  chunkIndex?: number;
  totalChunks?: number;
  timestamp?: number; // Used for caching
}

export interface RAGQuery {
  query: string;
  context?: QueryContext;
  filters?: FilterExpression;
  rerank?: boolean;
  expandContext?: boolean;
  maxContextLength?: number;
  temperature?: number;
  model?: string;
}

export interface RAGResponse {
  answer: string;
  sources: SearchResult[];
  query: string;
  context: string;
  confidence: number;
  metadata: ResponseMetadata;
  citations?: Citation[];
  relatedQueries?: string[];
  followUpQuestions?: string[];
  metrics?: RAGMetrics;
}

export interface RawDocument {
  id?: string;
  content: string;
  title?: string;
  author?: string;
  source: string;
  type: DocumentType;
  url?: string;
  createdAt?: Date;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface DocumentMetadata {
  title?: string;
  documentTitle?: string; // Alias
  author?: string;
  source?: string;
  documentSource?: string; // Alias
  type: DocumentType;
  documentType?: DocumentType; // Alias
  url?: string;
  tags?: string[];
  language?: string;
  wordCount?: number;
  readingTime?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  lastAccessed?: Date;
  accessCount?: number;
  chunkLength?: number;
  tokenCount?: number;
  processedAt?: string;
  createdAt?: string; // Added field
  processingVersion?: string;
  custom?: Record<string, any>;
  truncated?: boolean;
  originalLength?: number;
  summarized?: boolean;
  keywordExtraction?: boolean;
  originalKeywords?: string[];
  sectionHeader?: boolean;
  sectionTitle?: string;
}

export interface IndexOptions {
  metric?: 'cosine' | 'euclidean' | 'dotproduct';
  pods?: number;
  replicas?: number;
  podType?: string;
  metadataConfig?: Record<string, string>;
  vectorizer?: string;
  moduleConfig?: Record<string, any>;
}

export interface SearchOptions {
  includeMetadata?: boolean;
  includeValues?: boolean;
  filter?: FilterExpression;
  rerank?: boolean;
  expandResults?: boolean;
  maxResults?: number;
  limit?: number;
  offset?: number;
  threshold?: number; // Minimum similarity score (0-1)
  minRelevanceScore?: number; // Alias for threshold
  filters?: SearchFilters;
  skipCache?: boolean;
  namespace?: string;
  batchSize?: number;
  rankingAlgorithm?: string;
  diversifyResults?: boolean;
}

export interface FilterExpression {
  operator: 'AND' | 'OR' | 'NOT';
  conditions: FilterCondition[];
  filters?: FilterExpression[];
}

export interface FilterCondition {
  field: string;
  operator:
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'nin'
  | 'contains'
  | 'regex';
  value: any;
}

export interface ChunkingOptions {
  strategy: 'fixed' | 'semantic' | 'recursive' | 'sliding' | 'hybrid';
  chunkSize?: number;
  chunkOverlap?: number;
  maxChunkSize?: number;
  minChunkSize?: number;
  separators?: string[];
  respectSentenceBoundaries?: boolean;
  respectParagraphBoundaries?: boolean;
}

export interface QueryOptions {
  streaming?: boolean;
  timeout?: number;
  verbose?: boolean;
}

export interface IngestionOptions {
  indexName: string;
  batch?: boolean;
  batchSize?: number;
  processInParallel?: boolean;
  generateEmbeddings?: boolean;
  extractMetadata?: boolean;
  updateExisting?: boolean;
  validateDocuments?: boolean;
}

export interface IngestionResult {
  processedDocuments: number;
  failedDocuments: number;
  skippedDocuments: number;
  processingTime: number;
  errors: IngestionError[];
  warnings: IngestionWarning[];
}

export interface QueryContext {
  userId?: string;
  sessionId?: string;
  conversationHistory?: ConversationTurn[];
  previousQueries?: string[];
  userProfile?: UserProfile;
  timeContext?: {
    startDate?: Date;
    endDate?: Date;
  };
  locationContext?: {
    latitude?: number;
    longitude?: number;
    timezone?: string;
  };
}

export interface HybridSearchOptions {
  alpha?: number; // Weight between semantic and keyword search
  rrf?: number; // Reciprocal Rank Fusion parameter
  keywordWeight?: number;
  semanticWeight?: number;
  expandResults?: boolean;
  diversityBoost?: number;
}

export interface HybridSearchResult {
  semanticResults: SearchResult[];
  keywordResults: SearchResult[];
  combinedResults: SearchResult[];
  queryExpansion?: {
    expandedQueries: string[];
    synonyms: string[];
    relatedTerms: string[];
  };
}

export interface ModelInfo {
  name: string;
  dimension: number;
  maxTokens: number;
  costPerToken?: number;
  capabilities: string[];
}

export interface Entity {
  text: string;
  type: EntityType | string;
  confidence: number;
  start?: number;
  end?: number;
  startPosition?: number;
  endPosition?: number;
  metadata?: Record<string, any>;
}

export interface Citation {
  source: string;
  title: string; // If documentTitle is available
  url?: string;
  pages?: string[];
  confidence: number;
  relevance: number;
  documentIndex?: number;
  snippet?: string;
  startPosition?: number;
  endPosition?: number;
}

export interface ResponseMetadata {
  model: string;
  temperature: number;
  maxTokens: number;
  processingTime: number;
  retrievalTime: number;
  generationTime: number;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  cacheHit: boolean;
}

export interface ConversationTurn {
  query: string;
  response: string;
  timestamp: Date;
  context?: any;
}

export interface UserProfile {
  id: string;
  preferences: UserPreferences;
  history: UserHistory;
  expertise: string[];
  language: string;
  timezone: string;
}

export interface UserPreferences {
  maxResults?: number;
  includeCitations?: boolean;
  explainReasoning?: boolean;
  preferredSources?: string[];
  blockedSources?: string[];
  readingLevel?: 'basic' | 'intermediate' | 'advanced';
}

export interface UserHistory {
  recentQueries: QueryHistory[];
  frequentlyAccessedDocuments: DocumentAccess[];
  interests: string[];
  expertise: string[];
}

export interface QueryHistory {
  query: string;
  timestamp: Date;
  results: number;
  satisfaction?: number;
  clickedDocuments?: string[];
}

export interface DocumentAccess {
  documentId: string;
  accessCount: number;
  lastAccessed: Date;
  averageTimeSpent: number;
  rating?: number;
}

export interface RAGStats {
  totalDocuments: number;
  totalQueries: number;
  averageResponseTime: number;
  cacheHitRate: number;
  popularQueries: QueryStats[];
  documentStats: DocumentStats[];
  indexStats: Record<string, IndexStats>;
  errorRate: number;
  uptime: number;
}

export interface QueryStats {
  query: string;
  frequency: number;
  averageResponseTime: number;
  satisfaction: number;
}

export interface ProcessedDocument {
  document: Document;
  chunks: DocumentChunk[];
  entities: Entity[];
  keywords: string[];
  statistics: DocumentStatistics;
  processingTime: number;
  success: boolean;
  errors: string[];
}

export interface DocumentStatistics {
  totalChunks: number;
  averageChunkLength: number;
  minChunkLength: number;
  maxChunkLength: number;
  totalTokens: number;
}

export interface ProcessingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  minChunkSize?: number;
  maxChunkSize?: number;
  supportedLanguages?: Language[];
  extractMetadata?: boolean;
  detectLanguage?: boolean;
  extractEntities?: boolean;
}

export interface TextEntity {
  text: string;
  type: string;
  confidence: number;
  startPosition: number;
  endPosition: number;
  metadata?: Record<string, any>;
}

export interface TextPreprocessor {
  preprocess(text: string, language: Language): string;
  normalize(text: string): string;
  tokenize(text: string): string[];
}

export interface DocumentStats {
  documentId: string;
  accessCount: number;
  averageRelevanceScore: number;
  lastAccessed: Date;
  source: string;
}

export interface IndexInfo {
  name: string;
  dimension: number;
  documentCount: number;
  status: IndexStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IndexStats {
  documentCount: number;
  vectorCount: number;
  indexSize: number;
  status: IndexStatus;
  lastUpdated: Date;
}

export enum DocumentType {
  TEXT = 'text',
  CODE = 'code',
  MARKDOWN = 'markdown',
  PDF = 'pdf',
  HTML = 'html',
  JSON = 'json',
  XML = 'xml',
  CSV = 'csv',
  API = 'api',
  DATABASE = 'database',
  EMAIL = 'email',
  CHAT = 'chat',
  TICKET = 'ticket',
  DOCUMENTATION = 'documentation',
  PLAIN_TEXT = 'text',
  UNKNOWN = 'unknown',
  ACADEMIC = 'academic',
}

export type EntityType =
  | 'person'
  | 'organization'
  | 'location'
  | 'date'
  | 'email'
  | 'phone'
  | 'url'
  | 'product'
  | 'technology'
  | 'concept'
  | 'metric'
  | 'currency'
  | 'custom';

export type IndexStatus =
  | 'initializing'
  | 'ready'
  | 'indexing'
  | 'updating'
  | 'error'
  | 'deleting';

export type DocumentSource =
  | 'local'
  | 'url'
  | 'api'
  | 'database'
  | 'filesystem'
  | 'git'
  | 's3'
  | 'sharepoint'
  | 'confluence'
  | 'notion'
  | 'slack'
  | 'custom';

export enum ChunkingStrategy {
  FIXED = 'fixed',
  SEMANTIC = 'semantic',
  RECURSIVE = 'recursive',
  SLIDING = 'sliding',
  HYBRID = 'hybrid',
}

export enum Language {
  ENGLISH = 'en',
  SPANISH = 'es',
  FRENCH = 'fr',
  GERMAN = 'de',
  ITALIAN = 'it',
  PORTUGUESE = 'pt',
  CHINESE = 'zh',
  JAPANESE = 'ja',
}

export type IngestionError = {
  documentId: string;
  error: string;
  timestamp: Date;
  retryable: boolean;
};

export type IngestionWarning = {
  documentId: string;
  warning: string;
  timestamp: Date;
};

export interface RAGConfig {
  vectorDatabase: VectorDatabaseConfig;
  embeddingService: EmbeddingServiceConfig;
  documentProcessor: DocumentProcessorConfig;
  cache: CacheConfig;
  security: SecurityConfig;
  monitoring: MonitoringConfig;
}

export interface VectorDatabaseConfig {
  provider: 'pinecone' | 'weaviate' | 'chroma' | 'faiss' | 'milvus' | 'cloudflare';
  apiKey?: string;
  environment?: string;
  indexName?: string;
  dimension: number;
  metric: string;
}

export interface EmbeddingServiceConfig {
  provider: 'openai' | 'huggingface' | 'cohere' | 'google' | 'local' | 'cloudflare';
  apiKey?: string;
  model: string;
  dimension: number;
  batchSize: number;
  cache: boolean;
}

export interface DocumentProcessorConfig {
  chunkingStrategy: string;
  chunkSize: number;
  chunkOverlap: number;
  maxChunkSize: number;
  extractMetadata: boolean;
  detectLanguage: boolean;
  extractEntities: boolean;
}

export interface CacheConfig {
  enabled: boolean;
  provider: 'redis' | 'memory' | 'file';
  ttl: number;
  maxSize: number;
}

export interface SecurityConfig {
  encryption: boolean;
  accessControl: boolean;
  auditLogging: boolean;
  rateLimiting: boolean;
  dataPrivacy: boolean;
}

export interface MonitoringConfig {
  enabled: boolean;
  metricsProvider: string;
  logLevel: string;
  alerting: boolean;
}

export enum VectorDatabaseProvider {
  PINECONE = 'pinecone',
  WEAVIATE = 'weaviate',
  CHROMA = 'chroma',
  FAISS = 'faiss',
  MILVUS = 'milvus',
  CLOUDFLARE = 'cloudflare'
}

export enum EmbeddingProvider {
  OPENAI = 'openai',
  HUGGINGFACE = 'huggingface',
  COHERE = 'cohere',
  GOOGLE = 'google',
  LOCAL = 'local',
  CLOUDFLARE = 'cloudflare'
}

export interface SemanticSearchEngine {
  search(query: SearchQuery, options?: SearchOptions): Promise<SearchResult[]>;
  hybridSearch(query: SearchQuery, options?: HybridSearchOptions): Promise<SearchResult[]>;
  contextualSearch(query: SearchQuery, history: string[], options?: SearchOptions): Promise<SearchResult[]>;
}

export interface ContextBuilder {
  buildContext(documents: DocumentChunk[], options?: any): Promise<ContextWindow>;
}

export interface ResponseGenerator {
  generateResponse(request: {
    query: string;
    context: string[];
    conversationHistory?: any[];
    options?: any;
  }): Promise<RetrievalAugmentedResponse>;
}

export interface ContextWindow {
  chunks: DocumentChunk[];
  totalLength: number;
  totalTokens: number;
  compressionRatio?: number;
  relevanceScore?: number;
  metadata?: any;
}

export enum ContextRelevanceStrategy {
  SEMANTIC_RELEVANCE = 'semantic',
  RECENCY = 'recency',
  DIVERSITY = 'diversity',
  COVERAGE = 'coverage',
  BALANCED = 'balanced'
}

export enum ContextCompressionMethod {
  NONE = 'none',
  SUMMARIZATION = 'summarization',
  KEYWORD_EXTRACTION = 'keyword',
  ENTITY_FILTERING = 'entity',
  REDUNDANCY_REMOVAL = 'redundancy'
}

export interface ContextBuilderOptions {
  maxTokens?: number;
  relevanceStrategy?: ContextRelevanceStrategy;
  compressionMethod?: ContextCompressionMethod;
  query?: string;
  optimizeLayout?: boolean;
  timeWeight?: number;
  timeDecayFunction?: 'linear' | 'exponential' | 'logarithmic';
  referenceDate?: Date;
  prioritizeRecency?: boolean;
}

export interface RetrievalAugmentedResponse {
  answer: string;
  confidence: number;
  citations: Citation[];
  followUpQuestions?: string[];
  relatedDocuments?: any[];
  metadata?: any;
}

export enum LLMProviderType {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  CLOUDFLARE = 'cloudflare'
}

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  model: string;
  messages: ConversationMessage[];
  temperature: number;
  maxTokens: number;
  stream?: boolean;
  metadata?: Record<string, any>;
}

export interface LLMResponse {
  content: string;
  usage?: {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
  };
}

export interface LLMStreamChunk {
  content: string;
  done: boolean;
}

export interface LLMProvider {
  generate(request: LLMRequest): Promise<LLMResponse>;
  generateStream(request: LLMRequest): AsyncGenerator<LLMStreamChunk>;
}

export interface RAGEngineConfig extends RAGConfig {
  maxConversationHistory?: number;
  maxRetrievedDocuments?: number;
  maxContextLength?: number;
  defaultRankingAlgorithm?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  llmConfig?: {
    model: string;
    temperature: number;
    maxTokens: number;
  };
  embeddingService: EmbeddingServiceConfig;
  vectorDatabase: VectorDatabaseConfig;
  documentProcessing: DocumentProcessorConfig;
  contextBuilding?: any;
  responseGeneration?: any;
}

export interface SearchQuery {
  text: string;
  originalText?: string;
  filters?: SearchFilters | FilterExpression;
  intent?: string;
  entities?: string[];
  keywords?: string[];
}

export interface SearchFilters {
  documentTypes?: string[];
  authors?: string[];
  dateRange?: { start: Date; end: Date };
  tags?: string[];
  language?: string;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  content: string;
  metadata?: any;
}

export enum SearchRankingAlgorithm {
  SEMANTIC = 'semantic',
  BM25 = 'bm25',
  TF_IDF = 'tfidf',
  LEARNING_TO_RANK = 'ltr'
}

export interface RelevanceScore {
  score: number;
  details: any;
}


export interface RAGMetrics {
  retrievalLatency: number;
  generationLatency: number;
  totalLatency: number;
  retrievedDocumentCount: number;
  contextUtilization: number;
  responseRelevance: number;
  hallucinationScore: number;
  factualConsistency: number;
}

export interface RAGEvaluationMetrics {
  totalQueries: number;
  averageConfidence: number;
  averageResponseTime: number;
  averageRelevanceScore: number;
  averageFactualConsistency: number;
  successRate: number;
  hallucinationRate: number;
  queryResults: any[];
}

// ─── Search Analytics Interfaces ──────────────────────────────────────────────

export interface SearchAnalyticsEntry {
  id?: string;
  queryText: string;
  resultCount: number;
  latencyMs: number;
  cacheHit: boolean;
  searchType: 'semantic' | 'keyword' | 'hybrid' | 'contextual';
  createdAt?: number;
}

export interface SearchPerformanceStats {
  totalSearches: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  cacheHitRate: number;
  avgResultCount: number;
}

export interface SearchCacheStats {
  entries: number;
  maxSize: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  embeddingCacheSize: number;
}

export interface TopQueryEntry {
  queryText: string;
  count: number;
  avgLatencyMs: number;
}

export interface KeywordSearchResult {
  id: string;
  documentId: string;
  content: string;
  score: number;
  metadata?: Record<string, any>;
}

