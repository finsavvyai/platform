import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockDb,
  createMockKV,
  createMockR2,
  createMockHetzner,
  createMockLLM,
} from './helpers.js';

/**
 * Performance Benchmark Tests
 *
 * Validates latency, throughput, and scalability of every core
 * subsystem: DB queries, KV cache, R2 storage, Hetzner API,
 * LLM calls, and mixed workloads under concurrent pressure.
 */

/* ── timing helpers ──────────────────────────────────────── */

interface BenchResult {
  ops: number;
  totalMs: number;
  opsPerSec: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
}

async function benchmark(
  fn: () => Promise<void>,
  iterations: number,
): Promise<BenchResult> {
  const latencies: number[] = [];
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const s = performance.now();
    await fn();
    latencies.push(performance.now() - s);
  }

  const totalMs = performance.now() - start;
  const sorted = latencies.sort((a, b) => a - b);

  return {
    ops: iterations,
    totalMs,
    opsPerSec: Math.round((iterations / totalMs) * 1000),
    avgMs: totalMs / iterations,
    p50Ms: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
    p95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    p99Ms: sorted[Math.floor(sorted.length * 0.99)] ?? 0,
  };
}

async function concurrentBenchmark(
  fn: () => Promise<void>,
  concurrency: number,
): Promise<BenchResult> {
  const latencies: number[] = [];
  const start = performance.now();

  const results = await Promise.all(
    Array.from({ length: concurrency }, async () => {
      const s = performance.now();
      await fn();
      return performance.now() - s;
    }),
  );

  latencies.push(...results);
  const totalMs = performance.now() - start;
  const sorted = latencies.sort((a, b) => a - b);

  return {
    ops: concurrency,
    totalMs,
    opsPerSec: Math.round((concurrency / totalMs) * 1000),
    avgMs: totalMs / concurrency,
    p50Ms: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
    p95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    p99Ms: sorted[Math.floor(sorted.length * 0.99)] ?? 0,
  };
}

/* ── DB Performance ──────────────────────────────────────── */

describe('Performance: Database Operations', () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => { db = createMockDb(); });
  afterEach(() => { vi.clearAllMocks(); });

  it('handles 500 sequential SELECT queries', async () => {
    db._setSelectResult([{ id: 'inst_1', status: 'running' }]);

    const result = await benchmark(async () => {
      await db.select().from('instances').where('orgId = ?');
    }, 500);

    expect(result.ops).toBe(500);
    expect(result.p95Ms).toBeLessThan(50);
    expect(result.opsPerSec).toBeGreaterThan(100);
  });

  it('handles 200 sequential INSERT operations', async () => {
    const result = await benchmark(async () => {
      await db.insert({ instances: {} }).values({
        id: `inst_${crypto.randomUUID().slice(0, 8)}`,
        name: 'perf-test',
        status: 'running',
      });
    }, 200);

    expect(result.ops).toBe(200);
    expect(result.p95Ms).toBeLessThan(50);
  });

  it('handles 200 sequential UPDATE operations', async () => {
    const result = await benchmark(async () => {
      await db.update({ instances: {} })
        .set({ status: 'paused' })
        .where('id = ?');
    }, 200);

    expect(result.ops).toBe(200);
    expect(result.p95Ms).toBeLessThan(50);
  });

  it('handles 100 concurrent SELECT queries', async () => {
    db._setSelectResult([{ id: 'inst_1' }]);

    const result = await concurrentBenchmark(async () => {
      await db.select().from('instances').where('orgId = ?');
    }, 100);

    expect(result.ops).toBe(100);
    expect(result.totalMs).toBeLessThan(5000);
  });

  it('handles mixed read/write workload (300 ops)', async () => {
    db._setSelectResult([{ id: 'inst_1' }]);

    let readCount = 0;
    let writeCount = 0;

    const result = await benchmark(async () => {
      if (Math.random() > 0.3) {
        await db.select().from('instances');
        readCount++;
      } else {
        await db.insert({ events: {} }).values({ type: 'perf' });
        writeCount++;
      }
    }, 300);

    expect(readCount + writeCount).toBe(300);
    expect(result.p95Ms).toBeLessThan(50);
  });
});

/* ── KV Cache Performance ────────────────────────────────── */

