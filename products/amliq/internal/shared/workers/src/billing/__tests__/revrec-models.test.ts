/**
 * Tests for revenue recognition domain models and Zod schemas.
 */
import { describe, it, expect } from 'vitest';
import {
  performanceObligationSchema,
  revenueContractSchema,
  revenuePeriodSchema,
  revenueScheduleSchema,
  revenueReportSchema,
} from '../revrec-models';

describe('performanceObligationSchema', () => {
  const valid = {
    id: 'ob-1',
    description: 'SaaS platform access',
    standalone_selling_price: 10000,
    allocated_price: 8000,
    recognition_type: 'over_time' as const,
    status: 'pending' as const,
  };

  it('accepts valid obligation', () => {
    expect(performanceObligationSchema.parse(valid)).toMatchObject(valid);
  });

  it('rejects empty id', () => {
    const result = performanceObligationSchema.safeParse({ ...valid, id: '' });
    expect(result.success).toBe(false);
  });

  it('rejects negative price', () => {
    const result = performanceObligationSchema.safeParse({
      ...valid,
      standalone_selling_price: -100,
    });
    expect(result.success).toBe(false);
  });

  it('accepts zero-value obligation', () => {
    const result = performanceObligationSchema.parse({
      ...valid,
      standalone_selling_price: 0,
      allocated_price: 0,
    });
    expect(result.standalone_selling_price).toBe(0);
  });
});

describe('revenueContractSchema', () => {
  const validContract = {
    contract_id: '550e8400-e29b-41d4-a716-446655440001',
    tenant_id: '550e8400-e29b-41d4-a716-446655440002',
    customer_id: 'cust-100',
    name: 'Enterprise SaaS Agreement',
    start_date: '2026-01-01T00:00:00Z',
    end_date: '2026-12-31T23:59:59Z',
    total_value: 120000,
    currency: 'USD',
    performance_obligations: [
      {
        id: 'ob-1',
        description: 'Platform access',
        standalone_selling_price: 100000,
        allocated_price: 100000,
        recognition_type: 'over_time' as const,
        status: 'in_progress' as const,
      },
      {
        id: 'ob-2',
        description: 'Onboarding',
        standalone_selling_price: 20000,
        allocated_price: 20000,
        recognition_type: 'point_in_time' as const,
        satisfaction_date: '2026-01-15T00:00:00Z',
        status: 'satisfied' as const,
      },
    ],
    status: 'active' as const,
  };

  it('accepts valid contract', () => {
    const result = revenueContractSchema.parse(validContract);
    expect(result.contract_id).toBe(validContract.contract_id);
  });

  it('rejects start_date after end_date', () => {
    const result = revenueContractSchema.safeParse({
      ...validContract,
      start_date: '2027-01-01T00:00:00Z',
      end_date: '2026-12-31T23:59:59Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty obligations', () => {
    const result = revenueContractSchema.safeParse({
      ...validContract,
      performance_obligations: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid currency code', () => {
    const result = revenueContractSchema.safeParse({
      ...validContract,
      currency: 'usd',
    });
    expect(result.success).toBe(false);
  });

  it('accepts single obligation', () => {
    const result = revenueContractSchema.parse({
      ...validContract,
      performance_obligations: [validContract.performance_obligations[0]],
    });
    expect(result.performance_obligations).toHaveLength(1);
  });

  it('rejects more than 50 obligations', () => {
    const many = Array.from({ length: 51 }, (_, i) => ({
      id: `ob-${i}`,
      description: `Obligation ${i}`,
      standalone_selling_price: 100,
      allocated_price: 100,
      recognition_type: 'over_time' as const,
      status: 'pending' as const,
    }));
    const result = revenueContractSchema.safeParse({
      ...validContract,
      performance_obligations: many,
    });
    expect(result.success).toBe(false);
  });
});

describe('revenuePeriodSchema', () => {
  it('accepts valid period', () => {
    const result = revenuePeriodSchema.parse({
      period_start: '2026-01-01T00:00:00Z',
      period_end: '2026-01-31T23:59:59Z',
      recognized_amount: 10000,
      deferred_amount: 5000,
    });
    expect(result.recognized_amount).toBe(10000);
  });
});

describe('revenueScheduleSchema', () => {
  it('accepts valid schedule', () => {
    const result = revenueScheduleSchema.parse({
      contract_id: '550e8400-e29b-41d4-a716-446655440001',
      periods: [
        {
          period_start: '2026-01-01T00:00:00Z',
          period_end: '2026-01-31T23:59:59Z',
          recognized_amount: 10000,
          deferred_amount: 110000,
        },
      ],
      total_recognized: 10000,
      total_deferred: 110000,
    });
    expect(result.total_recognized).toBe(10000);
  });
});

describe('revenueReportSchema', () => {
  it('accepts valid report', () => {
    const result = revenueReportSchema.parse({
      report_id: '550e8400-e29b-41d4-a716-446655440003',
      tenant_id: '550e8400-e29b-41d4-a716-446655440002',
      period_start: '2026-01-01T00:00:00Z',
      period_end: '2026-03-31T23:59:59Z',
      total_recognized: 30000,
      total_deferred: 90000,
      waterfall: {
        opening_deferred: 0,
        new_bookings: 120000,
        recognized: 30000,
        closing_deferred: 90000,
      },
      contract_breakdowns: [
        {
          contract_id: '550e8400-e29b-41d4-a716-446655440001',
          contract_name: 'Enterprise SaaS',
          recognized: 30000,
          deferred: 90000,
          completion_pct: 25,
        },
      ],
      generated_at: '2026-04-01T00:00:00Z',
    });
    expect(result.waterfall.closing_deferred).toBe(90000);
  });
});
