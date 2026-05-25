/**
 * Revenue Recognition Calculation Engine
 * Implements ASC 606 Step 4 (allocate transaction price) and Step 5
 * (recognise revenue). Supports over-time (straight-line) and
 * point-in-time recognition with penny-precise rounding.
 */

import type {
  RevenueContract,
  PerformanceObligation,
  RevenueSchedule,
  RevenuePeriod,
} from './revrec-models';

// --- Price Allocation (ASC 606 Step 4) ---

/**
 * Distribute total contract value across obligations proportionally
 * to their standalone selling prices. Penny remainder goes to last.
 */
export function allocateTransactionPrice(
  contract: RevenueContract,
): PerformanceObligation[] {
  const obligations = contract.performance_obligations;
  const totalSSP = obligations.reduce(
    (sum, o) => sum + o.standalone_selling_price,
    0,
  );

  if (totalSSP === 0) {
    return obligations.map((o) => ({ ...o, allocated_price: 0 }));
  }

  let allocated = 0;
  const result = obligations.map((o, idx) => {
    if (idx === obligations.length - 1) {
      // Remainder to last obligation for penny precision
      return { ...o, allocated_price: roundCents(contract.total_value - allocated) };
    }
    const share = roundCents(
      (o.standalone_selling_price / totalSSP) * contract.total_value,
    );
    allocated += share;
    return { ...o, allocated_price: share };
  });

  return result;
}

// --- Recognition Schedule (ASC 606 Step 5) ---

/**
 * Generate monthly revenue recognition periods for a contract.
 * Over-time obligations use straight-line; point-in-time uses
 * full amount on satisfaction date.
 */
export function calculateRecognitionSchedule(
  contract: RevenueContract,
): RevenueSchedule {
  const obligations = allocateTransactionPrice(contract);
  const months = getMonthlyPeriods(contract.start_date, contract.end_date);

  const periodAmounts = months.map(() => 0);

  for (const ob of obligations) {
    if (ob.recognition_type === 'over_time') {
      distributeOverTime(ob, months, periodAmounts);
    } else {
      distributePointInTime(ob, contract, months, periodAmounts);
    }
  }

  let totalRecognized = 0;
  const periods: RevenuePeriod[] = months.map((m, idx) => {
    totalRecognized += periodAmounts[idx];
    return {
      period_start: m.start.toISOString(),
      period_end: m.end.toISOString(),
      recognized_amount: roundCents(periodAmounts[idx]),
      deferred_amount: roundCents(contract.total_value - totalRecognized),
    };
  });

  return {
    contract_id: contract.contract_id,
    periods,
    total_recognized: roundCents(totalRecognized),
    total_deferred: roundCents(contract.total_value - totalRecognized),
  };
}

// --- Internal helpers ---

interface MonthBound {
  start: Date;
  end: Date;
}

function getMonthlyPeriods(startISO: string, endISO: string): MonthBound[] {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const periods: MonthBound[] = [];

  let curYear = start.getUTCFullYear();
  let curMonth = start.getUTCMonth();
  let curDay = start.getUTCDate();

  while (true) {
    const monthStart = new Date(Date.UTC(curYear, curMonth, curDay));
    if (monthStart >= end) break;

    // Last day of this month
    const lastDay = new Date(Date.UTC(curYear, curMonth + 1, 0, 23, 59, 59, 999));
    const periodEnd = lastDay > end ? end : lastDay;
    periods.push({ start: monthStart, end: periodEnd });

    // Move to first day of next month
    curMonth += 1;
    if (curMonth > 11) {
      curMonth = 0;
      curYear += 1;
    }
    curDay = 1;
  }

  return periods;
}

/**
 * Straight-line recognition distributed evenly across contract months.
 * Handles partial first/last months by day-fraction.
 */
function distributeOverTime(
  ob: PerformanceObligation,
  months: MonthBound[],
  amounts: number[],
): void {
  const totalDays = months.reduce((s, m) => s + daysBetween(m.start, m.end), 0);
  if (totalDays === 0) return;

  let distributed = 0;
  for (let i = 0; i < months.length; i++) {
    if (i === months.length - 1) {
      // Remainder to last period for penny precision
      amounts[i] += roundCents(ob.allocated_price - distributed);
    } else {
      const days = daysBetween(months[i].start, months[i].end);
      const share = roundCents((days / totalDays) * ob.allocated_price);
      amounts[i] += share;
      distributed += share;
    }
  }
}

/**
 * Point-in-time recognition: full allocated price on satisfaction
 * month or first month if no satisfaction date.
 */
function distributePointInTime(
  ob: PerformanceObligation,
  contract: RevenueContract,
  months: MonthBound[],
  amounts: number[],
): void {
  const satDate = ob.satisfaction_date
    ? new Date(ob.satisfaction_date)
    : new Date(contract.start_date);

  for (let i = 0; i < months.length; i++) {
    if (satDate >= months[i].start && satDate <= months[i].end) {
      amounts[i] += ob.allocated_price;
      return;
    }
  }
  // Fallback: recognise in first period
  if (months.length > 0) {
    amounts[0] += ob.allocated_price;
  }
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/** Round to nearest cent. Coerces -0 to +0. */
export function roundCents(value: number): number {
  const result = Math.round(value * 100) / 100;
  return result === 0 ? 0 : result;
}
