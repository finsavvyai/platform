/**
 * Tests for revenue recognition calculation engine.
 */
import { describe, it, expect } from 'vitest';
import {
  allocateTransactionPrice,
  calculateRecognitionSchedule,
  roundCents,
} from '../revrec-engine';
import type { RevenueContract } from '../revrec-models';

function makeContract(overrides: Partial<RevenueContract> = {}): RevenueContract {
  return {
    contract_id: '550e8400-e29b-41d4-a716-446655440001',
    tenant_id: '550e8400-e29b-41d4-a716-446655440002',
    customer_id: 'cust-100',
    name: 'Test Contract',
    start_date: '2026-01-01T00:00:00Z',
    end_date: '2026-12-31T23:59:59Z',
    total_value: 120000,
    currency: 'USD',
    performance_obligations: [
      {
        id: 'ob-1',
        description: 'Platform access',
        standalone_selling_price: 90000,
        allocated_price: 0,
        recognition_type: 'over_time',
        status: 'in_progress',
      },
      {
        id: 'ob-2',
        description: 'Onboarding',
        standalone_selling_price: 30000,
        allocated_price: 0,
        recognition_type: 'point_in_time',
        satisfaction_date: '2026-01-15T00:00:00Z',
        status: 'satisfied',
      },
    ],
    status: 'active',
    ...overrides,
  };
}

describe('allocateTransactionPrice', () => {
  it('distributes by standalone price ratio', () => {
    const contract = makeContract();
    const result = allocateTransactionPrice(contract);
    // 90000/120000 * 120000 = 90000 for ob-1
    // 30000/120000 * 120000 = 30000 for ob-2
    expect(result[0].allocated_price).toBe(90000);
    expect(result[1].allocated_price).toBe(30000);
  });

  it('sums exactly to total value (penny precision)', () => {
    const contract = makeContract({ total_value: 100000 });
    const result = allocateTransactionPrice(contract);
    const sum = result.reduce((s, o) => s + o.allocated_price, 0);
    expect(sum).toBe(100000);
  });

  it('handles single obligation = 100% allocation', () => {
    const contract = makeContract({
      performance_obligations: [
        {
          id: 'ob-1',
          description: 'Single service',
          standalone_selling_price: 50000,
          allocated_price: 0,
          recognition_type: 'over_time',
          status: 'pending',
        },
      ],
    });
    const result = allocateTransactionPrice(contract);
    expect(result[0].allocated_price).toBe(120000);
  });

  it('handles zero SSP gracefully', () => {
    const contract = makeContract({
      performance_obligations: [
        {
          id: 'ob-1',
          description: 'Free tier',
          standalone_selling_price: 0,
          allocated_price: 0,
          recognition_type: 'over_time',
          status: 'pending',
        },
      ],
    });
    const result = allocateTransactionPrice(contract);
    expect(result[0].allocated_price).toBe(0);
  });

  it('three obligations with uneven split remain penny-precise', () => {
    const contract = makeContract({
      total_value: 10000,
      performance_obligations: [
        { id: 'a', description: 'A', standalone_selling_price: 3333, allocated_price: 0, recognition_type: 'over_time', status: 'pending' },
        { id: 'b', description: 'B', standalone_selling_price: 3333, allocated_price: 0, recognition_type: 'over_time', status: 'pending' },
        { id: 'c', description: 'C', standalone_selling_price: 3334, allocated_price: 0, recognition_type: 'over_time', status: 'pending' },
      ],
    });
    const result = allocateTransactionPrice(contract);
    const sum = result.reduce((s, o) => s + o.allocated_price, 0);
    expect(roundCents(sum)).toBe(10000);
  });
});

describe('calculateRecognitionSchedule', () => {
  it('generates 12 monthly periods for a full year', () => {
    const contract = makeContract();
    const schedule = calculateRecognitionSchedule(contract);
    expect(schedule.periods.length).toBe(12);
  });

  it('total recognized + deferred = contract value', () => {
    const contract = makeContract();
    const schedule = calculateRecognitionSchedule(contract);
    expect(roundCents(schedule.total_recognized + schedule.total_deferred)).toBe(120000);
  });

  it('straight-line over 12 months distributes evenly', () => {
    const contract = makeContract({
      performance_obligations: [
        {
          id: 'ob-1',
          description: 'Platform',
          standalone_selling_price: 120000,
          allocated_price: 0,
          recognition_type: 'over_time',
          status: 'in_progress',
        },
      ],
    });
    const schedule = calculateRecognitionSchedule(contract);
    const amounts = schedule.periods.map((p) => p.recognized_amount);
    const sum = amounts.reduce((s, a) => s + a, 0);
    expect(roundCents(sum)).toBe(120000);
    // Each month should be approximately 10000
    for (const a of amounts) {
      expect(a).toBeGreaterThan(9000);
      expect(a).toBeLessThan(11000);
    }
  });

  it('point-in-time recognises in satisfaction month', () => {
    const contract = makeContract({
      performance_obligations: [
        {
          id: 'ob-1',
          description: 'Setup fee',
          standalone_selling_price: 120000,
          allocated_price: 0,
          recognition_type: 'point_in_time',
          satisfaction_date: '2026-03-15T00:00:00Z',
          status: 'satisfied',
        },
      ],
    });
    const schedule = calculateRecognitionSchedule(contract);
    // March is index 2
    expect(schedule.periods[2].recognized_amount).toBe(120000);
    expect(schedule.periods[0].recognized_amount).toBe(0);
  });

  it('handles partial period (mid-month start)', () => {
    const contract = makeContract({
      start_date: '2026-01-15T00:00:00Z',
      end_date: '2026-03-31T23:59:59Z',
      total_value: 30000,
      performance_obligations: [
        {
          id: 'ob-1',
          description: 'Service',
          standalone_selling_price: 30000,
          allocated_price: 0,
          recognition_type: 'over_time',
          status: 'in_progress',
        },
      ],
    });
    const schedule = calculateRecognitionSchedule(contract);
    expect(schedule.periods.length).toBe(3);
    const sum = schedule.periods.reduce((s, p) => s + p.recognized_amount, 0);
    expect(roundCents(sum)).toBe(30000);
    // First partial month should be less than full months
    expect(schedule.periods[0].recognized_amount).toBeLessThan(schedule.periods[1].recognized_amount);
  });

  it('deferred amounts decrease each period', () => {
    const contract = makeContract();
    const schedule = calculateRecognitionSchedule(contract);
    for (let i = 1; i < schedule.periods.length; i++) {
      expect(schedule.periods[i].deferred_amount).toBeLessThanOrEqual(
        schedule.periods[i - 1].deferred_amount,
      );
    }
  });

  it('last period deferred is zero when fully recognised', () => {
    const contract = makeContract({
      performance_obligations: [
        {
          id: 'ob-1',
          description: 'All over time',
          standalone_selling_price: 120000,
          allocated_price: 0,
          recognition_type: 'over_time',
          status: 'in_progress',
        },
      ],
    });
    const schedule = calculateRecognitionSchedule(contract);
    const last = schedule.periods[schedule.periods.length - 1];
    expect(last.deferred_amount).toBe(0);
  });
});

describe('roundCents', () => {
  it('rounds to two decimal places', () => {
    expect(roundCents(10.005)).toBe(10.01);
    expect(roundCents(10.004)).toBe(10);
    expect(roundCents(0.1 + 0.2)).toBeCloseTo(0.3, 2);
  });
});
