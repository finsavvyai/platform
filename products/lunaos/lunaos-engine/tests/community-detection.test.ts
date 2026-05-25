/**
 * Community detection tests — label propagation.
 */

import { describe, it, expect } from 'vitest';
import {
  labelPropagation,
  communityStats,
  type GraphNode,
} from '../packages/api/src/services/community-detection';

describe('labelPropagation', () => {
  it('returns empty map for empty input', () => {
    expect(labelPropagation([]).size).toBe(0);
  });

  it('single node keeps its own label', () => {
    const nodes: GraphNode[] = [{ id: 'a', neighbors: [] }];
    const labels = labelPropagation(nodes);
    expect(labels.get('a')).toBe('a');
  });

  it('two connected nodes merge into one community', () => {
    const nodes: GraphNode[] = [
      { id: 'a', neighbors: [{ id: 'b', weight: 1 }] },
      { id: 'b', neighbors: [{ id: 'a', weight: 1 }] },
    ];
    const labels = labelPropagation(nodes);
    expect(labels.get('a')).toBe(labels.get('b'));
  });

  it('two disconnected components stay separate', () => {
    const nodes: GraphNode[] = [
      { id: 'a', neighbors: [{ id: 'b', weight: 1 }] },
      { id: 'b', neighbors: [{ id: 'a', weight: 1 }] },
      { id: 'c', neighbors: [{ id: 'd', weight: 1 }] },
      { id: 'd', neighbors: [{ id: 'c', weight: 1 }] },
    ];
    const labels = labelPropagation(nodes);
    expect(labels.get('a')).toBe(labels.get('b'));
    expect(labels.get('c')).toBe(labels.get('d'));
    expect(labels.get('a')).not.toBe(labels.get('c'));
  });

  it('dense clique forms single community', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const nodes: GraphNode[] = ids.map((id) => ({
      id,
      neighbors: ids.filter((x) => x !== id).map((x) => ({ id: x, weight: 1 })),
    }));
    const labels = labelPropagation(nodes);
    const uniqueLabels = new Set(labels.values());
    expect(uniqueLabels.size).toBe(1);
  });

  it('bridge between two cliques may split', () => {
    // Two triangles connected by a single edge
    const nodes: GraphNode[] = [
      { id: 'a', neighbors: [{ id: 'b', weight: 1 }, { id: 'c', weight: 1 }] },
      { id: 'b', neighbors: [{ id: 'a', weight: 1 }, { id: 'c', weight: 1 }] },
      { id: 'c', neighbors: [{ id: 'a', weight: 1 }, { id: 'b', weight: 1 }, { id: 'd', weight: 1 }] },
      { id: 'd', neighbors: [{ id: 'c', weight: 1 }, { id: 'e', weight: 1 }, { id: 'f', weight: 1 }] },
      { id: 'e', neighbors: [{ id: 'd', weight: 1 }, { id: 'f', weight: 1 }] },
      { id: 'f', neighbors: [{ id: 'd', weight: 1 }, { id: 'e', weight: 1 }] },
    ];
    const labels = labelPropagation(nodes);
    const uniqueLabels = new Set(labels.values());
    // Should find 1 or 2 communities (algorithm is randomized)
    expect(uniqueLabels.size).toBeGreaterThanOrEqual(1);
    expect(uniqueLabels.size).toBeLessThanOrEqual(2);
  });
});

describe('communityStats', () => {
  it('empty map returns zero stats', () => {
    const stats = communityStats(new Map());
    expect(stats.numCommunities).toBe(0);
    expect(stats.largest).toBe(0);
  });

  it('counts unique communities', () => {
    const labels = new Map([
      ['a', 'c1'],
      ['b', 'c1'],
      ['c', 'c2'],
    ]);
    const stats = communityStats(labels);
    expect(stats.numCommunities).toBe(2);
    expect(stats.largest).toBe(2);
    expect(stats.smallest).toBe(1);
  });

  it('builds size histogram', () => {
    const labels = new Map([
      ['a', 'c1'],
      ['b', 'c1'],
      ['c', 'c1'],
      ['d', 'c2'],
      ['e', 'c2'],
      ['f', 'c3'],
    ]);
    const stats = communityStats(labels);
    expect(stats.sizeHistogram[3]).toBe(1); // one community of size 3
    expect(stats.sizeHistogram[2]).toBe(1); // one community of size 2
    expect(stats.sizeHistogram[1]).toBe(1); // one community of size 1
  });
});
