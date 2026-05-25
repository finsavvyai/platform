import { describe, it, expect } from 'vitest';
import { createAlertRuleSchema, updateAlertRuleSchema, updateAlertStatusSchema } from './alerts.js';

describe('createAlertRuleSchema', () => {
  it('accepts valid input with required fields', () => {
    const result = createAlertRuleSchema.safeParse({ name: 'CPU Alert', eventType: 'cpu_high' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.threshold).toBe(1);
      expect(result.data.windowMinutes).toBe(60);
      expect(result.data.cooldownMinutes).toBe(30);
    }
  });

  it('accepts valid input with all fields', () => {
    const result = createAlertRuleSchema.safeParse({
      name: 'Custom Rule', eventType: 'anomaly', severityFilter: 'critical',
      threshold: 5, windowMinutes: 15, cooldownMinutes: 120,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const result = createAlertRuleSchema.safeParse({ eventType: 'cpu_high' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('name');
  });

  it('rejects missing eventType', () => {
    const result = createAlertRuleSchema.safeParse({ name: 'Alert' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('eventType');
  });

  it('rejects empty name', () => {
    const result = createAlertRuleSchema.safeParse({ name: '', eventType: 'cpu_high' });
    expect(result.success).toBe(false);
  });

  it('rejects non-string name', () => {
    const result = createAlertRuleSchema.safeParse({ name: 123, eventType: 'cpu_high' });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer threshold', () => {
    const result = createAlertRuleSchema.safeParse({ name: 'A', eventType: 'e', threshold: 1.5 });
    expect(result.success).toBe(false);
  });

  it('rejects negative windowMinutes', () => {
    const result = createAlertRuleSchema.safeParse({ name: 'A', eventType: 'e', windowMinutes: -1 });
    expect(result.success).toBe(false);
  });
});

describe('updateAlertRuleSchema', () => {
  it('accepts partial update', () => {
    const result = updateAlertRuleSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('accepts empty object', () => {
    const result = updateAlertRuleSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts isActive boolean', () => {
    const result = updateAlertRuleSchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });

  it('rejects non-boolean isActive', () => {
    const result = updateAlertRuleSchema.safeParse({ isActive: 'yes' });
    expect(result.success).toBe(false);
  });

  it('accepts nullable severityFilter', () => {
    const result = updateAlertRuleSchema.safeParse({ severityFilter: null });
    expect(result.success).toBe(true);
  });
});

describe('updateAlertStatusSchema', () => {
  it('accepts acknowledged', () => {
    const result = updateAlertStatusSchema.safeParse({ status: 'acknowledged' });
    expect(result.success).toBe(true);
  });

  it('accepts resolved', () => {
    const result = updateAlertStatusSchema.safeParse({ status: 'resolved' });
    expect(result.success).toBe(true);
  });

  it('rejects open status', () => {
    const result = updateAlertStatusSchema.safeParse({ status: 'open' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('acknowledged');
  });

  it('rejects invalid status', () => {
    const result = updateAlertStatusSchema.safeParse({ status: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('rejects missing status', () => {
    const result = updateAlertStatusSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects non-string status', () => {
    const result = updateAlertStatusSchema.safeParse({ status: 42 });
    expect(result.success).toBe(false);
  });
});
