export interface InstanceData {
  id: string;
  name: string;
  status: string;
  region: string;
  engineVersion: string | null;
  agentVersion: string | null;
  lastHealthCheck: string | null;
  createdAt: string;
}

export interface HealthData {
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  engineRunning: boolean;
  timestamp: string;
}

export interface SecurityDashboard {
  score: {
    overall: number;
    recommendations: string[];
  };
  recentEvents: Array<{
    id: string;
    eventType: string;
    severity: string;
    details: string | null;
    createdAt: string;
  }>;
}

/** Brand signal colours for progress bars */
export function progressColor(value: number): string {
  if (value >= 90) return 'bg-alert';
  if (value >= 70) return 'bg-warn';
  return 'bg-signal';
}

/** Brand signal colours for score display */
export function scoreColor(score: number): string {
  if (score >= 80) return 'text-ok';
  if (score >= 60) return 'text-warn';
  if (score >= 40) return 'text-warn';
  return 'text-alert';
}

/** Brand severity badge colours */
export const severityColors: Record<string, string> = {
  info: 'bg-info/12 text-info',
  warning: 'bg-warn/12 text-warn',
  critical: 'bg-alert/12 text-alert',
};
