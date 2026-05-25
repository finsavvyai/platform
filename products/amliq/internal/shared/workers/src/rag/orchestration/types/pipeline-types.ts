/**
 * RAG Pipeline Types and Interfaces
 *
 * Defines the unified orchestration system that combines all RAG components:
 * document ingestion, content extraction, vector embedding, knowledge graph construction,
 * and query processing for financial regulatory compliance.
 */

export interface RAGPipelineConfig {
  ingestion: {
    enabled: boolean;
    batchSize: number;
    maxConcurrency: number;
    retryAttempts: number;
    supportedSources: string[];
  };
  extraction: {
    enabled: boolean;
    aiModels: {
      textExtraction: string;
      entityExtraction: string;
      relationshipExtraction: string;
    };
    confidence: {
      minThreshold: number;
      aiFallback: boolean;
    };
  };
  embedding: {
    enabled: boolean;
    model: string;
    dimensions: number;
    chunkingStrategy: 'semantic' | 'fixed' | 'sliding';
    batchSize: number;
  };
  knowledgeGraph: {
    enabled: boolean;
    maxEntitiesPerDocument: number;
    maxRelationshipsPerDocument: number;
    enableInference: boolean;
  };
  query: {
    enabled: boolean;
    defaultType: 'semantic' | 'hybrid' | 'graph';
    maxResults: number;
    enableExplanations: boolean;
  };
  processing: {
    enableAsync: boolean;
    queueName: string;
    enableRetry: boolean;
    timeoutMs: number;
  };
}

export interface RAGPipelineRequest {
  id: string;
  type: PipelineRequestType;
  data: any;
  options?: PipelineOptions;
  context?: PipelineContext;
  userId?: string;
  timestamp: string;
}

export type PipelineRequestType =
  | 'ingest_document'
  | 'process_query'
  | 'update_index'
  | 'export_data'
  | 'analyze_compliance'
  | 'generate_report'
  | 'bulk_import'
  | 'health_check';

export interface PipelineOptions {
  priority: 'low' | 'normal' | 'high' | 'urgent';
  timeout?: number;
  retryCount?: number;
  enableNotifications?: boolean;
  outputFormat?: 'json' | 'xml' | 'csv' | 'pdf';
  includeMetadata?: boolean;
  enableTracing?: boolean;
}

export interface PipelineContext {
  sessionId?: string;
  organizationId?: string;
  jurisdiction?: string;
  complianceFramework?: string;
  userRole?: string;
  previousRequests?: RAGPipelineRequest[];
}

export interface RAGPipelineResult {
  id: string;
  requestId: string;
  type: PipelineRequestType;
  status: PipelineStatus;
  result: any;
  metadata: PipelineResultMetadata;
  executionStats: PipelineExecutionStats;
  errors?: PipelineError[];
  warnings?: PipelineWarning[];
}

export interface PipelineResultMetadata {
  processingTime: number;
  queueTime: number;
  retryCount: number;
  memoryUsage: MemoryUsage;
  dataProcessed: DataProcessingStats;
  quality: QualityMetrics;
}

export interface MemoryUsage {
  peak: number;
  average: number;
  limit: number;
  efficiency: number;
}

export interface DataProcessingStats {
  documentsProcessed: number;
  chunksGenerated: number;
  embeddingsCreated: number;
  entitiesExtracted: number;
  relationshipsCreated: number;
  queriesProcessed: number;
  resultsReturned: number;
}

export interface QualityMetrics {
  extractionQuality: number;
  embeddingQuality: number;
  graphQuality: number;
  queryRelevance: number;
  overallScore: number;
}

export interface PipelineExecutionStats {
  totalTime: number;
  components: ComponentStats;
  performance: PerformanceMetrics;
  resources: ResourceUsage;
}

export interface ComponentStats {
  ingestion: number;
  extraction: number;
  embedding: number;
  knowledgeGraph: number;
  query: number;
  postProcessing: number;
}

export interface PerformanceMetrics {
  throughput: number;
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  errorRate: number;
  successRate: number;
}

export interface ResourceUsage {
  cpu: number;
  memory: number;
  storage: number;
  network: number;
  ai: number;
}

export interface PipelineError {
  code: string;
  message: string;
  component: string;
  severity: 'error' | 'warning' | 'info';
  timestamp: string;
  context?: any;
  stackTrace?: string;
}

export interface PipelineWarning {
  code: string;
  message: string;
  component: string;
  recommendation?: string;
  timestamp: string;
}

export type PipelineStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout'
  | 'retrying';

export interface PipelineStage {
  name: string;
  status: PipelineStatus;
  startTime?: string;
  endTime?: string;
  duration?: number;
  input?: any;
  output?: any;
  metadata?: any;
  errors?: PipelineError[];
}

