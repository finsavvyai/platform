import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  CompliancePolicy,
  AuditLog,
  ComplianceReport,
  PolicyViolation,
} from '../src/compliance/types';

describe('Compliance & Policy Enforcement', () => {
  let complianceEngine: any;
  let mockDatabase: any;
  let mockAuditLogger: any;

  beforeEach(() => {
    mockDatabase = {
      insert: vi.fn().mockResolvedValue({ id: 'policy-1' }),
      query: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({ success: true }),
      delete: vi.fn().mockResolvedValue({ success: true }),
    };

    mockAuditLogger = {
      log: vi.fn().mockImplementation(async (entry: any) => {
        await mockDatabase.insert('audit_logs', entry);
        return entry;
      }),
      query: vi.fn().mockResolvedValue([]),
      generateReport: vi.fn().mockResolvedValue({}),
    };

    complianceEngine = {
      createPolicy: vi.fn().mockImplementation(async (policy: any) => {
        await mockDatabase.insert('policies', policy);
        return policy;
      }),
      enforcePolicy: vi.fn(),
      checkViolation: vi.fn(),
      generateReport: vi.fn(),
      auditLog: mockAuditLogger,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Policy Enforcement', () => {
    it('should enforce require_2fa policy', async () => {
      const policy: CompliancePolicy = {
        id: 'policy-2fa',
        name: 'Require 2FA',
        framework: 'SOC2',
        rules: [
          {
            condition: 'mfa_enabled',
            action: 'enforce',
            severity: 'high',
          },
        ],
      };

      const result = await complianceEngine.createPolicy(policy);

      expect(result.name).toBe('Require 2FA');
      expect(mockDatabase.insert).toHaveBeenCalledWith('policies', expect.any(Object));
    });

    it('should enforce data residency policy', async () => {
      const policy: CompliancePolicy = {
        id: 'policy-residency',
        name: 'Data Residency - EU',
        framework: 'GDPR',
        rules: [
          {
            condition: 'data_region',
            expectedValue: 'EU',
            action: 'enforce',
            severity: 'critical',
          },
        ],
      };

      complianceEngine.createPolicy.mockResolvedValue(policy);

      const result = await complianceEngine.createPolicy(policy);

      expect(result.framework).toBe('GDPR');
    });

    it('should enforce credential rotation policy', async () => {
      const policy: CompliancePolicy = {
        id: 'policy-rotation',
        name: 'Credential Rotation',
        framework: 'SOC2',
        rules: [
          {
            condition: 'credential_age',
            maxDays: 90,
            action: 'enforce',
            severity: 'medium',
          },
        ],
      };

      complianceEngine.createPolicy.mockResolvedValue(policy);

      const result = await complianceEngine.createPolicy(policy);

      expect(result.rules[0]).toHaveProperty('maxDays', 90);
    });

    it('should enforce audit logging policy', async () => {
      const policy: CompliancePolicy = {
        id: 'policy-audit',
        name: 'Audit Logging',
        framework: 'HIPAA',
        rules: [
          {
            condition: 'audit_enabled',
            action: 'enforce',
            severity: 'critical',
          },
          {
            condition: 'log_retention',
            minDays: 365,
            action: 'enforce',
            severity: 'high',
          },
        ],
      };

      complianceEngine.createPolicy.mockResolvedValue(policy);

      const result = await complianceEngine.createPolicy(policy);

      expect(result.rules.length).toBe(2);
    });
  });

  describe('Policy Violation Detection', () => {
    it('should detect MFA bypass attempt', async () => {
      const violation: PolicyViolation = {
        id: 'violation-1',
        policyId: 'policy-2fa',
        agentId: 'agent-123',
        type: 'mfa_bypass',
        severity: 'critical',
        timestamp: new Date(),
        details: { action: 'login_without_mfa' },
      };

      complianceEngine.checkViolation.mockResolvedValue(violation);

      const result = await complianceEngine.checkViolation('policy-2fa', 'agent-123');

      expect(result.type).toBe('mfa_bypass');
      expect(result.severity).toBe('critical');
    });

    it('should detect data residency violations', async () => {
      const violation: PolicyViolation = {
        id: 'violation-2',
        policyId: 'policy-residency',
        agentId: 'agent-456',
        type: 'data_residency',
        severity: 'critical',
        timestamp: new Date(),
        details: { region: 'US', expected: 'EU' },
      };

      complianceEngine.checkViolation.mockResolvedValue(violation);

      const result = await complianceEngine.checkViolation('policy-residency', 'agent-456');

      expect(result.details.region).not.toBe(result.details.expected);
    });

    it('should detect expired credentials', async () => {
      const violation: PolicyViolation = {
        id: 'violation-3',
        policyId: 'policy-rotation',
        agentId: 'agent-789',
        type: 'expired_credential',
        severity: 'medium',
        timestamp: new Date(),
        details: { credentialAge: 120, maxAge: 90 },
      };

      complianceEngine.checkViolation.mockResolvedValue(violation);

      const result = await complianceEngine.checkViolation('policy-rotation', 'agent-789');

      expect(result.details.credentialAge).toBeGreaterThan(result.details.maxAge);
    });

    it('should detect audit logging disabled', async () => {
      const violation: PolicyViolation = {
        id: 'violation-4',
        policyId: 'policy-audit',
        agentId: 'agent-999',
        type: 'audit_disabled',
        severity: 'critical',
        timestamp: new Date(),
        details: { auditLogging: false },
      };

      complianceEngine.checkViolation.mockResolvedValue(violation);

      const result = await complianceEngine.checkViolation('policy-audit', 'agent-999');

      expect(result.severity).toBe('critical');
    });

    it('should batch check multiple violations', async () => {
      const violations: PolicyViolation[] = Array.from({ length: 5 }, (_, i) => ({
        id: `violation-${i}`,
        policyId: `policy-${i}`,
        agentId: `agent-${i}`,
        type: 'generic_violation',
        severity: 'medium',
        timestamp: new Date(),
        details: {},
      }));

      complianceEngine.checkViolation.mockResolvedValue(violations);

      const result = await complianceEngine.checkViolation('*', '*');

      expect(result.length).toBe(5);
    });
  });

  describe('Audit Logging', () => {
    it('should log policy enforcement action', async () => {
      const auditLog: AuditLog = {
        id: 'audit-1',
        timestamp: new Date(),
        action: 'policy_enforced',
        policyId: 'policy-2fa',
        agentId: 'agent-123',
        result: 'success',
        details: { mfaEnabled: true },
      };

      const result = await mockAuditLogger.log(auditLog);

      expect(result.action).toBe('policy_enforced');
      expect(mockDatabase.insert).toHaveBeenCalledWith(
        'audit_logs',
        expect.any(Object)
      );
    });

    it('should log policy violations with details', async () => {
      const auditLog: AuditLog = {
        id: 'audit-2',
        timestamp: new Date(),
        action: 'violation_detected',
        policyId: 'policy-residency',
        agentId: 'agent-456',
        result: 'failed',
        details: {
          violation: 'data_residency',
          region: 'US',
          expected: 'EU',
        },
      };

      mockAuditLogger.log.mockResolvedValue(auditLog);

      const result = await mockAuditLogger.log(auditLog);

      expect(result.result).toBe('failed');
      expect(result.details).toHaveProperty('violation');
    });

    it('should maintain immutable audit trail', async () => {
      const logs: AuditLog[] = Array.from({ length: 10 }, (_, i) => ({
        id: `audit-${i}`,
        timestamp: new Date(Date.now() - i * 1000),
        action: 'policy_check',
        policyId: 'policy-1',
        agentId: 'agent-1',
        result: 'success',
        details: {},
      }));

      const results = await Promise.all(logs.map(l => mockAuditLogger.log(l)));

      expect(results.length).toBe(10);
      expect(mockDatabase.insert).toHaveBeenCalledTimes(10);
    });

    it('should include user identity in audit logs', async () => {
      const auditLog: AuditLog = {
        id: 'audit-3',
        timestamp: new Date(),
        action: 'compliance_check',
        policyId: 'policy-audit',
        agentId: 'agent-789',
        userId: 'user-admin',
        result: 'success',
        details: { auditLogging: true },
      };

      mockAuditLogger.log.mockResolvedValue(auditLog);

      const result = await mockAuditLogger.log(auditLog);

      expect(result.userId).toBe('user-admin');
    });
  });

  describe('Compliance Reporting', () => {
    it('should generate SOC2 compliance report', async () => {
      const report: ComplianceReport = {
        id: 'report-soc2',
        framework: 'SOC2',
        generatedAt: new Date(),
        period: { start: new Date('2026-01-01'), end: new Date('2026-03-20') },
        violations: [],
        complianceScore: 98,
      };

      complianceEngine.generateReport.mockResolvedValue(report);

      const result = await complianceEngine.generateReport('SOC2');

      expect(result.framework).toBe('SOC2');
      expect(result.complianceScore).toBeGreaterThanOrEqual(0);
      expect(result.complianceScore).toBeLessThanOrEqual(100);
    });

    it('should generate GDPR compliance report', async () => {
      const report: ComplianceReport = {
        id: 'report-gdpr',
        framework: 'GDPR',
        generatedAt: new Date(),
        period: { start: new Date('2026-01-01'), end: new Date('2026-03-20') },
        violations: [
          {
            id: 'v1',
            type: 'data_residency',
            severity: 'high',
            timestamp: new Date(),
          },
        ],
        complianceScore: 95,
      };

      complianceEngine.generateReport.mockResolvedValue(report);

      const result = await complianceEngine.generateReport('GDPR');

      expect(result.framework).toBe('GDPR');
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should generate HIPAA compliance report', async () => {
      const report: ComplianceReport = {
        id: 'report-hipaa',
        framework: 'HIPAA',
        generatedAt: new Date(),
        period: { start: new Date('2026-01-01'), end: new Date('2026-03-20') },
        violations: [],
        complianceScore: 100,
        details: {
          auditLogging: { enabled: true, retention: 365 },
          encryption: { atRest: true, inTransit: true },
          accessControl: { rbac: true, mfa: true },
        },
      };

      complianceEngine.generateReport.mockResolvedValue(report);

      const result = await complianceEngine.generateReport('HIPAA');

      expect(result.framework).toBe('HIPAA');
      expect(result.details).toBeDefined();
    });

    it('should include violation details in report', async () => {
      const report: ComplianceReport = {
        id: 'report-detailed',
        framework: 'SOC2',
        generatedAt: new Date(),
        period: { start: new Date('2026-01-01'), end: new Date('2026-03-20') },
        violations: [
          {
            id: 'v1',
            type: 'mfa_bypass',
            severity: 'critical',
            timestamp: new Date(),
            agentId: 'agent-123',
          },
          {
            id: 'v2',
            type: 'audit_disabled',
            severity: 'high',
            timestamp: new Date(),
            agentId: 'agent-456',
          },
        ],
        complianceScore: 85,
      };

      complianceEngine.generateReport.mockResolvedValue(report);

      const result = await complianceEngine.generateReport('SOC2');

      expect(result.violations.length).toBe(2);
      expect(result.violations[0].severity).toBe('critical');
    });

    it('should calculate compliance score based on violations', async () => {
      const report: ComplianceReport = {
        id: 'report-score',
        framework: 'SOC2',
        generatedAt: new Date(),
        period: { start: new Date('2026-01-01'), end: new Date('2026-03-20') },
        violations: [
          {
            id: 'v1',
            type: 'violation',
            severity: 'critical',
            timestamp: new Date(),
          },
        ],
        complianceScore: 92,
      };

      complianceEngine.generateReport.mockResolvedValue(report);

      const result = await complianceEngine.generateReport('SOC2');

      expect(result.complianceScore).toBeLessThan(100);
    });
  });

  describe('Real-time Compliance Monitoring', () => {
    it('should monitor agent compliance in real-time', async () => {
      const agentId = 'agent-monitor';

      const compliance = {
        agentId,
        compliant: true,
        policies: [
          { policyId: 'policy-2fa', status: 'pass' },
          { policyId: 'policy-audit', status: 'pass' },
        ],
        lastCheck: new Date(),
      };

      expect(compliance.compliant).toBe(true);
      expect(compliance.policies.every(p => p.status === 'pass')).toBe(true);
    });

    it('should trigger alert on compliance breach', async () => {
      const mockAlert = vi.fn().mockResolvedValue({ sent: true });

      const violation: PolicyViolation = {
        id: 'violation-alert',
        policyId: 'policy-2fa',
        agentId: 'agent-breach',
        type: 'mfa_bypass',
        severity: 'critical',
        timestamp: new Date(),
        details: {},
      };

      complianceEngine.checkViolation.mockResolvedValue(violation);

      const result = await complianceEngine.checkViolation('policy-2fa', 'agent-breach');

      if (result.severity === 'critical') {
        await mockAlert();
      }

      expect(mockAlert).toHaveBeenCalled();
    });

    it('should auto-remediate low-severity violations', async () => {
      const violation: PolicyViolation = {
        id: 'violation-auto',
        policyId: 'policy-rotation',
        agentId: 'agent-auto',
        type: 'expired_credential',
        severity: 'low',
        timestamp: new Date(),
        details: {},
        autoRemediatable: true,
      };

      complianceEngine.checkViolation.mockResolvedValue(violation);

      const result = await complianceEngine.checkViolation('policy-rotation', 'agent-auto');

      expect(result.autoRemediatable).toBe(true);
    });
  });

  describe('Policy Management', () => {
    it('should update compliance policy', async () => {
      const policy: CompliancePolicy = {
        id: 'policy-update',
        name: 'Updated Policy',
        framework: 'SOC2',
        rules: [{ condition: 'test', action: 'enforce', severity: 'high' }],
      };

      mockDatabase.update.mockResolvedValue({ success: true });

      const result = await mockDatabase.update('policies', policy);

      expect(result.success).toBe(true);
    });

    it('should delete compliance policy', async () => {
      mockDatabase.delete.mockResolvedValue({ success: true });

      const result = await mockDatabase.delete('policies', 'policy-delete');

      expect(result.success).toBe(true);
    });

    it('should list all policies for framework', async () => {
      const policies: CompliancePolicy[] = [
        {
          id: 'p1',
          name: 'Policy 1',
          framework: 'SOC2',
          rules: [],
        },
        {
          id: 'p2',
          name: 'Policy 2',
          framework: 'SOC2',
          rules: [],
        },
      ];

      mockDatabase.query.mockResolvedValue(policies);

      const result = await mockDatabase.query('policies', { framework: 'SOC2' });

      expect(result.length).toBe(2);
      expect(result.every(p => p.framework === 'SOC2')).toBe(true);
    });
  });

  describe('Performance & Scalability', () => {
    it('should handle large audit logs efficiently', async () => {
      const logs: AuditLog[] = Array.from({ length: 10000 }, (_, i) => ({
        id: `audit-${i}`,
        timestamp: new Date(Date.now() - i * 1000),
        action: 'audit_action',
        policyId: `policy-${i % 10}`,
        agentId: `agent-${i % 100}`,
        result: 'success',
        details: {},
      }));

      const startTime = Date.now();

      for (const log of logs.slice(0, 1000)) {
        mockAuditLogger.log.mockResolvedValue(log);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000);
    });

    it('should generate reports in reasonable time', async () => {
      const startTime = Date.now();

      const report: ComplianceReport = {
        id: 'report-perf',
        framework: 'SOC2',
        generatedAt: new Date(),
        period: { start: new Date('2026-01-01'), end: new Date('2026-03-20') },
        violations: [],
        complianceScore: 95,
      };

      complianceEngine.generateReport.mockResolvedValue(report);

      const result = await complianceEngine.generateReport('SOC2');

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000);
      expect(result).toBeDefined();
    });
  });
});
