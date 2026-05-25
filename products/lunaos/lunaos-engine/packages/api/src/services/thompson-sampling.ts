/**
 * Thompson Sampling — multi-armed bandit for smart routing.
 *
 * Pure JS Beta distribution sampling (no scipy).
 * Uses Marsaglia-Tsang gamma approximation.
 *
 * Balances exploit (known good routes) vs explore (try new ones).
 */

/**
 * Sample from Beta(alpha, beta) using gamma approximation.
 * Beta(a,b) = Gamma(a) / (Gamma(a) + Gamma(b))
 */
export function sampleBeta(alpha: number, beta: number): number {
  const x = sampleGamma(alpha);
  const y = sampleGamma(beta);
  return x / (x + y);
}

/**
 * Marsaglia-Tsang gamma sampling.
 * Works for alpha >= 1. For alpha < 1, use Ahrens-Dieter fallback.
 */
function sampleGamma(alpha: number): number {
  if (alpha < 1) {
    // Boost: Gamma(alpha) = Gamma(alpha+1) * U^(1/alpha)
    return sampleGamma(alpha + 1) * Math.pow(Math.random(), 1 / alpha);
  }
  const d = alpha - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x: number;
    let v: number;
    do {
      x = normalSample();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x) {
      return d * v;
    }
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

/** Box-Muller transform for standard normal sample. */
function normalSample(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Given outcome counts, pick best arm via Thompson sampling.
 * Each arm gets a Beta(successes+1, failures+1) prior.
 */
export interface BanditArm {
  id: string;
  successes: number;
  failures: number;
}

export function thompsonPick(arms: BanditArm[]): BanditArm | null {
  if (arms.length === 0) return null;
  if (arms.length === 1) return arms[0];

  let best: BanditArm = arms[0];
  let bestScore = -Infinity;

  for (const arm of arms) {
    const score = sampleBeta(arm.successes + 1, arm.failures + 1);
    if (score > bestScore) {
      bestScore = score;
      best = arm;
    }
  }

  return best;
}

/**
 * Time-decayed outcome weight.
 * 30-day half-life: recent outcomes count ~2x vs 30 days old.
 */
export function decayWeight(ageInDays: number): number {
  return Math.exp(-ageInDays / 30);
}

/**
 * Forced exploration when data is sparse.
 * Returns true if we should pick randomly (explore) vs best known (exploit).
 */
export function shouldExplore(sampleSize: number, explorationRate = 0.1): boolean {
  // Always explore if very few samples
  if (sampleSize < 20) return Math.random() < explorationRate * 2;
  // Reduced exploration as data accumulates
  return Math.random() < explorationRate;
}
