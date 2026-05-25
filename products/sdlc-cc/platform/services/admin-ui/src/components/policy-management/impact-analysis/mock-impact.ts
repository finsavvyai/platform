// @ts-nocheck
/**
 * Mock impact data for Policy Impact Analysis
 */

import { PolicyImpact } from '@/types/policy-management';

export const mockImpact: PolicyImpact = {
  affectedResources: [
    { type: 'api', id: 'api-auth-service', name: 'Authentication API', impact: 'write', description: 'All authentication endpoints will be affected', risk: 'medium' },
    { type: 'database', id: 'db-user-sessions', name: 'User Sessions Database', impact: 'read', description: 'Read access to user sessions for validation', risk: 'low' },
    { type: 'service', id: 'svc-gateway', name: 'API Gateway', impact: 'write', description: 'Gateway configuration will be updated', risk: 'high' },
    { type: 'user', id: 'users-all', name: 'All Active Users', impact: 'read', description: 'User permissions will be evaluated', risk: 'low' },
    { type: 'data', id: 'data-phi', name: 'Protected Health Information', impact: 'admin', description: 'PHI access controls will be enforced', risk: 'critical' }
  ],
  estimatedChanges: 23,
  riskLevel: 'medium',
  downtimeRisk: 'minimal',
  rollbackComplexity: 'moderate',
  userImpact: {
    affectedUsers: 15420,
    impactLevel: 'moderate',
    notifications: ['Security policy update notification', 'New authentication requirements', 'Session timeout changes'],
    trainingRequired: true,
    downtimeWindows: [{
      start: new Date('2024-01-15T02:00:00Z'),
      end: new Date('2024-01-15T02:30:00Z'),
      duration: 30,
      affectedServices: ['Authentication API', 'User Management'],
      reason: 'Policy deployment and validation'
    }]
  },
  systemImpact: {
    services: ['auth-service', 'user-service', 'gateway'],
    databases: ['users', 'sessions', 'audit_logs'],
    apis: ['/api/v1/auth/*', '/api/v1/users/*'],
    performance: { latencyIncrease: 15, throughputDecrease: 5, memoryIncrease: 128, cpuIncrease: 10 },
    availability: { downtimeRisk: 'minimal', recoveryTime: 30, failoverRequired: false, backupRequired: true },
    security: {
      authenticationChanges: ['MFA requirement for all users', 'Session timeout reduction'],
      authorizationChanges: ['Role-based access updates', 'Resource-level permissions'],
      dataAccessChanges: ['PHI access logging', 'Data classification enforcement'],
      auditChanges: ['Enhanced logging', 'Real-time monitoring'],
      newRisks: ['Policy complexity may impact performance', 'Training required for users'],
      mitigations: ['Gradual rollout', 'Comprehensive testing', 'User training sessions']
    }
  }
};
