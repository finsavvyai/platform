/**
 * DLP Service Tests
 * Comprehensive test suite for Data Loss Prevention functionality
 */

import { DLPService } from '@/services/dlp/DLPService';
import {
  DLPScanRequest,
  DLPConfig,
  DLPRule,
  DLPPolicy,
  DataType,
  RiskLevel,
  ViolationSeverity
} from '@/types/dlp';
import { logger } from '@/utils/logger';

// Mock dependencies
jest.mock('@/utils/logger');
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('DLPService', () => {
  let dlpService: DLPService;
  let config: DLPConfig;

  beforeEach(() => {
    config = {
      version: '1.0.0',
      enabled: true,
      scanMode: 'SYNC',
      batchSize: 100,
      timeout: 30000,
      retryCount: 3,
      cache: {
        enabled: true,
        ttl: 300,
        maxSize: 10000
      },
      classification: {
        confidenceThreshold: 0.7,
        enableML: true,
        enableRegex: true,
        enableKeyword: true,
        models: ['test-model'],
        customClassifiers: []
      },
      masking: {
        defaultMethod: 'PARTIAL',
        preserveFormat: true,
        visibleChars: 4,
        tokenVault: {
          enabled: false,
          endpoint: '',
          apiKey: ''
        }
      },
      encryption: {
        defaultAlgorithm: 'AES-256-GCM',
        keyRotationDays: 90,
        keyManagement: 'LOCAL'
      },
      audit: {
        storage: 'MEMORY',
        retentionDays: 365,
        logLevel: 'INFO',
        includeSensitiveData: false,
        compressionEnabled: false,
        encryptionEnabled: false
      },
      quarantine: {
        enabled: true,
        retentionDays: 30,
        autoApproval: false,
        notificationEnabled: false
      },
      notifications: {
        channels: [],
        templates: {},
        throttle: {
          maxPerMinute: 10,
          maxPerHour: 100,
          maxPerDay: 1000
        }
      },
      performance: {
        maxConcurrentScans: 50,
        queueSize: 1000,
        workerThreads: 4,
        memoryLimit: 2048
      },
      compliance: {
        frameworks: [],
        reporting: {
          enabled: false,
          frequency: 'WEEKLY',
          recipients: []
        }
      }
    };

    dlpService = new DLPService(config);
    jest.clearAllMocks();
  });

  describe('scanData', () => {
    it('should scan PII data and detect violations', async () => {
      const request: DLPScanRequest = {
        data: 'John Doe, SSN: 123-45-6789, Credit Card: 4111-1111-1111-1111',
        userId: 'test-user',
        dataSource: 'test-source'
      };

      const result = await dlpService.scanData(request);

      expect(result.scanId).toBeDefined();
      expect(result.userId).toBe('test-user');
      expect(result.dataSource).toBe('test-source');
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.riskLevel).toBe('CRITICAL');
      expect(result.classification.type).toBe('PII');

      // Check for specific violations
      const ssnViolation = result.violations.find(v => v.ruleId === 'ssn-detection');
      const ccViolation = result.violations.find(v => v.ruleId === 'credit-card-detection');

      expect(ssnViolation).toBeDefined();
      expect(ccViolation).toBeDefined();
    });

    it('should scan financial data and apply appropriate policies', async () => {
      const request: DLPScanRequest = {
        data: 'Account number: 123456789, Balance: $10,000.00',
        userId: 'test-user',
        dataSource: 'test-source'
      };

      const result = await dlpService.scanData(request);

      expect(result.classification.type).toBe('FINANCIAL');
      expect(result.actions.length).toBeGreaterThan(0);

      // Check if encryption action was applied
      const encryptAction = result.actions.find(a => a.type === 'ENCRYPT');
      expect(encryptAction).toBeDefined();
    });

    it('should handle public data with no violations', async () => {
      const request: DLPScanRequest = {
        data: 'This is a public document with no sensitive information.',
        userId: 'test-user',
        dataSource: 'test-source'
      };

      const result = await dlpService.scanData(request);

      expect(result.violations.length).toBe(0);
      expect(result.riskLevel).toBe('LOW');
      expect(result.classification.type).toBe('PUBLIC');
    });

    it('should apply masking to detected PII', async () => {
      const request: DLPScanRequest = {
        data: 'Email: john.doe@example.com',
        userId: 'test-user',
        dataSource: 'test-source'
      };

      const result = await dlpService.scanData(request);

      const maskActionResult = result.actionResults.find(r => r.type === 'MASK');
      expect(maskActionResult).toBeDefined();
      expect(maskActionResult?.status).toBe('success');
      expect(maskActionResult?.result?.masked).toBe(true);
    });

    it('should quarantine critical risk data', async () => {
      const request: DLPScanRequest = {
        data: 'SSN: 123-45-6789, Credit Card: 4111-1111-1111-1111, Email: test@example.com',
        userId: 'test-user',
        dataSource: 'test-source'
      };

      const result = await dlpService.scanData(request);

      const quarantineActionResult = result.actionResults.find(r => r.type === 'QUARANTINE');
      expect(quarantineActionResult).toBeDefined();
      expect(quarantineActionResult?.result?.quarantined).toBe(true);
    });

    it('should handle streaming data', async () => {
      const { Readable } = require('stream');
      const testData = ['Chunk 1: John Doe', 'Chunk 2: 123-45-6789', 'Chunk 3: Normal text'];
      const stream = Readable.from(testData);

      const request: DLPScanRequest = {
        data: '', // Will be overwritten by stream
        userId: 'test-user',
        dataSource: 'stream-test'
      };

      const processedStream = await dlpService.scanStream(stream, request);

      const chunks = [];
      for await (const chunk of processedStream) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(3);
    });

    it('should handle batch scanning efficiently', async () => {
      const requests: DLPScanRequest[] = Array.from({ length: 50 }, (_, i) => ({
        data: `Test data ${i}: SSN: ${100 + i}-${200 + i}-${3000 + i}`,
        userId: 'test-user',
        dataSource: 'batch-test'
      }));

      const startTime = Date.now();
      const results = await dlpService.scanBatch(requests);
      const duration = Date.now() - startTime;

      expect(results.length).toBe(50);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      results.forEach(result => {
        expect(result.scanId).toBeDefined();
        expect(result.violations.length).toBeGreaterThan(0);
      });
    });

    it('should respect rate limiting', async () => {
      // Configure rate limiting
      const rateLimitedConfig = { ...config };
      rateLimitedConfig.performance.maxConcurrentScans = 1;
      rateLimitedConfig.performance.queueSize = 2;

      const limitedService = new DLPService(rateLimitedConfig);

      const requests = Array.from({ length: 5 }, (_, i) => ({
        data: `Test ${i}`,
        userId: 'test-user',
        dataSource: 'rate-limit-test'
      }));

      // Should process but queue some requests
      const results = await Promise.allSettled(
        requests.map(req => limitedService.scanData(req))
      );

      expect(results.every(r => r.status === 'fulfilled')).toBe(true);
    });

    it('should handle malformed data gracefully', async () => {
      const malformedRequests = [
        { data: null, userId: 'test-user', dataSource: 'test' },
        { data: undefined, userId: 'test-user', dataSource: 'test' },
        { data: '', userId: 'test-user', dataSource: 'test' },
        { data: 12345, userId: 'test-user', dataSource: 'test' }
      ];

      for (const request of malformedRequests) {
        const result = await dlpService.scanData(request);
        expect(result.scanId).toBeDefined();
        expect(result.classification.type).toBe('UNKNOWN');
      }
    });

    it('should cache scan results for identical data', async () => {
      const request: DLPScanRequest = {
        data: 'Test data for caching',
        userId: 'test-user',
        dataSource: 'cache-test'
      };

      // First scan
      const result1 = await dlpService.scanData(request);
      const metrics1 = result1.metrics;

      // Second scan with identical data
      const result2 = await dlpService.scanData(request);
      const metrics2 = result2.metrics;

      // Should have cache hits on second scan
      expect(metrics2.cacheHits).toBeGreaterThan(metrics1.cacheHits);
    });
  });

  describe('Rule Management', () => {
    it('should add a custom DLP rule', async () => {
      const customRule: DLPRule = {
        id: 'custom-api-key-rule',
        name: 'API Key Detection',
        description: 'Detects potential API keys',
        severity: 'HIGH',
        enabled: true,
        priority: 5,
        conditions: [
          {
            id: 'api-key-pattern',
            type: 'REGEX',
            operator: 'MATCHES',
            value: '(?i)(api[_-]?key|apikey)["\'"]?\\s*[:=]\\s*["\'"]?([a-zA-Z0-9_-]{20,})',
            weight: 1
          }
        ],
        dataTypes: ['UNKNOWN', 'INTERNAL'],
        actions: ['ALERT', 'QUARANTINE'],
        metadata: {
          category: 'Security',
          author: 'test-user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
          triggerCount: 0,
          falsePositiveRate: 0
        }
      };

      await dlpService.addRule(customRule);

      const request: DLPScanRequest = {
        data: 'api_key = sk_test_1234567890abcdef',
        userId: 'test-user',
        dataSource: 'rule-test'
      };

      const result = await dlpService.scanData(request);

      const customViolation = result.violations.find(v => v.ruleId === 'custom-api-key-rule');
      expect(customViolation).toBeDefined();
      expect(customViolation?.severity).toBe('HIGH');
    });

    it('should update existing DLP rule', async () => {
      const updates = {
        enabled: false,
        severity: 'MEDIUM' as ViolationSeverity
      };

      await dlpService.updateRule('ssn-detection', updates);

      const request: DLPScanRequest = {
        data: 'SSN: 123-45-6789',
        userId: 'test-user',
        dataSource: 'rule-update-test'
      };

      const result = await dlpService.scanData(request);

      // Rule should be disabled, no violation
      const ssnViolation = result.violations.find(v => v.ruleId === 'ssn-detection');
      expect(ssnViolation).toBeUndefined();
    });

    it('should remove DLP rule', async () => {
      await dlpService.removeRule('email-detection');

      const request: DLPScanRequest = {
        data: 'Email: test@example.com',
        userId: 'test-user',
        dataSource: 'rule-delete-test'
      };

      const result = await dlpService.scanData(request);

      const emailViolation = result.violations.find(v => v.ruleId === 'email-detection');
      expect(emailViolation).toBeUndefined();
    });

    it('should validate rule structure', async () => {
      const invalidRule = {
        // Missing required fields
        name: 'Invalid Rule'
      } as DLPRule;

      await expect(dlpService.addRule(invalidRule)).rejects.toThrow();
    });

    it('should handle rule conditions with different operators', async () => {
      const rule: DLPRule = {
        id: 'conditional-rule',
        name: 'Conditional Rule Test',
        description: 'Tests different condition operators',
        severity: 'MEDIUM',
        enabled: true,
        priority: 5,
        conditions: [
          {
            id: 'contains-test',
            type: 'KEYWORD',
            operator: 'CONTAINS',
            value: ['confidential', 'secret'],
            weight: 0.5
          },
          {
            id: 'length-test',
            type: 'CUSTOM',
            operator: 'GREATER_THAN',
            value: 100,
            weight: 0.5
          }
        ],
        actions: ['ALERT'],
        metadata: {
          category: 'Test',
          author: 'test-user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
          triggerCount: 0,
          falsePositiveRate: 0
        }
      };

      await dlpService.addRule(rule);

      const request: DLPScanRequest = {
        data: 'This document contains confidential information and is very long'.repeat(10),
        userId: 'test-user',
        dataSource: 'conditional-test'
      };

      const result = await dlpService.scanData(request);

      const conditionalViolation = result.violations.find(v => v.ruleId === 'conditional-rule');
      expect(conditionalViolation).toBeDefined();
    });
  });

  describe('Policy Management', () => {
    it('should add and apply custom DLP policy', async () => {
      const customPolicy: DLPPolicy = {
        id: 'custom-high-security',
        name: 'High Security Policy',
        description: 'Applies strict measures to sensitive data',
        enabled: true,
        priority: 1,
        conditions: {
          dataTypes: ['PII', 'PHI'],
          riskLevels: ['HIGH', 'CRITICAL']
        },
        actions: [
          {
            id: 'encrypt-all',
            type: 'ENCRYPT',
            params: {
              algorithm: 'AES-256-GCM',
              keyRotation: true
            },
            order: 1,
            async: false
          },
          {
            id: 'notify-admin',
            type: 'ALERT',
            params: {
              severity: 'HIGH',
              recipients: ['admin@company.com']
            },
            order: 2,
            async: true
          }
        ],
        exemptions: [],
        metadata: {
          category: 'Security',
          owner: 'test-user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
          complianceImpact: ['GDPR', 'CCPA']
        }
      };

      await dlpService.addPolicy(customPolicy);

      const request: DLPScanRequest = {
        data: 'John Doe, SSN: 123-45-6789',
        userId: 'test-user',
        dataSource: 'policy-test'
      };

      const result = await dlpService.scanData(request);

      // Should have policy actions applied
      expect(result.actions.length).toBeGreaterThan(0);

      const encryptAction = result.actions.find(a => a.type === 'ENCRYPT');
      expect(encryptAction).toBeDefined();
    });

    it('should handle policy conditions with user roles', async () => {
      const roleBasedPolicy: DLPPolicy = {
        id: 'admin-exemption',
        name: 'Admin Exemption Policy',
        description: 'Relaxed restrictions for admin users',
        enabled: true,
        priority: 10,
        conditions: {
          roles: ['admin', 'security-admin']
        },
        actions: [
          {
            id: 'log-only',
            type: 'LOG',
            params: {
              level: 'INFO'
            },
            order: 1,
            async: false
          }
        ],
        exemptions: [],
        metadata: {
          category: 'Access Control',
          owner: 'test-user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1
        }
      };

      await dlpService.addPolicy(roleBasedPolicy);

      const request: DLPScanRequest = {
        data: 'SSN: 123-45-6789',
        userId: 'admin-user',
        dataSource: 'role-policy-test',
        context: {
          roles: ['admin']
        }
      };

      const result = await dlpService.scanData(request);

      // Should have minimal actions for admin
      expect(result.actions.some(a => a.type === 'MASK')).toBe(false);
      expect(result.actions.some(a => a.type === 'LOG')).toBe(true);
    });
  });

  describe('Data Classification', () => {
    it('should correctly classify PII data', async () => {
      const testData = [
        'Name: John Doe, SSN: 123-45-6789',
        'Address: 123 Main St, Anytown, USA',
        'Phone: (555) 123-4567',
        'Email: john.doe@example.com'
      ];

      for (const data of testData) {
        const request: DLPScanRequest = {
          data,
          userId: 'test-user',
          dataSource: 'classification-test'
        };

        const result = await dlpService.scanData(request);

        expect(result.classification.type).toBe('PII');
        expect(result.classification.confidence).toBeGreaterThan(0.5);
        expect(result.classification.tags.length).toBeGreaterThan(0);
      }
    });

    it('should correctly classify PHI data', async () => {
      const request: DLPScanRequest = {
        data: 'Patient: John Doe, Diagnosis: Hypertension, Treatment: Prescription medication',
        userId: 'test-user',
        dataSource: 'phi-test'
      };

      const result = await dlpService.scanData(request);

      expect(result.classification.type).toBe('PHI');
      expect(result.classification.tags).toContain('medical');
    });

    it('should correctly classify financial data', async () => {
      const request: DLPScanRequest = {
        data: 'Credit Card: 4111-1111-1111-1111, Bank Account: 123456789, Transaction: $100.00',
        userId: 'test-user',
        dataSource: 'financial-test'
      };

      const result = await dlpService.scanData(request);

      expect(result.classification.type).toBe('FINANCIAL');
      expect(result.classification.confidence).toBeGreaterThan(0.7);
    });

    it('should handle multi-type classification', async () => {
      const request: DLPScanRequest = {
        data: 'Patient: John Doe (SSN: 123-45-6789), Credit Card: 4111-1111-1111-1111',
        userId: 'test-user',
        dataSource: 'multi-type-test'
      };

      const result = await dlpService.scanData(request);

      // Should classify as the most sensitive type
      expect(['PII', 'PHI', 'FINANCIAL']).toContain(result.classification.type);
      expect(result.riskLevel).toBe('CRITICAL');
    });
  });

  describe('Masking Operations', () => {
    it('should apply full masking', async () => {
      const request: DLPScanRequest = {
        data: 'SSN: 123-45-6789',
        userId: 'test-user',
        dataSource: 'masking-test'
      };

      // Add a policy that applies full masking
      const policy: DLPPolicy = {
        id: 'full-mask-policy',
        name: 'Full Mask Policy',
        description: 'Applies full masking to SSN',
        enabled: true,
        priority: 1,
        conditions: {
          dataTypes: ['PII']
        },
        actions: [
          {
            id: 'full-mask',
            type: 'MASK',
            params: {
              method: 'FULL'
            },
            order: 1,
            async: false
          }
        ],
        exemptions: [],
        metadata: {
          category: 'Masking',
          owner: 'test-user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1
        }
      };

      await dlpService.addPolicy(policy);

      const result = await dlpService.scanData(request);

      const maskResult = result.actionResults.find(r => r.type === 'MASK');
      expect(maskResult?.result?.processedData).toContain('***');
    });

    it('should apply partial masking preserving format', async () => {
      const policy: DLPPolicy = {
        id: 'partial-mask-policy',
        name: 'Partial Mask Policy',
        description: 'Applies partial masking preserving format',
        enabled: true,
        priority: 1,
        conditions: {
          dataTypes: ['PII']
        },
        actions: [
          {
            id: 'partial-mask',
            type: 'MASK',
            params: {
              method: 'PARTIAL',
              preserveFormat: true,
              visibleChars: 4
            },
            order: 1,
            async: false
          }
        ],
        exemptions: [],
        metadata: {
          category: 'Masking',
          owner: 'test-user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1
        }
      };

      await dlpService.addPolicy(policy);

      const request: DLPScanRequest = {
        data: 'Credit Card: 4111-1111-1111-1111',
        userId: 'test-user',
        dataSource: 'partial-mask-test'
      };

      const result = await dlpService.scanData(request);

      const maskResult = result.actionResults.find(r => r.type === 'MASK');
      expect(maskResult?.result?.processedData).toMatch(/^4111[-*]*\d{4}$/);
    });

    it('should apply tokenization', async () => {
      const policy: DLPPolicy = {
        id: 'tokenization-policy',
        name: 'Tokenization Policy',
        description: 'Applies tokenization to sensitive data',
        enabled: true,
        priority: 1,
        conditions: {
          dataTypes: ['PII']
        },
        actions: [
          {
            id: 'tokenize',
            type: 'MASK',
            params: {
              method: 'TOKENIZATION'
            },
            order: 1,
            async: false
          }
        ],
        exemptions: [],
        metadata: {
          category: 'Tokenization',
          owner: 'test-user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1
        }
      };

      await dlpService.addPolicy(policy);

      const request: DLPScanRequest = {
        data: 'SSN: 123-45-6789',
        userId: 'test-user',
        dataSource: 'tokenization-test'
      };

      const result = await dlpService.scanData(request);

      const maskResult = result.actionResults.find(r => r.type === 'MASK');
      expect(maskResult?.result?.processedData).toMatch(/TOKEN_[a-f0-9]{16}/);
    });
  });

  describe('Encryption Operations', () => {
    it('should encrypt sensitive data', async () => {
      const policy: DLPPolicy = {
        id: 'encryption-policy',
        name: 'Encryption Policy',
        description: 'Encrypts financial data',
        enabled: true,
        priority: 1,
        conditions: {
          dataTypes: ['FINANCIAL']
        },
        actions: [
          {
            id: 'encrypt-data',
            type: 'ENCRYPT',
            params: {
              algorithm: 'AES-256-GCM',
              keyId: 'test-key'
            },
            order: 1,
            async: false
          }
        ],
        exemptions: [],
        metadata: {
          category: 'Encryption',
          owner: 'test-user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1
        }
      };

      await dlpService.addPolicy(policy);

      const request: DLPScanRequest = {
        data: 'Credit Card: 4111-1111-1111-1111',
        userId: 'test-user',
        dataSource: 'encryption-test'
      };

      const result = await dlpService.scanData(request);

      const encryptResult = result.actionResults.find(r => r.type === 'ENCRYPT');
      expect(encryptResult?.status).toBe('success');
      expect(encryptResult?.result?.encrypted).toBe(true);
      expect(encryptResult?.result?.processedData).toHaveProperty('encrypted');
      expect(encryptResult?.result?.processedData).toHaveProperty('iv');
      expect(encryptResult?.result?.processedData).toHaveProperty('authTag');
    });

    it('should use different encryption algorithms', async () => {
      const algorithms = ['AES-128-GCM', 'AES-256-CBC', 'CHACHA20-POLY1305'];

      for (const algorithm of algorithms) {
        const policy: DLPPolicy = {
          id: `encryption-policy-${algorithm}`,
          name: `Encryption Policy - ${algorithm}`,
          description: `Encrypts with ${algorithm}`,
          enabled: true,
          priority: 1,
          conditions: {
            dataTypes: ['FINANCIAL']
          },
          actions: [
            {
              id: `encrypt-${algorithm}`,
              type: 'ENCRYPT',
              params: {
                algorithm,
                keyId: 'test-key'
              },
              order: 1,
              async: false
            }
          ],
          exemptions: [],
          metadata: {
            category: 'Encryption',
            owner: 'test-user',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1
          }
        };

        await dlpService.addPolicy(policy);

        const request: DLPScanRequest = {
          data: `Test data for ${algorithm}`,
          userId: 'test-user',
          dataSource: `encryption-test-${algorithm}`
        };

        const result = await dlpService.scanData(request);

        const encryptResult = result.actionResults.find(r => r.type === 'ENCRYPT');
        expect(encryptResult?.status).toBe('success');
        expect(encryptResult?.result?.processedData.algorithm).toBe(algorithm);
      }
    });
  });

  describe('Quarantine Management', () => {
    it('should quarantine high-risk data', async () => {
      const request: DLPScanRequest = {
        data: 'SSN: 123-45-6789, Credit Card: 4111-1111-1111-1111, API Key: sk_test_1234567890abcdef',
        userId: 'test-user',
        dataSource: 'quarantine-test'
      };

      const result = await dlpService.scanData(request);

      expect(result.riskLevel).toBe('CRITICAL');

      const quarantineResult = result.actionResults.find(r => r.type === 'QUARANTINE');
      expect(quarantineResult?.status).toBe('success');
      expect(quarantineResult?.result?.quarantined).toBe(true);
    });

    it('should release quarantined data with approval', async () => {
      // First quarantine some data
      const request: DLPScanRequest = {
        data: 'SSN: 123-45-6789',
        userId: 'test-user',
        dataSource: 'quarantine-release-test'
      };

      const scanResult = await dlpService.scanData(request);

      // Get quarantine records (implementation-specific)
      const quarantineRecords = await dlpService.getQuarantineRecords({
        userId: 'test-user',
        status: 'QUARANTINED'
      });

      if (quarantineRecords.length > 0) {
        const recordId = quarantineRecords[0].id;

        // Release the record
        await dlpService.releaseQuarantine(recordId, 'admin-user', 'Approved for release');

        // Verify release
        const updatedRecord = await dlpService.getQuarantineRecord(recordId);
        expect(updatedRecord.status).toBe('RELEASED');
        expect(updatedRecord.reviewedBy).toBe('admin-user');
      }
    });

    it('should delete quarantined data permanently', async () => {
      // Similar to release test but with deletion
      const request: DLPScanRequest = {
        data: 'SSN: 123-45-6789',
        userId: 'test-user',
        dataSource: 'quarantine-delete-test'
      };

      const scanResult = await dlpService.scanData(request);

      const quarantineRecords = await dlpService.getQuarantineRecords({
        userId: 'test-user',
        status: 'QUARANTINED'
      });

      if (quarantineRecords.length > 0) {
        const recordId = quarantineRecords[0].id;

        // Delete the record
        await dlpService.deleteQuarantine(recordId, 'admin-user', 'Permanently deleted');

        // Verify deletion
        const deletedRecord = await dlpService.getQuarantineRecord(recordId);
        expect(deletedRecord.status).toBe('DELETED');
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large data efficiently', async () => {
      const largeData = 'Sensitive information: '.repeat(10000) + 'SSN: 123-45-6789';

      const request: DLPScanRequest = {
        data: largeData,
        userId: 'test-user',
        dataSource: 'large-data-test'
      };

      const startTime = Date.now();
      const result = await dlpService.scanData(request);
      const duration = Date.now() - startTime;

      expect(result.scanId).toBeDefined();
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.metrics.bytesProcessed).toBeGreaterThan(100000);
    });

    it('should handle concurrent scans', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => ({
        data: `Concurrent test ${i}: SSN: ${100 + i}-${200 + i}-${3000 + i}`,
        userId: 'test-user',
        dataSource: 'concurrent-test'
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        concurrentRequests.map(req => dlpService.scanData(req))
      );
      const duration = Date.now() - startTime;

      expect(results.length).toBe(10);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      results.forEach((result, i) => {
        expect(result.scanId).toBeDefined();
        expect(result.violations.length).toBeGreaterThan(0);
      });
    });

    it('should maintain accuracy under load', async () => {
      const loadTestRequests = Array.from({ length: 100 }, (_, i) => ({
        data: `Load test ${i}: Contains ${i % 2 === 0 ? 'SSN: ' + (100 + i) + '-' + (200 + i) + '-' + (3000 + i) : 'public information'}`,
        userId: 'test-user',
        dataSource: 'load-test'
      }));

      const results = await dlpService.scanBatch(loadTestRequests);

      // Check accuracy
      const correctDetections = results.filter((result, i) => {
        const hasSSN = i % 2 === 0;
        const detectedViolation = result.violations.length > 0;
        return hasSSN === detectedViolation;
      });

      const accuracy = correctDetections.length / results.length;
      expect(accuracy).toBeGreaterThan(0.95); // 95% accuracy threshold
    });
  });

  describe('Error Handling', () => {
    it('should handle service failures gracefully', async () => {
      // Mock a failure in classification
      const mockError = new Error('Classification service unavailable');
      jest.spyOn(dlpService['classificationEngine'], 'classify')
        .mockRejectedValueOnce(mockError);

      const request: DLPScanRequest = {
        data: 'Test data',
        userId: 'test-user',
        dataSource: 'error-test'
      };

      const result = await dlpService.scanData(request);

      expect(result.riskLevel).toBe('ERROR');
      expect(result.error).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'DLP scan failed',
        expect.objectContaining({
          error: mockError.message
        })
      );
    });

    it('should handle action execution failures', async () => {
      // Create a policy with an action that will fail
      const failingPolicy: DLPPolicy = {
        id: 'failing-policy',
        name: 'Failing Policy',
        description: 'Policy with failing action',
        enabled: true,
        priority: 1,
        conditions: {
          dataTypes: ['PII']
        },
        actions: [
          {
            id: 'failing-action',
            type: 'CUSTOM', // Unsupported action type
            params: {},
            order: 1,
            async: false
          }
        ],
        exemptions: [],
        metadata: {
          category: 'Test',
          owner: 'test-user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1
        }
      };

      await dlpService.addPolicy(failingPolicy);

      const request: DLPScanRequest = {
        data: 'SSN: 123-45-6789',
        userId: 'test-user',
        dataSource: 'failing-action-test'
      };

      const result = await dlpService.scanData(request);

      const failedAction = result.actionResults.find(r => r.status === 'error');
      expect(failedAction).toBeDefined();
      expect(failedAction?.error).toBeDefined();
    });

    it('should handle timeout errors', async () => {
      // Create a large dataset that might cause timeout
      const largeData = 'x'.repeat(1000000) + ' SSN: 123-45-6789 ' + 'x'.repeat(1000000);

      const request: DLPScanRequest = {
        data: largeData,
        userId: 'test-user',
        dataSource: 'timeout-test',
        options: {
          timeout: 100 // Very short timeout
        }
      };

      const result = await dlpService.scanData(request);

      // Should either complete or handle timeout gracefully
      expect(result.scanId).toBeDefined();
      if (result.riskLevel === 'ERROR') {
        expect(result.error).toContain('timeout');
      }
    });
  });

  describe('Statistics and Reporting', () => {
    it('should generate accurate statistics', async () => {
      // Generate some scan data
      const testData = [
        { data: 'SSN: 123-45-6789', type: 'PII' },
        { data: 'Credit Card: 4111-1111-1111-1111', type: 'FINANCIAL' },
        { data: 'Public information', type: 'PUBLIC' },
        { data: 'Email: test@example.com', type: 'PII' },
        { data: 'Patient: John Doe', type: 'PHI' }
      ];

      for (const test of testData) {
        await dlpService.scanData({
          data: test.data,
          userId: 'test-user',
          dataSource: 'stats-test'
        });
      }

      const stats = await dlpService.getStats({
        start: new Date(Date.now() - 60000).toISOString(),
        end: new Date().toISOString()
      });

      expect(stats.totalScans).toBe(5);
      expect(stats.scansByDataType['PII']).toBe(2);
      expect(stats.scansByDataType['FINANCIAL']).toBe(1);
      expect(stats.scansByDataType['PUBLIC']).toBe(1);
      expect(stats.scansByDataType['PHI']).toBe(1);
      expect(stats.totalViolations).toBeGreaterThan(0);
    });

    it('should track metrics over time', async () => {
      const timeSeriesData = [];

      // Generate scans over time
      for (let i = 0; i < 10; i++) {
        const request: DLPScanRequest = {
          data: `Test ${i}: SSN: ${100 + i}-${200 + i}-${3000 + i}`,
          userId: 'test-user',
          dataSource: 'time-series-test'
        };

        const result = await dlpService.scanData(request);
        timeSeriesData.push({
          timestamp: result.timestamp,
          riskLevel: result.riskLevel,
          violations: result.violations.length
        });

        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Verify time series tracking
      expect(timeSeriesData.length).toBe(10);
      expect(timeSeriesData.every(t => t.timestamp)).toBe(true);
      expect(timeSeriesData.every(t => t.riskLevel !== undefined)).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should work with other security services', async () => {
      // Test integration with authentication/authorization
      const request: DLPScanRequest = {
        data: 'SSN: 123-45-6789',
        userId: 'privileged-user',
        dataSource: 'integration-test',
        context: {
          roles: ['admin', 'security-auditor'],
          department: 'IT Security',
          location: 'US'
        }
      };

      const result = await dlpService.scanData(request);

      // Should consider user context in policy application
      expect(result.scanId).toBeDefined();
      expect(result.classification.type).toBe('PII');
    });

    it('should integrate with logging and monitoring', async () => {
      const request: DLPScanRequest = {
        data: 'Critical data: SSN: 123-45-6789, Credit Card: 4111-1111-1111-1111',
        userId: 'test-user',
        dataSource: 'monitoring-integration-test'
      };

      const result = await dlpService.scanData(request);

      // Verify audit logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        'DLP scan completed',
        expect.objectContaining({
          scanId: result.scanId,
          riskLevel: result.riskLevel
        })
      );

      // Verify metrics emission
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Critical DLP risk detected',
        expect.any(Object)
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty data', async () => {
      const request: DLPScanRequest = {
        data: '',
        userId: 'test-user',
        dataSource: 'empty-test'
      };

      const result = await dlpService.scanData(request);

      expect(result.scanId).toBeDefined();
      expect(result.classification.type).toBe('UNKNOWN');
      expect(result.violations.length).toBe(0);
    });

    it('should handle binary data', async () => {
      const binaryData = Buffer.from('Binary content with SSN: 123-45-6789', 'utf8');

      const request: DLPScanRequest = {
        data: binaryData,
        userId: 'test-user',
        dataSource: 'binary-test'
      };

      const result = await dlpService.scanData(request);

      expect(result.scanId).toBeDefined();
      expect(result.metrics.bytesProcessed).toBe(binaryData.length);
    });

    it('should handle Unicode and special characters', async () => {
      const unicodeData = '测试数据 SSN: 123-45-6789 Émojis: 🚀🔒💳';

      const request: DLPScanRequest = {
        data: unicodeData,
        userId: 'test-user',
        dataSource: 'unicode-test'
      };

      const result = await dlpService.scanData(request);

      expect(result.scanId).toBeDefined();
      expect(result.classification.type).toBe('PII');
    });

    it('should handle very long strings', async () => {
      const longString = 'a'.repeat(1000000) + ' SSN: 123-45-6789 ' + 'b'.repeat(1000000);

      const request: DLPScanRequest = {
        data: longString,
        userId: 'test-user',
        dataSource: 'long-string-test'
      };

      const result = await dlpService.scanData(request);

      expect(result.scanId).toBeDefined();
      expect(result.metrics.scanDuration).toBeLessThan(10000);
    });
  });
});
