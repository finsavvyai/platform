/**
 * Community Detection via Label Propagation.
 *
 * Fast O(n*k) algorithm:
 *   1. Each node starts with unique label (its own ID)
 *   2. Each iteration, every node adopts the most common label among its neighbors
 *   3. Ties broken randomly
 *   4. Converges in ~5-10 iterations for most graphs
 *
 * Workers-compatible: pure JS, no native graph libs.
 */

export interface GraphNode {
  id: string;
  neighbors: Array<{ id: string; weight: number }>;
}

export interface CommunityAssignment {
  nodeId: string;
  communityId: string;
}

const MAX_ITERATIONS = 15;

/**
 * Run label propagation to detect communities.
 * Returns a Map of nodeId → communityId.
 */
export function labelPropagation(
  nodes: GraphNode[],
  maxIterations = MAX_ITERATIONS,
): Map<string, string> {
  if (nodes.length === 0) return new Map();

  // Initialize: each node is its own community
  const labels = new Map<string, string>();
  for (const node of nodes) {
    labels.set(node.id, node.id);
  }

  // Build adjacency lookup for fast access
  const adjacency = new Map<string, GraphNode>();
  for (const node of nodes) {
    adjacency.set(node.id, node);
  }

  // Iterate until convergence or max iterations
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = 0;

    // Shuffle node order to avoid bias
    const order = shuffle([...nodes]);

    for (const node of order) {
      const newLabel = pickMostCommonLabel(node, labels);
      if (newLabel && newLabel !== labels.get(node.id)) {
        labels.set(node.id, newLabel);
        changed++;
      }
    }

    // Converged if no labels changed
    if (changed === 0) break;
  }

  return labels;
}

/**
 * Pick the most common label among a node's neighbors.
 * Weighted by edge weight. Ties broken randomly.
 */
function pickMostCommonLabel(
  node: GraphNode,
  labels: Map<string, string>,
): string | null {
  if (node.neighbors.length === 0) return null;

  const labelWeights = new Map<string, number>();

  for (const neighbor of node.neighbors) {
    const label = labels.get(neighbor.id);
    if (!label) continue;
    labelWeights.set(label, (labelWeights.get(label) || 0) + neighbor.weight);
  }

  if (labelWeights.size === 0) return null;

  // Find max weight
  let maxWeight = 0;
  for (const weight of labelWeights.values()) {
    if (weight > maxWeight) maxWeight = weight;
  }

  // Collect all labels tied for max
  const candidates: string[] = [];
  for (const [label, weight] of labelWeights.entries()) {
    if (weight === maxWeight) candidates.push(label);
  }

  // Random tie-breaking
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Fisher-Yates shuffle (in place copy).
 */
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Compute community statistics: size distribution, modularity proxy.
 */
export function communityStats(labels: Map<string, string>): {
  numCommunities: number;
  largest: number;
  smallest: number;
  sizeHistogram: Record<string, number>;
} {
  const counts = new Map<string, number>();
  for (const label of labels.values()) {
    counts.set(label, (counts.get(label) || 0) + 1);
  }

  if (counts.size === 0) {
    return { numCommunities: 0, largest: 0, smallest: 0, sizeHistogram: {} };
  }

  const sizes = Array.from(counts.values());
  const histogram: Record<string, number> = {};
  for (const size of sizes) {
    histogram[size] = (histogram[size] || 0) + 1;
  }

  return {
    numCommunities: counts.size,
    largest: Math.max(...sizes),
    smallest: Math.min(...sizes),
    sizeHistogram: histogram,
  };
}
