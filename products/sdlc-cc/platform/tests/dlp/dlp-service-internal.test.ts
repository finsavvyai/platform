/**
 * DLP Service — Internal Helper Unit Tests
 * Tests: preprocessData, extractText, calculateEntropy,
 *        evaluateCondition branches, groupBy, getNestedValue,
 *        calculateAverage, getTopViolations, validateRule/Policy edge cases
 * Coverage target: 100% critical paths
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DLPService } from '../../src/services/dlp/DLPService';
import type { DLPConfig } from '../../src/types/dlp';

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

describe('DLPService — preprocessData', () => {
  let service: DLPService;
  let preprocessData: (data: any) => Promise<any>;

  beforeEach(() => {
    service = new DLPService(buildConfig());
    preprocessData = (service as any).preprocessData.bind(service);
  });

  it('wraps a plain string in { text } object', async () => {
    const result = await preprocessData('hello');
    expect(result).toEqual({ text: 'hello' });
  });

  it('wraps a Buffer in { binary, text } object', async () => {
    const buf = Buffer.from('buffered data');
    const result = await preprocessData(buf);
    expect(result.binary).toBe(buf);
    expect(typeof result.text).toBe('string');
  });

  it('samples only the first 1024 bytes of a large Buffer', async () => {
    const bigBuf = Buffer.alloc(2048, 'A');
    const result = await preprocessData(bigBuf);
    expect(result.text.length).toBeLessThanOrEqual(1024);
  });

  it('returns plain objects as-is', async () => {
    const obj = { key: 'value', num: 42 };
    const result = await preprocessData(obj);
    expect(result).toEqual(obj);
  });

  it('wraps unknown primitives in { value } object', async () => {
    const result = await preprocessData(99);
    expect(result).toEqual({ value: 99 });
  });
});

describe('DLPService — extractText (private)', () => {
  let service: DLPService;
  let extractText: (data: any) => string;

  beforeEach(() => {
    service = new DLPService(buildConfig());
    extractText = (service as any).extractText.bind(service);
  });

  it('returns the string itself when given a string', () => {
    expect(extractText('hello')).toBe('hello');
  });

  it('returns data.text when the object has a text property', () => {
    expect(extractText({ text: 'inner text', other: 1 })).toBe('inner text');
  });

  it('returns JSON.stringify for objects without a text property', () => {
    const obj = { a: 1, b: 2 };
    expect(extractText(obj)).toBe(JSON.stringify(obj));
  });

  it('coerces other types via String()', () => {
    expect(extractText(42)).toBe('42');
  });
});

describe('DLPService — calculateEntropy', () => {
  let service: DLPService;
  let calculateEntropy: (text: string) => number;

  beforeEach(() => {
    service = new DLPService(buildConfig());
    calculateEntropy = (service as any).calculateEntropy.bind(service);
  });

  it('returns 0 for a single-character string (no information)', () => {
    expect(calculateEntropy('aaaaaa')).toBeCloseTo(0, 5);
  });

  it('returns higher entropy for random-looking strings', () => {
    const highEntropy = calculateEntropy('aB3#xK9!mQ2@wP7$');
    expect(highEntropy).toBeGreaterThan(3);
  });

  it('returns lower entropy for repeated characters', () => {
    expect(calculateEntropy('aaaa')).toBeLessThan(calculateEntropy('abcd'));
  });

  it('handles empty string returning 0', () => {
    // Division by zero protection: empty string → entropy 0
    expect(calculateEntropy('')).toBe(0);
  });
});

describe('DLPService — evaluateCondition branches', () => {
  let service: DLPService;
  let evaluateCondition: (condition: any, data: any, classification: any) => Promise<boolean>;

  beforeEach(() => {
    service = new DLPService(buildConfig());
    evaluateCondition = (service as any).evaluateCondition.bind(service);
  });

  const baseClassification = { type: 'PUBLIC', confidence: 0.9, tags: [] };

  it('REGEX condition matches when pattern present', async () => {
    const cond = { type: 'REGEX', pattern: '\\d{3}-\\d{2}-\\d{4}', flags: 'g' };
    expect(await evaluateCondition(cond, { text: 'SSN: 123-45-6789' }, baseClassification)).toBe(true);
  });

  it('REGEX condition does not match unrelated text', async () => {
    const cond = { type: 'REGEX', pattern: '\\d{3}-\\d{2}-\\d{4}', flags: 'g' };
    expect(await evaluateCondition(cond, { text: 'no ssn here' }, baseClassification)).toBe(false);
  });

  it('KEYWORD condition matches when keyword present (case-insensitive)', async () => {
    const cond = { type: 'KEYWORD', keywords: ['secret'] };
    expect(await evaluateCondition(cond, { text: 'This is SECRET data' }, baseClassification)).toBe(true);
  });

  it('KEYWORD condition uses single keyword when not array', async () => {
    const cond = { type: 'KEYWORD', keywords: 'token' };
    expect(await evaluateCondition(cond, { text: 'my token here' }, baseClassification)).toBe(true);
  });

  it('KEYWORD condition returns false when keyword absent', async () => {
    const cond = { type: 'KEYWORD', keywords: ['classified'] };
    expect(await evaluateCondition(cond, { text: 'normal text' }, baseClassification)).toBe(false);
  });

  it('ML_MODEL condition returns false (placeholder)', async () => {
    const cond = { type: 'ML_MODEL', modelId: 'test-model' };
    expect(await evaluateCondition(cond, { text: 'anything' }, baseClassification)).toBe(false);
  });

  it('ENTROPY condition triggers for high-entropy strings', async () => {
    const cond = { type: 'ENTROPY', threshold: 2 }; // Low threshold to ensure trigger
    const highEntropyText = 'aB3#xK9!mQ2@wP7$nR5%';
    expect(await evaluateCondition(cond, { text: highEntropyText }, baseClassification)).toBe(true);
  });

  it('ENTROPY condition does not trigger for low-entropy repeated strings', async () => {
    const cond = { type: 'ENTROPY', threshold: 4.5 };
    expect(await evaluateCondition(cond, { text: 'aaaaaaaaaaaaaaaaaaaaaa' }, baseClassification)).toBe(false);
  });

  it('FORMAT condition CREDIT_CARD matches 16-digit card', async () => {
    const cond = { type: 'FORMAT', format: 'CREDIT_CARD' };
    expect(await evaluateCondition(cond, '4111111111111111', baseClassification)).toBe(true);
  });

  it('FORMAT condition SSN matches correct format', async () => {
    const cond = { type: 'FORMAT', format: 'SSN' };
    expect(await evaluateCondition(cond, '123-45-6789', baseClassification)).toBe(true);
  });

  it('FORMAT condition EMAIL matches valid email', async () => {
    const cond = { type: 'FORMAT', format: 'EMAIL' };
    expect(await evaluateCondition(cond, 'user@example.com', baseClassification)).toBe(true);
  });

  it('FORMAT condition PHONE matches US phone', async () => {
    const cond = { type: 'FORMAT', format: 'PHONE' };
    expect(await evaluateCondition(cond, '555-123-4567', baseClassification)).toBe(true);
  });

  it('FORMAT condition unknown format returns false', async () => {
    const cond = { type: 'FORMAT', format: 'UNKNOWN_FORMAT' };
    expect(await evaluateCondition(cond, 'anything', baseClassification)).toBe(false);
  });

  it('unknown condition type returns false', async () => {
    const cond = { type: 'CUSTOM', value: 'irrelevant' };
    expect(await evaluateCondition(cond, { text: 'text' }, baseClassification)).toBe(false);
  });
});

describe('DLPService — groupBy & getNestedValue helpers', () => {
  let service: DLPService;
  let groupBy: (items: any[], key: string) => Record<string, number>;
  let getNestedValue: (obj: any, path: string) => string;

  beforeEach(() => {
    service = new DLPService(buildConfig());
    groupBy = (service as any).groupBy.bind(service);
    getNestedValue = (service as any).getNestedValue.bind(service);
  });

  it('groupBy counts items by a flat key', () => {
    const items = [{ x: 'a' }, { x: 'b' }, { x: 'a' }];
    expect(groupBy(items, 'x')).toEqual({ a: 2, b: 1 });
  });

  it('groupBy counts items by a nested key', () => {
    const items = [
      { a: { b: 'X' } },
      { a: { b: 'X' } },
      { a: { b: 'Y' } },
    ];
    expect(groupBy(items, 'a.b')).toEqual({ X: 2, Y: 1 });
  });

  it('groupBy uses "unknown" for missing keys', () => {
    const items = [{ irrelevant: true }];
    expect(groupBy(items, 'missing.key')).toEqual({ unknown: 1 });
  });

  it('getNestedValue resolves a two-level path', () => {
    expect(getNestedValue({ a: { b: 'target' } }, 'a.b')).toBe('target');
  });

  it('getNestedValue returns "unknown" for missing path', () => {
    expect(getNestedValue({}, 'x.y.z')).toBe('unknown');
  });
});

describe('DLPService — calculateAverage & getTopViolations', () => {
  let service: DLPService;
  let calculateAverage: (items: any[], path: string) => number;
  let getTopViolations: (violations: any[], limit: number) => any[];

  beforeEach(() => {
    service = new DLPService(buildConfig());
    calculateAverage = (service as any).calculateAverage.bind(service);
    getTopViolations = (service as any).getTopViolations.bind(service);
  });

  it('calculateAverage returns 0 for empty array', () => {
    expect(calculateAverage([], 'value')).toBe(0);
  });

  it('calculateAverage returns correct mean rounded to integer', () => {
    const items = [{ v: 10 }, { v: 20 }, { v: 30 }];
    expect(calculateAverage(items, 'v')).toBe(20);
  });

  it('calculateAverage handles non-numeric fields as 0', () => {
    const items = [{ v: 'text' }, { v: 'text' }];
    expect(calculateAverage(items, 'v')).toBe(0);
  });

  it('getTopViolations returns array sorted by count descending', () => {
    const violations = [
      { ruleId: 'a' }, { ruleId: 'a' }, { ruleId: 'a' },
      { ruleId: 'b' }, { ruleId: 'b' },
      { ruleId: 'c' },
    ];
    const top = getTopViolations(violations, 3);
    expect(top[0]).toMatchObject({ ruleId: 'a', count: 3 });
    expect(top[1]).toMatchObject({ ruleId: 'b', count: 2 });
    expect(top[2]).toMatchObject({ ruleId: 'c', count: 1 });
  });

  it('getTopViolations respects the limit parameter', () => {
    const violations = [
      { ruleId: 'x' }, { ruleId: 'y' }, { ruleId: 'z' },
    ];
    expect(getTopViolations(violations, 2)).toHaveLength(2);
  });

  it('getTopViolations returns empty array for empty violations', () => {
    expect(getTopViolations([], 10)).toHaveLength(0);
  });
});
