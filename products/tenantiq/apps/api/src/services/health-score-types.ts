export interface Metrics {
  uptime?: number;
  cpu?: number;
  memory?: number;
  disk?: number;
  latency?: number;
  errorRate?: number;
  throughput?: number;
  responseTime?: number;
  [key: string]: number | undefined;
}

export interface HealthScore {
  score: number;
  components: Record<string, number>;
  critical: Array<{ component: string; severity: string; message: string }>;
  warnings: any[];
  trend?: { direction: string; rate: number };
}
