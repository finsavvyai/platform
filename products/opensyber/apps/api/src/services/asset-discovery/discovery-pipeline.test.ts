import { describe, it, expect, vi, beforeEach } from 'vitest';
import { upsertAssets, upsertRelations, runDiscoveryPipeline } from './discovery-pipeline.js';
import type { DiscoveredAsset, DiscoveredRelation } from './types.js';

function createPipelineDb() {
  let selectResults: any[][] = [[]];
  let selectIdx = 0;

  const makeThenable = (): any => {
    const obj: any = {};
    obj.from = vi.fn(() => makeThenable());
    obj.where = vi.fn(() => makeThenable());
    obj.then = (resolve: any) => {
      const data = selectResults[selectIdx] ?? [];
      selectIdx++;
      return Promise.resolve(resolve(data));
    };
    return obj;
  };

  const insertChain = { values: vi.fn().mockResolvedValue(undefined) };
  const updateSetChain = { where: vi.fn().mockResolvedValue(undefined) };
  const updateChain = { set: vi.fn().mockReturnValue(updateSetChain) };

  return {
    select: vi.fn(() => makeThenable()),
    insert: vi.fn().mockReturnValue(insertChain),
    update: vi.fn().mockReturnValue(updateChain),
    _insertChain: insertChain,
    _setSelectResults: (results: any[][]) => { selectResults = results; selectIdx = 0; },
    _reset: () => { selectResults = [[]]; selectIdx = 0; },
  } as any;
}

describe('Discovery Pipeline', () => {
  let db: ReturnType<typeof createPipelineDb>;

  beforeEach(() => {
    db = createPipelineDb();
  });

  describe('upsertAssets', () => {
    const asset: DiscoveredAsset = {
      assetType: 'file', name: 'config.yml', identifier: '/etc/config.yml',
      sensitivity: 'medium', discoverySource: 'agent_activity',
    };

    it('inserts new asset', async () => {
      db._setSelectResults([[]]); // no existing
      const map = await upsertAssets(db, 'org1', [asset]);
      expect(map.size).toBe(1);
      expect(map.has('/etc/config.yml')).toBe(true);
      expect(db.insert).toHaveBeenCalledTimes(1);
    });

    it('updates lastSeenAt for existing asset', async () => {
      db._setSelectResults([[{ id: 'existing-1' }]]); // found existing
      const map = await upsertAssets(db, 'org1', [asset]);
      expect(map.get('/etc/config.yml')).toBe('existing-1');
      expect(db.update).toHaveBeenCalledTimes(1);
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('handles multiple assets with dedup', async () => {
      db._setSelectResults([[], [{ id: 'ex-2' }]]); // first new, second existing
      const assets: DiscoveredAsset[] = [
        { ...asset, identifier: 'new-file' },
        { ...asset, identifier: 'existing-file' },
      ];
      const map = await upsertAssets(db, 'org1', assets);
      expect(map.size).toBe(2);
      expect(db.insert).toHaveBeenCalledTimes(1);
      expect(db.update).toHaveBeenCalledTimes(1);
    });

    it('handles crown jewel flag', async () => {
      db._setSelectResults([[]]);
      await upsertAssets(db, 'org1', [{ ...asset, isCrownJewel: true }]);
      const insertCall = db._insertChain.values.mock.calls[0][0];
      expect(insertCall.isCrownJewel).toBe(true);
    });

    it('serializes metadata', async () => {
      db._setSelectResults([[]]);
      await upsertAssets(db, 'org1', [{ ...asset, metadata: { region: 'us-east-1' } }]);
      const insertCall = db._insertChain.values.mock.calls[0][0];
      expect(insertCall.metadata).toBe('{"region":"us-east-1"}');
    });
  });

  describe('upsertRelations', () => {
    const idMap = new Map([['src-id', 'asset-src'], ['tgt-id', 'asset-tgt']]);
    const rel: DiscoveredRelation = {
      sourceIdentifier: 'src-id', targetIdentifier: 'tgt-id',
      relationType: 'read_access', confidence: 1.0, discoverySource: 'agent_activity',
    };

    it('inserts new relation', async () => {
      db._setSelectResults([[]]); // no existing
      const created = await upsertRelations(db, 'org1', [rel], idMap);
      expect(created).toBe(1);
      expect(db.insert).toHaveBeenCalledTimes(1);
    });

    it('updates existing relation', async () => {
      db._setSelectResults([[{ id: 'existing-rel' }]]);
      const created = await upsertRelations(db, 'org1', [rel], idMap);
      expect(created).toBe(0);
      expect(db.update).toHaveBeenCalledTimes(1);
    });

    it('skips relation with missing source identifier', async () => {
      const badRel = { ...rel, sourceIdentifier: 'unknown' };
      const created = await upsertRelations(db, 'org1', [badRel], idMap);
      expect(created).toBe(0);
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('skips relation with missing target identifier', async () => {
      const badRel = { ...rel, targetIdentifier: 'unknown' };
      const created = await upsertRelations(db, 'org1', [badRel], idMap);
      expect(created).toBe(0);
    });
  });

  describe('runDiscoveryPipeline', () => {
    it('orchestrates upsert + relation creation', async () => {
      const assets: DiscoveredAsset[] = [
        { assetType: 'agent_session', name: 'Session', identifier: 'sess-1', sensitivity: 'medium', discoverySource: 'agent_activity' },
        { assetType: 'file', name: 'creds', identifier: '/aws/creds', sensitivity: 'critical', discoverySource: 'agent_activity' },
      ];
      const relations: DiscoveredRelation[] = [
        { sourceIdentifier: 'sess-1', targetIdentifier: '/aws/creds', relationType: 'read_access', confidence: 1.0, discoverySource: 'agent_activity' },
      ];

      // Two asset upserts (both new) + one relation upsert (new)
      db._setSelectResults([[], [], []]);
      const result = await runDiscoveryPipeline(db, 'org1', assets, relations);
      expect(result.assetsUpserted).toBe(2);
      expect(result.relationsCreated).toBe(1);
    });

    it('handles empty inputs', async () => {
      const result = await runDiscoveryPipeline(db, 'org1', [], []);
      expect(result.assetsUpserted).toBe(0);
      expect(result.relationsCreated).toBe(0);
    });
  });
});
