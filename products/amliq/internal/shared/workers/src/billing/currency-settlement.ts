/**
 * Multi-Currency Settlement Reconciliation
 * Tracks settlements across currencies, calculates realized FX
 * gains/losses, and provides monthly aggregation for accounting.
 */

import { z } from 'zod';
import { roundForCurrency } from './currency-models';

// --- Zod Schemas ---

const iso4217 = z.string().length(3).regex(/^[A-Z]{3}$/);

export const settlementRecordSchema = z.object({
  id: z.string().min(1),
  invoice_id: z.string().min(1),
  tenant_id: z.string().uuid(),
  payment_amount: z.number().positive(),
  payment_currency: iso4217,
  settlement_amount: z.number().positive(),
  settlement_currency: iso4217,
  exchange_rate_at_payment: z.number().positive(),
  exchange_rate_at_settlement: z.number().positive(),
  payment_date: z.string().datetime(),
  settlement_date: z.string().datetime(),
  status: z.enum(['pending', 'settled', 'failed']),
});

export type SettlementRecord = z.infer<typeof settlementRecordSchema>;

export const fxGainLossSchema = z.object({
  settlement_id: z.string().min(1),
  expected_settlement: z.number(),
  actual_settlement: z.number(),
  gain_loss: z.number(),
  gain_loss_pct: z.number(),
  currency: iso4217,
});

export type FXGainLoss = z.infer<typeof fxGainLossSchema>;

export const monthlySummarySchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Must be YYYY-MM format'),
  total_settled: z.number().nonnegative(),
  total_fx_gain: z.number(),
  total_fx_loss: z.number(),
  net_fx_impact: z.number(),
  settlement_count: z.number().int().nonnegative(),
  currency: iso4217,
});

export type MonthlySummary = z.infer<typeof monthlySummarySchema>;

// --- FX Gain/Loss Calculation ---

/**
 * Calculate realized FX gain or loss for a single settlement.
 * Gain = positive, Loss = negative.
 */
export function calculateFXGainLoss(record: SettlementRecord): FXGainLoss {
  const { settlement_currency } = record;
  const expectedSettlement = roundForCurrency(
    record.payment_amount * record.exchange_rate_at_payment,
    settlement_currency,
  );
  const actualSettlement = roundForCurrency(
    record.payment_amount * record.exchange_rate_at_settlement,
    settlement_currency,
  );
  const gainLoss = roundForCurrency(actualSettlement - expectedSettlement, settlement_currency);
  const gainLossPct = expectedSettlement !== 0
    ? roundForCurrency((gainLoss / expectedSettlement) * 100, 'USD')
    : 0;

  return {
    settlement_id: record.id,
    expected_settlement: expectedSettlement,
    actual_settlement: actualSettlement,
    gain_loss: gainLoss,
    gain_loss_pct: gainLossPct,
    currency: settlement_currency,
  };
}

// --- Settlement Reconciliation ---

/**
 * Match a payment to its settlement with currency tracking.
 * Returns the reconciled settlement record.
 */
export function reconcileSettlement(
  invoiceId: string,
  tenantId: string,
  paymentAmount: number,
  paymentCurrency: string,
  settlementCurrency: string,
  rateAtPayment: number,
  rateAtSettlement: number,
): SettlementRecord {
  const settlementAmount = roundForCurrency(
    paymentAmount * rateAtSettlement,
    settlementCurrency,
  );

  return {
    id: generateSettlementId(),
    invoice_id: invoiceId,
    tenant_id: tenantId,
    payment_amount: paymentAmount,
    payment_currency: paymentCurrency,
    settlement_amount: settlementAmount,
    settlement_currency: settlementCurrency,
    exchange_rate_at_payment: rateAtPayment,
    exchange_rate_at_settlement: rateAtSettlement,
    payment_date: new Date().toISOString(),
    settlement_date: new Date().toISOString(),
    status: 'settled',
  };
}

// --- Monthly Aggregation ---

/**
 * Aggregate FX gain/loss for a set of settlements in a given month.
 * Returns a monthly summary with net FX impact.
 */
export function calculateMonthlySummary(
  records: SettlementRecord[],
  period: string,
  currency: string,
): MonthlySummary {
  let totalSettled = 0;
  let totalGain = 0;
  let totalLoss = 0;

  for (const record of records) {
    if (record.status !== 'settled') continue;
    totalSettled += record.settlement_amount;
    const fx = calculateFXGainLoss(record);
    if (fx.gain_loss > 0) {
      totalGain += fx.gain_loss;
    } else {
      totalLoss += fx.gain_loss;
    }
  }

  return {
    period,
    total_settled: roundForCurrency(totalSettled, currency),
    total_fx_gain: roundForCurrency(totalGain, currency),
    total_fx_loss: roundForCurrency(totalLoss, currency),
    net_fx_impact: roundForCurrency(totalGain + totalLoss, currency),
    settlement_count: records.filter((r) => r.status === 'settled').length,
    currency,
  };
}

// --- Helpers ---

function generateSettlementId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return 'stl-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
}
