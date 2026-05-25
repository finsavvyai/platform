/**
 * RAG Index & Search Integration Tests
 *
 * Tests the RAG indexing and search endpoints.
 * Since Vectorize and AI bindings are not available in miniflare,
 * we test validation, error handling, and route accessibility.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestContext,
  type TestContext,
} from '../setup';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.dispose();
});

describe('POST /rag/index — document indexing', () => {
  it('rejects empty files array', async () => {
    const res = await ctx.makeRequest('/rag/index', {
      auth: 'none',
      method: 'POST',
      body: JSON.stringify({ files: [] }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects files with missing path', async () => {
    const res = await ctx.makeRequest('/rag/index', {
      auth: 'none',
      method: 'POST',
      body: JSON.stringify({
        files: [{ content: 'function hello() {}' }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects files with missing content', async () => {
    const res = await ctx.makeRequest('/rag/index', {
      auth: 'none',
      method: 'POST',
      body: JSON.stringify({
        files: [{ path: 'src/test.ts' }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('accepts valid index request (may fail at vectorize)', async () => {
    const res = await ctx.makeRequest('/rag/index', {
      auth: 'none',
      method: 'POST',
      body: JSON.stringify({
        files: [
          { path: 'src/hello.ts', content: 'export function hello() {}' },
        ],
        repoName: 'test-repo',
      }),
    });

    // Should pass validation (200 or 500 if vectorize unavailable)
    expect([200, 500]).toContain(res.status);
  });
});

describe('GET /rag/search — semantic search', () => {
  it('rejects search without query parameter', async () => {
    const res = await ctx.makeRequest('/rag/search', { auth: 'none' });
    expect(res.status).toBe(400);
  });

  it('accepts valid search query (may fail at vectorize)', async () => {
    const res = await ctx.makeRequest('/rag/search?q=hello+function', {
      auth: 'none',
    });

    // Should pass validation (200 or 500 if vectorize unavailable)
    expect([200, 500]).toContain(res.status);
  });
});

describe('POST /rag/memories — agent memory storage', () => {
  it('rejects memory without agentId', async () => {
    const res = await ctx.makeRequest('/rag/memories', {
      auth: 'none',
      method: 'POST',
      body: JSON.stringify({ content: 'some memory' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects memory without content', async () => {
    const res = await ctx.makeRequest('/rag/memories', {
      auth: 'none',
      method: 'POST',
      body: JSON.stringify({ agentId: 'test-agent' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /rag/memories — memory retrieval', () => {
  it('rejects search without query parameter', async () => {
    const res = await ctx.makeRequest('/rag/memories', { auth: 'none' });
    expect(res.status).toBe(400);
  });
});

describe('GET /rag/analytics — search performance', () => {
  it('returns analytics or error', async () => {
    const res = await ctx.makeRequest('/rag/analytics', { auth: 'none' });
    // May succeed or fail depending on env
    expect([200, 500]).toContain(res.status);
  });
});
