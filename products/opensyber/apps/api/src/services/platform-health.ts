/**
 * Platform Health Aggregator
 *
 * Provides a unified health check across all platform subsystems.
 * Used for investor dashboards and operational monitoring.
 */

export interface SubsystemHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latencyMs?: number;
  details?: string;
}

export interface PlatformHealth {
  overall: 'healthy' | 'degraded' | 'down';
  subsystems: SubsystemHealth[];
  uptimePercent: number;
  timestamp: string;
}

export function aggregatePlatformHealth(
  subsystems: SubsystemHealth[],
): PlatformHealth {
  const hasDown = subsystems.some((s) => s.status === 'down');
  const hasDegraded = subsystems.some((s) => s.status === 'degraded');

  let overall: PlatformHealth['overall'] = 'healthy';
  if (hasDown) overall = 'down';
  else if (hasDegraded) overall = 'degraded';

  const healthy = subsystems.filter((s) => s.status === 'healthy').length;
  const uptimePercent = subsystems.length > 0
    ? Math.round((healthy / subsystems.length) * 10000) / 100
    : 100;

  return {
    overall,
    subsystems,
    uptimePercent,
    timestamp: new Date().toISOString(),
  };
}

export function getDefaultSubsystems(): SubsystemHealth[] {
  return [
    { name: 'API', status: 'healthy', latencyMs: 45 },
    { name: 'Database', status: 'healthy', latencyMs: 12 },
    { name: 'Auth', status: 'healthy', latencyMs: 89 },
    { name: 'Agent Monitor', status: 'healthy', latencyMs: 23 },
    { name: 'CSPM Scanner', status: 'healthy', latencyMs: 156 },
    { name: 'Alert Engine', status: 'healthy', latencyMs: 34 },
  ];
}
