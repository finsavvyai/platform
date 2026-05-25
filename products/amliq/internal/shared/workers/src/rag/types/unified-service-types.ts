/**
 * Unified RAG Service Types and Interfaces
 */

export interface UnifiedRAGRequest {
  id: string;
  operation: RAGOperation;
  data: any;
  options?: RAGOptions;
  context?: RAGContext;
  userId?: string;
  timestamp?: string;
}

export type RAGOperation =
  | 'ingest_document'
  | 'search'
  | 'analyze_document'
  | 'analyze_compliance'
  | 'process_multi_modal'
  | 'track_learning'
  | 'update_knowledge'
  | 'get_insights';

export interface RAGOptions {
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  timeout?: number;
  includeMetadata?: boolean;
  enableTracing?: boolean;
  outputFormat?: 'json' | 'xml' | 'csv';
}

export interface RAGContext {
  sessionId?: string;
  organizationId?: string;
  jurisdiction?: string;
  complianceFramework?: string;
  userRole?: string;
  previousRequests?: string[];
}

export interface UnifiedRAGResult {
  id: string;
  requestId: string;
  operation: RAGOperation;
  status: ProcessingStatus;
  result?: any;
  processingTime: number;
  error?: string;
  metadata: ResultMetadata;
}

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'timeout';

export interface ResultMetadata {
  serviceVersion: string;
  processingStages: string[];
  resourcesUsed: ResourceUsage;
  quality: QualityMetrics;
}

export interface ResourceUsage {
  cpu: number;
  memory: number;
  ai: number;
}

export interface QualityMetrics {
  confidence: number;
  relevance: number;
  completeness: number;
}

export interface RAGServiceConfig {
  services: {
    rag: ServiceConfig;
    multiModal: ServiceConfig;
    learning: ServiceConfig;
    documentProcessing: ServiceConfig;
    vectorSearch: ServiceConfig;
  };
  features: {
    enableLearning: boolean;
    enablePersonalization: boolean;
    enableMultiModal: boolean;
    enableKnowledgeGraph: boolean;
    enableComplianceAnalysis: boolean;
  };
  performance: {
    maxConcurrentRequests: number;
    enableCaching: boolean;
    cacheTTL: number;
    batchSize: number;
    maxFileSize: number;
  };
  security: {
    enablePIIMasking: boolean;
    enableAuditLogging: boolean;
    rateLimiting: {
      requests: number;
      window: number;
    };
  };
}

export interface ServiceConfig {
  enabled: boolean;
  timeout: number;
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: ComponentHealth[];
  metrics: HealthMetrics;
  lastCheck: string;
  uptime: number;
  version: string;
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  errorRate: number;
  dependencies: string[];
  lastError?: string;
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

export interface ProcessingStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  activeRequests: number;
  lastReset: string;
}
