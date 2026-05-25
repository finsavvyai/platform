export interface RiskyUser {
  id: string;
  name: string;
  email: string;
  riskScore: number;
  anomalyCount: number;
  lastAnomaly: string;
  status: 'Active' | 'Suspended' | 'Under Review';
}

export interface AnomalyEvent {
  id: string;
  userId: string;
  userName: string;
  type: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  riskDelta: number;
  time: string;
  description: string;
}

export interface TimelineEvent {
  id: string;
  type: 'login' | 'data_access' | 'permission_change' | 'anomaly';
  label: string;
  time: string;
  isAnomalous: boolean;
}

export const SEVERITY_COLORS: Record<string, string> = {
  Critical: 'bg-red-500/20 text-red-400',
  High: 'bg-amber-500/20 text-amber-400',
  Medium: 'bg-info/20 text-info',
  Low: 'bg-neutral-500/20 text-neutral-400',
};

export const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-green-500/20 text-green-400',
  Suspended: 'bg-red-500/20 text-red-400',
  'Under Review': 'bg-amber-500/20 text-amber-400',
};
