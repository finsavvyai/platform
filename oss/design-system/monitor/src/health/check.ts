import type {
  HealthStatus,
  HealthCheckFn,
  HealthStatusType,
} from '../types.js';

interface HealthCheckHandler {
  (): Promise<HealthStatus>;
}

const START_TIME = Date.now();

function aggregateStatus(statuses: HealthStatusType[]): HealthStatusType {
  if (statuses.some((s) => s === 'unhealthy')) return 'unhealthy';
  if (statuses.some((s) => s === 'degraded')) return 'degraded';
  return 'healthy';
}

export function createHealthCheck(checks: HealthCheckFn[]): HealthCheckHandler {
  return async (): Promise<HealthStatus> => {
    const results = await Promise.all(
      checks.map((check) =>
        check().catch((error) => ({
          name: 'unknown',
          status: 'unhealthy' as const,
          message: error instanceof Error ? error.message : 'Unknown error',
        }))
      )
    );

    const status = aggregateStatus(results.map((r) => r.status));
    const uptime = Date.now() - START_TIME;

    return {
      status,
      version: '0.1.0',
      uptime,
      timestamp: new Date().toISOString(),
      checks: results,
    };
  };
}
