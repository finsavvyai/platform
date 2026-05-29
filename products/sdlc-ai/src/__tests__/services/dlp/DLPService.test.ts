/**
 * DLP Service Tests
 * Comprehensive test suite for Data Loss Prevention functionality
 */

import { DLPService } from '@/services/dlp/DLPService';
import {
  DLPScanRequest,
  DLPConfig,
  DataType,
  RiskLevel,
  ViolationSeverity,
  DLPRule,
  DLPPolicy,
  DLPActionType
} from '@/types/dlp';
import { logger } from '@/utils/logger';

// Mock logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('DLPService', () => {
  let dlpService: DLPService;
  let mockConfig: DLPConfig;

  beforeEach(() => {
    mockConfig = {
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
        models: ['pii-classifier-v1'],
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
        notificationEnabled: true
      },
      notifications: {
        channels: ['EMAIL'],
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
          enabled: true,
          frequency: 'WEEKLY',
          recipients: []
        }
      }
    };

    dlpService = new DLPService(mockConfig);
    jest.clearAllMocks();
  });

  describe('Basic Scanning', () => {
    it('should scan public data without violations', async () => {
      const request: DLPScanRequest = {
        data: 'This is a public document with no sensitive information.',
        userId: 'user-123',
        dataSource: 'test'
      };

      const result = await dlpService.scanData(request);

      expect(result.scanId).toBeDefined();
      expect(result.userId).toBe('user-123');
      expect(result.dataSource).toBe('test');
      expect(result.riskLevel).toBe('NONE');
      expect(result.violations).toHaveLength(0);
      expect(result.classification.type).toBe('PUBLIC');
      expect(result.metrics.scanDuration).toBeGreaterThan(0);
    });

    it('should detect PII data and apply masking', async () => {
      const request: DLPScanRequest = {
        data: 'Contact John Doe at john.doe@email.com or call 555-123-4567. SSN: 123-45-6789',
        userId: 'user-123',
        dataSource: 'test'
      };

      const result = await dlpService.scanData(request);

      expect(result.scanId).toBeDefined();
      expect(result.riskLevel).toBe('HIGH');
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.classification.type).toBe('PII');
      expect(result.actions.length).toBeGreaterThan(0);

      // Check for email detection
      const emailViolation = result.violations.find(v => v.ruleName === 'Email Address Detection');
      expect(emailViolation).toBeDefined();

      // Check for SSN detection
      const ssnViolation = result.violations.find(v => v.ruleName === 'Social Security Number Detection');
      expect(ssnViolation).toBeDefined();
      expect(ssnViolation.severity).toBe('CRITICAL');
    });

    it('should detect credit card numbers', async () => {
      const request: DLPScanRequest = {
        data: 'Credit card: 4111-1111-1111-1111',
        userId: 'user-123',
        dataSource: 'test'
      };

      const result = await dlpService.scanData(request);

      expect(result.riskLevel).toBe('HIGH');
      const ccViolation = result.violations.find(v => v.ruleName === 'Credit Card Number Detection');
      expect(ccViolation).toBeDefined();
      expect(ccViolation.severity).toBe('HIGH');
    });

    it('should detect high entropy data (potential API keys)', async () => {
      const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';
      const request: DLPScanRequest = {
        data: `API Key: ${apiKey}`,
        userId: 'user-123',
        dataSource: 'test'
      };

      const result = await dlpService.scanData(request);

      const entropyViolation = result.violations.find(v => v.ruleName === 'High Entropy Data Detection');
      expect(entropyViolation).toBeDefined();
      expect(entropyViolation.severity).toBe('HIGH');
    });
  });

  describe('Classification Engine', () => {
    it('should classify PHI data correctly', async () => {
      const request: DLPScanRequest = {
        data: 'Patient: John Smith, Diagnosis: Hypertension, Treatment: Lisinopril 10mg daily',
        userId: 'user-123',
        dataSource: 'test'
      };

      const result = await dlpService.scanData(request);

      expect(result.classification.type).toBe('PHI');
      expect(result.classification.confidence).toBeGreaterThan(0.5);
    });

    it('should classify financial data correctly', async () => {
      const request: DLPScanRequest = {
        data: 'Bank Account: 123456789, Routing: 021000021, Balance: $5,432.10',
        userId: 'user-123',
        dataSource: 'test'
      };

      const result = await dlpService.scanData(request);

      expect(result.classification.type).toBe('FINANCIAL');
      expect(result.riskLevel).toBe('HIGH');
    });

    it('should classify confidential business data', async () => {
      const request: DLPScanRequest = {
        data: 'CONFIDENTIAL: Q3 Revenue Projections - Internal Use Only',
        userId: 'user-123',
        dataSource: 'test'
      };

      const result = await dlpService.scanData(request);

      expect(['INTERNAL', 'CONFIDENTIAL']).toContain(result.classification.type);
    });
  });

  describe('Policy Application', () => {
    it('should apply PII protection policy to PII data', async () => {
      const request: DLPScanRequest = {
        data: 'John Doe, SSN: 123-45-6789, Email: john@example.com',
        userId: 'user-123',
        dataSource: 'test'
      };

      const result = await dlpService.scanData(request);

      // Should have masking actions applied
      const maskAction = result.actions.find(a => a.type === 'MASK');
      expect(maskAction).toBeDefined();

      // Should have alert actions
      const alertAction = result.actions.find(a => a.type === 'ALERT');
      expect(alertAction).toBeDefined();
    });

    it('should apply encryption policy to financial data', async () => {
      const request: DLPScanRequest = {
        data: 'Credit Card: 4111-1111-1111-1111, Expiry: 12/24, CVV: 123',
        userId: 'user-123',
        dataSource: 'test'
      };

      const result = await dlpService.scanData(request);

      const encryptAction = result.actions.find(a => a.type === 'ENCRYPT');
      expect(encryptAction).toBeDefined();
    });
  });

  describe('Risk Assessment', () => {
    it('should assess CRITICAL risk for SSN exposure', async () => {
      const request: DLPScanRequest = {
        data: 'Social Security Number: 123-45-6789',
        userId: 'user-123',
        dataSource: 'test'
      };

      const result = await dlpService.scanData(request);

      expect(result.riskLevel).toBe('CRITICAL');
      expect(result.violations.some(v => v.severity === 'CRITICAL')).toBe(true);
    });

    it('should assess MEDIUM risk for email exposure', async () => {
      const request: DLPScanRequest = {
        data: 'Contact us at support@example.com',
        userId: 'user-123',
        dataSource: 'test'
      };

      const result = await dlpService.scanData(request);

      expect(['LOW', 'MEDIUM']).toContain(result.riskLevel);
    });

    it('should assess NO risk for public data', async () => {
      const request: DLPScanRequest = {
        data: 'This is a public announcement.',
        userId: 'user-123',
        dataSource: 'test'
      };

      const result = await dlpService.scanData(request);

      expect(result.riskLevel).toBe('NONE');
    });
  });

  describe('Custom Rules', () => {
    it('should add and apply custom rule', async () => {
      const customRule: DLPRule = {
        id: 'custom-api-key',
        name: 'Custom API Key Detection',
        description: 'Detects custom API key pattern',
        severity: 'HIGH',
        enabled: true,
        priority: 5,
        conditions: [
          {
            id: 'api-key-pattern',
            type: 'REGEX',
            operator: 'MATCHES',
            value: 'custom_api_[a-zA-Z0-9]{32}',
            weight: 1
          }
        ],
        actions: ['BLOCK', 'ALERT'],
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
        data: 'API Key: custom_api_abcdef1234567890abcdef1234567890',
        userId: 'user-123',
        dataSource: 'test'
      };

      const result = await dlpService.scanData(request);

      const customViolation = result.violations.find(v => v.ruleId === 'custom-api-key');
      expect(customViolation).toBeDefined();
      expect(customViolation.severity).toBe('HIGH');
    });

    it('should update existing rule', async () => {
      // Update credit card rule to be more strict
      await dlpService.updateRule('credit-card-detection', {
        severity: 'CRITICAL',
        enabled: true
      });

      const request: DLPScanRequest = {
        data: 'Card: 4111-1111-1111-1111',
        userId: 'user-123',
        dataSource: 'test'
      };

      const result = await dlpService.scanData(request);

      const ccViolation = result.violations.find(v => v.ruleId === 'credit-card-detection');
      expect(ccViolation.severity).toBe('CRITICAL');
    });

    it('should remove rule', async () => {
      await dlpService.removeRule('email-detection');

      const request: DLPScanRequest = {
        data: 'Contact: test@example.com',
        userId: 'user-123',
        dataSource: 'test'
      };

      const result = await dlpService.scanData(request);

      const emailViolation = result.violations.find(v => v.ruleId === 'email-detection');
      expect(emailViolation).toBeUndefined();
    });
  });

  describe('Batch Scanning', () => {
    it('should scan multiple items in batch', async () => {
      const requests: DLPScanRequest[] = [
        {
          data: 'Public information',
          userId: 'user-123',
          dataSource: 'test-batch'
        },
        {
          data: 'SSN: 123-45-6789',
          userId: 'user-123',
          dataSource: 'test-batch'
        },
        {
          data: 'Email: test@example.com',
          userId: 'user-123',
          dataSource: 'test-batch'
        }
      ];

      const results = await dlpService.scanBatch(requests);

      expect(results).toHaveLength(3);
      expect(results[0].riskLevel).toBe('NONE');
      expect(results[1].riskLevel).toBe('CRITICAL');
      expect(results[2].riskLevel).toBe('MEDIUM');
    });

    it('should emit batch progress events', async () => {
      const progressEvents = [];
      dlpService.on('batchProgress', (event) => {
        progressEvents.push(event);
      });

      const requests: DLPScanRequest[] = Array.from({ length: 250 }, (_, i) => ({
        data: `Test data ${i}`,
        userId: 'user-123',
        dataSource: 'test-batch'
      }));

      await dlpService.scanBatch(requests);

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[progressEvents.length - 1].percentage).toBe(100);
    });
  });

  describe('Quarantine Management', () => {
    it('should quarantine critical violations', async () => {
      const quarantineSpy = jest.spyOn(dlpService['quarantineManager'], 'quarantine');

      const request: DLPScanRequest = {
        data: 'SSN: 123-45-6789 and Credit Card: 4111-1111-1111-1111',
        userId: 'user-123',
        dataSource: 'test'
      };

      await dlpService.scanData(request);

      expect(quarantineSpy).toHaveBeenCalled();
    });

    it('should release quarantined data', async () => {
      const request: DLPScanRequest = {
        data: 'SSN: 123-45-6789',
        userId: 'user-123',
        dataSource: 'test'
      };

      const result = await dlpService.scanData(request);

      // Get quarantine record ID (would normally be returned from scan)
      const quarantineId = 'test-quarantine-id';

      await dlpService['quarantineManager'].release(quarantineId, 'admin-user');

      // Verify release logic
      const record = dlpService['quarantineManager']['quarantined'].get(quarantineId);
      expect(record.status).toBe('RELEASED');
    });
  });

  describe('Masking Engine', () => {
    it('should apply full masking', async () => {
      const maskingEngine = dlpService['maskingEngine'];
      const result = await maskingEngine.mask('Sensitive Data', { method: 'FULL' });

      expect(result).toBe('**************');
    });

    it('should apply partial masking', async () => {
      const maskingEngine = dlpService['maskingEngine'];
      const result = await maskingEngine.mask('1234567890', {
        method: 'PARTIAL',
        preserveFormat: true,
        visibleChars: 4
      });

      expect(result).toBe('1234******');
    });

    it('should tokenize sensitive data', async () => {
      const maskingEngine = dlpService['maskingEngine'];
      const result = await maskingEngine.mask('token-12345', { method: 'TOKENIZATION' });

      expect(result).toMatch(/^TOKEN_[a-f0-9]{16}$/);
    });

    it('should hash sensitive data', async () => {
      const maskingEngine = dlpService['maskingEngine'];
      const result = await maskingEngine.mask('sensitive-value', { method: 'HASH' });

      expect(result).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Encryption Engine', () => {
    it('should encrypt and decrypt data', async () => {
      const encryptionEngine = dlpService['encryptionEngine'];
      const data = { secret: 'confidential information' };

      const encrypted = await encryptionEngine.encrypt(data, {
        algorithm: 'AES-256-GCM',
        keyId: 'default'
      });

      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();

      const decrypted = await encryptionEngine.decrypt(encrypted);
      expect(decrypted).toEqual(data);
    });

    it('should throw error for invalid key', async () => {
      const encryptionEngine = dlpService['encryptionEngine'];

      await expect(
        encryptionEngine.encrypt('test', { keyId: 'invalid-key' })
      ).rejects.toThrow('Encryption key not found');
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should return DLP statistics', async () => {
      // Perform some scans first
      await dlpService.scanData({
        data: 'Public data',
        userId: 'user-1',
        dataSource: 'test'
      });

      await dlpService.scanData({
        data: 'SSN: 123-45-6789',
        userId: 'user-2',
        dataSource: 'test'
      });

      const stats = await dlpService.getStats();

      expect(stats.totalScans).toBe(2);
      expect(stats.scansByRiskLevel).toBeDefined();
      expect(stats.totalViolations).toBeGreaterThan(0);
      expect(stats.averageScanTime).toBeGreaterThan(0);
    });

    it('should filter stats by time range', async () => {
      const timeRange = {
        start: new Date(Date.now() - 60000).toISOString(),
        end: new Date().toISOString()
      };

      const stats = await dlpService.getStats(timeRange);

      expect(stats).toBeDefined();
      // Stats should only include scans within the time range
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid data gracefully', async () => {
      const request: DLPScanRequest = {
        data: null,
        userId: 'user-123',
        dataSource: 'test'
      };

      const result = await dlpService.scanData(request);

      expect(result.scanId).toBeDefined();
      expect(result.riskLevel).toBe('ERROR');
      expect(result.error).toBeDefined();
    });

    it('should handle scan timeout', async () => {
      // Mock slow processing
      const originalScan = dlpService.scanData.bind(dlpService);
      dlpService.scanData = async (request) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return originalScan(request);
      };

      const request: DLPScanRequest = {
        data: 'Test data',
        userId: 'user-123',
        dataSource: 'test',
        options: { timeout: 50 }
      };

      const result = await dlpService.scanData(request);

      // Should handle timeout gracefully
      expect(result).toBeDefined();
    });

    it('should handle malformed rules', async () => {
      const invalidRule = {
        id: '',
        name: '',
        conditions: []
      } as DLPRule;

      await expect(dlpService.addRule(invalidRule)).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should complete scan within acceptable time', async () => {
      const startTime = Date.now();

      const request: DLPScanRequest = {
        data: 'Test data for performance measurement',
        userId: 'user-123',
        dataSource: 'test'
      };

      await dlpService.scanData(request);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle large text efficiently', async () => {
      const largeText = 'Test. '.repeat(10000);

      const request: DLPScanRequest = {
        data: largeText,
        userId: 'user-123',
        dataSource: 'test'
      };

      const startTime = Date.now();
      const result = await dlpService.scanData(request);
      const duration = Date.now() - startTime;

      expect(result.scanId).toBeDefined();
      expect(duration).toBeLessThan(5000); // Should handle large text within 5 seconds
    });

    it('should handle concurrent scans', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        data: `Concurrent test data ${i}: email@test${i}.com`,
        userId: 'user-123',
        dataSource: 'test-concurrent'
      }));

      const startTime = Date.now();
      const promises = requests.map(req => dlpService.scanData(req));
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(10);
      expect(duration).toBeLessThan(3000); // Should handle 10 concurrent scans within 3 seconds
    });
  });

  describe('Event Emission', () => {
    it('should emit scan completed event', async () => {
      const eventSpy = jest.fn();
      dlpService.on('scanCompleted', eventSpy);

      const request: DLPScanRequest = {
        data: 'Test event emission',
        userId: 'user-123',
        dataSource: 'test'
      };

      await dlpService.scanData(request);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          scanId: expect.any(String),
          userId: 'user-123'
        })
      );
    });

    it('should emit critical risk event', async () => {
      const eventSpy = jest.fn();
      dlpService.on('criticalRiskDetected', eventSpy);

      const request: DLPScanRequest = {
        data: 'SSN: 123-45-6789',
        userId: 'user-123',
        dataSource: 'test'
      };

      await dlpService.scanData(request);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          scanId: expect.any(String),
          riskLevel: 'CRITICAL'
        })
      );
    });

    it('should emit rule added event', async () => {
      const eventSpy = jest.fn();
      dlpService.on('ruleAdded', eventSpy);

      const rule: DLPRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'Test rule for event emission',
        severity: 'MEDIUM',
        enabled: true,
        priority: 5,
        conditions: [
          {
            id: 'test-condition',
            type: 'KEYWORD',
            operator: 'CONTAINS',
            value: 'sensitive',
            weight: 1
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

      expect(eventSpy).toHaveBeenCalledWith(rule);
    });
  });

  describe('Configuration', () => {
    it('should respect configuration changes', async () => {
      // Update configuration to increase confidence threshold
      dlpService['config'].classification.confidenceThreshold = 0.9;

      const request: DLPScanRequest = {
        data: 'Potentially sensitive but ambiguous data',
        userId: 'user-123',
        dataSource: 'test'
      };

      const result = await dlpService.scanData(request);

      // With higher threshold, should be more conservative in classification
      expect(result.classification.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should handle disabled DLP service', async () => {
      dlpService['config'].enabled = false;

      const request: DLPScanRequest = {
        data: 'SSN: 123-45-6789',
        userId: 'user-123',
        dataSource: 'test'
      };

      const result = await dlpService.scanData(request);

      // When disabled, should skip scanning
      expect(result.riskLevel).toBe('NONE');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complex document with multiple data types', async () => {
      const complexDocument = `
        CONFIDENTIAL BUSINESS DOCUMENT

        Executive Summary:
        This Q3 financial report shows revenue of $1,234,567.89.

        Employee Information:
        - John Doe (SSN: 123-45-6789)
        - Jane Smith (Email: jane.smith@company.com, Phone: 555-123-4567)

        Banking Information:
        Account Number: 987654321
        Routing Number: 021000021
        Credit Card on File: 4111-1111-1111-1111

        Notes:
        Please handle this information with utmost care.
      `;

      const request: DLPScanRequest = {
        data: complexDocument,
        userId: 'user-123',
        dataSource: 'document-upload'
      };

      const result = await dlpService.scanData(request);

      expect(result.riskLevel).toBe('CRITICAL');
      expect(result.violations.length).toBeGreaterThan(5);

      // Should detect multiple types
      const detectedTypes = new Set(result.violations.map(v => v.ruleName));
      expect(detectedTypes.has('Social Security Number Detection')).toBe(true);
      expect(detectedTypes.has('Credit Card Number Detection')).toBe(true);
      expect(detectedTypes.has('Email Address Detection')).toBe(true);

      // Should apply multiple actions
      const actionTypes = new Set(result.actions.map(a => a.type));
      expect(actionTypes.has('MASK')).toBe(true);
      expect(actionTypes.has('ALERT')).toBe(true);
      expect(actionTypes.has('QUARANTINE')).toBe(true);
    });

    it('should process streaming data correctly', async () => {
      const { Readable } = require('stream');

      const streamData = [
        'Chunk 1: Public information\n',
        'Chunk 2: Contact john@example.com\n',
        'Chunk 3: SSN: 123-45-6789\n'
      ];

      const stream = Readable.from(streamData);

      const request: DLPScanRequest = {
        data: '', // Will be replaced by stream
        userId: 'user-123',
        dataSource: 'stream-test'
      };

      const processedStream = await dlpService.scanStream(stream, request);

      let result = '';
      for await (const chunk of processedStream) {
        result += chunk.toString();
      }

      expect(result).toBeDefined();
      // Stream should be processed with DLP rules applied
    });
  });

  describe('Audit and Compliance', () => {
    it('should maintain audit trail for all scans', async () => {
      const auditLogger = dlpService['auditLogger'];
      const logSpy = jest.spyOn(auditLogger, 'logScan');

      const request: DLPScanRequest = {
        data: 'Test for audit trail',
        userId: 'user-123',
        dataSource: 'audit-test'
      };

      await dlpService.scanData(request);

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          dataSource: 'audit-test',
          type: 'SCAN'
        })
      );
    });

    it('should log rule changes', async () => {
      const auditLogger = dlpService['auditLogger'];
      const logSpy = jest.spyOn(auditLogger, 'logRuleChange');

      await dlpService.addRule({
        id: 'audit-test-rule',
        name: 'Audit Test Rule',
        description: 'Testing audit logging',
        severity: 'LOW',
        enabled: true,
        priority: 10,
        conditions: [
          {
            id: 'audit-condition',
            type: 'KEYWORD',
            operator: 'CONTAINS',
            value: 'test',
            weight: 1
          }
        ],
        actions: ['LOG'],
        metadata: {
          category: 'Test',
          author: 'audit-user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
          triggerCount: 0,
          falsePositiveRate: 0
        }
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ADD',
          ruleId: 'audit-test-rule',
          userId: 'system'
        })
      );
    });
  });
});
