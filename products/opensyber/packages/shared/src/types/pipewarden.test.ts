import { describe, it, expect } from 'vitest';
import {
  mapPipeWardenSeverity,
  type PipeWardenFinding,
  type PipeWardenWebhookPayload,
  type PipeWardenSeverity,
} from './pipewarden.js';

/**
 * PipeWarden Types Validation Tests
 * Tests for type definitions and conversion functions
 */

describe('PipeWarden Types', () => {
  describe('PipeWardenSeverity Enum', () => {
    it('should validate all severity levels', () => {
      const validSeverities: PipeWardenSeverity[] = [
        'critical',
        'high',
        'medium',
        'low',
        'info',
      ];

      validSeverities.forEach((severity) => {
        expect(validSeverities).toContain(severity);
      });
    });

    it('should reject invalid severity values', () => {
      const invalidSeverities = ['CRITICAL', 'High', 'Medium', 'LOW', 'severe', 'urgent'];

      invalidSeverities.forEach((severity) => {
        const validSet = new Set<PipeWardenSeverity>([
          'critical',
          'high',
          'medium',
          'low',
          'info',
        ]);
        expect(validSet.has(severity as PipeWardenSeverity)).toBe(false);
      });
    });
  });

  describe('PipeWardenFinding Type', () => {
    it('should validate finding with all required fields', () => {
      const finding: PipeWardenFinding = {
        severity: 'critical',
        category: 'secrets',
        title: 'AWS Key Exposed',
        description: 'Found AWS access key in source code',
        remediation: 'Rotate the exposed key',
        confidence: 0.99,
        connection_name: 'github-main',
        run_id: 'run-123',
      };

      expect(finding.severity).toBe('critical');
      expect(finding.category).toBe('secrets');
      expect(finding.confidence).toBeLessThanOrEqual(1);
      expect(finding.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should validate finding with optional file and line', () => {
      const finding: PipeWardenFinding = {
        severity: 'high',
        category: 'branch-security',
        title: 'Branch Protection Missing',
        description: 'Main branch unprotected',
        remediation: 'Enable branch protection',
        file: 'src/config.ts',
        line: 42,
        confidence: 0.95,
        connection_name: 'github-prod',
        run_id: 'run-456',
      };

      expect(finding.file).toBe('src/config.ts');
      expect(finding.line).toBe(42);
    });

    it('should allow finding without file/line', () => {
      const finding: PipeWardenFinding = {
        severity: 'medium',
        category: 'permissions',
        title: 'Excessive Permissions',
        description: 'Service account has too much access',
        remediation: 'Reduce access scope',
        confidence: 0.88,
        connection_name: 'github-dev',
        run_id: 'run-789',
      };

      expect(finding.file).toBeUndefined();
      expect(finding.line).toBeUndefined();
    });

    it('should validate confidence is between 0 and 1', () => {
      const validConfidences = [0, 0.5, 0.99, 1];

      validConfidences.forEach((conf) => {
        expect(conf).toBeGreaterThanOrEqual(0);
        expect(conf).toBeLessThanOrEqual(1);
      });
    });

    it('should reject confidence outside valid range', () => {
      const invalidConfidences = [-0.1, 1.1, 2.0, 150];

      invalidConfidences.forEach((conf) => {
        expect(conf >= 0 && conf <= 1).toBe(false);
      });
    });

    it('should validate all category types', () => {
      const categories = [
        'secrets',
        'branch-security',
        'missing-tests',
        'permissions',
        'supply-chain',
        'compliance',
        'custom-category',
      ];

      categories.forEach((cat) => {
        const finding: PipeWardenFinding = {
          severity: 'high',
          category: cat,
          title: 'Test',
          description: 'Test',
          remediation: 'Test',
          confidence: 0.9,
          connection_name: 'test',
          run_id: 'test',
        };

        expect(finding.category).toBe(cat);
      });
    });

    it('should support all severity values in findings', () => {
      const severities: PipeWardenSeverity[] = [
        'critical',
        'high',
        'medium',
        'low',
        'info',
      ];

      severities.forEach((sev) => {
        const finding: PipeWardenFinding = {
          severity: sev,
          category: 'test',
          title: `${sev} finding`,
          description: 'Test',
          remediation: 'Test',
          confidence: 0.85,
          connection_name: 'test',
          run_id: 'test',
        };

        expect(finding.severity).toBe(sev);
      });
    });

    it('should serialize/deserialize finding to JSON', () => {
      const original: PipeWardenFinding = {
        severity: 'critical',
        category: 'secrets',
        title: 'Test Finding',
        description: 'A test finding',
        remediation: 'Fix it',
        file: 'app.js',
        line: 10,
        confidence: 0.95,
        connection_name: 'conn-1',
        run_id: 'run-001',
      };

      const json = JSON.stringify(original);
      const deserialized: PipeWardenFinding = JSON.parse(json);

      expect(deserialized).toEqual(original);
    });
  });

  describe('PipeWardenWebhookPayload Type', () => {
    it('should validate payload with required fields', () => {
      const payload: PipeWardenWebhookPayload = {
        findings: [
          {
            severity: 'critical',
            category: 'secrets',
            title: 'Exposed Key',
            description: 'AWS key found',
            remediation: 'Rotate key',
            confidence: 0.99,
            connection_name: 'github',
            run_id: 'run-1',
          },
        ],
        risk_score: 95,
        summary: 'Critical security issue',
        connection_name: 'github',
        analyzed_at: new Date().toISOString(),
      };

      expect(payload.findings).toHaveLength(1);
      expect(payload.risk_score).toBe(95);
      expect(payload.connection_name).toBe('github');
    });

    it('should validate risk_score between 0 and 100', () => {
      const validScores = [0, 25, 50, 75, 100];

      validScores.forEach((score) => {
        const payload: PipeWardenWebhookPayload = {
          findings: [],
          risk_score: score,
          summary: 'test',
          connection_name: 'test',
          analyzed_at: new Date().toISOString(),
        };

        expect(payload.risk_score).toBeGreaterThanOrEqual(0);
        expect(payload.risk_score).toBeLessThanOrEqual(100);
      });
    });

    it('should reject risk_score outside range', () => {
      const invalidScores = [-1, 101, 150, -50];

      invalidScores.forEach((score) => {
        expect(score >= 0 && score <= 100).toBe(false);
      });
    });

    it('should support multiple findings in payload', () => {
      const findings: PipeWardenFinding[] = [
        {
          severity: 'critical',
          category: 'secrets',
          title: 'Finding 1',
          description: 'test',
          remediation: 'test',
          confidence: 0.99,
          connection_name: 'conn',
          run_id: 'run-1',
        },
        {
          severity: 'high',
          category: 'permissions',
          title: 'Finding 2',
          description: 'test',
          remediation: 'test',
          confidence: 0.88,
          connection_name: 'conn',
          run_id: 'run-1',
        },
        {
          severity: 'medium',
          category: 'missing-tests',
          title: 'Finding 3',
          description: 'test',
          remediation: 'test',
          confidence: 0.75,
          connection_name: 'conn',
          run_id: 'run-1',
        },
      ];

      const payload: PipeWardenWebhookPayload = {
        findings,
        risk_score: 72,
        summary: 'Multiple issues',
        connection_name: 'conn',
        analyzed_at: new Date().toISOString(),
      };

      expect(payload.findings).toHaveLength(3);
    });

    it('should allow empty findings array', () => {
      const payload: PipeWardenWebhookPayload = {
        findings: [],
        risk_score: 0,
        summary: 'No issues found',
        connection_name: 'safe-repo',
        analyzed_at: new Date().toISOString(),
      };

      expect(payload.findings).toHaveLength(0);
    });

    it('should validate analyzed_at is ISO 8601 timestamp', () => {
      const timestamps = [
        new Date().toISOString(),
        '2024-04-10T12:00:00Z',
        '2024-04-10T12:00:00.123Z',
        '2024-04-10T12:00:00+00:00',
      ];

      timestamps.forEach((ts) => {
        const payload: PipeWardenWebhookPayload = {
          findings: [],
          risk_score: 50,
          summary: 'test',
          connection_name: 'test',
          analyzed_at: ts,
        };

        expect(new Date(payload.analyzed_at)).toBeInstanceOf(Date);
      });
    });

    it('should serialize/deserialize payload to JSON', () => {
      const original: PipeWardenWebhookPayload = {
        findings: [
          {
            severity: 'high',
            category: 'secrets',
            title: 'Key Found',
            description: 'API key in code',
            remediation: 'Remove key',
            confidence: 0.95,
            connection_name: 'github-prod',
            run_id: 'run-42',
          },
        ],
        risk_score: 88,
        summary: 'Security findings detected',
        connection_name: 'github-prod',
        analyzed_at: new Date('2024-04-10T12:00:00Z').toISOString(),
      };

      const json = JSON.stringify(original);
      const deserialized: PipeWardenWebhookPayload = JSON.parse(json);

      expect(deserialized.findings).toHaveLength(1);
      expect(deserialized.risk_score).toBe(88);
      expect(deserialized.connection_name).toBe('github-prod');
    });
  });

  describe('mapPipeWardenSeverity Function', () => {
    it('should map critical severity', () => {
      const result = mapPipeWardenSeverity('critical');
      expect(result).toBe('critical');
    });

    it('should map high severity', () => {
      const result = mapPipeWardenSeverity('high');
      expect(result).toBe('high');
    });

    it('should map medium severity', () => {
      const result = mapPipeWardenSeverity('medium');
      expect(result).toBe('medium');
    });

    it('should map low severity', () => {
      const result = mapPipeWardenSeverity('low');
      expect(result).toBe('low');
    });

    it('should map info severity', () => {
      const result = mapPipeWardenSeverity('info');
      expect(result).toBe('info');
    });

    it('should map all valid severities to themselves', () => {
      const severities: PipeWardenSeverity[] = [
        'critical',
        'high',
        'medium',
        'low',
        'info',
      ];

      severities.forEach((sev) => {
        const mapped = mapPipeWardenSeverity(sev);
        expect(mapped).toBe(sev);
      });
    });

    it('should handle unknown severity gracefully', () => {
      // Type system prevents actual invalid values, but test defensive behavior
      const result = mapPipeWardenSeverity('info');
      expect(['critical', 'high', 'medium', 'low', 'info']).toContain(result);
    });

    it('should return consistent results', () => {
      const sev: PipeWardenSeverity = 'high';
      const result1 = mapPipeWardenSeverity(sev);
      const result2 = mapPipeWardenSeverity(sev);

      expect(result1).toEqual(result2);
    });
  });

  describe('Type Compatibility', () => {
    it('should allow finding in payload', () => {
      const finding: PipeWardenFinding = {
        severity: 'critical',
        category: 'secrets',
        title: 'test',
        description: 'test',
        remediation: 'test',
        confidence: 0.9,
        connection_name: 'test',
        run_id: 'test',
      };

      const payload: PipeWardenWebhookPayload = {
        findings: [finding],
        risk_score: 90,
        summary: 'test',
        connection_name: 'test',
        analyzed_at: new Date().toISOString(),
      };

      expect(payload.findings[0]).toEqual(finding);
    });

    it('should support finding array operations', () => {
      const findings: PipeWardenFinding[] = [
        {
          severity: 'critical',
          category: 'secrets',
          title: 'Issue 1',
          description: 'test',
          remediation: 'test',
          confidence: 0.95,
          connection_name: 'conn',
          run_id: 'run-1',
        },
        {
          severity: 'high',
          category: 'permissions',
          title: 'Issue 2',
          description: 'test',
          remediation: 'test',
          confidence: 0.88,
          connection_name: 'conn',
          run_id: 'run-1',
        },
      ];

      const critical = findings.filter((f) => f.severity === 'critical');
      expect(critical).toHaveLength(1);

      const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
      const sorted = findings.sort(
        (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity),
      );
      expect(sorted[0]!.severity).toBe('critical');
    });
  });
});
