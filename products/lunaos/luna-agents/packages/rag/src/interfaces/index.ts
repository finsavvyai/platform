/**
 * RAG System Interfaces for Luna Agents
 * Core interfaces for Retrieval-Augmented Generation functionality in Claude Code
 */

export interface VectorDatabase {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  createIndex(indexName: string, dimension: number, options?: IndexOptions): Promise<void>;
  indexDocuments(indexName: string, documents: Document[]): Promise<string[]>;
  search(indexName: string, query: VectorQuery, options?: SearchOptions): Promise<SearchResult[]>;
  deleteDocument(indexName: string, documentId: string): Promise<void>;
  updateDocument(indexName: string, document: Document): Promise<void>;
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
  chunkDocument(document: RawDocument, options?: ChunkingOptions): Promise<DocumentChunk[]>;
  extractMetadata(document: RawDocument): Promise<DocumentMetadata>;
  preprocessText(text: string): Promise<string>;
  extractEntities(text: string): Promise<Entity[]>;
  extractKeywords(text: string): Promise<string[]>;
  detectLanguage(text: string): Promise<string>;
}

export interface RAGEngine {
  initialize(config: RAGConfig): Promise<void>;
  ingestDocuments(documents: RawDocument[], options?: IngestionOptions): Promise<IngestionResult>;
  query(query: RAGQuery, options?: QueryOptions): Promise<RAGResponse>;
  hybridSearch(query: RAGQuery, options?: HybridSearchOptions): Promise<HybridSearchResult>;
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
  totalChunks: number;
  position: {
    start: number;
    end: number;
  };
  context?: string;
}

export interface SearchResult {
  document: Document;
  score: number;
  metadata?: Record<string, any>;
  relevanceScore?: number;
  rank: number;
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
  author?: string;
  source: string;
  type: DocumentType;
  url?: string;
  tags?: string[];
  language?: string;
  wordCount?: number;
  readingTime?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  lastAccessed?: Date;
  accessCount?: number;
  custom?: Record<string, any>;
}

export interface IndexOptions {
  metric?: 'cosine' | 'euclidean' | 'dotproduct';
  pods?: number;
  replicas?: number;
  podType?: string;
  metadataConfig?: Record<string, string>;
}

export interface SearchOptions {
  includeMetadata?: boolean;
  includeValues?: boolean;
  filter?: FilterExpression;
  rerank?: boolean;
  expandResults?: boolean;
  maxResults?: number;
}

export interface FilterExpression {
  operator: 'AND' | 'OR' | 'NOT';
  conditions: FilterCondition[];
  filters?: FilterExpression[];
}

export interface FilterCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'regex';
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
  type: EntityType;
  confidence: number;
  start: number;
  end: number;
  metadata?: Record<string, any>;
}

export interface Citation {
  source: string;
  title: string;
  url?: string;
  pages?: string[];
  confidence: number;
  relevance: number;
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

export type DocumentType =
  | 'text'
  | 'code'
  | 'markdown'
  | 'pdf'
  | 'html'
  | 'json'
  | 'xml'
  | 'csv'
  | 'api'
  | 'database'
  | 'email'
  | 'chat'
  | 'ticket'
  | 'documentation';

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
  provider: 'pinecone' | 'weaviate' | 'chroma' | 'faiss' | 'milvus';
  apiKey?: string;
  environment?: string;
  indexName?: string;
  dimension: number;
  metric: string;
}

export interface EmbeddingServiceConfig {
  provider: 'openai' | 'huggingface' | 'cohere' | 'google' | 'local';
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

// Claude Code specific interfaces
export interface ClaudeCodeRAGConfig extends RAGConfig {
  claudeCode: {
    projectRoot: string;
    maxFileSize: number;
    supportedExtensions: string[];
    excludePaths: string[];
    includePaths: string[];
    enableRealtimeIndexing: boolean;
    indexGitHistory: boolean;
    codeAnalysis: {
      extractFunctions: boolean;
      extractClasses: boolean;
      extractComments: boolean;
      extractImports: boolean;
    };
  };
}

export interface CodeDocument extends RawDocument {
  filePath: string;
  language: string;
  functions?: FunctionInfo[];
  classes?: ClassInfo[];
  imports?: ImportInfo[];
  exports?: ExportInfo[];
  dependencies?: string[];
  complexity?: number;
  testCoverage?: number;
}

export interface FunctionInfo {
  name: string;
  signature: string;
  parameters: ParameterInfo[];
  returnType: string;
  documentation?: string;
  complexity?: number;
  lineNumbers: {
    start: number;
    end: number;
  };
}

export interface ClassInfo {
  name: string;
  extends?: string;
  implements?: string[];
  methods: FunctionInfo[];
  properties: PropertyInfo[];
  documentation?: string;
  lineNumbers: {
    start: number;
    end: number;
  };
}

export interface ParameterInfo {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: string;
  description?: string;
}

export interface PropertyInfo {
  name: string;
  type: string;
  visibility: 'public' | 'private' | 'protected';
  readonly: boolean;
  documentation?: string;
}

export interface ImportInfo {
  module: string;
  imports: string[];
  isTypeOnly: boolean;
  line: number;
}

export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'interface' | 'variable' | 'type';
  isDefault: boolean;
  line: number;
}
