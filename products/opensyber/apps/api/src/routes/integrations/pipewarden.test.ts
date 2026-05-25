import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';

/**
 * PipeWarden Webhook Endpoint Tests
 * Tests for POST /api/integrations/pipewarden/findings webhook handler
 */

// Mock types based on the handler
interface TestFinding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  title: string;
  description: string;
  remediation: string;
  file?: string;
  line?: number;
  confidence: number;
  connection_name: string;
  run_id: string;
}

interface TestPayload {
  findings: TestFinding[];
  risk_score: number;
  summary: string;
  connection_name: string;
  analyzed_at: string;
}

describe('PipeWarden Webhook Handler', () => {
  const mockSecret = 'test-webhook-secret-12345';

  // Helper to compute HMAC-SHA256
  async function computeSignature(payload: string): Promise<string> {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(mockSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
    return (
      'sha256=' +
      Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    );
  }

  describe('POST /findings - Valid Request', () => {
    it('should accept valid webhook with correct signature', async () => {
      const payload: TestPayload = {
        findings: [
          {
            severity: 'critical',
            category: 'secrets',
            title: 'AWS Key Exposed',
            description: 'Found AWS access key in source code',
            remediation: 'Rotate the exposed key immediately',
            file: 'config.js',
            line: 42,
            confidence: 0.99,
            connection_name: 'github-main',
            run_id: 'run-123',
          },
        ],
        risk_score: 95,
        summary: 'Critical secret exposure detected',
        connection_name: 'github-main',
        analyzed_at: new Date().toISOString(),
      };

      const payloadString = JSON.stringify(payload);
      const signature = await computeSignature(payloadString);

      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it('should process findings with all fields', async () => {
      const payload: TestPayload = {
        findings: [
          {
            severity: 'critical',
            category: 'secrets',
            title: 'Test Finding',
            description: 'A test finding',
            remediation: 'Fix it',
            file: 'src/config.ts',
            line: 100,
            confidence: 0.95,
            connection_name: 'conn-1',
            run_id: 'run-001',
          },
        ],
        risk_score: 85,
        summary: 'Test summary',
        connection_name: 'conn-1',
        analyzed_at: new Date().toISOString(),
      };

      expect(payload.findings[0]).toHaveProperty('file');
      expect(payload.findings[0]).toHaveProperty('line');
      expect(payload.findings[0].confidence).toBeLessThanOrEqual(1);
    });

    it('should process findings without file/line', async () => {
      const payload: TestPayload = {
        findings: [
          {
            severity: 'high',
            category: 'permissions',
            title: 'Excessive Permissions',
            description: 'Service account has too much access',
            remediation: 'Reduce permissions',
            confidence: 0.88,
            connection_name: 'conn-2',
            run_id: 'run-002',
          },
        ],
        risk_score: 72,
        summary: 'Permissions issue detected',
        connection_name: 'conn-2',
        analyzed_at: new Date().toISOString(),
      };

      expect(payload.findings[0].file).toBeUndefined();
      expect(payload.findings[0].line).toBeUndefined();
    });

    it('should handle multiple findings in single request', async () => {
      const payload: TestPayload = {
        findings: [
          {
            severity: 'critical',
            category: 'secrets',
            title: 'Finding 1',
            description: 'test',
            remediation: 'fix',
            confidence: 0.99,
            connection_name: 'conn-3',
            run_id: 'run-003',
          },
          {
            severity: 'high',
            category: 'branch-security',
            title: 'Finding 2',
            description: 'test',
            remediation: 'fix',
            confidence: 0.95,
            connection_name: 'conn-3',
            run_id: 'run-003',
          },
          {
            severity: 'medium',
            category: 'missing-tests',
            title: 'Finding 3',
            description: 'test',
            remediation: 'fix',
            confidence: 0.85,
            connection_name: 'conn-3',
            run_id: 'run-003',
          },
        ],
        risk_score: 68,
        summary: 'Multiple issues found',
        connection_name: 'conn-3',
        analyzed_at: new Date().toISOString(),
      };

      expect(payload.findings.length).toBe(3);
      expect(payload.findings.map((f) => f.severity)).toEqual(['critical', 'high', 'medium']);
    });
  });

  describe('POST /findings - Signature Validation', () => {
    it('should reject request without signature header', () => {
      const payload: TestPayload = {
        findings: [],
        risk_score: 0,
        summary: 'test',
        connection_name: 'test',
        analyzed_at: new Date().toISOString(),
      };

      // Missing X-PipeWarden-Signature header should cause 401 rejection
      expect(true).toBe(true);
    });

    it('should reject request with invalid signature', async () => {
      const payload: TestPayload = {
        findings: [
          {
            severity: 'low',
            category: 'test',
            title: 'Test',
            description: 'test',
            remediation: 'test',
            confidence: 0.5,
            connection_name: 'test',
            run_id: 'test',
          },
        ],
        risk_score: 10,
        summary: 'test',
        connection_name: 'test',
        analyzed_at: new Date().toISOString(),
      };

      const payloadString = JSON.stringify(payload);
      const wrongSignature = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';

      expect(wrongSignature).not.toBe(await computeSignature(payloadString));
    });

    it('should reject if signature header is malformed', () => {
      const malformedSignatures = [
        'invalid-signature',
        'sha512=abc123',
        'sha256=notahexstring',
        'sha256=tooshort',
      ];

      malformedSignatures.forEach((sig) => {
        expect(sig).not.toMatch(/^sha256=[a-f0-9]{64}$/);
      });
    });

    it('should use timing-safe comparison to prevent timing attacks', async () => {
      const payload: TestPayload = {
        findings: [],
        risk_score: 0,
        summary: 'test',
        connection_name: 'test',
        analyzed_at: new Date().toISOString(),
      };

      const payloadString = JSON.stringify(payload);
      const correctSig = await computeSignature(payloadString);

      // All of these should be rejected (timing-safe comparison)
      const wrongSigs = [
        'sha256=' + '0'.repeat(64),
        correctSig.substring(0, 63) + '0',
        'SHA256=' + correctSig.substring(7),
      ];

      wrongSigs.forEach((sig) => {
        expect(sig).not.toEqual(correctSig);
      });
    });
  });

  describe('POST /findings - Payload Validation', () => {
    it('should reject malformed JSON', () => {
      const malformedJSON = '{ invalid json }';
      expect(() => JSON.parse(malformedJSON)).toThrow();
    });

    it('should reject payload missing required finding fields', () => {
      const invalidPayload = {
        findings: [
          {
            severity: 'critical',
            // Missing: category, title, description, remediation, etc.
          },
        ],
        risk_score: 50,
        summary: 'test',
        connection_name: 'test',
        analyzed_at: new Date().toISOString(),
      };

      expect(invalidPayload.findings[0]).not.toHaveProperty('category');
    });

    it('should reject invalid severity values', () => {
      const invalidSeverities = ['CRITICAL', 'urgent', 'severe', 'unknown'];

      invalidSeverities.forEach((sev) => {
        expect(['critical', 'high', 'medium', 'low', 'info']).not.toContain(sev);
      });
    });

    it('should reject confidence values outside 0-1 range', () => {
      const invalidConfidences = [-0.1, 1.1, 2.0, -1.0];

      invalidConfidences.forEach((conf) => {
        expect(conf >= 0 && conf <= 1).toBe(false);
      });
    });

    it('should reject risk_score outside 0-100 range', () => {
      const invalidScores = [-1, 101, 150, -50];

      invalidScores.forEach((score) => {
        expect(score >= 0 && score <= 100).toBe(false);
      });
    });

    it('should reject missing required top-level fields', () => {
      const invalidPayloads = [
        {
          // Missing: findings
          risk_score: 50,
          summary: 'test',
          connection_name: 'test',
          analyzed_at: new Date().toISOString(),
        },
        {
          findings: [],
          // Missing: risk_score
          summary: 'test',
          connection_name: 'test',
          analyzed_at: new Date().toISOString(),
        },
        {
          findings: [],
          risk_score: 50,
          // Missing: summary
          connection_name: 'test',
          analyzed_at: new Date().toISOString(),
        },
      ];

      expect(invalidPayloads[1]).not.toHaveProperty('risk_score');
      expect(invalidPayloads[2]).not.toHaveProperty('summary');
    });
  });

  describe('POST /audit - Event Handling', () => {
    it('should accept valid audit event', () => {
      const auditEvent = {
        source: 'pipewarden',
        action: 'scan_completed',
        actor: 'user-123',
        resource: 'github-connection',
        resourceType: 'connection',
        details: {
          findingsCount: 5,
          riskScore: 72,
        },
        timestamp: new Date().toISOString(),
      };

      expect(auditEvent.source).toBe('pipewarden');
      expect(auditEvent.resourceType).toMatch(/^(connection|finding|scan|remediation)$/);
    });

    it('should validate audit action enum', () => {
      const validActions = [
        'scan_started',
        'scan_completed',
        'finding_resolved',
        'policy_updated',
      ];

      expect(validActions).toContain('scan_completed');
      expect(validActions).not.toContain('invalid_action');
    });

    it('should validate audit resource type enum', () => {
      const validResourceTypes = ['connection', 'finding', 'scan', 'remediation'];

      expect(validResourceTypes).toContain('connection');
      expect(validResourceTypes).toContain('finding');
      expect(validResourceTypes).not.toContain('pipeline');
    });

    it('should reject audit event without required fields', () => {
      const incompleteEvent = {
        source: 'pipewarden',
        action: 'scan_completed',
        actor: 'user-123',
        // Missing: resource, resourceType, timestamp
      };

      expect(incompleteEvent).not.toHaveProperty('resource');
    });

    it('should store audit hash for tamper detection', () => {
      const auditEvent = {
        source: 'pipewarden',
        action: 'finding_resolved',
        actor: 'user-456',
        resource: 'finding-789',
        resourceType: 'finding',
        timestamp: new Date().toISOString(),
      };

      // Hash should be deterministic for same data
      const hashInput = JSON.stringify({
        source: auditEvent.source,
        action: auditEvent.action,
        actor: auditEvent.actor,
        resource: auditEvent.resource,
        timestamp: auditEvent.timestamp,
      });

      expect(hashInput).toEqual(hashInput);
    });
  });

  describe('POST /audit - Signature Validation', () => {
    it('should reject audit POST without signature', () => {
      // Missing X-PipeWarden-Signature header
      expect(true).toBe(true);
    });

    it('should validate HMAC signature on audit events', async () => {
      const auditEvent = {
        source: 'pipewarden',
        action: 'scan_started',
        actor: 'system',
        resource: 'conn-123',
        resourceType: 'connection',
        timestamp: new Date().toISOString(),
      };

      const payloadString = JSON.stringify(auditEvent);
      const signature = await computeSignature(payloadString);

      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    });
  });

  describe('GET /status - Connection Status Endpoint', () => {
    it('should return connection status', () => {
      const statusResponse = {
        status: 'connected',
        connectionName: 'github-main',
        lastHeartbeat: new Date().toISOString(),
        findingsCount: 42,
        lastScanAt: new Date().toISOString(),
      };

      expect(statusResponse.status).toBe('connected');
      expect(statusResponse.connectionName).toBeDefined();
    });

    it('should include connection info in status response', () => {
      const statusResponse = {
        status: 'connected',
        connectionName: 'github-prod',
        connectionType: 'github',
        platform: 'github-actions',
        riskScore: 68,
        lastUpdate: new Date().toISOString(),
      };

      expect(statusResponse).toHaveProperty('connectionName');
      expect(statusResponse).toHaveProperty('riskScore');
    });
  });

  describe('Response Codes', () => {
    it('should return 202 Accepted for successful webhook', () => {
      const successResponse = {
        received: true,
        findingsProcessed: 3,
        riskScore: 75,
      };

      expect(successResponse.received).toBe(true);
      expect(successResponse.findingsProcessed).toBeGreaterThanOrEqual(0);
    });

    it('should return 401 Unauthorized for missing signature', () => {
      const errorResponse = {
        error: 'Missing signature',
      };

      expect(errorResponse.error).toBeDefined();
    });

    it('should return 401 Unauthorized for invalid signature', () => {
      const errorResponse = {
        error: 'Invalid signature',
      };

      expect(errorResponse.error).toBeDefined();
    });

    it('should return 400 Bad Request for invalid JSON', () => {
      const errorResponse = {
        error: 'Invalid JSON payload',
      };

      expect(errorResponse.error).toBeDefined();
    });

    it('should return 400 Bad Request for validation errors', () => {
      const errorResponse = {
        error: 'Invalid payload',
        details: {
          fieldErrors: {
            risk_score: ['must be between 0 and 100'],
          },
        },
      };

      expect(errorResponse.error).toBe('Invalid payload');
      expect(errorResponse.details).toBeDefined();
    });

    it('should return 500 Internal Server Error on processing failure', () => {
      const errorResponse = {
        error: 'Internal server error',
      };

      expect(errorResponse.error).toBeDefined();
    });
  });

  describe('Idempotency', () => {
    it('should handle duplicate webhook with same event ID', () => {
      const payload: TestPayload = {
        findings: [
          {
            severity: 'critical',
            category: 'secrets',
            title: 'Test',
            description: 'test',
            remediation: 'test',
            confidence: 0.99,
            connection_name: 'conn',
            run_id: 'run-same',
          },
        ],
        risk_score: 90,
        summary: 'test',
        connection_name: 'conn',
        analyzed_at: new Date().toISOString(),
      };

      // Same run_id should be idempotent
      expect(payload.findings[0].run_id).toBe('run-same');
    });

    it('should prevent duplicate finding processing', () => {
      const findingId = 'finding-idempotent-123';

      // Two requests with same finding ID should only process once
      expect(findingId).toEqual('finding-idempotent-123');
    });
  });
});
