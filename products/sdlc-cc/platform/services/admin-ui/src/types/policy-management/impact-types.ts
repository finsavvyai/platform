/**
 * Policy Impact Types
 *
 * Types for policy impact analysis including resource, user,
 * system, performance, availability, and security impacts
 */

export interface PolicyImpact {
  affectedResources: ResourceImpact[];
  estimatedChanges: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  downtimeRisk: 'none' | 'minimal' | 'moderate' | 'significant';
  rollbackComplexity: 'simple' | 'moderate' | 'complex';
  userImpact: UserImpact;
  systemImpact: SystemImpact;
}

export interface ResourceImpact {
  type: 'api' | 'database' | 'service' | 'user' | 'data';
  id: string;
  name: string;
  impact: 'none' | 'read' | 'write' | 'delete' | 'admin';
  description: string;
}

export interface UserImpact {
  affectedUsers: number;
  impactLevel: 'none' | 'minimal' | 'moderate' | 'significant';
  notifications: string[];
  trainingRequired: boolean;
  downtimeWindows: DowntimeWindow[];
}

export interface DowntimeWindow {
  start: Date;
  end: Date;
  duration: number;
  affectedServices: string[];
  reason: string;
}

export interface SystemImpact {
  services: string[];
  databases: string[];
  apis: string[];
  performance: PerformanceImpact;
  availability: AvailabilityImpact;
  security: SecurityImpact;
}

export interface PerformanceImpact {
  latencyIncrease?: number;
  throughputDecrease?: number;
  memoryIncrease?: number;
  cpuIncrease?: number;
}

export interface AvailabilityImpact {
  downtimeRisk: string;
  recoveryTime: number;
  failoverRequired: boolean;
  backupRequired: boolean;
}

export interface SecurityImpact {
  authenticationChanges: string[];
  authorizationChanges: string[];
  dataAccessChanges: string[];
  auditChanges: string[];
  newRisks: string[];
  mitigations: string[];
}
