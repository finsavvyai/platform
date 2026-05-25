export type RequestStatus = 'approved' | 'denied' | 'expired' | 'revoked' | 'pending';
export type AccessLevel = 'read-only' | 'read-write' | 'admin';

export interface ActiveSession {
  id: string;
  user: string;
  resource: string;
  level: AccessLevel;
  startedAt: string;
  expiresAt: string;
}

export interface PendingRequest {
  id: string;
  requester: string;
  resource: string;
  level: AccessLevel;
  duration: string;
  justification: string;
  ticketRef?: string;
  requestedAt: string;
}

export interface HistoricalRequest {
  id: string;
  requester: string;
  resource: string;
  level: AccessLevel;
  duration: string;
  status: RequestStatus;
  processedBy: string;
  date: string;
}

export interface AccessSummary {
  activeSessions: number;
  pendingRequests: number;
  requestsToday: number;
}

export const resourceOptions = [
  'Production Database',
  'Admin Panel',
  'Cloud Console (AWS)',
  'Cloud Console (GCP)',
  'CI/CD Pipeline',
  'Secrets Manager',
  'Kubernetes Cluster',
  'Monitoring Dashboard',
] as const;

export const durationOptions = [
  { label: '30 minutes', value: '30 min' },
  { label: '1 hour', value: '1 hour' },
  { label: '4 hours', value: '4 hours' },
  { label: '8 hours', value: '8 hours' },
] as const;

export const levelOptions: AccessLevel[] = ['read-only', 'read-write', 'admin'];
