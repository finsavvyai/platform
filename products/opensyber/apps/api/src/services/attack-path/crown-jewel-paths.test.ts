import { describe, it, expect } from 'vitest';
import { findCrownJewelPaths } from './crown-jewel-paths.js';
import type { ReachableAsset, GraphNode } from './types.js';

function makeEntry(
  id: string,
  sensitivity: string,
  isCrownJewel: boolean,
  depth: number,
): [string, ReachableAsset] {
  const path = ['entry'];
  for (let i = 1; i <= depth; i++) path.push(i === depth ? id : `hop${i}`);
  const asset: GraphNode = {
    id,
    assetType: 'database',
    name: id,
    identifier: `arn:${id}`,
    sensitivity: sensitivity as GraphNode['sensitivity'],
    isCrownJewel,
    edges: [],
  };
  return [id, { asset, depth, path }];
}

describe('findCrownJewelPaths', () => {
  it('should return empty for no crown jewels', () => {
    const reachable = new Map([makeEntry('a', 'high', false, 2)]);
    const result = findCrownJewelPaths(reachable);
    expect(result.paths).toHaveLength(0);
    expect(result.totalCrownJewels).toBe(0);
  });

  it('should find single crown jewel path', () => {
    const reachable = new Map([
      makeEntry('a', 'critical', true, 3),
      makeEntry('b', 'high', false, 1),
    ]);
    const result = findCrownJewelPaths(reachable);
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0].targetAssetId).toBe('a');
    expect(result.paths[0].hops).toBe(3);
    expect(result.paths[0].isCrownJewel).toBe(true);
  });

  it('should rank by sensitivity then hop count', () => {
    const reachable = new Map([
      makeEntry('db-prod', 'critical', true, 4),
      makeEntry('db-staging', 'high', true, 2),
      makeEntry('db-dev', 'critical', true, 2),
    ]);
    const result = findCrownJewelPaths(reachable);
    expect(result.paths).toHaveLength(3);
    // Critical first, then by hops
    expect(result.paths[0].targetAssetId).toBe('db-dev');    // critical, 2 hops
    expect(result.paths[1].targetAssetId).toBe('db-prod');   // critical, 4 hops
    expect(result.paths[2].targetAssetId).toBe('db-staging'); // high, 2 hops
  });

  it('should limit to maxPaths', () => {
    const entries: [string, ReachableAsset][] = [];
    for (let i = 0; i < 20; i++) {
      entries.push(makeEntry(`cj${i}`, 'critical', true, i + 1));
    }
    const result = findCrownJewelPaths(new Map(entries), 5);
    expect(result.paths).toHaveLength(5);
    expect(result.totalCrownJewels).toBe(20);
  });

  it('should include path array', () => {
    const reachable = new Map([makeEntry('target', 'critical', true, 2)]);
    const result = findCrownJewelPaths(reachable);
    expect(result.paths[0].path).toContain('entry');
    expect(result.paths[0].path).toContain('target');
  });
});
