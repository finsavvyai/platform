import { describe, it, expect } from 'vitest';
import { discoverFromActivity } from './agent-activity-discoverer.js';
import type { AgentActivityRecord } from './types.js';

function makeActivity(overrides: Partial<AgentActivityRecord> = {}): AgentActivityRecord {
  return {
    id: 'evt-1',
    sessionId: 'sess-1',
    agent: 'cursor',
    type: 'file_read',
    risk: 'medium',
    path: '/home/dev/project/src/index.ts',
    summary: 'Read source file',
    secretsCount: 0,
    ...overrides,
  };
}

describe('discoverFromActivity', () => {
  it('should create agent session asset as entry point', () => {
    const result = discoverFromActivity('sess-1', 'cursor', []);
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].assetType).toBe('agent_session');
    expect(result.assets[0].identifier).toBe('sess-1');
  });

  it('should discover file assets from file_read events', () => {
    const activities = [makeActivity({ path: '/home/dev/.aws/credentials' })];
    const result = discoverFromActivity('sess-1', 'cursor', activities);

    const fileAsset = result.assets.find((a) => a.assetType === 'file');
    expect(fileAsset).toBeDefined();
    expect(fileAsset!.identifier).toBe('/home/dev/.aws/credentials');
    expect(fileAsset!.sensitivity).toBe('critical');
  });

  it('should create read_access relation from session to file', () => {
    const activities = [makeActivity({ path: '/home/dev/file.ts' })];
    const result = discoverFromActivity('sess-1', 'cursor', activities);

    const rel = result.relations.find((r) => r.relationType === 'read_access');
    expect(rel).toBeDefined();
    expect(rel!.sourceIdentifier).toBe('sess-1');
    expect(rel!.targetIdentifier).toBe('/home/dev/file.ts');
  });

  it('should discover secrets when secretsCount > 0', () => {
    const activities = [makeActivity({ path: '/home/dev/.env', secretsCount: 2 })];
    const result = discoverFromActivity('sess-1', 'cursor', activities);

    const secretAsset = result.assets.find((a) => a.assetType === 'secret');
    expect(secretAsset).toBeDefined();
    expect(secretAsset!.sensitivity).toBe('critical');
    expect(secretAsset!.isCrownJewel).toBe(true);
  });

  it('should extract env vars from bash command summaries', () => {
    const activities = [makeActivity({
      type: 'bash_exec',
      path: null,
      summary: 'DATABASE_URL=postgres://user:pass@prod-db.rds.amazonaws.com/mydb',
    })];
    const result = discoverFromActivity('sess-1', 'cursor', activities);

    const envAsset = result.assets.find((a) => a.assetType === 'env_var');
    expect(envAsset).toBeDefined();
    expect(envAsset!.identifier).toBe('DATABASE_URL');

    const dbAsset = result.assets.find((a) => a.assetType === 'database');
    expect(dbAsset).toBeDefined();
    expect(dbAsset!.identifier).toBe('prod-db.rds.amazonaws.com');
  });

  it('should create authenticates_to relation for DB URLs', () => {
    const activities = [makeActivity({
      type: 'bash_exec',
      path: null,
      summary: 'DATABASE_URL=postgres://u:p@db-host/mydb',
    })];
    const result = discoverFromActivity('sess-1', 'cursor', activities);

    const authRel = result.relations.find((r) => r.relationType === 'authenticates_to');
    expect(authRel).toBeDefined();
    expect(authRel!.sourceIdentifier).toBe('DATABASE_URL');
    expect(authRel!.targetIdentifier).toBe('db-host');
    expect(authRel!.confidence).toBe(0.7);
  });

  it('should deduplicate assets by identifier', () => {
    const activities = [
      makeActivity({ path: '/home/dev/file.ts' }),
      makeActivity({ id: 'evt-2', path: '/home/dev/file.ts' }),
    ];
    const result = discoverFromActivity('sess-1', 'cursor', activities);
    const files = result.assets.filter((a) => a.assetType === 'file');
    expect(files).toHaveLength(1);
  });

  it('should mark production files as crown jewels', () => {
    const activities = [makeActivity({ path: '/data/production/customer_data.csv' })];
    const result = discoverFromActivity('sess-1', 'cursor', activities);

    const file = result.assets.find((a) => a.assetType === 'file');
    expect(file!.isCrownJewel).toBe(true);
  });

  it('should handle activities with no path', () => {
    const activities = [makeActivity({ type: 'bash_exec', path: null, summary: 'ls -la' })];
    const result = discoverFromActivity('sess-1', 'cursor', activities);
    // Should only have the session asset
    expect(result.assets).toHaveLength(1);
  });
});
