import { describe, it, expect } from 'vitest';
import { buildVizGraph } from './graph-builder.js';
import { mkNode, mkReachable } from './test-fixtures.js';

describe('buildVizGraph', () => {
  it('always includes the entry node as type "entry"', () => {
    const entry = mkNode('sess-1', 'agent_session');
    const result = buildVizGraph(entry, mkReachable([]));
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]).toMatchObject({ id: 'sess-1', type: 'entry' });
    expect(result.edges).toHaveLength(0);
  });

  it('classifies crown jewels as "crown-jewel" regardless of asset type', () => {
    const entry = mkNode('sess-1', 'agent_session');
    const db = mkNode('db-1', 'database', 'critical', { isCrownJewel: true });
    entry.edges = [
      { relationId: 'r1', targetId: 'db-1', relationType: 'authenticates_to', confidence: 0.9 },
    ];
    const bfs = mkReachable([{ node: db, depth: 1, path: ['sess-1', 'db-1'] }]);
    const result = buildVizGraph(entry, bfs);
    const dbNode = result.nodes.find((n) => n.id === 'db-1');
    expect(dbNode?.type).toBe('crown-jewel');
    expect(dbNode?.severity).toBe('critical');
  });

  it('classifies secret/env_var/file as "vulnerability"', () => {
    const entry = mkNode('sess-1', 'agent_session');
    const secret = mkNode('sec-1', 'secret', 'high');
    const envVar = mkNode('env-1', 'env_var', 'high');
    const file = mkNode('file-1', 'file', 'medium');
    entry.edges = [
      { relationId: 'r1', targetId: 'sec-1', relationType: 'secret_access', confidence: 0.8 },
      { relationId: 'r2', targetId: 'env-1', relationType: 'read_access', confidence: 0.9 },
      { relationId: 'r3', targetId: 'file-1', relationType: 'read_access', confidence: 0.7 },
    ];
    const bfs = mkReachable([
      { node: secret, depth: 1, path: ['sess-1', 'sec-1'] },
      { node: envVar, depth: 1, path: ['sess-1', 'env-1'] },
      { node: file, depth: 1, path: ['sess-1', 'file-1'] },
    ]);
    const result = buildVizGraph(entry, bfs);
    for (const id of ['sec-1', 'env-1', 'file-1']) {
      expect(result.nodes.find((n) => n.id === id)?.type).toBe('vulnerability');
    }
  });

  it('classifies cloud resources and databases as "asset"', () => {
    const entry = mkNode('sess-1', 'agent_session');
    const s3 = mkNode('s3-1', 'cloud_resource', 'low');
    entry.edges = [
      { relationId: 'r1', targetId: 's3-1', relationType: 'read_access', confidence: 0.6 },
    ];
    const bfs = mkReachable([{ node: s3, depth: 1, path: ['sess-1', 's3-1'] }]);
    const result = buildVizGraph(entry, bfs);
    expect(result.nodes.find((n) => n.id === 's3-1')?.type).toBe('asset');
  });

  it('drops severity for "info" sensitivity', () => {
    const entry = mkNode('sess-1', 'agent_session', 'info');
    const result = buildVizGraph(entry, mkReachable([]));
    expect(result.nodes[0].severity).toBeUndefined();
  });

  it('reconstructs parent → child edges from BFS path arrays', () => {
    const entry = mkNode('sess-1', 'agent_session');
    const mid = mkNode('mid-1', 'file', 'high');
    const leaf = mkNode('leaf-1', 'database', 'critical', { isCrownJewel: true });

    entry.edges = [
      { relationId: 'r1', targetId: 'mid-1', relationType: 'read_access', confidence: 0.8 },
    ];
    mid.edges = [
      { relationId: 'r2', targetId: 'leaf-1', relationType: 'authenticates_to', confidence: 0.95 },
    ];

    const bfs = mkReachable([
      { node: mid, depth: 1, path: ['sess-1', 'mid-1'] },
      { node: leaf, depth: 2, path: ['sess-1', 'mid-1', 'leaf-1'] },
    ]);

    const result = buildVizGraph(entry, bfs);
    expect(result.edges).toHaveLength(2);
    const e1 = result.edges.find((e) => e.target === 'mid-1');
    const e2 = result.edges.find((e) => e.target === 'leaf-1');
    expect(e1).toMatchObject({ source: 'sess-1', weight: 0.8, label: 'read_access' });
    expect(e2).toMatchObject({ source: 'mid-1', weight: 0.95, label: 'authenticates_to' });
  });

  it('falls back to 0.5 edge weight when the relation cannot be found', () => {
    const entry = mkNode('sess-1', 'agent_session');
    // Entry has NO edges — edge lookup will fail, forcing the fallback.
    const leaf = mkNode('leaf-1', 'cloud_resource', 'low');
    const bfs = mkReachable([
      { node: leaf, depth: 1, path: ['sess-1', 'leaf-1'] },
    ]);
    const result = buildVizGraph(entry, bfs);
    expect(result.edges[0].weight).toBe(0.5);
    expect(result.edges[0].label).toBeUndefined();
  });
});
