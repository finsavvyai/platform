// @ts-nocheck
/**
 * Mock data for Policy Version Management
 */

import { PolicyVersion } from '@/types/policy-management';

export const mockVersions: PolicyVersion[] = [
  {
    version: 5,
    createdAt: new Date('2024-01-10T10:30:00Z'),
    createdBy: 'john.doe@example.com',
    changelog: 'Added MFA requirement for privileged operations',
    regoCode: 'package sdlc.policy\n\ndefault allow = false\n\nallow {\n    input.user.authenticated\n    input.user.mfa_verified\n    time.now_ns() - input.user.last_login < 86400000000000\n}',
    metadata: {
      version: '5.0.0',
      schema: 'rego-v1',
      compatibility: ['opa-v1.0'],
      requirements: ['MFA infrastructure'],
      limitations: ['None'],
      performance: {
        maxExecutionTime: 5000,
        averageExecutionTime: 1200,
        memoryUsage: 256,
        cpuUsage: 0.8,
        throughput: 800,
        errorRate: 0.02
      },
      compliance: {
        frameworks: ['SOX', 'HIPAA', 'PCI-DSS'],
        controls: ['AC-2', 'AC-3', 'IA-2'],
        certifications: ['ISO 27001'],
        lastAudit: new Date('2024-01-05T00:00:00Z'),
        nextAudit: new Date('2024-04-05T00:00:00Z'),
        auditScore: 95
      },
      risk: {
        level: 'medium',
        score: 45,
        factors: ['MFA dependency', 'User training required'],
        mitigations: ['Backup auth methods', 'Graceful rollout'],
        lastAssessed: new Date('2024-01-10T10:30:00Z')
      }
    },
    checksum: 'sha256:abc123...',
    signature: '-----BEGIN SIGNATURE-----\n...',
    approvedBy: 'jane.smith@example.com',
    approvedAt: new Date('2024-01-10T11:00:00Z')
  },
  {
    version: 4,
    createdAt: new Date('2024-01-05T14:20:00Z'),
    createdBy: 'jane.smith@example.com',
    changelog: 'Enhanced session management with secure token handling',
    regoCode: 'package sdlc.policy\n\ndefault allow = false\n\nallow {\n    input.user.authenticated\n    valid_session(input.user.session_id)\n    time.now_ns() - input.user.last_login < 172800000000000\n}',
    metadata: {
      version: '4.2.1',
      schema: 'rego-v1',
      compatibility: ['opa-v1.0'],
      requirements: ['Redis session store'],
      limitations: ['Session size limited'],
      performance: {
        maxExecutionTime: 3000,
        averageExecutionTime: 800,
        memoryUsage: 192,
        cpuUsage: 0.5,
        throughput: 1000,
        errorRate: 0.01
      },
      compliance: {
        frameworks: ['SOX', 'HIPAA'],
        controls: ['AC-2', 'SC-23'],
        certifications: ['ISO 27001'],
        lastAudit: new Date('2024-01-01T00:00:00Z'),
        nextAudit: new Date('2024-04-01T00:00:00Z'),
        auditScore: 92
      },
      risk: {
        level: 'low',
        score: 25,
        factors: ['Session persistence'],
        mitigations: ['Session failover', 'Token refresh'],
        lastAssessed: new Date('2024-01-05T14:20:00Z')
      }
    },
    checksum: 'sha256:def456...',
    signature: '-----BEGIN SIGNATURE-----\n...',
    approvedBy: 'mike.johnson@example.com',
    approvedAt: new Date('2024-01-05T15:00:00Z')
  },
  {
    version: 3,
    createdAt: new Date('2023-12-20T09:15:00Z'),
    createdBy: 'mike.johnson@example.com',
    changelog: 'Fixed RBAC evaluation logic for nested roles',
    regoCode: 'package sdlc.policy\n\ndefault allow = false\n\nallow {\n    user_roles := data.roles[input.user.id]\n    required_roles := data.resources[input.resource.id].roles\n    count(user_roles & required_roles) > 0\n}',
    metadata: {
      version: '3.1.0',
      schema: 'rego-v1',
      compatibility: ['opa-v1.0'],
      requirements: ['Role database'],
      limitations: ['Max 10 nested roles'],
      performance: {
        maxExecutionTime: 2000,
        averageExecutionTime: 500,
        memoryUsage: 128,
        cpuUsage: 0.3,
        throughput: 1200,
        errorRate: 0.005
      },
      compliance: {
        frameworks: ['SOX'],
        controls: ['AC-2', 'AC-3'],
        certifications: ['ISO 27001'],
        lastAudit: new Date('2023-12-15T00:00:00Z'),
        nextAudit: new Date('2024-03-15T00:00:00Z'),
        auditScore: 88
      },
      risk: {
        level: 'low',
        score: 20,
        factors: ['Role complexity'],
        mitigations: ['Role caching', 'Optimized queries'],
        lastAssessed: new Date('2023-12-20T09:15:00Z')
      }
    },
    checksum: 'sha256:ghi789...',
    signature: '-----BEGIN SIGNATURE-----\n...',
    approvedBy: 'john.doe@example.com',
    approvedAt: new Date('2023-12-20T10:00:00Z')
  }
];