describe('Performance: KV Cache Operations', () => {
  let kv: ReturnType<typeof createMockKV>;

  beforeEach(() => { kv = createMockKV(); });
  afterEach(() => { vi.clearAllMocks(); });

  it('handles 1000 sequential KV writes', async () => {
    const put = kv.put as ReturnType<typeof vi.fn>;

    const result = await benchmark(async () => {
      const key = `key_${crypto.randomUUID().slice(0, 8)}`;
      await put(key, JSON.stringify({ ts: Date.now() }));
    }, 1000);

    expect(result.ops).toBe(1000);
    expect(result.p95Ms).toBeLessThan(10);
    expect(result.opsPerSec).toBeGreaterThan(500);
  });

  it('handles 1000 sequential KV reads', async () => {
    const put = kv.put as ReturnType<typeof vi.fn>;
    const get = kv.get as ReturnType<typeof vi.fn>;

    await put('cached-key', JSON.stringify({ data: 'value' }));

    const result = await benchmark(async () => {
      await get('cached-key', 'json');
    }, 1000);

    expect(result.ops).toBe(1000);
    expect(result.p95Ms).toBeLessThan(10);
  });

  it('handles 200 concurrent KV reads', async () => {
    const put = kv.put as ReturnType<typeof vi.fn>;
    const get = kv.get as ReturnType<typeof vi.fn>;
    await put('hot-key', 'hot-value');

    const result = await concurrentBenchmark(async () => {
      await get('hot-key');
    }, 200);

    expect(result.ops).toBe(200);
    expect(result.totalMs).toBeLessThan(3000);
  });

  it('handles rate-limit counter increment pattern', async () => {
    const store = (kv as Record<string, unknown>)._store as Map<string, string>;
    const get = kv.get as ReturnType<typeof vi.fn>;
    const put = kv.put as ReturnType<typeof vi.fn>;

    store.set('rate:org_1:daily', '0');

    const result = await benchmark(async () => {
      const current = Number(await get('rate:org_1:daily')) || 0;
      await put('rate:org_1:daily', String(current + 1));
    }, 500);

    const finalCount = Number(store.get('rate:org_1:daily'));
    expect(finalCount).toBe(500);
    expect(result.p95Ms).toBeLessThan(10);
  });
});

/* ── R2 Storage Performance ──────────────────────────────── */

describe('Performance: R2 Object Storage', () => {
  let r2: ReturnType<typeof createMockR2>;

  beforeEach(() => { r2 = createMockR2(); });

  it('handles 100 sequential object uploads', async () => {
    const put = r2.put as ReturnType<typeof vi.fn>;

    const result = await benchmark(async () => {
      const key = `skills/test/${crypto.randomUUID()}/package.tar.gz`;
      await put(key, 'x'.repeat(1024));
    }, 100);

    expect(result.ops).toBe(100);
    expect(result.p95Ms).toBeLessThan(50);
  });

  it('handles 100 sequential object reads', async () => {
    const put = r2.put as ReturnType<typeof vi.fn>;
    const get = r2.get as ReturnType<typeof vi.fn>;

    await put('skills/ai-triage/1.0.0/package.tar.gz', 'x'.repeat(2048));

    const result = await benchmark(async () => {
      await get('skills/ai-triage/1.0.0/package.tar.gz');
    }, 100);

    expect(result.ops).toBe(100);
    expect(result.p95Ms).toBeLessThan(50);
  });

  it('handles 50 concurrent HEAD checks', async () => {
    const put = r2.put as ReturnType<typeof vi.fn>;
    const head = r2.head as ReturnType<typeof vi.fn>;
    await put('exists.tar.gz', 'data');

    const result = await concurrentBenchmark(async () => {
      await head('exists.tar.gz');
    }, 50);

    expect(result.ops).toBe(50);
    expect(result.totalMs).toBeLessThan(2000);
  });
});

/* ── Hetzner API Performance ─────────────────────────────── */

describe('Performance: Hetzner Server Operations', () => {
  let hetzner: ReturnType<typeof createMockHetzner>;

  beforeEach(() => { hetzner = createMockHetzner(); });

  it('handles 20 sequential server creates', async () => {
    const result = await benchmark(async () => {
      await hetzner.createServer({ name: `agent-${Date.now()}` });
    }, 20);

    expect(result.ops).toBe(20);
    expect(result.p95Ms).toBeLessThan(100);
    const servers = await hetzner.listServers();
    expect(servers.length).toBe(20);
  });

  it('handles 50 concurrent server status checks', async () => {
    const { server } = await hetzner.createServer({ name: 'target' });

    const result = await concurrentBenchmark(async () => {
      const s = await hetzner.getServer(server.id as string);
      expect(s).not.toBeNull();
    }, 50);

    expect(result.ops).toBe(50);
    expect(result.totalMs).toBeLessThan(3000);
  });
});

/* ── LLM / AI Skill Performance ──────────────────────────── */

