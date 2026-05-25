/**
 * Tests for revenue recognition report generator.
 */
import { describe, it, expect } from 'vitest';
import { generateRevenueReport } from '../revrec-report';
import { roundCents } from '../revrec-engine';
import type { RevenueContract } from '../revrec-models';

function makeContracts(): RevenueContract[] {
  return [
    {
      contract_id: '550e8400-e29b-41d4-a716-446655440001',
      tenant_id: '550e8400-e29b-41d4-a716-446655440002',
      customer_id: 'cust-100',
      name: 'Enterprise Annual',
      start_date: '2026-01-01T00:00:00Z',
      end_date: '2026-12-31T23:59:59Z',
      total_value: 120000,
      currency: 'USD',
      performance_obligations: [
        { id: 'ob-1', description: 'Platform', standalone_selling_price: 120000, allocated_price: 0, recognition_type: 'over_time', status: 'in_progress' },
      ],
      status: 'active',
    },
    {
      contract_id: '550e8400-e29b-41d4-a716-446655440010',
      tenant_id: '550e8400-e29b-41d4-a716-446655440002',
      customer_id: 'cust-200',
      name: 'Q1 Consulting',
      start_date: '2026-01-15T00:00:00Z',
      end_date: '2026-03-31T23:59:59Z',
      total_value: 30000,
      currency: 'USD',
      performance_obligations: [
        { id: 'ob-2', description: 'Consulting', standalone_selling_price: 20000, allocated_price: 0, recognition_type: 'over_time', status: 'in_progress' },
        { id: 'ob-3', description: 'Setup', standalone_selling_price: 10000, allocated_price: 0, recognition_type: 'point_in_time', satisfaction_date: '2026-01-20T00:00:00Z', status: 'satisfied' },
      ],
      status: 'active',
    },
  ];
}

describe('generateRevenueReport', () => {
  it('generates report with correct structure', () => {
    const report = generateRevenueReport({
      tenantId: '550e8400-e29b-41d4-a716-446655440002',
      periodStart: '2026-01-01T00:00:00Z',
      periodEnd: '2026-03-31T23:59:59Z',
      contracts: makeContracts(),
    });

    expect(report.report_id).toBeTruthy();
    expect(report.tenant_id).toBe('550e8400-e29b-41d4-a716-446655440002');
    expect(report.contract_breakdowns).toHaveLength(2);
    expect(report.total_recognized).toBeGreaterThan(0);
    expect(report.waterfall).toBeDefined();
  });

  it('waterfall balances: opening + bookings - recognized = closing', () => {
    const report = generateRevenueReport({
      tenantId: '550e8400-e29b-41d4-a716-446655440002',
      periodStart: '2026-01-01T00:00:00Z',
      periodEnd: '2026-03-31T23:59:59Z',
      contracts: makeContracts(),
    });

    const { opening_deferred, new_bookings, recognized, closing_deferred } = report.waterfall;
    const expected = roundCents(opening_deferred + new_bookings - recognized);
    expect(closing_deferred).toBe(expected);
  });

  it('contract spanning period boundary is correctly prorated', () => {
    // The annual contract spans Q1 boundary
    const report = generateRevenueReport({
      tenantId: '550e8400-e29b-41d4-a716-446655440002',
      periodStart: '2026-01-01T00:00:00Z',
      periodEnd: '2026-03-31T23:59:59Z',
      contracts: [makeContracts()[0]],
    });

    // 3 months of 12 = ~25% of 120000 = ~30000
    expect(report.total_recognized).toBeGreaterThan(25000);
    expect(report.total_recognized).toBeLessThan(35000);
  });

  it('handles empty contracts list', () => {
    const report = generateRevenueReport({
      tenantId: '550e8400-e29b-41d4-a716-446655440002',
      periodStart: '2026-01-01T00:00:00Z',
      periodEnd: '2026-03-31T23:59:59Z',
      contracts: [],
    });

    expect(report.total_recognized).toBe(0);
    expect(report.total_deferred).toBe(0);
    expect(report.contract_breakdowns).toHaveLength(0);
  });

  it('completion percentage is capped at 100', () => {
    const report = generateRevenueReport({
      tenantId: '550e8400-e29b-41d4-a716-446655440002',
      periodStart: '2026-01-01T00:00:00Z',
      periodEnd: '2026-12-31T23:59:59Z',
      contracts: makeContracts(),
    });

    for (const b of report.contract_breakdowns) {
      expect(b.completion_pct).toBeLessThanOrEqual(100);
    }
  });

  it('report across full year shows all recognised', () => {
    const annualContract = makeContracts()[0];
    const report = generateRevenueReport({
      tenantId: '550e8400-e29b-41d4-a716-446655440002',
      periodStart: '2026-01-01T00:00:00Z',
      periodEnd: '2026-12-31T23:59:59Z',
      contracts: [annualContract],
    });

    expect(report.total_recognized).toBe(120000);
  });
});
