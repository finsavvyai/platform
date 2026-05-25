import { describe, it, expect, vi } from 'vitest';
import { loadOrgGraph } from './graph-loader.js';

function createMockGraphDb(assets: any[], relations: any[]) {
  let callCount = 0;
  const makeThenable = (data: any[]): any => {
    const obj: any = {};
    obj.from = vi.fn(() => makeThenable(data));
    obj.where = vi.fn(() => makeThenable(data));
    obj.then = (resolve: any) => Promise.resolve(resolve(data));
    return obj;
  };

  return {
    select: vi.fn(() => {
      const data = callCount === 0 ? assets : relations;
      callCount++;
      return makeThenable(data);
    }),
  } as any;
}

describe('loadOrgGraph', () => {
  it('builds graph with nodes and edges', async () => {
    const assets = [
      { id: 'a1', assetType: 'agent_session', name: 'Session', identifier: 's1', sensitivity: 'medium', isCrownJewel: false },
      { id: 'a2', assetType: 'file', name: 'creds', identifier: '/aws/creds', sensitivity: 'critical', isCrownJewel: true },
    ];
    const relations = [
      { id: 'r1', sourceAssetId: 'a1', targetAssetId: 'a2', relationType: 'read_access', confidence: 1.0 },
    ];

    const graph = await loadOrgGraph(createMockGraphDb(assets, relations), 'org1');

    expect(graph.size).toBe(2);
    const node1 = graph.get('a1')!;
    expect(node1.edges).toHaveLength(1);
    expect(node1.edges[0].targetId).toBe('a2');
    expect(graph.get('a2')!.isCrownJewel).toBe(true);
  });

  it('returns empty graph for org with no assets', async () => {
    const graph = await loadOrgGraph(createMockGraphDb([], []), 'org_empty');
    expect(graph.size).toBe(0);
  });

  it('skips relations with dangling source', async () => {
    const assets = [{ id: 'a1', assetType: 'file', name: 'f', identifier: 'f1', sensitivity: 'low', isCrownJewel: false }];
    const relations = [
      { id: 'r1', sourceAssetId: 'missing', targetAssetId: 'a1', relationType: 'read_access', confidence: 1.0 },
    ];

    const graph = await loadOrgGraph(createMockGraphDb(assets, relations), 'org1');
    expect(graph.get('a1')!.edges).toHaveLength(0);
  });

  it('skips relations with dangling target', async () => {
    const assets = [{ id: 'a1', assetType: 'file', name: 'f', identifier: 'f1', sensitivity: 'low', isCrownJewel: false }];
    const relations = [
      { id: 'r1', sourceAssetId: 'a1', targetAssetId: 'missing', relationType: 'read_access', confidence: 1.0 },
    ];

    const graph = await loadOrgGraph(createMockGraphDb(assets, relations), 'org1');
    expect(graph.get('a1')!.edges).toHaveLength(0);
  });

  it('handles multiple edges from same node', async () => {
    const assets = [
      { id: 'a1', assetType: 'agent_session', name: 'S', identifier: 's1', sensitivity: 'medium', isCrownJewel: false },
      { id: 'a2', assetType: 'file', name: 'F1', identifier: 'f1', sensitivity: 'high', isCrownJewel: false },
      { id: 'a3', assetType: 'file', name: 'F2', identifier: 'f2', sensitivity: 'low', isCrownJewel: false },
    ];
    const relations = [
      { id: 'r1', sourceAssetId: 'a1', targetAssetId: 'a2', relationType: 'read_access', confidence: 1.0 },
      { id: 'r2', sourceAssetId: 'a1', targetAssetId: 'a3', relationType: 'write_access', confidence: 0.8 },
    ];

    const graph = await loadOrgGraph(createMockGraphDb(assets, relations), 'org1');
    expect(graph.get('a1')!.edges).toHaveLength(2);
  });

  it('preserves confidence from relations', async () => {
    const assets = [
      { id: 'a1', assetType: 'file', name: 'F', identifier: 'f1', sensitivity: 'low', isCrownJewel: false },
      { id: 'a2', assetType: 'database', name: 'DB', identifier: 'd1', sensitivity: 'high', isCrownJewel: true },
    ];
    const relations = [
      { id: 'r1', sourceAssetId: 'a1', targetAssetId: 'a2', relationType: 'authenticates_to', confidence: 0.7 },
    ];

    const graph = await loadOrgGraph(createMockGraphDb(assets, relations), 'org1');
    expect(graph.get('a1')!.edges[0].confidence).toBe(0.7);
  });
});
