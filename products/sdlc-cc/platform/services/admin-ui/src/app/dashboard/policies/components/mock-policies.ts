// @ts-nocheck
/**
 * Mock policy data for the Policy Management Page
 */

import { Policy } from '@/types/policy-management';

export const mockPolicies: Policy[] = [
  {
    id: 'policy-1',
    name: 'User Authentication Policy',
    description: 'Controls user authentication with MFA requirements',
    category: 'authentication',
    status: 'deployed',
    priority: 'critical',
    regoCode: `package sdlc.auth\n\ndefault allow = false\n\nallow {\n    input.user.authenticated\n    input.user.mfa_verified\n    time.now_ns() - input.user.last_login < 86400000000000\n}`,
    version: 5,
    createdAt: new Date('2024-01-10T10:30:00Z'),
    updatedAt: new Date('2024-01-15T14:20:00Z'),
    createdBy: 'john.doe@example.com',
    updatedBy: 'john.doe@example.com',
    tenantId: 'tenant-1',
    tags: ['authentication', 'mfa', 'security'],
    metadata: {
      version: '5.0.0', schema: 'rego-v1', compatibility: ['opa-v1.0'],
      requirements: ['MFA infrastructure'], limitations: [],
      performance: { maxExecutionTime: 5000, averageExecutionTime: 1200, memoryUsage: 256, cpuUsage: 0.8, throughput: 800, errorRate: 0.02 },
      compliance: { frameworks: ['SOX', 'HIPAA', 'PCI-DSS'], controls: ['AC-2', 'AC-3', 'IA-2'], certifications: ['ISO 27001'], lastAudit: new Date('2024-01-05T00:00:00Z'), nextAudit: new Date('2024-04-05T00:00:00Z'), auditScore: 95 },
      risk: { level: 'medium', score: 45, factors: [], mitigations: [], lastAssessed: new Date('2024-01-10T10:30:00Z') }
    },
    approvalStatus: 'approved', deploymentStatus: 'deployed',
    lastTested: new Date('2024-01-15T10:00:00Z'), testResults: [], versionHistory: [], dependencies: [],
    impact: {
      affectedResources: [], estimatedChanges: 23, riskLevel: 'medium', downtimeRisk: 'minimal', rollbackComplexity: 'moderate',
      userImpact: { affectedUsers: 15420, impactLevel: 'moderate', notifications: [], trainingRequired: true, downtimeWindows: [] },
      systemImpact: { services: [], databases: [], apis: [],
        performance: { latencyIncrease: 15, throughputDecrease: 5, memoryIncrease: 128, cpuIncrease: 10 },
        availability: { downtimeRisk: 'minimal', recoveryTime: 30, failoverRequired: false, backupRequired: true },
        security: { authenticationChanges: [], authorizationChanges: [], dataAccessChanges: [], auditChanges: [], newRisks: [], mitigations: [] }
      }
    },
    securityContext: {
      classification: 'internal', accessControls: [],
      encryption: { atRest: true, inTransit: true, algorithm: 'AES-256', keyRotation: 90, keyManagement: 'KMS' },
      auditLogging: { logLevel: 'info', logRetention: 365, logDestinations: ['SIEM', 'CloudWatch'], sensitiveDataMasking: true, realTimeAlerts: true },
      dataRetention: { policyData: 2555, auditLogs: 2555, testResults: 90, versions: 10, autoDelete: false },
      complianceRequirements: ['SOX', 'HIPAA', 'PCI-DSS'], securityChecks: []
    }
  },
  {
    id: 'policy-2',
    name: 'Data Access Control',
    description: 'Manages data access based on classification and clearance',
    category: 'data_access',
    status: 'deployed',
    priority: 'high',
    regoCode: `package sdlc.data_access\n\ndefault allow = false\n\nallow {\n    input.user.clearance >= input.data.classification\n    data.purpose_allowed[input.context.purpose]\n    not data.restricted_data[input.data.type]\n}`,
    version: 3,
    createdAt: new Date('2024-01-05T14:20:00Z'),
    updatedAt: new Date('2024-01-12T09:30:00Z'),
    createdBy: 'jane.smith@example.com',
    updatedBy: 'jane.smith@example.com',
    tenantId: 'tenant-1',
    tags: ['data', 'access', 'classification'],
    metadata: {
      version: '3.1.0', schema: 'rego-v1', compatibility: ['opa-v1.0'],
      requirements: [], limitations: [],
      performance: { maxExecutionTime: 3000, averageExecutionTime: 800, memoryUsage: 192, cpuUsage: 0.5, throughput: 1000, errorRate: 0.01 },
      compliance: { frameworks: ['SOX', 'HIPAA'], controls: ['AC-2', 'SC-23'], certifications: ['ISO 27001'], lastAudit: new Date('2024-01-01T00:00:00Z'), nextAudit: new Date('2024-04-01T00:00:00Z'), auditScore: 92 },
      risk: { level: 'low', score: 25, factors: [], mitigations: [], lastAssessed: new Date('2024-01-05T14:20:00Z') }
    },
    approvalStatus: 'approved', deploymentStatus: 'deployed',
    lastTested: new Date('2024-01-12T08:00:00Z'), testResults: [], versionHistory: [], dependencies: [],
    impact: {
      affectedResources: [], estimatedChanges: 15, riskLevel: 'low', downtimeRisk: 'none', rollbackComplexity: 'simple',
      userImpact: { affectedUsers: 8500, impactLevel: 'minimal', notifications: [], trainingRequired: false, downtimeWindows: [] },
      systemImpact: { services: [], databases: [], apis: [],
        performance: { latencyIncrease: 5, throughputDecrease: 2, memoryIncrease: 64, cpuIncrease: 5 },
        availability: { downtimeRisk: 'none', recoveryTime: 0, failoverRequired: false, backupRequired: false },
        security: { authenticationChanges: [], authorizationChanges: [], dataAccessChanges: [], auditChanges: [], newRisks: [], mitigations: [] }
      }
    },
    securityContext: {
      classification: 'confidential', accessControls: [],
      encryption: { atRest: true, inTransit: true, algorithm: 'AES-256', keyRotation: 90, keyManagement: 'KMS' },
      auditLogging: { logLevel: 'info', logRetention: 365, logDestinations: ['SIEM', 'CloudWatch'], sensitiveDataMasking: true, realTimeAlerts: true },
      dataRetention: { policyData: 2555, auditLogs: 2555, testResults: 90, versions: 10, autoDelete: false },
      complianceRequirements: ['SOX', 'HIPAA', 'GDPR'], securityChecks: []
    }
  },
  {
    id: 'policy-3',
    name: 'API Rate Limiting',
    description: 'Enforces rate limits on API endpoints',
    category: 'api_security',
    status: 'testing',
    priority: 'medium',
    regoCode: `package sdlc.rate_limit\n\ndefault allow = true\n\ndeny {\n    count(requests[input.user.id][time.now_ns() // 1000000000]) > 100\n}`,
    version: 2,
    createdAt: new Date('2024-01-08T11:45:00Z'),
    updatedAt: new Date('2024-01-14T16:00:00Z'),
    createdBy: 'mike.johnson@example.com',
    updatedBy: 'mike.johnson@example.com',
    tenantId: 'tenant-1',
    tags: ['api', 'rate-limit', 'performance'],
    metadata: {
      version: '2.0.0', schema: 'rego-v1', compatibility: ['opa-v1.0'],
      requirements: [], limitations: [],
      performance: { maxExecutionTime: 1000, averageExecutionTime: 200, memoryUsage: 64, cpuUsage: 0.2, throughput: 5000, errorRate: 0.001 },
      compliance: { frameworks: [], controls: [], certifications: [], lastAudit: new Date('2024-01-08T00:00:00Z'), nextAudit: new Date('2024-04-08T00:00:00Z'), auditScore: 0 },
      risk: { level: 'low', score: 15, factors: [], mitigations: [], lastAssessed: new Date('2024-01-08T11:45:00Z') }
    },
    approvalStatus: 'pending', deploymentStatus: 'not_deployed',
    lastTested: new Date('2024-01-14T15:30:00Z'), testResults: [], versionHistory: [], dependencies: [],
    impact: {
      affectedResources: [], estimatedChanges: 8, riskLevel: 'low', downtimeRisk: 'none', rollbackComplexity: 'simple',
      userImpact: { affectedUsers: 0, impactLevel: 'none', notifications: [], trainingRequired: false, downtimeWindows: [] },
      systemImpact: { services: [], databases: [], apis: [],
        performance: { latencyIncrease: 1, throughputDecrease: 0, memoryIncrease: 32, cpuIncrease: 2 },
        availability: { downtimeRisk: 'none', recoveryTime: 0, failoverRequired: false, backupRequired: false },
        security: { authenticationChanges: [], authorizationChanges: [], dataAccessChanges: [], auditChanges: [], newRisks: [], mitigations: [] }
      }
    },
    securityContext: {
      classification: 'public', accessControls: [],
      encryption: { atRest: false, inTransit: true, algorithm: 'TLS-1.3', keyRotation: 0, keyManagement: 'None' },
      auditLogging: { logLevel: 'warn', logRetention: 90, logDestinations: ['CloudWatch'], sensitiveDataMasking: false, realTimeAlerts: false },
      dataRetention: { policyData: 90, auditLogs: 90, testResults: 30, versions: 5, autoDelete: true },
      complianceRequirements: [], securityChecks: []
    }
  }
];
