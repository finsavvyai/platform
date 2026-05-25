/**
 * Shared fixture helpers for attack-path unit tests.
 * Not used by production code — kept out of the barrel export.
 */
import type { BfsResult, GraphNode, ReachableAsset } from './types.js';

export function mkNode(
  id: string,
  assetType: GraphNode['assetType'],
  sensitivity: GraphNode['sensitivity'] = 'medium',
  opts: { isCrownJewel?: boolean; name?: string } = {},
): GraphNode {
  return {
    id,
    assetType,
    name: opts.name ?? id,
    identifier: id,
    sensitivity,
    isCrownJewel: opts.isCrownJewel ?? false,
    edges: [],
  };
}

export function mkReachable(
  nodes: Array<{ node: GraphNode; depth: number; path: string[] }>,
): BfsResult {
  const reachable = new Map<string, ReachableAsset>();
  for (const { node, depth, path } of nodes) {
    reachable.set(node.id, { asset: node, depth, path });
  }
  return { reachable };
}
