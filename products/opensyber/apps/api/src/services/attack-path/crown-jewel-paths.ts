/**
 * Crown Jewel Path Finder
 *
 * Extracts the shortest paths from BFS results to all crown jewel assets,
 * ranked by sensitivity and hop count.
 */
import type { ReachableAsset, AttackPath, CrownJewelPathResult } from './types.js';

const SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

export function findCrownJewelPaths(
  reachable: Map<string, ReachableAsset>,
  maxPaths = 10,
): CrownJewelPathResult {
  const paths: AttackPath[] = [];

  for (const [id, entry] of reachable.entries()) {
    if (!entry.asset.isCrownJewel) continue;
    paths.push({
      targetAssetId: id,
      targetName: entry.asset.name,
      targetSensitivity: entry.asset.sensitivity,
      isCrownJewel: true,
      hops: entry.depth,
      path: entry.path,
    });
  }

  paths.sort((a, b) => {
    const saDiff = (SEVERITY_RANK[b.targetSensitivity] ?? 0) - (SEVERITY_RANK[a.targetSensitivity] ?? 0);
    if (saDiff !== 0) return saDiff;
    return a.hops - b.hops;
  });

  return {
    paths: paths.slice(0, maxPaths),
    totalCrownJewels: paths.length,
  };
}
