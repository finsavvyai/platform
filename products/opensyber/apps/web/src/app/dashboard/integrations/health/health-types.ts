export type HealthStatus = 'healthy' | 'degraded' | 'down';

export interface IntegrationHealth {
  id: string;
  slug: string;
  status: string;
  lastSyncAt: string | null;
  eventsReceived: number;
  errorCount: number;
  lastErrorAt: string | null;
  consecutiveFailures: number;
  avgLatencyMs: number;
  health: HealthStatus;
}

export interface HealthSummary {
  healthy: number;
  degraded: number;
  down: number;
}

export interface IntegrationHealthResponse {
  integrations: IntegrationHealth[];
  summary: HealthSummary;
}

export interface SyncEvent {
  id: string;
  eventType: string;
  severity: string;
  summary: string;
  latencyMs: number | null;
  createdAt: string;
}

export interface SyncEventsResponse {
  events: SyncEvent[];
}
