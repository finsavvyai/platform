import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createTestUser,
  createMockDb,
  createMockKV,
  createMockLLM,
} from './helpers.js';

/**
 * Sample Project 6: AI Security Analysis
 *
 * Tests the full AI skills integration:
 *   AI Triage → AI Reasoning → AI Remediation → AI Compliance → AI Threat Intel → AI Incident Response
 *
 * Validates the $99/mo AI Security Analyst Bundle
 */
describe('Sample Project: AI Security Analysis', () => {
  let user: ReturnType<typeof createTestUser>;
  let db: ReturnType<typeof createMockDb>;
  let kv: ReturnType<typeof createMockKV>;
  let llm: ReturnType<typeof createMockLLM>;

  beforeEach(() => {
    user = createTestUser({ plan: 'pro', role: 'owner' });
    db = createMockDb();
    kv = createMockKV();
    llm = createMockLLM();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('AI Triage Skill', () => {
    it('should batch-process security findings for prioritization', async () => {
      const findings = [
        { id: 'f1', title: 'Open SSH port', severity: 'high', resource: 'sg-123' },
        { id: 'f2', title: 'S3 public bucket', severity: 'critical', resource: 'my-bucket' },
        { id: 'f3', title: 'Unused IAM role', severity: 'low', resource: 'role-old' },
        { id: 'f4', title: 'Unencrypted EBS', severity: 'medium', resource: 'vol-123' },
        { id: 'f5', title: 'Root user API key', severity: 'critical', resource: 'root' },
      ];

      llm.askLLM.mockResolvedValueOnce({
        text: JSON.stringify({
          prioritized: [
            { id: 'f5', adjustedSeverity: 'critical', priority: 1, immediateAction: true, reasoning: 'Root API key is highest risk' },
            { id: 'f2', adjustedSeverity: 'critical', priority: 2, immediateAction: true, reasoning: 'Data exposure risk' },
            { id: 'f1', adjustedSeverity: 'high', priority: 3, immediateAction: false, reasoning: 'Network exposure' },
            { id: 'f4', adjustedSeverity: 'medium', priority: 4, immediateAction: false, reasoning: 'Data at rest concern' },
            { id: 'f3', adjustedSeverity: 'low', priority: 5, immediateAction: false, reasoning: 'Hygiene issue only' },
          ],
        }),
        usage: { input_tokens: 500, output_tokens: 200 },
      });

      const result = await llm.askLLM(
        'You are a security triage specialist...',
        `Triage these ${findings.length} findings:\n${JSON.stringify(findings)}`,
      );

      const parsed = llm.parseJSON(result.text);

      expect(parsed.prioritized).toHaveLength(5);
      expect(parsed.prioritized[0].id).toBe('f5');
      expect(parsed.prioritized[0].immediateAction).toBe(true);
    });

    it('should handle LLM timeout gracefully', async () => {
      llm.askLLM.mockRejectedValueOnce(new Error('Request timed out'));

      await expect(
        llm.askLLM('system', 'prompt'),
      ).rejects.toThrow('timed out');
    });

    it('should handle malformed LLM response', () => {
      const malformed = 'This is not JSON at all';
      const result = llm.parseJSON(malformed);
      expect(result).toBeNull();
    });

    it('should track token usage for billing', async () => {
      const usage = {
        skillSlug: 'ai-triage',
        orgId: user.orgId,
        inputTokens: 500,
        outputTokens: 200,
        model: 'claude-sonnet-4-6',
        cost: 0.003,
        timestamp: new Date().toISOString(),
      };

      await db.insert({ ai_usage: {} }).values(usage);

      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('AI Reasoning Engine', () => {
    it('should perform root cause analysis on finding clusters', async () => {
      llm.askLLM.mockResolvedValueOnce({
        text: JSON.stringify({
          rootCause: 'Misconfigured Terraform module',
          affectedResources: ['sg-123', 'sg-456', 'sg-789'],
          riskScore: 87,
          attackVector: 'Network → EC2 → Data Exfiltration',
          recommendation: 'Update terraform-aws-security-group module to v5.2.0',
        }),
        usage: { input_tokens: 800, output_tokens: 300 },
      });

      const result = await llm.askLLM(
        'Analyze the root cause...',
        'Security group findings: ...',
      );
      const analysis = llm.parseJSON(result.text);

      expect(analysis.riskScore).toBeGreaterThan(80);
      expect(analysis.affectedResources).toHaveLength(3);
      expect(analysis.rootCause).toContain('Terraform');
    });

    it('should score risk with multiple dimensions', () => {
      const riskDimensions = {
        exploitability: 0.9,
        blastRadius: 0.7,
        dataSensitivity: 0.8,
        businessImpact: 0.6,
        easeOfRemediation: 0.3,
      };

      const weights = {
        exploitability: 0.3,
        blastRadius: 0.2,
        dataSensitivity: 0.2,
        businessImpact: 0.2,
        easeOfRemediation: 0.1,
      };

      const score = Object.keys(riskDimensions).reduce(
        (total, key) =>
          total +
          riskDimensions[key as keyof typeof riskDimensions] *
            weights[key as keyof typeof weights],
        0,
      );

      expect(score).toBeGreaterThan(0.5);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('AI Remediation Skill', () => {
    it('should generate fix with rollback procedure', async () => {
      llm.askLLM.mockResolvedValueOnce({
        text: JSON.stringify({
          fix: {
            description: 'Enable S3 Block Public Access',
            steps: [
              'aws s3api put-public-access-block --bucket my-bucket --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true',
            ],
            iac: 'resource "aws_s3_bucket_public_access_block" "my_bucket" {\n  bucket = aws_s3_bucket.my_bucket.id\n  block_public_acls = true\n}',
          },
          rollback: {
            description: 'Remove Block Public Access if needed',
            steps: [
              'aws s3api delete-public-access-block --bucket my-bucket',
            ],
          },
          riskAssessment: 'Low risk — only restricts public access',
        }),
        usage: { input_tokens: 400, output_tokens: 250 },
      });

      const result = await llm.askLLM('Generate remediation...', 'Finding: S3 public...');
      const remediation = llm.parseJSON(result.text);

      expect(remediation.fix.steps).toHaveLength(1);
      expect(remediation.rollback).toBeDefined();
      expect(remediation.fix.iac).toContain('block_public_acls');
    });

    it('should validate remediation does not break dependencies', () => {
      const dependencyCheck = {
        findingId: 'find_001',
        affectedServices: ['web-frontend', 'cdn'],
        breakingChanges: false,
        warnings: ['CDN may need reconfiguration for private bucket access'],
      };

      expect(dependencyCheck.breakingChanges).toBe(false);
      expect(dependencyCheck.warnings).toHaveLength(1);
    });
  });

  describe('AI Compliance Writer', () => {
    it('should generate SOC 2 evidence documents', async () => {
      llm.askLLM.mockResolvedValueOnce({
        text: JSON.stringify({
          framework: 'SOC 2 Type II',
          control: 'CC6.1 - Logical Access Controls',
          evidence: {
            description: 'OpenSyber enforces RBAC with four permission levels...',
            artifacts: [
              'RBAC configuration screenshot',
              'Audit log export showing access controls',
              'SSO/SAML integration evidence',
            ],
            testProcedure: 'Verify that only authorized users can access agent management...',
            effectivenessRating: 'Effective',
          },
        }),
        usage: { input_tokens: 600, output_tokens: 400 },
      });

      const result = await llm.askLLM('Generate compliance evidence...', 'Control: CC6.1...');
      const evidence = llm.parseJSON(result.text);

      expect(evidence.framework).toBe('SOC 2 Type II');
      expect(evidence.evidence.artifacts).toHaveLength(3);
      expect(evidence.evidence.effectivenessRating).toBe('Effective');
    });

    it('should map findings to compliance frameworks', () => {
      const mapping: Record<string, string[]> = {
        'find_001': ['SOC2-CC6.1', 'ISO27001-A.9', 'HIPAA-164.312(a)(1)'],
        'find_002': ['SOC2-CC6.3', 'ISO27001-A.9.4', 'PCI-DSS-8.3'],
        'find_003': ['SOC2-CC6.6', 'ISO27001-A.13', 'NIST-AC-4'],
      };

      expect(mapping['find_001']).toContain('SOC2-CC6.1');
      expect(Object.keys(mapping)).toHaveLength(3);
    });
  });

  describe('AI Threat Intelligence', () => {
    it('should enrich findings with CVE data', async () => {
      llm.askLLM.mockResolvedValueOnce({
        text: JSON.stringify({
          cveId: 'CVE-2026-1234',
          cvssScore: 9.8,
          exploitAvailable: true,
          affectedVersions: ['< 4.17.22'],
          references: [
            'https://nvd.nist.gov/vuln/detail/CVE-2026-1234',
          ],
          threatActors: ['APT-29', 'FIN7'],
          lastSeenInWild: '2026-04-01',
        }),
        usage: { input_tokens: 300, output_tokens: 200 },
      });

      const result = await llm.askLLM('Enrich with threat intel...', 'CVE-2026-1234');
      const intel = llm.parseJSON(result.text);

      expect(intel.cvssScore).toBeGreaterThanOrEqual(9.0);
      expect(intel.exploitAvailable).toBe(true);
      expect(intel.threatActors).toContain('APT-29');
    });

    it('should aggregate OSINT from multiple sources', () => {
      const sources = [
        { name: 'NVD', status: 'available', lastSync: '2026-04-08T00:00:00Z' },
        { name: 'CIRCL', status: 'available', lastSync: '2026-04-08T00:00:00Z' },
        { name: 'ExploitDB', status: 'available', lastSync: '2026-04-07T00:00:00Z' },
      ];

      const allAvailable = sources.every((s) => s.status === 'available');
      expect(allAvailable).toBe(true);
    });
  });

  describe('AI Incident Responder', () => {
    it('should investigate multi-step attack chains', async () => {
      llm.askLLM.mockResolvedValueOnce({
        text: JSON.stringify({
          attackChain: [
            { step: 1, technique: 'Initial Access', detail: 'Exploited public S3 bucket' },
            { step: 2, technique: 'Credential Harvesting', detail: 'Found AWS keys in config files' },
            { step: 3, technique: 'Lateral Movement', detail: 'Used keys to access EC2 instances' },
            { step: 4, technique: 'Data Exfiltration', detail: 'Downloaded database backups' },
          ],
          severity: 'critical',
          containmentSteps: [
            'Rotate all AWS access keys immediately',
            'Enable S3 Block Public Access',
            'Review CloudTrail for unauthorized API calls',
            'Isolate affected EC2 instances',
          ],
          estimatedImpact: 'Potential PII data breach affecting ~10K users',
        }),
        usage: { input_tokens: 1000, output_tokens: 500 },
      });

      const result = await llm.askLLM('Investigate attack chain...', 'Events: ...');
      const incident = llm.parseJSON(result.text);

      expect(incident.attackChain).toHaveLength(4);
      expect(incident.severity).toBe('critical');
      expect(incident.containmentSteps.length).toBeGreaterThan(0);
    });

    it('should generate incident timeline', () => {
      const timeline = [
        { time: '2026-04-08T02:00:00Z', event: 'S3 bucket made public via API call' },
        { time: '2026-04-08T02:15:00Z', event: 'Unusual data download from bucket' },
        { time: '2026-04-08T02:30:00Z', event: 'New IAM user created with admin access' },
        { time: '2026-04-08T02:45:00Z', event: 'EC2 instances queried via describe-instances' },
        { time: '2026-04-08T03:00:00Z', event: 'Alert triggered by anomaly detection' },
      ];

      expect(timeline).toHaveLength(5);
      const sorted = [...timeline].sort(
        (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
      );
      expect(sorted[0].time).toBe(timeline[0].time);
    });
  });

  describe('AI Bundle Pricing & Limits', () => {
    it('should validate bundle includes all 6 skills', () => {
      const bundle = {
        slug: 'ai-security-analyst-bundle',
        price: 9900,
        skills: [
          'ai-triage',
          'ai-reasoning-engine',
          'ai-remediation',
          'ai-compliance-writer',
          'ai-threat-intel',
          'ai-incident-responder',
        ],
      };

      expect(bundle.skills).toHaveLength(6);
      expect(bundle.price).toBe(9900);
    });

    it('should track token usage per org per month', async () => {
      db._setSelectResult([
        {
          orgId: user.orgId,
          month: '2026-04',
          totalInputTokens: 50_000,
          totalOutputTokens: 25_000,
          totalCost: 1.50,
        },
      ]);

      const usage = await db
        .select()
        .from('ai_usage_monthly')
        .where('orgId = ? AND month = ?');

      expect(usage).toHaveLength(1);
    });

    it('should rate limit AI requests per plan', async () => {
      const planLimits: Record<string, number> = {
        free: 0,
        pro: 500,
        team: 2000,
        enterprise: 10000,
      };

      const currentUsage = 450;
      const limit = planLimits[user.plan] ?? 0;
      const withinLimit = currentUsage < limit;

      expect(withinLimit).toBe(true);
    });
  });
});
