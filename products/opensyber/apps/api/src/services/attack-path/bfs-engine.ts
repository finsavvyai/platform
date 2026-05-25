/**
 * BFS Attack Path Engine
 *
 * Traverses the asset graph from an entry point to find all reachable assets.
 * Uses breadth-first search with configurable depth, confidence, and type filters.
 */
import type { GraphNode, BfsResult, BfsOptions, ReachableAsset } from './types.js';

const DEFAULT_MAX_DEPTH = 10;
const DEFAULT_MIN_CONFIDENCE = 0.5;

export function bfsTraverse(
  graph: Map<string, GraphNode>,
  entryId: string,
  options: BfsOptions = {},
): BfsResult {
  const {
    maxDepth = DEFAULT_MAX_DEPTH,
    minConfidence = DEFAULT_MIN_CONFIDENCE,
    filterAssetTypes,
    filterSensitivity,
    filterRelationTypes,
  } = options;

  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number; path: string[] }> = [];
  const reachable = new Map<string, ReachableAsset>();

  const entryNode = graph.get(entryId);
  if (!entryNode) return { reachable };

  queue.push({ id: entryId, depth: 0, path: [entryId] });
  visited.add(entryId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;

    const node = graph.get(current.id);
    if (!node) continue;

    for (const edge of node.edges) {
      if (visited.has(edge.targetId)) continue;
      if (edge.confidence < minConfidence) continue;
      if (filterRelationTypes && !filterRelationTypes.includes(edge.relationType)) continue;

      const targetNode = graph.get(edge.targetId);
      if (!targetNode) continue;
      if (filterAssetTypes && !filterAssetTypes.includes(targetNode.assetType)) continue;
      if (filterSensitivity && !filterSensitivity.includes(targetNode.sensitivity)) continue;

      visited.add(edge.targetId);
      const newPath = [...current.path, edge.targetId];

      reachable.set(edge.targetId, {
        asset: targetNode,
        depth: current.depth + 1,
        path: newPath,
      });

      queue.push({ id: edge.targetId, depth: current.depth + 1, path: newPath });
    }
  }

  return { reachable };
}
