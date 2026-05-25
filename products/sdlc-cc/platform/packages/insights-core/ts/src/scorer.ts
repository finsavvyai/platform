import type { ScoreBreakdown, Weights } from "./types.js";

export class Scorer {
  constructor(public readonly weights: Weights) {}

  score(b: ScoreBreakdown): number {
    const v =
      this.weights.soc2 * b.soc2 +
      this.weights.hipaa * b.hipaa +
      this.weights.gdpr * b.gdpr +
      this.weights.cost * b.cost +
      this.weights.blast * b.blast;
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
  }
}
