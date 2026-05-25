/** Baseline registry — one place to fetch all four. */

import { baselineA } from './raw';
import { baselineB } from './cached';
import { baselineC } from './cf-gateway';
import { baselineD } from './clawpipe';
import type { Baseline } from './types';

export const BASELINES: Record<'A' | 'B' | 'C' | 'D', Baseline> = {
  A: baselineA,
  B: baselineB,
  C: baselineC,
  D: baselineD,
};

export type { Baseline, BenchRequest, ProviderCallResult, ModelChoice } from './types';
export { MODELS, PRICING, computeCost } from './types';
