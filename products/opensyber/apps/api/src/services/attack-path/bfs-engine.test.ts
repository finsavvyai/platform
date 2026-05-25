import { describe, it, expect } from 'vitest';
import { bfsTraverse } from './bfs-engine.js';
import type { GraphNode } from './types.js';

function makeNode(id: string, overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id,
    assetType: 'file',
    name: id,
    identifier: `/${id}`,
    sensitivity: 'medium',
    isCrownJewel: false,
    edges: [],
    ...overrides,
  };
}

function buildGraph(nodes: GraphNode[]): Map<string, GraphNode> {
  const graph = new Map<string, GraphNode>();
  for (const n of nodes) graph.set(n.id, n);
  return graph;
}

describe('bfsTraverse', () => {
  it('should return empty for non-existent entry', () => {
    const graph = buildGraph([makeNode('a')]);
    const result = bfsTraverse(graph, 'missing');
    expect(result.reachable.size).toBe(0);
  });

  it('should return empty for isolated node', () => {
    const graph = buildGraph([makeNode('a')]);
    const result = bfsTraverse(graph, 'a');
    expect(result.reachable.size).toBe(0);
  });

  it('should find directly connected nodes', () => {
    const a = makeNode('a');
    const b = makeNode('b');
    a.edges = [{ relationId: 'r1', targetId: 'b', relationType: 'read_access', confidence: 1.0 }];
    const graph = buildGraph([a, b]);

    const result = bfsTraverse(graph, 'a');
    expect(result.reachable.size).toBe(1);
    expect(result.reachable.get('b')?.depth).toBe(1);
    expect(result.reachable.get('b')?.path).toEqual(['a', 'b']);
  });

  it('should traverse multi-hop paths', () => {
    const a = makeNode('a');
    const b = makeNode('b');
    const c = makeNode('c');
    const d = makeNode('d');
    a.edges = [{ relationId: 'r1', targetId: 'b', relationType: 'read_access', confidence: 1.0 }];
    b.edges = [{ relationId: 'r2', targetId: 'c', relationType: 'secret_access', confidence: 0.8 }];
    c.edges = [{ relationId: 'r3', targetId: 'd', relationType: 'network_access', confidence: 0.9 }];
    const graph = buildGraph([a, b, c, d]);

    const result = bfsTraverse(graph, 'a');
    expect(result.reachable.size).toBe(3);
    expect(result.reachable.get('d')?.depth).toBe(3);
    expect(result.reachable.get('d')?.path).toEqual(['a', 'b', 'c', 'd']);
  });

  it('should respect maxDepth', () => {
    const a = makeNode('a');
    const b = makeNode('b');
    const c = makeNode('c');
    a.edges = [{ relationId: 'r1', targetId: 'b', relationType: 'read_access', confidence: 1.0 }];
    b.edges = [{ relationId: 'r2', targetId: 'c', relationType: 'read_access', confidence: 1.0 }];
    const graph = buildGraph([a, b, c]);

    const result = bfsTraverse(graph, 'a', { maxDepth: 1 });
    expect(result.reachable.size).toBe(1);
    expect(result.reachable.has('b')).toBe(true);
    expect(result.reachable.has('c')).toBe(false);
  });

  it('should filter by minConfidence', () => {
    const a = makeNode('a');
    const b = makeNode('b');
    const c = makeNode('c');
    a.edges = [
      { relationId: 'r1', targetId: 'b', relationType: 'read_access', confidence: 0.9 },
      { relationId: 'r2', targetId: 'c', relationType: 'read_access', confidence: 0.3 },
    ];
    const graph = buildGraph([a, b, c]);

    const result = bfsTraverse(graph, 'a', { minConfidence: 0.5 });
    expect(result.reachable.size).toBe(1);
    expect(result.reachable.has('b')).toBe(true);
  });

  it('should filter by asset type', () => {
    const a = makeNode('a', { assetType: 'agent_session' });
    const b = makeNode('b', { assetType: 'file' });
    const c = makeNode('c', { assetType: 'database' });
    a.edges = [
      { relationId: 'r1', targetId: 'b', relationType: 'read_access', confidence: 1.0 },
      { relationId: 'r2', targetId: 'c', relationType: 'network_access', confidence: 1.0 },
    ];
    const graph = buildGraph([a, b, c]);

    const result = bfsTraverse(graph, 'a', { filterAssetTypes: ['database'] });
    expect(result.reachable.size).toBe(1);
    expect(result.reachable.has('c')).toBe(true);
  });

  it('should filter by sensitivity', () => {
    const a = makeNode('a');
    const b = makeNode('b', { sensitivity: 'critical' });
    const c = makeNode('c', { sensitivity: 'low' });
    a.edges = [
      { relationId: 'r1', targetId: 'b', relationType: 'read_access', confidence: 1.0 },
      { relationId: 'r2', targetId: 'c', relationType: 'read_access', confidence: 1.0 },
    ];
    const graph = buildGraph([a, b, c]);

    const result = bfsTraverse(graph, 'a', { filterSensitivity: ['critical'] });
    expect(result.reachable.size).toBe(1);
    expect(result.reachable.has('b')).toBe(true);
  });

  it('should filter by relation type', () => {
    const a = makeNode('a');
    const b = makeNode('b');
    const c = makeNode('c');
    a.edges = [
      { relationId: 'r1', targetId: 'b', relationType: 'read_access', confidence: 1.0 },
      { relationId: 'r2', targetId: 'c', relationType: 'secret_access', confidence: 1.0 },
    ];
    const graph = buildGraph([a, b, c]);

    const result = bfsTraverse(graph, 'a', { filterRelationTypes: ['secret_access'] });
    expect(result.reachable.size).toBe(1);
    expect(result.reachable.has('c')).toBe(true);
  });

  it('should handle cycles without infinite loop', () => {
    const a = makeNode('a');
    const b = makeNode('b');
    a.edges = [{ relationId: 'r1', targetId: 'b', relationType: 'read_access', confidence: 1.0 }];
    b.edges = [{ relationId: 'r2', targetId: 'a', relationType: 'read_access', confidence: 1.0 }];
    const graph = buildGraph([a, b]);

    const result = bfsTraverse(graph, 'a');
    expect(result.reachable.size).toBe(1);
  });

  it('should handle diamond-shaped graphs', () => {
    const a = makeNode('a');
    const b = makeNode('b');
    const c = makeNode('c');
    const d = makeNode('d');
    a.edges = [
      { relationId: 'r1', targetId: 'b', relationType: 'read_access', confidence: 1.0 },
      { relationId: 'r2', targetId: 'c', relationType: 'read_access', confidence: 1.0 },
    ];
    b.edges = [{ relationId: 'r3', targetId: 'd', relationType: 'read_access', confidence: 1.0 }];
    c.edges = [{ relationId: 'r4', targetId: 'd', relationType: 'read_access', confidence: 1.0 }];
    const graph = buildGraph([a, b, c, d]);

    const result = bfsTraverse(graph, 'a');
    expect(result.reachable.size).toBe(3);
    // d should be reached via b (shorter BFS path found first)
    expect(result.reachable.get('d')?.depth).toBe(2);
  });

  it('should skip edges to non-existent target nodes', () => {
    const a = makeNode('a');
    a.edges = [{ relationId: 'r1', targetId: 'ghost', relationType: 'read_access', confidence: 1.0 }];
    const graph = buildGraph([a]);

    const result = bfsTraverse(graph, 'a');
    expect(result.reachable.size).toBe(0);
  });

  it('should handle large graph (1000 nodes, linear chain)', () => {
    const nodes: GraphNode[] = [];
    for (let i = 0; i < 1000; i++) {
      const node = makeNode(`n${i}`);
      if (i < 999) {
        node.edges = [{ relationId: `r${i}`, targetId: `n${i + 1}`, relationType: 'read_access', confidence: 1.0 }];
      }
      nodes.push(node);
    }
    const graph = buildGraph(nodes);

    const result = bfsTraverse(graph, 'n0', { maxDepth: 20 });
    // Should only reach first 20 nodes due to maxDepth
    expect(result.reachable.size).toBe(20);
  });

  it('should use default options when none provided', () => {
    const a = makeNode('a');
    const b = makeNode('b');
    a.edges = [{ relationId: 'r1', targetId: 'b', relationType: 'read_access', confidence: 0.6 }];
    const graph = buildGraph([a, b]);

    const result = bfsTraverse(graph, 'a');
    expect(result.reachable.size).toBe(1);
  });
});
