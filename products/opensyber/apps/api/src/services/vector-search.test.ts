/**
 * Vector Search Service Tests
 */
import { describe, it, expect, vi } from 'vitest';
import {
  generateEmbedding,
  semanticSearch,
  indexSkill,
  indexFinding,
  removeFromIndex,
} from './vector-search.js';

const FAKE_EMBEDDING = [0.1, 0.2, 0.3, 0.4];

function mockAi(embedding: number[] = FAKE_EMBEDDING): Ai {
  return { run: vi.fn().mockResolvedValue({ data: [embedding] }) } as unknown as Ai;
}

function mockVectorize(matches: VectorizeMatch[] = []): VectorizeIndex {
  return {
    query: vi.fn().mockResolvedValue({ matches }),
    upsert: vi.fn().mockResolvedValue(undefined),
    deleteByIds: vi.fn().mockResolvedValue(undefined),
  } as unknown as VectorizeIndex;
}

describe('generateEmbedding', () => {
  it('calls ai.run with the embedding model and returns first vector', async () => {
    const ai = mockAi();
    const result = await generateEmbedding(ai, 'hello world');
    expect(ai.run).toHaveBeenCalledWith('@cf/baai/bge-base-en-v1.5', { text: ['hello world'] });
    expect(result).toEqual(FAKE_EMBEDDING);
  });

  it('throws when response has no data field', async () => {
    const ai = { run: vi.fn().mockResolvedValue({}) } as unknown as Ai;
    await expect(generateEmbedding(ai, 'x')).rejects.toThrow('Unexpected embedding response shape');
  });

  it('throws when data is not an array', async () => {
    const ai = { run: vi.fn().mockResolvedValue({ data: 'bad' }) } as unknown as Ai;
    await expect(generateEmbedding(ai, 'x')).rejects.toThrow('Unexpected embedding response shape');
  });

  it('throws when first element of data is not an array', async () => {
    const ai = { run: vi.fn().mockResolvedValue({ data: [42] }) } as unknown as Ai;
    await expect(generateEmbedding(ai, 'x')).rejects.toThrow('Unexpected embedding response shape');
  });
});

describe('semanticSearch', () => {
  it('returns mapped results with id, score, namespace, and metadata', async () => {
    const matches = [{ id: 'skill-1', score: 0.95, metadata: { name: 'Recon' } }] as VectorizeMatch[];
    const results = await semanticSearch(mockAi(), mockVectorize(matches), 'recon');
    expect(results[0]).toEqual({ id: 'skill-1', score: 0.95, namespace: 'skills', metadata: { name: 'Recon' } });
  });

  it('uses default namespace "skills" and topK 10', async () => {
    const vectorize = mockVectorize();
    await semanticSearch(mockAi(), vectorize, 'query');
    expect(vectorize.query).toHaveBeenCalledWith(
      FAKE_EMBEDDING,
      expect.objectContaining({ namespace: 'skills', topK: 10 }),
    );
  });

  it('respects custom namespace, topK, and filter options', async () => {
    const vectorize = mockVectorize();
    const filter = { category: 'network' };
    await semanticSearch(mockAi(), vectorize, 'query', { namespace: 'findings', topK: 5, filter });
    expect(vectorize.query).toHaveBeenCalledWith(
      FAKE_EMBEDDING,
      expect.objectContaining({ namespace: 'findings', topK: 5, filter }),
    );
  });

  it('returns empty array when no matches and handles missing metadata', async () => {
    expect(await semanticSearch(mockAi(), mockVectorize([]), 'q')).toEqual([]);

    const noMeta = [{ id: 'x', score: 0.5 }] as VectorizeMatch[];
    const results = await semanticSearch(mockAi(), mockVectorize(noMeta), 'q');
    expect(results[0]!.metadata).toEqual({});
  });
});

describe('indexSkill', () => {
  it('upserts with namespace "skills" and truncated description', async () => {
    const vectorize = mockVectorize();
    const skill = {
      id: 'skill-abc', name: 'Threat Intel',
      description: 'A'.repeat(300), category: 'intelligence', tags: 'cve',
    };

    await indexSkill(mockAi(), vectorize, skill);

    const upserted = (vectorize.upsert as ReturnType<typeof vi.fn>).mock.calls[0]![0]![0]!;
    expect(upserted.id).toBe('skill-abc');
    expect(upserted.namespace).toBe('skills');
    expect((upserted.metadata as Record<string, string>)['description']!.length).toBe(200);
  });

  it('handles missing tags without error', async () => {
    await expect(indexSkill(mockAi(), mockVectorize(), {
      id: 's', name: 'n', description: 'd', category: 'c',
    })).resolves.toBeUndefined();
  });
});

describe('indexFinding', () => {
  it('upserts with namespace "findings", correct metadata, and combined text', async () => {
    const ai = mockAi();
    const vectorize = mockVectorize();
    await indexFinding(ai, vectorize, {
      id: 'f1', title: 'Open Port', description: 'Port 22 exposed', severity: 'critical',
    });

    const upserted = (vectorize.upsert as ReturnType<typeof vi.fn>).mock.calls[0]![0]![0]!;
    expect(upserted.namespace).toBe('findings');
    expect((upserted.metadata as Record<string, string>)['severity']).toBe('critical');

    const textArg = ((ai.run as ReturnType<typeof vi.fn>).mock.calls[0]![1] as { text: string[] }).text[0]!;
    expect(textArg).toContain('Open Port');
    expect(textArg).toContain('Port 22 exposed');
    expect(textArg).toContain('critical');
  });
});

describe('removeFromIndex', () => {
  it('calls vectorize.deleteByIds with provided ids', async () => {
    const vectorize = mockVectorize();
    await removeFromIndex(vectorize, ['id-1', 'id-2']);
    expect(vectorize.deleteByIds).toHaveBeenCalledWith(['id-1', 'id-2']);
  });

  it('accepts an empty array without error', async () => {
    const vectorize = mockVectorize();
    await expect(removeFromIndex(vectorize, [])).resolves.toBeUndefined();
    expect(vectorize.deleteByIds).toHaveBeenCalledWith([]);
  });
});