export interface PipelineTrace {
  requestId: string;
  stages: PipelineStage[];
  overallStatus: PipelineStatus;
  startTime: string;
  endTime?: string;
  totalDuration?: number;
  summary: PipelineSummary;
}

export interface PipelineSummary {
  totalStages: number;
  completedStages: number;
  failedStages: number;
  totalDuration: number;
  successRate: number;
  bottlenecks: string[];
  recommendations: string[];
}

export interface RAGPipelineHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: ComponentHealth[];
  metrics: HealthMetrics;
  lastCheck: string;
  uptime: number;
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  errorRate: number;
  lastError?: string;
  dependencies: string[];
}

export interface HealthMetrics {
  activeRequests: number;
  queuedRequests: number;
  processedRequests: number;
  averageResponseTime: number;
  systemLoad: number;
  availableMemory: number;
  diskSpace: number;
}

export interface ComplianceAnalysisRequest {
  scope: {
    documents?: string[];
    jurisdictions?: string[];
    timeRange?: {
      from: string;
      to: string;
    };
    entityTypes?: string[];
  };
  focus: {
    requirements?: string[];
    risks?: string[];
    controls?: string[];
  };
  options: {
    includeRecommendations?: boolean;
    includeEvidence?: boolean;
    generateReport?: boolean;
    exportFormat?: 'json' | 'pdf';
  };
}

export interface ComplianceAnalysisResult {
  summary: ComplianceSummary;
  findings: ComplianceFinding[];
  gaps: ComplianceGap[];
  recommendations: ComplianceRecommendation[];
  evidence: ComplianceEvidence[];
  report?: any; // Generated report content
}

export interface ComplianceSummary {
  overallCompliance: number;
  coverage: number;
  riskLevel: 'low' | 'medium' | 'high';
  lastUpdated: string;
  scope: any;
}

export interface ComplianceFinding {
  id: string;
  type: 'requirement' | 'risk' | 'control' | 'violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: string[];
  source: {
    documentId: string;
    sectionId?: string;
    jurisdiction: string;
  };
  confidence: number;
}

export interface ComplianceGap {
  id: string;
  description: string;
  impact: string;
  severity: 'low' | 'medium' | 'high';
  recommendation: string;
  affectedEntities: string[];
}

export interface ComplianceRecommendation {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  title: string;
  description: string;
  implementation: ImplementationPlan;
  benefits: string[];
}

export interface ImplementationPlan {
  steps: string[];
  timeline: string;
  resources: string[];
  dependencies: string[];
  estimatedCost?: number;
}

export interface ComplianceEvidence {
  id: string;
  type: 'document' | 'process' | 'control' | 'test';
  description: string;
  source: string;
  date: string;
  relevance: number;
}

export interface RAGPipelineOrchestrator {
  process(request: RAGPipelineRequest): Promise<RAGPipelineResult>;
  processAsync(request: RAGPipelineRequest): Promise<string>; // Returns request ID
  getResult(requestId: string): Promise<RAGPipelineResult>;
  cancelRequest(requestId: string): Promise<boolean>;
  getTrace(requestId: string): Promise<PipelineTrace>;
  getHealth(): Promise<RAGPipelineHealth>;
  analyzeCompliance(request: ComplianceAnalysisRequest): Promise<ComplianceAnalysisResult>;
}

export interface PipelineWorker {
  initialize(): Promise<void>;
  process(request: RAGPipelineRequest): Promise<RAGPipelineResult>;
  healthCheck(): Promise<ComponentHealth>;
  cleanup(): Promise<void>;
}

export interface QueueManager {
  enqueue(request: RAGPipelineRequest): Promise<string>;
  dequeue(): Promise<RAGPipelineRequest | null>;
  peek(): Promise<RAGPipelineRequest | null>;
  size(): Promise<number>;
  clear(): Promise<void>;
  getStats(): Promise<QueueStats>;
}

export interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  averageWaitTime: number;
  maxWaitTime: number;
}

export interface NotificationManager {
  send(notification: Notification): Promise<void>;
  subscribe(event: string, handler: NotificationHandler): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<void>;
  getHistory(filters?: NotificationFilters): Promise<Notification[]>;
}

export interface Notification {
  id: string;
  type: NotificationType;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  data?: any;
  recipients: string[];
  channels: NotificationChannel[];
  timestamp: string;
}

export type NotificationType =
  | 'pipeline_completed'
  | 'pipeline_failed'
  | 'compliance_alert'
  | 'system_health'
  | 'data_update'
  | 'user_notification';

export type NotificationChannel = 'email' | 'webhook' | 'sms' | 'in_app';

export interface NotificationHandler {
  (notification: Notification): Promise<void>;
}

export interface NotificationFilters {
  type?: NotificationType;
  severity?: string;
  dateRange?: {
    from: string;
    to: string;
  };
  recipient?: string;
  limit?: number;
}
