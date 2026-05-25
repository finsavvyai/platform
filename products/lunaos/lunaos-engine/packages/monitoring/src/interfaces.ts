/**
 * Monitoring interfaces and types for Claude Agent Platform
 */

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  duration: number;
  details: HealthCheckDetails;
  issues: HealthIssue[];
  metadata?: Record<string, any>;
}

export interface HealthCheckDetails {
  services: ServiceHealth[];
  infrastructure: InfrastructureHealth;
  system: SystemHealth;
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastCheck: Date;
  uptime: number;
  errorRate: number;
  throughput: number;
  details?: Record<string, any>;
}

export interface InfrastructureHealth {
  database: DatabaseHealth;
  cache: CacheHealth;
  messaging: MessagingHealth;
  storage: StorageHealth;
}

export interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  connectionPool: {
    active: number;
    idle: number;
    total: number;
  };
  queries: {
    total: number;
    slow: number;
    failed: number;
  };
  details?: Record<string, any>;
}

export interface CacheHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  hitRate: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  keyCount: number;
  details?: Record<string, any>;
}

export interface MessagingHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connected: boolean;
  queues: QueueHealth[];
  connectionPool: {
    active: number;
    idle: number;
    total: number;
  };
  details?: Record<string, any>;
}

export interface QueueHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  messages: {
    ready: number;
    unacknowledged: number;
    total: number;
  };
  consumers: number;
  rate: number;
  details?: Record<string, any>;
}

export interface StorageHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  usage: {
    used: number;
    total: number;
    percentage: number;
  };
  availability: number;
  details?: Record<string, any>;
}

export interface SystemHealth {
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    heap: {
      used: number;
      total: number;
      percentage: number;
    };
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
    readSpeed: number;
    writeSpeed: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
  uptime: number;
}

export interface HealthIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'service' | 'infrastructure' | 'system' | 'security';
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  resolved?: boolean;
  resolvedAt?: Date;
}

export interface MetricsConfig {
  enabled: boolean;
  collectDefaultMetrics: boolean;
  prefix: string;
  labels: Record<string, string>;
  buckets: number[];
  percentileThresholds: number[];
}

export interface LoggingConfig {
  level: 'error' | 'warn' | 'info' | 'debug';
  format: 'json' | 'simple';
  console: boolean;
  file: {
    enabled: boolean;
    filename: string;
    maxSize: string;
    maxFiles: number;
  };
  elasticsearch?: {
    enabled: boolean;
    index: string;
    host: string;
    port: number;
    auth?: {
      username: string;
      password: string;
    };
  };
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  condition: AlertCondition;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cooldown: number; // milliseconds
  notifications: NotificationConfig[];
  metadata?: Record<string, any>;
}

export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';
  threshold: number;
  duration: number; // milliseconds
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
  interval: number; // milliseconds
}

export interface NotificationConfig {
  type: 'webhook' | 'email' | 'slack' | 'pagerduty';
  config: Record<string, any>;
  enabled: boolean;
}

export interface MonitoringConfig {
  healthCheck: {
    interval: number;
    timeout: number;
    retries: number;
  };
  metrics: MetricsConfig;
  logging: LoggingConfig;
  alerts: {
    enabled: boolean;
    rules: AlertRule[];
  };
  tracing: {
    enabled: boolean;
    sampling: number;
    exporter: 'jaeger' | 'zipkin' | 'otlp';
    endpoint?: string;
  };
}

export interface PerformanceMetrics {
  requestDuration: {
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  };
  requestRate: {
    total: number;
    success: number;
    error: number;
  };
  throughput: {
    requests: number;
    bytes: number;
  };
  errorRate: number;
  availability: number;
}

export interface CustomMetric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  help: string;
  labels?: string[];
  values?: number[];
}

export interface MonitoringEvent {
  type: 'metric' | 'health' | 'alert' | 'log';
  timestamp: Date;
  source: string;
  data: any;
  metadata?: Record<string, any>;
}

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'text';
  title: string;
  query: string;
  refreshInterval: number;
  config: Record<string, any>;
}

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  layout: {
    columns: number;
    rows: number;
  };
  sharing: {
    public: boolean;
    token?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
