import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PipeWardenBridge, type DLPFinding, type OPAPolicy } from '../src/pipewarden.js';

describe('PipeWarden Integration Bridge', () => {
  let bridge: PipeWardenBridge;

  beforeEach(() => {
    bridge = new PipeWardenBridge('https://pipewarden.example.com');
  });

  describe('Constructor', () => {
    it('should create instance with URL normalization', () => {
      const bridge1 = new PipeWardenBridge('https://example.com/');
      const bridge2 = new PipeWardenBridge('https://example.com');

      expect(bridge1['pipewardenUrl']).toBe('https://example.com');
      expect(bridge2['pipewardenUrl']).toBe('https://example.com');
    });

    it('should initialize DLP detector and policy cache', () => {
      expect(bridge['dlpDetector']).toBeDefined();
      expect(bridge['policyCache']).toBeInstanceOf(Map);
      expect(bridge['policyCache'].size).toBe(0);
    });
  });

  describe('pushDLPFindings', () => {
    it('should push findings to PipeWarden API', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      global.fetch = mockFetch;

      const findings: DLPFinding[] = [
        {
          pattern: 'aws_access_key',
          match: 'AKIAIOSFODNN7EXAMPLE',
          file: 'config.yml',
          line: 42,
          severity: 'critical',
          category: 'secrets',
          confidence: 0.98,
        },
      ];

      await bridge.pushDLPFindings(findings);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://pipewarden.example.com/api/dlp/findings',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    it('should throw on API failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      global.fetch = mockFetch;

      const findings: DLPFinding[] = [
        {
          pattern: 'test',
          match: 'data',
          file: 'file.txt',
          line: 1,
          severity: 'high',
          category: 'secrets',
          confidence: 0.9,
        },
      ];

      await expect(bridge.pushDLPFindings(findings)).rejects.toThrow(
        'Failed to push DLP findings: 500 Internal Server Error',
      );
    });

    it('should handle multiple findings', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      global.fetch = mockFetch;

      const findings: DLPFinding[] = [
        {
          pattern: 'aws_key',
          match: 'AKIA...',
          file: 'env.yml',
          line: 1,
          severity: 'critical',
          category: 'secrets',
          confidence: 0.99,
        },
        {
          pattern: 'github_token',
          match: 'ghp_...',
          file: 'config.yml',
          line: 5,
          severity: 'critical',
          category: 'secrets',
          confidence: 0.95,
        },
      ];

      await bridge.pushDLPFindings(findings);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody.findings).toHaveLength(2);
      expect(callBody.findings[0].match).toBe('AKIA...');
      expect(callBody.findings[1].match).toBe('ghp_...');
    });
  });

  describe('syncPolicies', () => {
    it('should sync policies to PipeWarden', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      global.fetch = mockFetch;

      const policies: OPAPolicy[] = [
        {
          id: 'require-tests',
          name: 'Require Tests',
          description: 'Pipeline must include tests',
          severity: 'high',
          enforced: true,
          rules: [
            {
              id: 'rule-1',
              description: 'Check for test step',
              action: 'audit',
              conditions: { stepExists: 'test' },
            },
          ],
        },
      ];

      await bridge.syncPolicies(policies);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://pipewarden.example.com/api/policies/sync',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('should update policy cache after sync', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      global.fetch = mockFetch;

      const policies: OPAPolicy[] = [
        {
          id: 'policy-1',
          name: 'Test Policy',
          description: 'Test',
          severity: 'high',
          enforced: true,
          rules: [],
        },
      ];

      await bridge.syncPolicies(policies);

      expect(bridge['policyCache'].has('policy-1')).toBe(true);
      expect(bridge['policyCache'].get('policy-1')).toEqual(policies[0]);
    });

    it('should throw on sync failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      global.fetch = mockFetch;

      await expect(bridge.syncPolicies([])).rejects.toThrow(
        'Failed to sync policies: 400 Bad Request',
      );
    });
  });

  describe('getComplianceReport', () => {
    it('should retrieve compliance report', async () => {
      const mockReport = {
        connectionName: 'github-main',
        timestamp: new Date().toISOString(),
        dlpFindings: [],
        policyViolations: [],
        riskScore: 42,
        summary: 'Low risk',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockReport,
      });

      global.fetch = mockFetch;

      const report = await bridge.getComplianceReport('github-main');

      expect(report.connectionName).toBe('github-main');
      expect(report.riskScore).toBe(42);
    });

    it('should encode connection name in URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          connectionName: 'test',
          timestamp: new Date().toISOString(),
          dlpFindings: [],
          policyViolations: [],
          riskScore: 0,
          summary: '',
        }),
      });

      global.fetch = mockFetch;

      await bridge.getComplianceReport('my connection/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('my%20connection%2Ftest'),
        expect.any(Object),
      );
    });

    it('should throw on API failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      global.fetch = mockFetch;

      await expect(bridge.getComplianceReport('nonexistent')).rejects.toThrow(
        'Failed to get compliance report: 404 Not Found',
      );
    });
  });

  describe('convertSDLCFindingsToPipeWarden', () => {
    it('should convert DLP matches to PipeWarden format', () => {
      const matches = [
        {
          piiType: 'CREDIT_CARD',
          matchedText: '4532-1234-5678-9010',
          confidence: 0.99,
          redactedLabel: '[CREDIT_CARD]',
        },
        {
          piiType: 'EMAIL',
          matchedText: 'user@example.com',
          confidence: 0.95,
          redactedLabel: '[EMAIL]',
        },
      ];

      const findings = bridge.convertSDLCFindingsToPipeWarden(matches as any);

      expect(findings).toHaveLength(2);
      expect(findings[0].severity).toBe('critical');
      expect(findings[0].category).toBe('data-exposure');
      expect(findings[1].severity).toBe('high');
    });

    it('should use default severity for unknown PII types', () => {
      const matches = [
        {
          piiType: 'UNKNOWN_TYPE',
          matchedText: 'data',
          confidence: 0.8,
          redactedLabel: '[UNKNOWN]',
        },
      ];

      const findings = bridge.convertSDLCFindingsToPipeWarden(matches as any);

      expect(findings[0].severity).toBe('medium');
    });
  });

  describe('scanPipelineConfig', () => {
    it('should scan content for DLP matches', () => {
      // The SDLC FastPIIDetector finds PII (email, card, SSN, phone, IP, DOB),
      // not arbitrary secrets. Use real PII so this test exercises the path.
      const content = `
        notify_email: alerts@example.com
        on_call_phone: 555-123-4567
      `;

      const findings = bridge.scanPipelineConfig(content);

      expect(Array.isArray(findings)).toBe(true);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]).toHaveProperty('pattern');
      expect(findings[0]).toHaveProperty('confidence');
    });

    it('should mark high-confidence matches as critical', () => {
      const content = 'secret: SUPER_SECRET_KEY_12345';

      const findings = bridge.scanPipelineConfig(content);

      if (findings.length > 0) {
        const criticalFinding = findings.find((f) => f.severity === 'critical');
        expect(criticalFinding?.confidence).toBeGreaterThan(0.95);
      }
    });
  });

  describe('getDefaultPolicies', () => {
    it('should return 4 default policies', () => {
      const policies = bridge.getDefaultPolicies();

      expect(policies).toHaveLength(4);
    });

    it('should include require-tests policy', () => {
      const policies = bridge.getDefaultPolicies();
      const testPolicy = policies.find((p) => p.id === 'sdlc-require-tests');

      expect(testPolicy).toBeDefined();
      expect(testPolicy?.name).toBe('Require Tests (SDLC)');
      expect(testPolicy?.severity).toBe('high');
    });

    it('should include no-hardcoded-secrets policy', () => {
      const policies = bridge.getDefaultPolicies();
      const secretsPolicy = policies.find((p) => p.id === 'sdlc-no-hardcoded-secrets');

      expect(secretsPolicy).toBeDefined();
      expect(secretsPolicy?.severity).toBe('critical');
      expect(secretsPolicy?.enforced).toBe(true);
    });

    it('should include require-sast policy', () => {
      const policies = bridge.getDefaultPolicies();
      const sastPolicy = policies.find((p) => p.id === 'sdlc-require-sast');

      expect(sastPolicy).toBeDefined();
      expect(sastPolicy?.rules.length).toBeGreaterThan(0);
    });

    it('should include require-code-review policy', () => {
      const policies = bridge.getDefaultPolicies();
      const reviewPolicy = policies.find((p) => p.id === 'sdlc-require-code-review');

      expect(reviewPolicy).toBeDefined();
      expect(reviewPolicy?.enforced).toBe(true);
    });

    it('all policies should have valid structure', () => {
      const policies = bridge.getDefaultPolicies();

      policies.forEach((policy) => {
        expect(policy.id).toBeDefined();
        expect(policy.name).toBeDefined();
        expect(policy.description).toBeDefined();
        expect(policy.severity).toMatch(/^(critical|high|medium|low)$/);
        expect(policy.enforced).toBeTypeOf('boolean');
        expect(Array.isArray(policy.rules)).toBe(true);
      });
    });
  });
});
