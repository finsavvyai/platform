/**
 * DLP Service — Rule Lifecycle Unit Tests
 * Tests: addRule, updateRule, removeRule, getAllRules, custom rule evaluation
 * Coverage target: 100% critical paths
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DLPService } from '../../src/services/dlp/DLPService';
import type { DLPConfig, DLPScanRequest, DLPRule } from '../../src/types/dlp';

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function buildConfig(): DLPConfig {
  return {
    version: '1.0.0',
    enabled: true,
    scanMode: 'SYNC',
    batchSize: 100,
    timeout: 30000,
    retryCount: 3,
    cache: { enabled: false, ttl: 300, maxSize: 10000 },
    classification: {
      confidenceThreshold: 0.7,
      enableML: false,
      enableRegex: true,
      enableKeyword: true,
      models: [],
      customClassifiers: [],
    },
    masking: {
      defaultMethod: 'FULL',
      preserveFormat: false,
      visibleChars: 4,
      tokenVault: { enabled: false, endpoint: '', apiKey: '' },
    },
    encryption: {
      defaultAlgorithm: 'AES-256-GCM',
      keyRotationDays: 90,
      keyManagement: 'LOCAL',
    },
    audit: {
      storage: 'MEMORY',
      retentionDays: 365,
      logLevel: 'INFO',
      includeSensitiveData: false,
      compressionEnabled: false,
      encryptionEnabled: false,
    },
    quarantine: {
      enabled: false,
      retentionDays: 30,
      autoApproval: false,
      notificationEnabled: false,
    },
    notifications: {
      channels: [],
      templates: {},
      throttle: { maxPerMinute: 10, maxPerHour: 100, maxPerDay: 1000 },
    },
    performance: {
      maxConcurrentScans: 50,
      queueSize: 1000,
      workerThreads: 4,
      memoryLimit: 2048,
    },
    compliance: {
      frameworks: [],
      reporting: { enabled: false, frequency: 'WEEKLY', recipients: [] },
    },
  };
}

function minimalRule(id: string, overrides: Partial<DLPRule> = {}): DLPRule {
  return {
    id,
    name: `Rule ${id}`,
    description: 'Test rule',
    severity: 'MEDIUM',
    enabled: true,
    priority: 5,
    conditions: [
      {
        id: `cond-${id}`,
        type: 'KEYWORD',
        operator: 'CONTAINS',
        value: 'secret',
        weight: 1,
      },
    ],
    actions: ['ALERT'],
    metadata: {
      category: 'Test',
      author: 'test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      triggerCount: 0,
      falsePositiveRate: 0,
    },
    ...overrides,
  };
}

describe('DLPService — addRule', () => {
  let service: DLPService;

  beforeEach(() => {
    service = new DLPService(buildConfig());
  });

  it('adds a valid rule without throwing', async () => {
    await expect(service.addRule(minimalRule('new-rule'))).resolves.toBeUndefined();
  });

  it('emits ruleAdded event with the rule payload', async () => {
    const spy = vi.fn();
    service.on('ruleAdded', spy);
    const rule = minimalRule('evt-rule');
    await service.addRule(rule);
    expect(spy).toHaveBeenCalledWith(rule);
  });

  it('rejects a rule with an empty id', async () => {
    const bad = minimalRule('');
    await expect(service.addRule(bad)).rejects.toThrow('Rule must have id and name');
  });

  it('rejects a rule with an empty name', async () => {
    const bad = minimalRule('valid-id', { name: '' });
    await expect(service.addRule(bad)).rejects.toThrow('Rule must have id and name');
  });

  it('rejects a rule with no conditions', async () => {
    const bad = minimalRule('no-cond', { conditions: [] });
    await expect(service.addRule(bad)).rejects.toThrow('Rule must have at least one condition');
  });

  it('rejects a condition that lacks a type', async () => {
    const bad = minimalRule('bad-cond', {
      conditions: [{ id: 'c', type: '' as any, operator: 'CONTAINS', value: 'x', weight: 1 }],
    });
    await expect(service.addRule(bad)).rejects.toThrow('Rule condition must have type');
  });

  it('a REGEX custom rule triggers on matching input', async () => {
    const rule = minimalRule('regex-rule', {
      conditions: [
        {
          id: 'r',
          type: 'REGEX',
          operator: 'MATCHES',
          value: 'custom_api_[a-z0-9]{8}',
          weight: 1,
        },
      ],
    });
    await service.addRule(rule);
    const result = await service.scanData({
      data: 'Token: custom_api_abcdef01',
      userId: 'u1',
      dataSource: 'test',
    });
    const hit = result.violations.find((v) => v.ruleId === 'regex-rule');
    expect(hit).toBeDefined();
  });

  it('a KEYWORD rule does not trigger when keyword absent', async () => {
    await service.addRule(minimalRule('kw-rule'));
    const result = await service.scanData({
      data: 'This is totally normal text.',
      userId: 'u1',
      dataSource: 'test',
    });
    const hit = result.violations.find((v) => v.ruleId === 'kw-rule');
    expect(hit).toBeUndefined();
  });
});

describe('DLPService — updateRule', () => {
  let service: DLPService;

  beforeEach(async () => {
    service = new DLPService(buildConfig());
  });

  it('updates severity of an existing default rule', async () => {
    await service.updateRule('email-detection', { severity: 'CRITICAL' });
    const result = await service.scanData({
      data: 'user@example.com',
      userId: 'u1',
      dataSource: 'test',
    });
    const email = result.violations.find((v) => v.ruleId === 'email-detection');
    expect(email!.severity).toBe('CRITICAL');
  });

  it('emits ruleUpdated event after update', async () => {
    const spy = vi.fn();
    service.on('ruleUpdated', spy);
    await service.updateRule('email-detection', { severity: 'HIGH' });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('throws when updating a non-existent rule id', async () => {
    await expect(service.updateRule('does-not-exist', { severity: 'LOW' })).rejects.toThrow(
      'Rule not found: does-not-exist',
    );
  });

  it('preserves rule id after update (verified via internal Map)', async () => {
    await service.updateRule('email-detection', { severity: 'LOW' });
    // getAllRules is not yet a public method; access the private Map
    const rulesMap = (service as any).rules as Map<string, DLPRule>;
    const rule = rulesMap.get('email-detection');
    expect(rule!.id).toBe('email-detection');
  });
});

describe('DLPService — removeRule', () => {
  let service: DLPService;

  beforeEach(() => {
    service = new DLPService(buildConfig());
  });

  it('removes an existing rule without throwing', async () => {
    await expect(service.removeRule('email-detection')).resolves.toBeUndefined();
  });

  it('emits ruleRemoved event with the rule id', async () => {
    const spy = vi.fn();
    service.on('ruleRemoved', spy);
    await service.removeRule('email-detection');
    expect(spy).toHaveBeenCalledWith('email-detection');
  });

  it('no longer detects email after email rule is removed', async () => {
    await service.removeRule('email-detection');
    const result = await service.scanData({
      data: 'admin@example.com',
      userId: 'u1',
      dataSource: 'test',
    });
    const email = result.violations.find((v) => v.ruleId === 'email-detection');
    expect(email).toBeUndefined();
  });

  it('throws when removing a non-existent rule', async () => {
    await expect(service.removeRule('ghost-rule')).rejects.toThrow('Rule not found: ghost-rule');
  });
});

/**
 * Helper: read the private rules Map directly (white-box access).
 * getAllRules is not yet a public method on DLPService; the controller
 * references it but it is not yet implemented. We access the underlying
 * Map to assert the same invariants.
 */
function getRulesMap(svc: DLPService): Map<string, DLPRule> {
  return (svc as any).rules as Map<string, DLPRule>;
}

describe('DLPService — internal rules Map (getAllRules equivalent)', () => {
  let service: DLPService;

  beforeEach(() => {
    service = new DLPService(buildConfig());
  });

  it('has default rules on fresh construction', () => {
    expect(getRulesMap(service).size).toBeGreaterThan(0);
  });

  it('includes credit-card-detection in default rules', () => {
    expect(getRulesMap(service).has('credit-card-detection')).toBe(true);
  });

  it('includes ssn-detection in default rules', () => {
    expect(getRulesMap(service).has('ssn-detection')).toBe(true);
  });

  it('includes email-detection in default rules', () => {
    expect(getRulesMap(service).has('email-detection')).toBe(true);
  });

  it('size increases after addRule', async () => {
    const before = getRulesMap(service).size;
    await service.addRule(minimalRule('extra-rule'));
    expect(getRulesMap(service).size).toBe(before + 1);
  });

  it('size decreases after removeRule', async () => {
    const before = getRulesMap(service).size;
    await service.removeRule('email-detection');
    expect(getRulesMap(service).size).toBe(before - 1);
  });
});
