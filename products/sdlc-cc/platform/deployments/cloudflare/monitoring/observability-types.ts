// Observability shared types and interfaces

export interface ObservabilityConfig {
  environment: 'development' | 'staging' | 'production';
  service: string;
  version: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableMetrics: boolean;
  enableTracing: boolean;
  enableErrorTracking: boolean;
  metricsEndpoint?: string;
  sentryDsn?: string;
  datadogApiKey?: string;
}

export interface MetricData {
  name: string;
  value: number;
  timestamp: number;
  tags: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram';
}

export interface WorkerMetrics {
  requestsTotal: number;
  requestDuration: number[];
  activeRequests: number;
  errorsTotal: number;
  errorRate: number;
  cpuTime: number;
  memoryUsage: number;
  documentsProcessed: number;
  vectorSearches: number;
  authentications: number;
  customMetrics: Map<string, MetricData>;
}

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  service: string;
  environment: string;
  message: string;
  requestId?: string;
  userId?: string;
  tenantId?: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  tenantId?: string;
  service: string;
  environment: string;
  version: string;
  tags?: Record<string, string>;
  extra?: Record<string, any>;
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  tags: Record<string, string>;
  logs: Array<{
    timestamp: number;
    level: string;
    message: string;
  }>;
}
