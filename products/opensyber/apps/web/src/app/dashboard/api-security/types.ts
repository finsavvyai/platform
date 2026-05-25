export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
export type AuthType = 'API Key' | 'JWT' | 'None' | 'OAuth';
export type AttackType = 'Injection' | 'Brute Force' | 'Rate Abuse' | 'Auth Bypass';

export interface ApiEndpoint {
  id: string;
  method: HttpMethod;
  path: string;
  riskScore: number;
  authType: AuthType;
  lastCalled: string;
  requestVolume: number[];
}

export interface ApiAttack {
  id: string;
  endpointPath: string;
  attackType: AttackType;
  sourceIp: string;
  timestamp: string;
  blocked: boolean;
}

export interface ApiVulnerability {
  id: string;
  category: string;
  description: string;
  count: number;
  severity: 'Critical' | 'High' | 'Medium';
}

export interface ApiStats {
  totalEndpoints: number;
  highRiskEndpoints: number;
  attacks24h: number;
  authIssues: number;
}

export interface HourlyAttacks {
  hour: number;
  injection: number;
  bruteForce: number;
  rateAbuse: number;
  authBypass: number;
}

export const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'bg-green-500/20 text-green-400',
  POST: 'bg-info/20 text-info',
  PUT: 'bg-amber-500/20 text-amber-400',
  DELETE: 'bg-red-500/20 text-red-400',
};

export const ATTACK_COLORS: Record<AttackType, string> = {
  Injection: '#ef4444',
  'Brute Force': '#f59e0b',
  'Rate Abuse': '#3b82f6',
  'Auth Bypass': '#a855f7',
};
