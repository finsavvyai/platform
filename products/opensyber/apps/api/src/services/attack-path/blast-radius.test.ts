import { describe, it, expect } from 'vitest';
import { computeBlastRadius } from './blast-radius.js';
import type { ReachableAsset, GraphNode } from './types.js';

function makeReachable(
  id: string,
  sensitivity: string,
  assetType: string,
  isCrownJewel = false,
  depth = 1,
): [string, ReachableAsset] {
  const asset: GraphNode = {
    id,
    assetType: assetType as GraphNode['assetType'],
    name: id,
    identifier: `/${id}`,
    sensitivity: sensitivity as GraphNode['sensitivity'],
    isCrownJewel,
    edges: [],
  };
  return [id, { asset, depth, path: ['entry', id] }];
}

describe('computeBlastRadius', () => {
  it('should return zero for empty reachable set', () => {
    const result = computeBlastRadius(new Map());
    expect(result.score).toBe(0);
    expect(result.totalReachable).toBe(0);
    expect(result.crownJewelsReached).toBe(0);
  });

  it('should score a single low-sensitivity asset', () => {
    const reachable = new Map([makeReachable('a', 'low', 'file')]);
    const result = computeBlastRadius(reachable);
    expect(result.score).toBeGreaterThan(0);
    expect(result.totalReachable).toBe(1);
    expect(result.bySensitivity['low']).toBe(1);
    expect(result.byType['file']).toBe(1);
  });

  it('should score critical assets higher than low', () => {
    const lowOnly = new Map([makeReachable('a', 'low', 'file')]);
    const critOnly = new Map([makeReachable('a', 'critical', 'file')]);
    const lowScore = computeBlastRadius(lowOnly).score;
    const critScore = computeBlastRadius(critOnly).score;
    expect(critScore).toBeGreaterThan(lowScore);
  });

  it('should add crown jewel bonus', () => {
    const noCrown = new Map([makeReachable('a', 'high', 'database', false)]);
    const withCrown = new Map([makeReachable('a', 'high', 'database', true)]);
    const noCrownScore = computeBlastRadius(noCrown).score;
    const withCrownScore = computeBlastRadius(withCrown).score;
    expect(withCrownScore).toBeGreaterThan(noCrownScore);
    expect(computeBlastRadius(withCrown).crownJewelsReached).toBe(1);
  });

  it('should count by type correctly', () => {
    const reachable = new Map([
      makeReachable('a', 'medium', 'file'),
      makeReachable('b', 'medium', 'file'),
      makeReachable('c', 'medium', 'database'),
    ]);
    const result = computeBlastRadius(reachable);
    expect(result.byType['file']).toBe(2);
    expect(result.byType['database']).toBe(1);
    expect(result.totalReachable).toBe(3);
  });

  it('should count by sensitivity correctly', () => {
    const reachable = new Map([
      makeReachable('a', 'critical', 'file'),
      makeReachable('b', 'high', 'file'),
      makeReachable('c', 'high', 'database'),
      makeReachable('d', 'low', 'env_var'),
    ]);
    const result = computeBlastRadius(reachable);
    expect(result.bySensitivity['critical']).toBe(1);
    expect(result.bySensitivity['high']).toBe(2);
    expect(result.bySensitivity['low']).toBe(1);
  });

  it('should cap score at 100', () => {
    const entries: [string, ReachableAsset][] = [];
    for (let i = 0; i < 50; i++) {
      entries.push(makeReachable(`c${i}`, 'critical', 'database', true));
    }
    const result = computeBlastRadius(new Map(entries));
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('should handle info sensitivity (zero weight)', () => {
    const reachable = new Map([makeReachable('a', 'info', 'file')]);
    const result = computeBlastRadius(reachable);
    expect(result.score).toBe(0);
    expect(result.totalReachable).toBe(1);
  });

  it('should handle multiple crown jewels', () => {
    const reachable = new Map([
      makeReachable('a', 'critical', 'database', true),
      makeReachable('b', 'critical', 'secret', true),
      makeReachable('c', 'high', 'file', false),
    ]);
    const result = computeBlastRadius(reachable);
    expect(result.crownJewelsReached).toBe(2);
    expect(result.totalReachable).toBe(3);
  });
});
