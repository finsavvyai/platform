// @ts-nocheck
/**
 * Types for Policy Impact Analysis
 */

import { RiskLevel } from '@/types/policy-management';

export interface ImpactMetric {
  name: string;
  current: number;
  projected: number;
  change: number;
  changePercent: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface AffectedResource {
  id: string;
  name: string;
  type: 'api' | 'database' | 'service' | 'user' | 'data';
  impact: 'none' | 'read' | 'write' | 'delete' | 'admin';
  description: string;
  risk: RiskLevel;
  dependencies: string[];
  estimatedDowntime?: number;
  rollbackComplexity: 'simple' | 'moderate' | 'complex';
}

export interface SecurityImplication {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedControls: string[];
  mitigations: string[];
  complianceImpact: string[];
}

export interface PredictionModel {
  name: string;
  accuracy: number;
  confidence: number;
  factors: string[];
  predictions: {
    userImpact: number;
    systemLoad: number;
    errorRate: number;
    responseTime: number;
  };
}
