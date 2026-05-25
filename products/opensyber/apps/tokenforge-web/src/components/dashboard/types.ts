export interface Session {
  id: string;
  deviceId: string;
  userId: string;
  trustScore: number;
  status: 'active' | 'revoked' | 'expired';
  boundAt: string;
  lastSeen: string;
  userAgent: string;
  ip: string;
}

export interface SecurityEvent {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  ip: string;
  country: string;
  deviceId: string | null;
  details: Record<string, string>;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  allowedDomains?: string[];
}

export interface UsageDataPoint {
  day: string;
  count: number;
}

export interface DashboardStats {
  activeSessions: number;
  verificationsToday: number;
  trustScoreAverage: number;
  planUsagePercent: number;
  planLimit: number;
  planUsed: number;
}

export interface ComplianceReport {
  period: { label: string; start: string; end: string };
  tenant: { name: string; plan: string };
  totalVerifications: number;
  threatsBlocked: { total: number; byType: Record<string, number> };
  averageTrustScore: number;
  activeSessions: number;
  deviceBindingCoverage: number;
  uptime: number;
  generatedAt: string;
}
