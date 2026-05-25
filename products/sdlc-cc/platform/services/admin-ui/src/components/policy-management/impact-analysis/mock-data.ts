// @ts-nocheck
/**
 * Mock metrics data for Policy Impact Analysis
 */

import { ImpactMetric, SecurityImplication, PredictionModel } from './types';

export { mockImpact } from './mock-impact';

export const impactMetrics: ImpactMetric[] = [
  { name: 'Response Time', current: 50, projected: 58, change: 8, changePercent: 16, unit: 'ms', trend: 'up', severity: 'medium' },
  { name: 'Request Rate', current: 1000, projected: 950, change: -50, changePercent: -5, unit: 'req/s', trend: 'down', severity: 'low' },
  { name: 'Memory Usage', current: 512, projected: 640, change: 128, changePercent: 25, unit: 'MB', trend: 'up', severity: 'medium' },
  { name: 'CPU Usage', current: 30, projected: 40, change: 10, changePercent: 33, unit: '%', trend: 'up', severity: 'high' },
  { name: 'Error Rate', current: 0.1, projected: 0.2, change: 0.1, changePercent: 100, unit: '%', trend: 'up', severity: 'high' },
  { name: 'Throughput', current: 50000, projected: 47500, change: -2500, changePercent: -5, unit: 'req/min', trend: 'down', severity: 'low' }
];

export const securityImplications: SecurityImplication[] = [
  {
    type: 'Authentication Strengthening', severity: 'medium',
    description: 'Multi-factor authentication will be required for all privileged operations',
    affectedControls: ['AC-2', 'AC-3', 'IA-2'],
    mitigations: ['Graceful rollout', 'User communication', 'Backup authentication methods'],
    complianceImpact: ['SOX', 'HIPAA', 'PCI-DSS']
  },
  {
    type: 'Data Access Logging', severity: 'low',
    description: 'All data access will be logged with user context and timestamp',
    affectedControls: ['AU-2', 'AU-3', 'AU-12'],
    mitigations: ['Log rotation', 'Secure storage', 'Access controls on logs'],
    complianceImpact: ['GDPR', 'CCPA', 'HIPAA']
  },
  {
    type: 'Session Management', severity: 'medium',
    description: 'Session timeout reduced to 30 minutes for enhanced security',
    affectedControls: ['SC-23', 'AC-11'],
    mitigations: ['Session refresh mechanism', 'User notifications'],
    complianceImpact: ['NIST SP 800-53']
  },
  {
    type: 'Privilege Escalation', severity: 'high',
    description: 'New controls prevent privilege escalation through policy chaining',
    affectedControls: ['AC-6', 'AC-5'],
    mitigations: ['Thorough testing', 'Fallback mechanisms'],
    complianceImpact: ['SOX', 'PCI-DSS']
  }
];

export const predictionModels: PredictionModel[] = [
  {
    name: 'ML-Based Impact Prediction', accuracy: 92, confidence: 88,
    factors: ['Historical data', 'Policy complexity', 'System load'],
    predictions: { userImpact: 15, systemLoad: 12, errorRate: 0.15, responseTime: 55 }
  },
  {
    name: 'Statistical Analysis', accuracy: 85, confidence: 82,
    factors: ['Resource usage', 'Dependencies', 'User patterns'],
    predictions: { userImpact: 18, systemLoad: 15, errorRate: 0.2, responseTime: 60 }
  },
  {
    name: 'Expert System', accuracy: 78, confidence: 75,
    factors: ['Rule-based analysis', 'Security policies', 'Best practices'],
    predictions: { userImpact: 12, systemLoad: 10, errorRate: 0.1, responseTime: 52 }
  }
];
