/**
 * Hybrid Search Service — sparse + dense fusion via Reciprocal Rank Fusion
 *
 * Combines Cloudflare Vectorize (dense/semantic) with D1 FTS5 (sparse/keyword)
 * for higher-quality search results than either method alone.
 */

import type { Env } from '../worker';

export interface SearchResult {
  id: string;
  text: string;
  score: number;
  source: 'dense' | 'sparse' | 'fused';
  metadata: Record<string, string>;
}

/**
 * Dense search via Cloudflare Vectorize (semantic embeddings).
 * Uses the AI binding to generate query embeddings, then queries Vectorize.
 */
async function denseSearch(
  env: Env, query: string, topK: number,
): Promise<SearchResult[]> {
  if (!env.AI || !env.VECTORIZE) return [];

  try {
    const embeddingResponse = await env.AI.run(
      '@cf/baai/bge-base-en-v1.5',
      { text: [query] },
    );
    const queryVector = embeddingResponse?.data?.[0];
    if (!queryVector) return [];

    const vectorResults = await env.VECTORIZE.query(queryVector, {
      topK,
      returnMetadata: true,
    });

    return (vectorResults.matches ?? []).map((match: {
      id: string; score: number; metadata?: Record<string, string>;
    }) => ({
      id: match.id,
      text: match.metadata?.content ?? '',
      score: match.score,
      source: 'dense' as const,
      metadata: match.metadata ?? {},
    }));
  } catch (err) {
    console.error('[hybrid-search] Dense search failed:', err);
    return [];
  }
}

/**
 * Sparse search via D1 FTS5 (keyword matching with Porter stemming).
 * Queries the docs_fts virtual table created in migration 019.
 */
async function sparseSearch(
  env: Env, query: string, topK: number,
): Promise<SearchResult[]> {
  try {
    const sanitized = sanitizeFtsQuery(query);
    if (!sanitized) return [];

    const result = await env.DB.prepare(
      `SELECT doc_id, content, source, section, rank
       FROM docs_fts
       WHERE docs_fts MATCH ?
       ORDER BY rank
       LIMIT ?`,
    ).bind(sanitized, topK).all<{
      doc_id: string; content: string; source: string;
      section: string; rank: number;
    }>();

    return (result.results ?? []).map((row) => ({
      id: row.doc_id,
      text: row.content,
      score: normalizeRank(row.rank),
      source: 'sparse' as const,
      metadata: { source: row.source, section: row.section },
    }));
  } catch (err) {
    console.error('[hybrid-search] Sparse search failed:', err);
    return [];
  }
}

/**
 * Reciprocal Rank Fusion — merges ranked lists from dense + sparse search.
 *
 * RRF score for a document = sum(1 / (k + rank_i)) across all lists.
 * k=60 is the standard constant from the original RRF paper.
 */
function reciprocalRankFusion(
  dense: SearchResult[], sparse: SearchResult[], topK: number, k = 60,
): SearchResult[] {
  const scores = new Map<string, { score: number; result: SearchResult }>();

  const addScores = (results: SearchResult[]) => {
    results.forEach((result, index) => {
      const rank = index + 1;
      const rrfScore = 1 / (k + rank);
      const existing = scores.get(result.id);

      if (existing) {
        existing.score += rrfScore;
        existing.result = { ...existing.result, source: 'fused', score: existing.score };
      } else {
        scores.set(result.id, { score: rrfScore, result: { ...result, score: rrfScore } });
      }
    });
  };

  addScores(dense);
  addScores(sparse);

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ result, score }) => ({ ...result, score }));
}

/**
 * Hybrid search — runs dense + sparse in parallel, fuses with RRF.
 */
export async function hybridSearch(
  env: Env, query: string, topK = 10,
): Promise<SearchResult[]> {
  const [dense, sparse] = await Promise.all([
    denseSearch(env, query, topK * 2),
    sparseSearch(env, query, topK * 2),
  ]);

  if (dense.length === 0 && sparse.length === 0) return [];
  if (dense.length === 0) return sparse.slice(0, topK);
  if (sparse.length === 0) return dense.slice(0, topK);

  return reciprocalRankFusion(dense, sparse, topK);
}

/**
 * Index a document into the FTS5 sparse search table.
 */
export async function indexForSparseSearch(
  db: D1Database, docId: string, content: string,
  source: string, section: string,
): Promise<void> {
  await db.prepare(
    `INSERT OR REPLACE INTO docs_fts (doc_id, content, source, section)
     VALUES (?, ?, ?, ?)`,
  ).bind(docId, content, source, section).run();
}

/** Sanitize user input for FTS5 MATCH queries */
function sanitizeFtsQuery(query: string): string {
  return query.replace(/[^\w\s]/g, ' ').trim().split(/\s+/).filter(Boolean).join(' ');
}

/** Normalize FTS5 rank (negative, lower=better) to 0-1 score (higher=better) */
function normalizeRank(rank: number): number {
  return 1 / (1 + Math.abs(rank));
}
