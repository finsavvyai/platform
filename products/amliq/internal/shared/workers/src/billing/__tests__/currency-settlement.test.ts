import { describe, expect, it } from 'vitest';
import {
  settlementRecordSchema,
  calculateFXGainLoss,
  reconcileSettlement,
  calculateMonthlySummary,
  type SettlementRecord,
} from '../currency-settlement';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const NOW = '2026-07-20T12:00:00Z';

function makeRecord(overrides: Partial<SettlementRecord> = {}): SettlementRecord {
  return {
    id: 'stl-001',
    invoice_id: 'inv-001',
    tenant_id: VALID_UUID,
    payment_amount: 100,
    payment_currency: 'EUR',
    settlement_amount: 109,
    settlement_currency: 'USD',
    exchange_rate_at_payment: 1.08,
    exchange_rate_at_settlement: 1.09,
    payment_date: NOW,
    settlement_date: NOW,
    status: 'settled',
    ...overrides,
  };
}

describe('settlementRecordSchema', () => {
  it('accepts a valid settlement record', () => {
    const result = settlementRecordSchema.safeParse(makeRecord());
    expect(result.success).toBe(true);
  });

  it('rejects negative payment amount', () => {
    const result = settlementRecordSchema.safeParse(makeRecord({ payment_amount: -10 }));
    expect(result.success).toBe(false);
  });

  it('rejects invalid status', () => {
    const result = settlementRecordSchema.safeParse(
      makeRecord({ status: 'invalid' as 'settled' }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects invalid currency code', () => {
    const result = settlementRecordSchema.safeParse(
      makeRecord({ payment_currency: 'us' }),
    );
    expect(result.success).toBe(false);
  });
});

describe('calculateFXGainLoss', () => {
  it('calculates positive gain when settlement rate is higher', () => {
    const record = makeRecord({
      exchange_rate_at_payment: 1.08,
      exchange_rate_at_settlement: 1.10,
    });
    const result = calculateFXGainLoss(record);
    expect(result.gain_loss).toBe(2);
    expect(result.gain_loss_pct).toBeGreaterThan(0);
  });

  it('calculates negative loss when settlement rate drops', () => {
    const record = makeRecord({
      exchange_rate_at_payment: 1.10,
      exchange_rate_at_settlement: 1.05,
    });
    const result = calculateFXGainLoss(record);
    expect(result.gain_loss).toBe(-5);
    expect(result.gain_loss_pct).toBeLessThan(0);
  });

  it('returns zero when rates are identical', () => {
    const record = makeRecord({
      exchange_rate_at_payment: 1.08,
      exchange_rate_at_settlement: 1.08,
    });
    const result = calculateFXGainLoss(record);
    expect(result.gain_loss).toBe(0);
  });

  it('returns correct settlement_id', () => {
    const record = makeRecord({ id: 'stl-xyz' });
    expect(calculateFXGainLoss(record).settlement_id).toBe('stl-xyz');
  });
});

describe('reconcileSettlement', () => {
  it('creates a settled record with correct amounts', () => {
    const record = reconcileSettlement(
      'inv-001', VALID_UUID, 100, 'EUR', 'USD', 1.08, 1.10,
    );
    expect(record.status).toBe('settled');
    expect(record.settlement_amount).toBe(110);
    expect(record.payment_amount).toBe(100);
    expect(record.payment_currency).toBe('EUR');
    expect(record.settlement_currency).toBe('USD');
  });

  it('handles mismatched currencies properly', () => {
    const record = reconcileSettlement(
      'inv-002', VALID_UUID, 1000, 'GBP', 'USD', 1.27, 1.25,
    );
    expect(record.settlement_amount).toBe(1250);
  });
});

describe('calculateMonthlySummary', () => {
  it('aggregates gain and loss separately', () => {
    const records: SettlementRecord[] = [
      makeRecord({ id: 'a', exchange_rate_at_payment: 1.08, exchange_rate_at_settlement: 1.12 }),
      makeRecord({ id: 'b', exchange_rate_at_payment: 1.10, exchange_rate_at_settlement: 1.05 }),
    ];
    const summary = calculateMonthlySummary(records, '2026-07', 'USD');
    expect(summary.total_fx_gain).toBeGreaterThan(0);
    expect(summary.total_fx_loss).toBeLessThan(0);
    expect(summary.net_fx_impact).toBe(summary.total_fx_gain + summary.total_fx_loss);
    expect(summary.settlement_count).toBe(2);
  });

  it('excludes non-settled records', () => {
    const records: SettlementRecord[] = [
      makeRecord({ id: 'a', status: 'settled' }),
      makeRecord({ id: 'b', status: 'pending' }),
    ];
    const summary = calculateMonthlySummary(records, '2026-07', 'USD');
    expect(summary.settlement_count).toBe(1);
  });

  it('handles empty records', () => {
    const summary = calculateMonthlySummary([], '2026-07', 'USD');
    expect(summary.total_settled).toBe(0);
    expect(summary.settlement_count).toBe(0);
    expect(summary.net_fx_impact).toBe(0);
  });

  it('returns correct period format', () => {
    const summary = calculateMonthlySummary([], '2026-07', 'USD');
    expect(summary.period).toBe('2026-07');
    expect(summary.currency).toBe('USD');
  });
});
