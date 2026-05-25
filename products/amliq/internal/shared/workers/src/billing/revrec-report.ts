/**
 * Revenue Recognition Report Generator
 * Aggregates recognised and deferred revenue across contracts for a
 * given tenant and period. Produces summary totals, per-contract
 * breakdowns, and waterfall data.
 */

import { randomUUID } from 'node:crypto';
import type { RevenueContract, RevenueReport, RevenueWaterfall } from './revrec-models';
import { calculateRecognitionSchedule, roundCents } from './revrec-engine';

interface GenerateReportInput {
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  contracts: RevenueContract[];
}

interface ContractBreakdown {
  contract_id: string;
  contract_name: string;
  recognized: number;
  deferred: number;
  completion_pct: number;
}

/**
 * Generate a revenue recognition report for the given period.
 * Handles contracts that span the reporting period boundary.
 */
export function generateRevenueReport(input: GenerateReportInput): RevenueReport {
  const { tenantId, periodStart, periodEnd, contracts } = input;
  const pStart = new Date(periodStart);
  const pEnd = new Date(periodEnd);

  let totalRecognized = 0;
  let totalDeferred = 0;
  let newBookings = 0;
  const breakdowns: ContractBreakdown[] = [];

  for (const contract of contracts) {
    const schedule = calculateRecognitionSchedule(contract);

    let contractRecognized = 0;
    let contractDeferred = 0;

    for (const period of schedule.periods) {
      const periodS = new Date(period.period_start);
      const periodE = new Date(period.period_end);

      // Include periods that overlap with the reporting window
      if (periodE >= pStart && periodS <= pEnd) {
        contractRecognized += period.recognized_amount;
      }
    }

    contractDeferred = roundCents(contract.total_value - sumRecognizedBefore(schedule, pEnd));
    if (contractDeferred < 0) contractDeferred = 0;

    totalRecognized += contractRecognized;
    totalDeferred += contractDeferred;

    // Track new bookings: contracts starting within the period
    const cStart = new Date(contract.start_date);
    if (cStart >= pStart && cStart <= pEnd) {
      newBookings += contract.total_value;
    }

    const completionPct = contract.total_value > 0
      ? roundCents((sumRecognizedBefore(schedule, pEnd) / contract.total_value) * 100)
      : 0;

    breakdowns.push({
      contract_id: contract.contract_id,
      contract_name: contract.name,
      recognized: roundCents(contractRecognized),
      deferred: roundCents(contractDeferred),
      completion_pct: Math.min(completionPct, 100),
    });
  }

  totalRecognized = roundCents(totalRecognized);
  totalDeferred = roundCents(totalDeferred);

  const openingDeferred = calculateOpeningDeferred(contracts, pStart);
  const waterfall: RevenueWaterfall = {
    opening_deferred: roundCents(openingDeferred),
    new_bookings: roundCents(newBookings),
    recognized: totalRecognized,
    closing_deferred: roundCents(openingDeferred + newBookings - totalRecognized),
  };

  return {
    report_id: generateReportId(),
    tenant_id: tenantId,
    period_start: periodStart,
    period_end: periodEnd,
    total_recognized: totalRecognized,
    total_deferred: totalDeferred,
    waterfall,
    contract_breakdowns: breakdowns,
    generated_at: new Date().toISOString(),
  };
}

// --- Helpers ---

function sumRecognizedBefore(
  schedule: ReturnType<typeof calculateRecognitionSchedule>,
  upTo: Date,
): number {
  let sum = 0;
  for (const p of schedule.periods) {
    if (new Date(p.period_end) <= upTo) {
      sum += p.recognized_amount;
    }
  }
  return roundCents(sum);
}

function calculateOpeningDeferred(
  contracts: RevenueContract[],
  periodStart: Date,
): number {
  let total = 0;
  for (const contract of contracts) {
    const schedule = calculateRecognitionSchedule(contract);
    const recognizedBefore = sumRecognizedBefore(schedule, periodStart);
    const deferred = contract.total_value - recognizedBefore;
    if (deferred > 0) total += deferred;
  }
  return roundCents(total);
}

function generateReportId(): string {
  try {
    return randomUUID();
  } catch {
    // Fallback for environments without crypto
    return 'rpt-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
}
