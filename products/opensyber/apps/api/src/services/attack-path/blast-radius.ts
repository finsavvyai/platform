/**
 * Blast Radius Scoring
 *
 * Computes a 0-100 score representing the attack surface reachable from an entry point.
 * Uses weighted sensitivity scoring with logarithmic scaling.
 */
import type { SensitivityLevel } from '@opensyber/shared';
import { SENSITIVITY_WEIGHTS, CROWN_JEWEL_BONUS } from '@opensyber/shared';
import type { ReachableAsset, BlastRadiusResult } from './types.js';

export function computeBlastRadius(
  reachable: Map<string, ReachableAsset>,
): BlastRadiusResult {
  let rawScore = 0;
  let crownJewelsReached = 0;
  const byType: Record<string, number> = {};
  const bySensitivity: Record<string, number> = {};

  for (const { asset } of reachable.values()) {
    const weight = SENSITIVITY_WEIGHTS[asset.sensitivity as SensitivityLevel] ?? 0;
    rawScore += weight;
    if (asset.isCrownJewel) {
      rawScore += CROWN_JEWEL_BONUS;
      crownJewelsReached++;
    }
    byType[asset.assetType] = (byType[asset.assetType] ?? 0) + 1;
    bySensitivity[asset.sensitivity] = (bySensitivity[asset.sensitivity] ?? 0) + 1;
  }

  const score = rawScore === 0 ? 0 : Math.min(100, Math.round(20 * Math.log2(1 + rawScore)));

  return {
    score,
    totalReachable: reachable.size,
    crownJewelsReached,
    byType,
    bySensitivity,
  };
}
