/**
 * Analytics Types and Interfaces
 *
 * This file defines the core types and interfaces for the shared analytics system
 * that will be used across all products in the enterprise platform.
 */

export interface AnalyticsEvent {
  id: string;
  type: EventType;
  userId?: string;
  sessionId: string;
  timestamp: number;
  data: Record<string, unknown>;
  metadata: EventMetadata;
}

export interface EventMetadata {
  productId: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
  url?: string;
  platform?: 'web' | 'mobile' | 'api' | 'worker';
}

export type EventType =
  | 'page_view'
  | 'user_action'
  | 'form_submit'
  | 'api_call'
  | 'error'
  | 'performance'
  | 'conversion'
  | 'feature_usage'
  | 'session_start'
  | 'session_end'
  | 'custom';

export interface UserActionEvent {
  action: string;
  target?: string;
  value?: unknown;
  context?: Record<string, unknown>;
}

export interface PageViewEvent {
  path: string;
  title?: string;
  referrer?: string;
  loadTime?: number;
}

export interface FormSubmitEvent {
  formName: string;
  fields: Record<string, unknown>;
  success: boolean;
  duration?: number;
  errors?: string[];
}

export interface ApiCallEvent {
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number;
  requestSize?: number;
  responseSize?: number;
}

export interface ErrorEvent {
  error: string;
  stack?: string;
  context?: Record<string, unknown>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface PerformanceEvent {
  metric: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percent';
  context?: Record<string, unknown>;
}

export interface ConversionEvent {
  type: string;
  value?: number;
  currency?: string;
  context?: Record<string, unknown>;
}

export interface FeatureUsageEvent {
  feature: string;
  action?: string;
  parameters?: Record<string, unknown>;
}

export interface AnalyticsConfig {
  productId: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  endpoint?: string;
  apiKey?: string;
  batchSize: number;
  flushInterval: number;
  enableDebug: boolean;
  enableSampling: boolean;
  samplingRate: number;
  enableGDPR: boolean;
  retentionDays: number;
  enableRealTime: boolean;
}

export interface AnalyticsSession {
  id: string;
  userId?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  pageViews: number;
  events: number;
  bounceRate: number;
  country?: string;
  city?: string;
  device?: string;
  browser?: string;
  os?: string;
}

export interface AnalyticsMetrics {
  totalEvents: number;
  uniqueUsers: number;
  totalSessions: number;
  bounceRate: number;
  avgSessionDuration: number;
  topPages: Array<{ path: string; views: number }>;
  topEvents: Array<{ type: string; count: number }>;
  conversionRate: number;
  errorRate: number;
  performanceMetrics: Record<string, number>;
}

export interface AnalyticsFilter {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  sessionId?: string;
  eventTypes?: EventType[];
  products?: string[];
  environments?: string[];
  customFilters?: Record<string, unknown>;
}

export interface AnalyticsQuery {
  filters: AnalyticsFilter;
  metrics: string[];
  dimensions: string[];
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'heatmap' | 'funnel';
  title: string;
  query: AnalyticsQuery;
  visualization: VisualizationConfig;
  refreshInterval?: number;
}

export interface VisualizationConfig {
  chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  xAxis?: string;
  yAxis?: string;
  groupBy?: string;
  colorScheme?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  height?: number;
  width?: number;
}

export interface GDPRConfig {
  enabled: boolean;
  consentRequired: boolean;
  anonymizeIP: boolean;
  dataRetentionDays: number;
  cookiePolicy: string;
  doNotTrack: boolean;
  regionalRestrictions: string[];
}

export interface AnalyticsProvider {
  name: string;
  initialize(config: AnalyticsConfig): Promise<void>;
  track(event: AnalyticsEvent): Promise<void>;
  flush(): Promise<void>;
  getMetrics(query: AnalyticsQuery): Promise<AnalyticsMetrics>;
  destroy(): Promise<void>;
}

// Cloudflare-specific types (declared locally to avoid @cloudflare/workers-types dependency)
declare global {
  interface KVNamespace {
    get(key: string, options?: Record<string, unknown>): Promise<string | null>;
    put(key: string, value: string, options?: Record<string, unknown>): Promise<void>;
    delete(key: string): Promise<void>;
    list(options?: Record<string, unknown>): Promise<{ keys: Array<{ name: string }> }>;
  }

  interface D1Database {
    prepare(query: string): D1PreparedStatement;
    exec(query: string): Promise<{ results: unknown[] }>;
    batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
  }

  interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first(column?: string): Promise<unknown>;
    run(): Promise<{ success: boolean }>;
    all(): Promise<{ results: unknown[] }>;
  }

  interface Queue {
    send(message: unknown): Promise<void>;
  }
}

export interface CloudflareAnalyticsProvider extends AnalyticsProvider {
  kvNamespace?: KVNamespace;
  d1Database?: D1Database;
  queue?: Queue;
}

// Utility types
export type EventData<T extends EventType> = T extends 'page_view' ? PageViewEvent :
  T extends 'user_action' ? UserActionEvent :
  T extends 'form_submit' ? FormSubmitEvent :
  T extends 'api_call' ? ApiCallEvent :
  T extends 'error' ? ErrorEvent :
  T extends 'performance' ? PerformanceEvent :
  T extends 'conversion' ? ConversionEvent :
  T extends 'feature_usage' ? FeatureUsageEvent :
  Record<string, unknown>;

export type AnalyticsContext = {
  config: AnalyticsConfig;
  session: AnalyticsSession;
  gdpr: GDPRConfig;
};

export type SamplingStrategy = 'random' | 'deterministic' | 'adaptive';
export type StorageBackend = 'cloudflare-kv' | 'cloudflare-d1' | 'memory' | 'external';