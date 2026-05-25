export interface MonitorConfig {
  environment: string;
  version: string;
  dsn?: string;
  tracesSampleRate?: number;
  debugLogging?: boolean;
}

export type HealthStatusType = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheckResult {
  name: string;
  status: HealthStatusType;
  message?: string;
  latencyMs?: number;
}

export interface HealthStatus {
  status: HealthStatusType;
  version: string;
  uptime: number;
  timestamp: string;
  checks: HealthCheckResult[];
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface MetricOptions {
  name: string;
  help: string;
  labels?: string[];
}

export interface SentryConfig extends MonitorConfig {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate?: number;
}

export type HealthCheckFn = () => Promise<HealthCheckResult>;

export interface LoggerOptions {
  name?: string;
  level?: string;
  maskSensitiveFields?: boolean;
}
