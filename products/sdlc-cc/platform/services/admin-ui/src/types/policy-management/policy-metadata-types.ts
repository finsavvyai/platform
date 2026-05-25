/**
 * Policy Metadata Types
 *
 * Types for policy metadata, compliance, risk assessment,
 * security context, and access control configurations
 */

import type { SecurityLevel } from './policy-types';

export interface PolicyMetadata {
  version: string;
  schema: string;
  compatibility: string[];
  requirements: string[];
  limitations: string[];
  performance: PerformanceMetrics;
  compliance: ComplianceInfo;
  risk: RiskAssessment;
}

export interface PerformanceMetrics {
  maxExecutionTime: number;
  averageExecutionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  throughput: number;
  errorRate: number;
}

export interface ComplianceInfo {
  frameworks: ComplianceFramework[];
  controls: string[];
  certifications: string[];
  lastAudit: Date;
  nextAudit: Date;
  auditScore?: number;
}

export interface ComplianceFramework {
  name: string;
  version: string;
  controls: string[];
  status: 'compliant' | 'non_compliant' | 'partial';
  evidence: string[];
}

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  factors: RiskFactor[];
  mitigations: string[];
  lastAssessed: Date;
}

export interface RiskFactor {
  type: string;
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  likelihood: 'low' | 'medium' | 'high';
}

export interface PolicySecurityContext {
  classification: SecurityLevel;
  accessControls: AccessControl[];
  encryption: EncryptionConfig;
  auditLogging: AuditConfig;
  dataRetention: RetentionConfig;
  complianceRequirements: string[];
  securityChecks: SecurityCheck[];
}

export interface AccessControl {
  type: 'RBAC' | 'ABAC' | 'ACL';
  permissions: string[];
  conditions: string[];
  exemptions: string[];
}

export interface EncryptionConfig {
  atRest: boolean;
  inTransit: boolean;
  algorithm: string;
  keyRotation: number;
  keyManagement: string;
}

export interface AuditConfig {
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logRetention: number;
  logDestinations: string[];
  sensitiveDataMasking: boolean;
  realTimeAlerts: boolean;
}

export interface RetentionConfig {
  policyData: number;
  auditLogs: number;
  testResults: number;
  versions: number;
  autoDelete: boolean;
}

export interface SecurityCheck {
  type: string;
  enabled: boolean;
  threshold?: number;
  action: 'warn' | 'block' | 'escalate';
  schedule?: string;
}
