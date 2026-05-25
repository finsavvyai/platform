import { describe, it, expect } from 'vitest';
import { rankAttackPaths } from './graph-builder.js';
import { mkNode, mkReachable } from './test-fixtures.js';

describe('rankAttackPaths', () => {
  it('returns empty array for empty BFS result', () => {
    expect(rankAttackPaths(mkReachable([]))).toEqual([]);
  });

  it('ranks crown jewels above equal-severity non-crown assets', () => {
    const cj = mkNode('cj-1', 'database', 'critical', { isCrownJewel: true });
    const plain = mkNode('plain-1', 'database', 'critical');
    const bfs = mkReachable([
      { node: plain, depth: 1, path: ['sess-1', 'plain-1'] },
      { node: cj, depth: 1, path: ['sess-1', 'cj-1'] },
    ]);
    const ranked = rankAttackPaths(bfs);
    expect(ranked[0].targetId).toBe('cj-1');
    expect(ranked[0].riskScore).toBeGreaterThan(ranked[1].riskScore);
  });

  it('weights by severity so critical > high > medium > low', () => {
    const crit = mkNode('c1', 'cloud_resource', 'critical');
    const high = mkNode('h1', 'cloud_resource', 'high');
    const med = mkNode('m1', 'cloud_resource', 'medium');
    const low = mkNode('l1', 'cloud_resource', 'low');
    const bfs = mkReachable([
      { node: low, depth: 1, path: ['s', 'l1'] },
      { node: med, depth: 1, path: ['s', 'm1'] },
      { node: high, depth: 1, path: ['s', 'h1'] },
      { node: crit, depth: 1, path: ['s', 'c1'] },
    ]);
    const ranked = rankAttackPaths(bfs);
    expect(ranked.map((r) => r.targetId)).toEqual(['c1', 'h1', 'm1', 'l1']);
  });

  it('boosts nodes with downstream blast radius (pivot points)', () => {
    // "hub" is a high-severity asset that leads to 3 more assets. A sibling
    // leaf with the same severity should rank LOWER than the hub because
    // the hub's blast_radius is larger.
    const hub = mkNode('hub', 'cloud_resource', 'high');
    const leaf = mkNode('leaf', 'cloud_resource', 'high');
    const a = mkNode('a', 'cloud_resource', 'low');
    const b = mkNode('b', 'cloud_resource', 'low');
    const c = mkNode('c', 'cloud_resource', 'low');
    const bfs = mkReachable([
      { node: hub, depth: 1, path: ['s', 'hub'] },
      { node: leaf, depth: 1, path: ['s', 'leaf'] },
      { node: a, depth: 2, path: ['s', 'hub', 'a'] },
      { node: b, depth: 2, path: ['s', 'hub', 'b'] },
      { node: c, depth: 2, path: ['s', 'hub', 'c'] },
    ]);
    const ranked = rankAttackPaths(bfs);
    const hubRank = ranked.findIndex((r) => r.targetId === 'hub');
    const leafRank = ranked.findIndex((r) => r.targetId === 'leaf');
    expect(hubRank).toBeLessThan(leafRank);
    expect(ranked[hubRank].riskScore).toBeGreaterThan(ranked[leafRank].riskScore);
  });

  it('scores "info" sensitivity as zero', () => {
    const info = mkNode('i1', 'cloud_resource', 'info');
    const bfs = mkReachable([{ node: info, depth: 1, path: ['s', 'i1'] }]);
    const ranked = rankAttackPaths(bfs);
    expect(ranked[0].riskScore).toBe(0);
    expect(ranked[0].maxSeverityWeight).toBe(0);
  });

  it('respects topN', () => {
    const bfs = mkReachable(
      Array.from({ length: 20 }, (_, i) => ({
        node: mkNode(`n${i}`, 'cloud_resource', 'medium'),
        depth: 1,
        path: ['s', `n${i}`],
      })),
    );
    expect(rankAttackPaths(bfs, 5)).toHaveLength(5);
    expect(rankAttackPaths(bfs, 100)).toHaveLength(20);
  });

  it('exposes hops, path and targetName for consumers', () => {
    const leaf = mkNode('leaf', 'database', 'critical', {
      isCrownJewel: true,
      name: 'Production DB',
    });
    const bfs = mkReachable([
      { node: leaf, depth: 2, path: ['s', 'mid', 'leaf'] },
    ]);
    const [top] = rankAttackPaths(bfs);
    expect(top.targetName).toBe('Production DB');
    expect(top.hops).toBe(2);
    expect(top.path).toEqual(['s', 'mid', 'leaf']);
  });
});
