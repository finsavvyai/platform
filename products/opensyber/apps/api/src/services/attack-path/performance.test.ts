import { describe, it, expect } from 'vitest';
import { bfsTraverse } from './bfs-engine.js';
import { computeBlastRadius } from './blast-radius.js';
import { findCrownJewelPaths } from './crown-jewel-paths.js';
import type { GraphNode, GraphEdge } from './types.js';
import type { AssetType, SensitivityLevel, RelationType } from '@opensyber/shared';

const TYPES: AssetType[] = ['file', 'env_var', 'cloud_resource', 'database', 'secret'];
const SENS: SensitivityLevel[] = ['critical', 'high', 'medium', 'low'];
const RELS: RelationType[] = ['read_access', 'write_access', 'authenticates_to', 'network_access'];

function buildGraph(nodeCount: number, edgesPerNode: number): Map<string, GraphNode> {
  const graph = new Map<string, GraphNode>();

  for (let i = 0; i < nodeCount; i++) {
    graph.set(`n${i}`, {
      id: `n${i}`,
      assetType: TYPES[i % TYPES.length]!,
      name: `Node ${i}`,
      identifier: `identifier-${i}`,
      sensitivity: SENS[i % SENS.length]!,
      isCrownJewel: i % 50 === 0 && i > 0,
      edges: [],
    });
  }

  for (let i = 0; i < nodeCount; i++) {
    const node = graph.get(`n${i}`)!;
    for (let j = 0; j < edgesPerNode; j++) {
      const targetIdx = (i + j + 1) % nodeCount;
      if (targetIdx === i) continue;
      node.edges.push({
        relationId: `r${i}_${j}`,
        targetId: `n${targetIdx}`,
        relationType: RELS[j % RELS.length]!,
        confidence: 0.8,
      });
    }
  }

  return graph;
}

describe('Performance', () => {
  it('BFS 1,000 nodes / 5,000 edges completes < 500ms', () => {
    const graph = buildGraph(1000, 5);
    const start = performance.now();
    const result = bfsTraverse(graph, 'n0', { maxDepth: 10 });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(result.reachable.size).toBeGreaterThan(0);
  });

  it('BFS 10,000 nodes / 50,000 edges completes < 2s', () => {
    const graph = buildGraph(10000, 5);
    const start = performance.now();
    const result = bfsTraverse(graph, 'n0', { maxDepth: 10 });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(2000);
    expect(result.reachable.size).toBeGreaterThan(0);
  });

  it('blast radius + crown jewel paths on 1K reachable < 100ms', () => {
    const graph = buildGraph(1000, 5);
    const bfsResult = bfsTraverse(graph, 'n0', { maxDepth: 10 });

    const start = performance.now();
    computeBlastRadius(bfsResult.reachable);
    findCrownJewelPaths(bfsResult.reachable, 10);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
  });

  it('graph build time for 10K nodes < 1s', () => {
    const start = performance.now();
    buildGraph(10000, 5);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1000);
  });
});
