/**
 * Vector Search Service
 *
 * Provides semantic search over skills and security findings using
 * Cloudflare Vectorize + AI embeddings (bge-base-en-v1.5).
 *
 * Supports: skill discovery, similar-finding clustering, NL queries.
 * Uses KV-backed embedding cache to reduce duplicate AI calls.
 */

import { getCachedEmbedding, setCachedEmbedding } from './embedding-cache.js';

const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';
const NAMESPACE_SKILLS = 'skills';
const NAMESPACE_FINDINGS = 'findings';
const TOP_K_DEFAULT = 10;

export interface VectorSearchResult {
  id: string;
  score: number;
  namespace: string;
  metadata: Record<string, string>;
}

export interface VectorSearchOptions {
  namespace?: string;
  topK?: number;
  filter?: Record<string, string>;
}

/**
 * Generate embedding vector from text using Cloudflare AI.
 * Optionally uses KV cache to skip duplicate AI calls.
 */
export async function generateEmbedding(
  ai: Ai,
  text: string,
  cache?: KVNamespace,
): Promise<number[]> {
  if (cache) {
    const cached = await getCachedEmbedding(cache, text);
    if (cached) return cached;
  }

  const result = await ai.run(EMBEDDING_MODEL, { text: [text] });
  const output = result as Record<string, unknown>;
  const data = output?.data;
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error('Unexpected embedding response shape');
  }
  const embedding = data[0] as number[];

  if (cache) {
    await setCachedEmbedding(cache, text, embedding);
  }

  return embedding;
}

/**
 * Search for similar items by text query.
 */
export async function semanticSearch(
  ai: Ai,
  vectorize: VectorizeIndex,
  query: string,
  options: VectorSearchOptions = {},
  cache?: KVNamespace,
): Promise<VectorSearchResult[]> {
  const embedding = await generateEmbedding(ai, query, cache);
  const {
    namespace = NAMESPACE_SKILLS,
    topK = TOP_K_DEFAULT,
    filter,
  } = options;

  const results = await vectorize.query(embedding, {
    topK,
    namespace,
    filter,
    returnMetadata: 'all',
  });

  return results.matches.map((match) => ({
    id: match.id,
    score: match.score,
    namespace,
    metadata: (match.metadata ?? {}) as Record<string, string>,
  }));
}

/**
 * Index a skill into the vector store.
 */
export async function indexSkill(
  ai: Ai,
  vectorize: VectorizeIndex,
  skill: { id: string; name: string; description: string; category: string; tags?: string },
): Promise<void> {
  const text = `${skill.name}: ${skill.description}. Category: ${skill.category}. ${skill.tags ?? ''}`;
  const embedding = await generateEmbedding(ai, text);

  await vectorize.upsert([
    {
      id: skill.id,
      values: embedding,
      namespace: NAMESPACE_SKILLS,
      metadata: {
        name: skill.name,
        category: skill.category,
        description: skill.description.slice(0, 200),
      },
    },
  ]);
}

/**
 * Index a security finding for similarity search.
 */
export async function indexFinding(
  ai: Ai,
  vectorize: VectorizeIndex,
  finding: { id: string; title: string; description: string; severity: string },
): Promise<void> {
  const text = `${finding.title}: ${finding.description}. Severity: ${finding.severity}`;
  const embedding = await generateEmbedding(ai, text);

  await vectorize.upsert([
    {
      id: finding.id,
      values: embedding,
      namespace: NAMESPACE_FINDINGS,
      metadata: {
        title: finding.title,
        severity: finding.severity,
        description: finding.description.slice(0, 200),
      },
    },
  ]);
}

/**
 * Remove an item from the vector index.
 */
export async function removeFromIndex(
  vectorize: VectorizeIndex,
  ids: string[],
): Promise<void> {
  await vectorize.deleteByIds(ids);
}
