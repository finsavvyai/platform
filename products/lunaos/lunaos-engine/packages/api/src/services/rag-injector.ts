/**
 * RAG Context Injector — enriches agent prompts with codebase context
 * Uses Cloudflare AI embeddings + Vectorize for semantic search
 */

import type { Env } from '../worker';

export interface RAGResult {
  ragSourceCount: number;
  enrichedPrompt: string;
  searchTimeMs: number;
}

const MAX_RAG_CHARS = 4000;

export async function injectRAGContext(
  env: Env,
  systemPrompt: string,
  context: string,
): Promise<RAGResult> {
  const ragStart = Date.now();
  let ragSourceCount = 0;

  if (!env.AI || !env.VECTORIZE) {
    return { ragSourceCount: 0, enrichedPrompt: systemPrompt, searchTimeMs: 0 };
  }

  try {
    const embeddingResult = await env.AI.run(
      '@cf/baai/bge-base-en-v1.5',
      { text: [context.substring(0, 512)] },
    );

    const queryVector = embeddingResult?.data?.[0];
    if (!queryVector || queryVector.length === 0) {
      return { ragSourceCount: 0, enrichedPrompt: systemPrompt, searchTimeMs: Date.now() - ragStart };
    }

    const searchResult = await env.VECTORIZE.query(queryVector, {
      topK: 5,
      returnValues: false,
      returnMetadata: true,
    });

    if (!searchResult?.matches?.length) {
      return { ragSourceCount: 0, enrichedPrompt: systemPrompt, searchTimeMs: Date.now() - ragStart };
    }

    const chunkIds = searchResult.matches.map((m: any) => `'${m.id}'`).join(',');
    const chunks = await env.DB.prepare(
      `SELECT id, content, metadata FROM chunks WHERE id IN (${chunkIds})`,
    ).all();

    const contentMap = new Map<string, any>();
    (chunks.results || []).forEach((row: any) => contentMap.set(row.id, row));

    const ragChunks: string[] = [];
    let totalLen = 0;

    for (const match of searchResult.matches) {
      if (totalLen >= MAX_RAG_CHARS) break;
      const row = contentMap.get(match.id);
      if (!row?.content) continue;

      let meta: any = {};
      try { meta = JSON.parse(row.metadata || '{}'); } catch { /* ok */ }

      const source = meta?.source || meta?.path || match.id;
      const snippet = row.content.substring(0, MAX_RAG_CHARS - totalLen);
      ragChunks.push(`--- ${source} (score: ${match.score.toFixed(3)}) ---\n${snippet}`);
      totalLen += snippet.length;
      ragSourceCount++;
    }

    let enrichedPrompt = systemPrompt;
    if (ragChunks.length > 0) {
      enrichedPrompt += `\n\n## Relevant Codebase Context\n${ragChunks.join('\n\n')}\n\nUse this context to provide more accurate, codebase-aware analysis.`;
    }

    return {
      ragSourceCount,
      enrichedPrompt,
      searchTimeMs: Date.now() - ragStart,
    };
  } catch (err) {
    console.error('RAG context injection failed:', err);
    return { ragSourceCount: 0, enrichedPrompt: systemPrompt, searchTimeMs: Date.now() - ragStart };
  }
}
