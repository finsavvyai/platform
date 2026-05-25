/**
 * Tests for revenue recognition validation schemas.
 */
import { describe, it, expect } from 'vitest';
import {
  createContractSchema,
  generateReportSchema,
  listContractsQuerySchema,
} from '../revrec-validation';

describe('createContractSchema', () => {
  const valid = {
    customer_id: 'cust-100',
    name: 'Enterprise Deal',
    start_date: '2026-01-01T00:00:00Z',
    end_date: '2026-12-31T23:59:59Z',
    total_value: 120000,
    currency: 'USD',
    performance_obligations: [
      {
        id: 'ob-1',
        description: 'Platform access',
        standalone_selling_price: 120000,
        allocated_price: 0,
        recognition_type: 'over_time' as const,
        status: 'pending' as const,
      },
    ],
  };

  it('accepts valid input', () => {
    const result = createContractSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects missing customer_id', () => {
    const result = createContractSchema.safeParse({ ...valid, customer_id: '' });
    expect(result.success).toBe(false);
  });

  it('rejects end_date before start_date', () => {
    const result = createContractSchema.safeParse({
      ...valid,
      start_date: '2027-01-01T00:00:00Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative total_value', () => {
    const result = createContractSchema.safeParse({ ...valid, total_value: -100 });
    expect(result.success).toBe(false);
  });

  it('rejects empty obligations', () => {
    const result = createContractSchema.safeParse({
      ...valid,
      performance_obligations: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid currency', () => {
    const result = createContractSchema.safeParse({ ...valid, currency: 'usd' });
    expect(result.success).toBe(false);
  });

  it('provides clear error message for invalid dates', () => {
    const result = createContractSchema.safeParse({
      ...valid,
      start_date: 'not-a-date',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues[0].message;
      expect(msg).toContain('Invalid');
    }
  });
});

describe('generateReportSchema', () => {
  it('accepts valid period', () => {
    const result = generateReportSchema.safeParse({
      period_start: '2026-01-01T00:00:00Z',
      period_end: '2026-03-31T23:59:59Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects start after end', () => {
    const result = generateReportSchema.safeParse({
      period_start: '2026-06-01T00:00:00Z',
      period_end: '2026-03-31T23:59:59Z',
    });
    expect(result.success).toBe(false);
  });

  it('accepts period of exactly 1 year', () => {
    const result = generateReportSchema.safeParse({
      period_start: '2026-01-01T00:00:00Z',
      period_end: '2026-12-31T23:59:59Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects period exceeding 1 year', () => {
    const result = generateReportSchema.safeParse({
      period_start: '2026-01-01T00:00:00Z',
      period_end: '2027-01-03T00:00:00Z',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path.includes('period_end'));
      expect(msg?.message).toContain('1 year');
    }
  });

  it('rejects missing period_start', () => {
    const result = generateReportSchema.safeParse({
      period_end: '2026-03-31T23:59:59Z',
    });
    expect(result.success).toBe(false);
  });
});

describe('listContractsQuerySchema', () => {
  it('applies defaults', () => {
    const result = listContractsQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('accepts valid status filter', () => {
    const result = listContractsQuerySchema.parse({ status: 'active' });
    expect(result.status).toBe('active');
  });

  it('caps limit at 100', () => {
    const result = listContractsQuerySchema.safeParse({ limit: 200 });
    expect(result.success).toBe(false);
  });
});