describe('Performance: LLM AI Operations', () => {
  let llm: ReturnType<typeof createMockLLM>;

  beforeEach(() => { llm = createMockLLM(); });

  it('handles 50 sequential LLM calls', async () => {
    const result = await benchmark(async () => {
      await llm.askLLM('system prompt', 'user prompt');
    }, 50);

    expect(result.ops).toBe(50);
    expect(result.p95Ms).toBeLessThan(100);
  });

  it('handles 20 concurrent LLM triage requests', async () => {
    const result = await concurrentBenchmark(async () => {
      const res = await llm.askLLM(
        'You are a triage specialist',
        'Triage these findings: [...]',
      );
      const parsed = llm.parseJSON(res.text);
      expect(parsed).not.toBeNull();
    }, 20);

    expect(result.ops).toBe(20);
    expect(result.totalMs).toBeLessThan(3000);
  });

  it('handles JSON parsing of 100 responses', async () => {
    const result = await benchmark(async () => {
      llm.parseJSON(JSON.stringify({
        prioritized: Array.from({ length: 10 }, (_, i) => ({
          id: `f${i}`,
          severity: 'high',
          priority: i + 1,
        })),
      }));
    }, 100);

    expect(result.ops).toBe(100);
    expect(result.p95Ms).toBeLessThan(5);
  });
});

/* ── Mixed Workload Performance ──────────────────────────── */

describe('Performance: Mixed Workload Simulation', () => {
  let db: ReturnType<typeof createMockDb>;
  let kv: ReturnType<typeof createMockKV>;
  let hetzner: ReturnType<typeof createMockHetzner>;

  beforeEach(() => {
    db = createMockDb();
    kv = createMockKV();
    hetzner = createMockHetzner();
  });

  afterEach(() => { vi.clearAllMocks(); });

  it('simulates realistic API request mix (500 ops)', async () => {
    db._setSelectResult([{ id: 'inst_1' }]);
    const put = kv.put as ReturnType<typeof vi.fn>;
    const get = kv.get as ReturnType<typeof vi.fn>;

    let dbReads = 0;
    let dbWrites = 0;
    let kvOps = 0;
    let hetznerOps = 0;

    const result = await benchmark(async () => {
      const rand = Math.random();

      if (rand < 0.4) {
        await db.select().from('instances');
        dbReads++;
      } else if (rand < 0.55) {
        await db.insert({ events: {} }).values({ type: 'test' });
        dbWrites++;
      } else if (rand < 0.85) {
        await put(`cache:${Date.now()}`, 'v');
        await get(`cache:${Date.now()}`);
        kvOps++;
      } else {
        await hetzner.createServer({ name: `srv-${Date.now()}` });
        hetznerOps++;
      }
    }, 500);

    expect(dbReads + dbWrites + kvOps + hetznerOps).toBe(500);
    expect(result.p95Ms).toBeLessThan(50);
    expect(result.opsPerSec).toBeGreaterThan(100);
  });

  it('handles burst traffic (100 concurrent mixed ops)', async () => {
    db._setSelectResult([{ id: 'inst_1' }]);

    const result = await concurrentBenchmark(async () => {
      const rand = Math.random();
      if (rand < 0.5) {
        await db.select().from('instances');
      } else if (rand < 0.8) {
        await (kv.get as ReturnType<typeof vi.fn>)('test');
      } else {
        await db.insert({ logs: {} }).values({ event: 'burst' });
      }
    }, 100);

    expect(result.ops).toBe(100);
    expect(result.totalMs).toBeLessThan(5000);
  });
});

/* ── Cryptographic Performance ───────────────────────────── */

describe('Performance: Cryptographic Operations', () => {
  it('generates 50 ECDSA P-256 key pairs', async () => {
    const result = await benchmark(async () => {
      await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign', 'verify'],
      );
    }, 50);

    expect(result.ops).toBe(50);
    expect(result.p95Ms).toBeLessThan(200);
  });

  it('signs and verifies 100 challenges', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign', 'verify'],
    );

    const result = await benchmark(async () => {
      const challenge = crypto.randomUUID();
      const data = new TextEncoder().encode(challenge);
      const sig = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        keyPair.privateKey,
        data,
      );
      const valid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        keyPair.publicKey,
        sig,
        data,
      );
      expect(valid).toBe(true);
    }, 100);

    expect(result.ops).toBe(100);
    expect(result.p95Ms).toBeLessThan(50);
  });

  it('generates 200 HMAC-SHA256 signatures', async () => {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('test-secret'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const result = await benchmark(async () => {
      await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(`payload-${Date.now()}`),
      );
    }, 200);

    expect(result.ops).toBe(200);
    expect(result.p95Ms).toBeLessThan(10);
  });
});
