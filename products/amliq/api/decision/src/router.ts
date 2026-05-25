/**
 * Engine router — pure function. 100% line + branch covered.
 *
 * Routing rules per `products/amliq/api/decision.md` §4 (paraphrased for the
 * INVESTIGATE-WIRE scope):
 *   - QuantumBeam runs on ALL transactions (fast-path, <50 ms target).
 *   - ml-fraud also runs when:
 *       • transaction.amount_minor > $10,000 (i.e. > 1_000_000 minor units)
 *       • mcc matches the high-risk pattern set
 *       • transaction.cross_border === true
 *       • subject has prior SAR history (context.prior_sar === true)
 *
 * No side effects. No I/O. Deterministic for replay.
 */

import type {
  DecisionRequest,
  EngineName,
  Transaction,
} from "./types.js";

/** Threshold: 10_000.00 in minor units. */
export const LARGE_TXN_THRESHOLD_MINOR = 10_000 * 100;

/**
 * High-risk MCC codes (Merchant Category Codes). Curated, PII-free:
 *   6051: Quasi-Cash / crypto exchanges
 *   7995: Gambling
 *   4829: Money transfer
 *   6010: Manual cash disbursement
 *   6011: ATM cash
 */
export const HIGH_RISK_MCCS: ReadonlySet<string> = new Set([
  "6051",
  "7995",
  "4829",
  "6010",
  "6011",
]);

const isLargeAmount = (tx: Transaction): boolean =>
  tx.amount_minor > LARGE_TXN_THRESHOLD_MINOR;

const isHighRiskMcc = (tx: Transaction): boolean =>
  tx.mcc !== undefined && HIGH_RISK_MCCS.has(tx.mcc);

const isCrossBorder = (tx: Transaction): boolean => tx.cross_border === true;

const hasPriorSar = (req: DecisionRequest): boolean =>
  req.context?.prior_sar === true;

/**
 * Decide which engines to run for this request.
 * Always returns at least `quantumbeam`. Order is stable: QB first, ml-fraud
 * second — matches decision.md §5 tie-break rule.
 */
export const route = (request: DecisionRequest): readonly EngineName[] => {
  const engines: EngineName[] = ["quantumbeam"];

  const mlFraudRequired =
    isLargeAmount(request.transaction) ||
    isHighRiskMcc(request.transaction) ||
    isCrossBorder(request.transaction) ||
    hasPriorSar(request);

  if (mlFraudRequired) {
    engines.push("ml-fraud");
  }
  return engines;
};
