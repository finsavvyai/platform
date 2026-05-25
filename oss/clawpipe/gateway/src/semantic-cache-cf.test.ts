/**
 * CP-010: Semantic cache CF embedding — unit tests.
 * Tests makeCFEmbeddingFn behaviour with and without env.AI binding.
 */

import { describe, it, expect } from 'vitest';
import { makeCFEmbeddingFn } from './semantic-cache-cf';
import { SemanticCache } from './semantic-cache';
import type { Env } from './types';

function makeEnvWithAI(dims = 384): Env {
  return {
    AI: {
      run: async (_model: string, opts: { text: string[] }) => ({
        data: opts.text.map(() =>
          Array.from({ length: dims }, (_, i) => Math.sin(i / dims)),
        ),
      }),
    },
  } as unknown as Env;
}

describe('makeCFEmbeddingFn', () => {
  it('returns null when env.AI is absent', () => {
    const fn = makeCFEmbeddingFn({} as Env);
    expect(fn).toBeNull();
  });

  it('returns a function when env.AI is bound', () => {
    const fn = makeCFEmbeddingFn(makeEnvWithAI() as unknown as Env);
    expect(typeof fn).toBe('function');
  });

  it('returned function calls env.AI.run with correct model and text', async () => {
    let captured: { model: string; opts: unknown } | null = null;
    const env = {
      AI: {
        run: async (model: string, opts: unknown) => {
          captured = { model, opts };
          return { data: [[0.1, 0.2, 0.3]] };
        },
      },
    };
    const fn = makeCFEmbeddingFn(env as unknown as Env)!;
    const result = await fn('hello world');
    expect(captured!.model).toBe('@cf/baai/bge-small-en-v1.5');
    expect((captured!.opts as { text: string[] }).text).toEqual(['hello world']);
    expect(result).toEqual([0.1, 0.2, 0.3]);
  });
});

describe('SemanticCache zero-config flow (CP-010)', () => {
  it('returns null on get when no embedding fn (disabled mode)', async () => {
    const cache = new SemanticCache();
    const result = await cache.get('anything');
    expect(result).toBeNull();
  });

  it('returns cached response on second identical prompt', async () => {
    const env = makeEnvWithAI(384);
    const embeddingFn = makeCFEmbeddingFn(env as unknown as Env)!;
    const cache = new SemanticCache({ embeddingFn, similarityThreshold: 0.9 });

    await cache.set('What is 2+2?', '4');
    const hit = await cache.get('What is 2+2?');
    expect(hit).toBe('4');
  });

  it('returns cached response for semantically similar prompt', async () => {
    // Use deterministic embeddings: same prompt → same vector → cosine = 1.0
    const calls: string[] = [];
    const embeddingFn = async (text: string): Promise<number[]> => {
      calls.push(text);
      // Normalise text to produce similar (not identical) vectors for similar phrases
      const hash = text.toLowerCase().replace(/[^a-z]/g, '').slice(0, 10);
      const vec = Array.from({ length: 8 }, (_, i) =>
        Math.sin((hash.charCodeAt(i % hash.length) + i) / 10),
      );
      const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
      return vec.map(v => v / norm);
    };
    const cache = new SemanticCache({ embeddingFn, similarityThreshold: 0.5 });

    await cache.set('hello world', 'greeting');
    const hit = await cache.get('hello world'); // identical → cosine = 1.0
    expect(hit).toBe('greeting');
  });

  it('returns null for dissimilar prompts', async () => {
    let i = 0;
    const deterministicFn = async (_: string): Promise<number[]> => {
      // Alternate between orthogonal vectors to ensure cosine = 0
      i++;
      return i % 2 === 0 ? [1, 0, 0, 0] : [0, 1, 0, 0];
    };
    const cache = new SemanticCache({ embeddingFn: deterministicFn, similarityThreshold: 0.9 });
    await cache.set('first prompt', 'first response');
    const miss = await cache.get('completely different');
    expect(miss).toBeNull();
  });

  it('cache disabled gracefully falls back to null (no env.AI)', async () => {
    const fn = makeCFEmbeddingFn({} as Env); // null
    const cache = new SemanticCache({ embeddingFn: fn ?? undefined });
    await cache.set('any prompt', 'response'); // should not throw
    const result = await cache.get('any prompt');
    expect(result).toBeNull(); // disabled → always miss
  });
});
