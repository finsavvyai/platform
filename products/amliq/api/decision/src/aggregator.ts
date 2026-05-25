/**
 * Decision aggregator — pure function. 100% line + branch covered.
 *
 * Inputs: EngineResult[] (one per engine that ran; some may carry `error`).
 * Outputs: { max_risk_score, merged unique explanations, recommended_action,
 *            confidence, partial }.
 *
 * Recommendation thresholds (per task spec, NOT decision.md §5 which uses
 * 0..1 cutoffs — INVESTIGATE-WIRE scope uses 0..100 scores):
 *   score ≥ 85 → block
 *   score ≥ 40 → flag
 *   score <  40 → allow
 *
 * Confidence: 1.0 minus stddev / mean across successful engines, clipped to
 * [0, 1]. With a single engine (or all-identical), confidence = 1.0. With
 * zero successful engines, confidence = 0 (safe default = allow + 0).
 */

import type { EngineResult, RecommendedAction } from "./types.js";

export const BLOCK_THRESHOLD = 85;
export const FLAG_THRESHOLD = 40;

export interface AggregateOutput {
  readonly max_risk_score: number;
  readonly aggregated_explanation: readonly string[];
  readonly recommended_action: RecommendedAction;
  readonly confidence: number;
  readonly partial: boolean;
}

const clamp = (n: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, n));

const dedupePreserveOrder = (xs: readonly string[]): readonly string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
};

const computeConfidence = (scores: readonly number[]): number => {
  // Defensive: aggregate() short-circuits on successful.length === 0 before
  // ever reaching this function — kept as a safe-input contract.
  /* v8 ignore next */
  if (scores.length === 0) return 0;
  if (scores.length === 1) return 1;
  const mean = scores.reduce((s, n) => s + n, 0) / scores.length;
  if (mean === 0) return 1; // all engines agree on zero risk
  const variance =
    scores.reduce((s, n) => s + (n - mean) * (n - mean), 0) / scores.length;
  const stddev = Math.sqrt(variance);
  // Coefficient of variation, clipped. Lower dispersion ⇒ higher confidence.
  return clamp(1 - stddev / mean, 0, 1);
};

const recommend = (score: number): RecommendedAction => {
  if (score >= BLOCK_THRESHOLD) return "block";
  if (score >= FLAG_THRESHOLD) return "flag";
  return "allow";
};

export const aggregate = (
  results: readonly EngineResult[],
): AggregateOutput => {
  const successful = results.filter((r) => r.error === undefined);
  const anyError = results.some((r) => r.error !== undefined);
  const partial = anyError && successful.length > 0;

  if (successful.length === 0) {
    // All engines errored (or none ran). Safe default: allow with zero
    // confidence — caller layer (decision-service) is responsible for any
    // policy that may want to upgrade an all-error case to block.
    return {
      max_risk_score: 0,
      aggregated_explanation: dedupePreserveOrder(
        results.flatMap((r) => r.explanations),
      ),
      recommended_action: "allow",
      confidence: 0,
      partial: false, // not "partial" — there is no signal at all
    };
  }

  const successScores = successful.map((r) =>
    clamp(r.risk_score, 0, 100),
  );
  const maxScore = Math.max(...successScores);
  const merged = dedupePreserveOrder(
    successful.flatMap((r) => r.explanations),
  );
  return {
    max_risk_score: maxScore,
    aggregated_explanation: merged,
    recommended_action: recommend(maxScore),
    confidence: computeConfidence(successScores),
    partial,
  };
};
