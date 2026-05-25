/**
 * Graph RAG tests — expansion + reranking.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { expandResults } from '../packages/api/src/services/graph-rag';

/** Build a mock D1Database that returns fixed edge/community responses. */
function buildMockDB(
  edges: Array<{ source: string; target: string; type: string; weight: number }> = [],
  communities: Record<string, string[]> = {},
) {
  const allSql: string[] = [];

  return {
    DB: {
      prepare: (sql: string) => {
        allSql.push(sql);
        return {
          bind: (...params: any[]) => ({
            run: async () => ({ success: true }),
            all: async () => {
              // Neighbor query: WHERE source_chunk_id = ? OR target_chunk_id = ?
              if (sql.includes('chunk_edges')) {
                const chunkId = params[0];
                const results = edges
                  .filter((e) => e.source === chunkId || e.target === chunkId)
                  .map((e) => ({
                    targetId: e.source === chunkId ? e.target : e.source,
                    type: e.type,
                    weight: e.weight,
                  }));
                return { results };
              }
              // Community query
              if (sql.includes('chunk_communities')) {
                const chunkId = params[0];
                const members = communities[chunkId] || [];
                return { results: members.map((id) => ({ chunk_id: id })) };
              }
              return { results: [] };
            },
          }),
        };
      },
    } as any,
  };
}

describe('expandResults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only vector hits when no edges exist', async () => {
    const env = buildMockDB([], {});
    const vectorHits = [
      { chunkId: 'a', score: 0.9 },
      { chunkId: 'b', score: 0.8 },
    ];
    const result = await expandResults(env, vectorHits);
    expect(result).toHaveLength(2);
    expect(result[0].source).toBe('vector');
    expect(result[0].chunkId).toBe('a');
  });

  it('expands with 1-hop neighbors', async () => {
    const env = buildMockDB(
      [
        { source: 'a', target: 'neighbor1', type: 'imports', weight: 1.0 },
        { source: 'a', target: 'neighbor2', type: 'calls', weight: 0.8 },
      ],
      {},
    );
    const vectorHits = [{ chunkId: 'a', score: 0.9 }];
    const result = await expandResults(env, vectorHits);

    // Should include original + 2 neighbors
    expect(result.length).toBeGreaterThanOrEqual(3);
    const sources = result.map((r) => r.source);
    expect(sources).toContain('1-hop');
  });

  it('expands with community members', async () => {
    const env = buildMockDB(
      [],
      { a: ['member1', 'member2', 'member3'] },
    );
    const vectorHits = [{ chunkId: 'a', score: 0.9 }];
    const result = await expandResults(env, vectorHits);

    // Should include original + 3 community members
    expect(result.length).toBe(4);
    const communityResults = result.filter((r) => r.source === 'community');
    expect(communityResults).toHaveLength(3);
  });

  it('vector hits score higher than expanded chunks', async () => {
    const env = buildMockDB(
      [{ source: 'a', target: 'neighbor', type: 'calls', weight: 1.0 }],
      { a: ['community1'] },
    );
    const vectorHits = [{ chunkId: 'a', score: 0.9 }];
    const result = await expandResults(env, vectorHits);

    // 'a' (vector) should be ranked first
    expect(result[0].chunkId).toBe('a');
    expect(result[0].source).toBe('vector');
  });

  it('respects topN limit', async () => {
    const env = buildMockDB(
      [],
      { a: Array.from({ length: 50 }, (_, i) => `m${i}`) },
    );
    const vectorHits = [{ chunkId: 'a', score: 0.9 }];
    const result = await expandResults(env, vectorHits, 5);

    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('dedupes chunks that appear in multiple expansion sources', async () => {
    const env = buildMockDB(
      [{ source: 'a', target: 'shared', type: 'calls', weight: 1.0 }],
      { a: ['shared'] }, // same chunk in community
    );
    const vectorHits = [{ chunkId: 'a', score: 0.9 }];
    const result = await expandResults(env, vectorHits);

    const sharedCount = result.filter((r) => r.chunkId === 'shared').length;
    expect(sharedCount).toBe(1);
  });

  it('handles empty vector hits', async () => {
    const env = buildMockDB();
    const result = await expandResults(env, []);
    expect(result).toEqual([]);
  });
});
