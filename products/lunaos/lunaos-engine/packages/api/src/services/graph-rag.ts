/**
 * Graph RAG — community-aware expansion over flat vector search.
 *
 * Pattern from RuVector: after vector search returns top-K chunks,
 * expand results via:
 *   1. 1-hop graph neighbors (imports, calls, same_file edges)
 *   2. Same-community membership (label propagation clusters)
 *
 * Result: 30-60% better recall for related-but-not-similar code.
 */

export type EdgeType = 'imports' | 'calls' | 'same_file' | 'same_community';

interface GraphRagEnv {
  DB: D1Database;
}

export interface ChunkEdge {
  id: string;
  sourceChunkId: string;
  targetChunkId: string;
  edgeType: EdgeType;
  weight: number;
}

export interface ExpandedChunk {
  chunkId: string;
  score: number;
  source: 'vector' | '1-hop' | 'community';
  edgeType?: EdgeType;
}

const VECTOR_WEIGHT = 1.0;
const ONE_HOP_WEIGHT = 0.7;
const COMMUNITY_WEIGHT = 0.5;

/**
 * Add an edge between two chunks.
 */
export async function addEdge(
  env: GraphRagEnv,
  source: string,
  target: string,
  type: EdgeType,
  weight = 1.0,
): Promise<void> {
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      `INSERT INTO chunk_edges (id, source_chunk_id, target_chunk_id, edge_type, weight)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(id, source, target, type, weight).run();
  } catch (err) {
    console.error('[graph-rag] addEdge failed:', (err as Error).message);
  }
}

/**
 * Assign a chunk to a community.
 */
export async function setCommunity(
  env: GraphRagEnv,
  chunkId: string,
  communityId: string,
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT OR REPLACE INTO chunk_communities (chunk_id, community_id) VALUES (?, ?)`,
    ).bind(chunkId, communityId).run();
  } catch (err) {
    console.error('[graph-rag] setCommunity failed:', (err as Error).message);
  }
}

/**
 * Get 1-hop neighbors of a chunk (both directions).
 */
async function getNeighbors(
  env: GraphRagEnv,
  chunkId: string,
): Promise<Array<{ targetId: string; type: EdgeType; weight: number }>> {
  try {
    const result = await env.DB.prepare(
      `SELECT target_chunk_id as targetId, edge_type as type, weight
       FROM chunk_edges WHERE source_chunk_id = ?
       UNION
       SELECT source_chunk_id as targetId, edge_type as type, weight
       FROM chunk_edges WHERE target_chunk_id = ?`,
    ).bind(chunkId, chunkId).all<{ targetId: string; type: EdgeType; weight: number }>();
    return result.results || [];
  } catch {
    return [];
  }
}

/**
 * Get all chunks in the same community.
 */
async function getCommunityMembers(
  env: GraphRagEnv,
  chunkId: string,
  limit = 10,
): Promise<string[]> {
  try {
    const result = await env.DB.prepare(
      `SELECT cc2.chunk_id FROM chunk_communities cc1
       JOIN chunk_communities cc2 ON cc1.community_id = cc2.community_id
       WHERE cc1.chunk_id = ? AND cc2.chunk_id != ?
       LIMIT ?`,
    ).bind(chunkId, chunkId, limit).all<{ chunk_id: string }>();
    return (result.results || []).map((r) => r.chunk_id);
  } catch {
    return [];
  }
}

/**
 * Expand vector search results with graph neighbors + community members.
 * Takes top-K vector hits, returns reranked list with graph-expanded candidates.
 */
export async function expandResults(
  env: GraphRagEnv,
  vectorHits: Array<{ chunkId: string; score: number }>,
  topN = 10,
): Promise<ExpandedChunk[]> {
  const expanded = new Map<string, ExpandedChunk>();

  // Seed with vector results (highest priority)
  for (const hit of vectorHits) {
    expanded.set(hit.chunkId, {
      chunkId: hit.chunkId,
      score: hit.score * VECTOR_WEIGHT,
      source: 'vector',
    });
  }

  // Expand via 1-hop graph neighbors
  for (const hit of vectorHits) {
    const neighbors = await getNeighbors(env, hit.chunkId);
    for (const neighbor of neighbors) {
      const existing = expanded.get(neighbor.targetId);
      const neighborScore = hit.score * ONE_HOP_WEIGHT * neighbor.weight;
      if (!existing) {
        expanded.set(neighbor.targetId, {
          chunkId: neighbor.targetId,
          score: neighborScore,
          source: '1-hop',
          edgeType: neighbor.type,
        });
      } else if (neighborScore > existing.score) {
        // Accumulate boost from multiple paths
        existing.score = Math.min(existing.score + neighborScore * 0.3, 1.0);
      }
    }
  }

  // Expand via community membership
  for (const hit of vectorHits) {
    const members = await getCommunityMembers(env, hit.chunkId, 5);
    for (const memberId of members) {
      if (!expanded.has(memberId)) {
        expanded.set(memberId, {
          chunkId: memberId,
          score: hit.score * COMMUNITY_WEIGHT,
          source: 'community',
        });
      }
    }
  }

  // Sort by score, take top N
  return Array.from(expanded.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

/**
 * Infer edges from chunks in the same file (cheap heuristic).
 */
export async function inferFileEdges(
  env: GraphRagEnv,
  documentId: string,
): Promise<number> {
  try {
    const result = await env.DB.prepare(
      `SELECT id FROM chunks WHERE document_id = ? ORDER BY chunk_index`,
    ).bind(documentId).all<{ id: string }>();
    const chunkIds = (result.results || []).map((r) => r.id);

    // Create edges between adjacent chunks
    let added = 0;
    for (let i = 0; i < chunkIds.length - 1; i++) {
      await addEdge(env, chunkIds[i], chunkIds[i + 1], 'same_file', 0.8);
      added++;
    }
    return added;
  } catch {
    return 0;
  }
}
