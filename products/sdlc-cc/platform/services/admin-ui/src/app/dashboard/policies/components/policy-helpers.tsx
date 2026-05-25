// @ts-nocheck
/**
 * Helper functions for Policy Management Page
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { PolicyStatus, PolicyPriority, PolicyCategory, Policy } from '@/types/policy-management';

export function getStatusBadge(status: PolicyStatus) {
  switch (status) {
    case 'draft':
      return <Badge variant="secondary">Draft</Badge>;
    case 'testing':
      return <Badge variant="default" className="bg-yellow-100 text-yellow-800">Testing</Badge>;
    case 'review':
      return <Badge variant="outline">In Review</Badge>;
    case 'approved':
      return <Badge variant="default" className="bg-blue-100 text-blue-800">Approved</Badge>;
    case 'deployed':
      return <Badge variant="default" className="bg-green-100 text-green-800">Deployed</Badge>;
    case 'deprecated':
      return <Badge variant="destructive">Deprecated</Badge>;
    case 'disabled':
      return <Badge variant="outline">Disabled</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export function getPriorityColor(priority: PolicyPriority): string {
  switch (priority) {
    case 'critical': return 'text-red-600';
    case 'high': return 'text-orange-600';
    case 'medium': return 'text-yellow-600';
    case 'low': return 'text-green-600';
    default: return 'text-gray-600';
  }
}

export function createNewPolicy(): Policy {
  return {
    id: `policy-${Date.now()}`,
    name: 'New Policy',
    description: '',
    category: 'authorization' as PolicyCategory,
    status: 'draft' as PolicyStatus,
    priority: 'medium' as PolicyPriority,
    regoCode: 'package new.policy\n\ndefault allow = false',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'current-user@example.com',
    updatedBy: 'current-user@example.com',
    tenantId: 'tenant-1',
    tags: [],
    metadata: {
      version: '1.0.0', schema: 'rego-v1', compatibility: ['opa-v1.0'],
      requirements: [], limitations: [],
      performance: { maxExecutionTime: 5000, averageExecutionTime: 1000, memoryUsage: 128, cpuUsage: 0.5, throughput: 1000, errorRate: 0.01 },
      compliance: { frameworks: [], controls: [], certifications: [], lastAudit: new Date(), nextAudit: new Date(), auditScore: 0 },
      risk: { level: 'low', score: 0, factors: [], mitigations: [], lastAssessed: new Date() }
    },
    approvalStatus: 'pending', deploymentStatus: 'not_deployed',
    lastTested: undefined, testResults: [], versionHistory: [], dependencies: [],
    impact: {
      affectedResources: [], estimatedChanges: 0, riskLevel: 'low', downtimeRisk: 'none', rollbackComplexity: 'simple',
      userImpact: { affectedUsers: 0, impactLevel: 'none', notifications: [], trainingRequired: false, downtimeWindows: [] },
      systemImpact: { services: [], databases: [], apis: [],
        performance: { latencyIncrease: 0, throughputDecrease: 0, memoryIncrease: 0, cpuIncrease: 0 },
        availability: { downtimeRisk: 'none', recoveryTime: 0, failoverRequired: false, backupRequired: false },
        security: { authenticationChanges: [], authorizationChanges: [], dataAccessChanges: [], auditChanges: [], newRisks: [], mitigations: [] }
      }
    },
    securityContext: {
      classification: 'internal', accessControls: [],
      encryption: { atRest: true, inTransit: true, algorithm: 'AES-256', keyRotation: 90, keyManagement: 'KMS' },
      auditLogging: { logLevel: 'info', logRetention: 365, logDestinations: [], sensitiveDataMasking: true, realTimeAlerts: true },
      dataRetention: { policyData: 2555, auditLogs: 2555, testResults: 90, versions: 10, autoDelete: false },
      complianceRequirements: [], securityChecks: []
    }
  } as Policy;
}
