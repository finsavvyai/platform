/**
 * Load Test Suite
 *
 * Simulates concurrent API requests to measure latency percentiles.
 * Uses Promise.all to fire 100 concurrent requests per endpoint.
 */
import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.LOAD_TEST_URL ?? 'http://localhost:8787';
const CONCURRENCY = 100;

interface LatencyResult {
  p50: number;
  p95: number;
  p99: number;
  successRate: number;
  totalMs: number;
}

/** Measure a single request latency in ms */
async function timedFetch(url: string, init?: RequestInit): Promise<{ ok: boolean; ms: number }> {
  const start = performance.now();
  try {
    const res = await fetch(url, init);
    return { ok: res.ok, ms: performance.now() - start };
  } catch {
    return { ok: false, ms: performance.now() - start };
  }
}

/** Fire N concurrent requests and compute latency percentiles */
async function runConcurrent(url: string, init?: RequestInit): Promise<LatencyResult> {
  const totalStart = performance.now();
  const requests = Array.from({ length: CONCURRENCY }, () => timedFetch(url, init));
  const results = await Promise.all(requests);
  const totalMs = performance.now() - totalStart;

  const sorted = results.map((r) => r.ms).sort((a, b) => a - b);
  const successes = results.filter((r) => r.ok).length;

  return {
    p50: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
    p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    p99: sorted[Math.floor(sorted.length * 0.99)] ?? 0,
    successRate: successes / CONCURRENCY,
    totalMs,
  };
}

function logResult(name: string, result: LatencyResult): void {
  console.log(
    `[${name}] p50=${result.p50.toFixed(0)}ms p95=${result.p95.toFixed(0)}ms ` +
    `p99=${result.p99.toFixed(0)}ms success=${(result.successRate * 100).toFixed(1)}% ` +
    `total=${result.totalMs.toFixed(0)}ms`,
  );
}

describe('Load Test — Concurrent API Requests', () => {
  it('GET /health — 100 concurrent', async () => {
    const result = await runConcurrent(`${BASE_URL}/health`);
    logResult('GET /health', result);
    expect(result.successRate).toBeGreaterThanOrEqual(0.95);
    expect(result.p99).toBeLessThan(10_000);
  }, 30_000);

  it('GET /api/instances — 100 concurrent (mock auth)', async () => {
    const headers = { Authorization: 'Bearer load-test-token' };
    const result = await runConcurrent(`${BASE_URL}/api/instances`, { headers });
    logResult('GET /api/instances', result);
    // Expect most requests to complete (may get 401s without real auth)
    expect(result.p99).toBeLessThan(15_000);
  }, 30_000);

  it('POST /api/security — 100 concurrent (mock auth)', async () => {
    const headers = {
      Authorization: 'Bearer load-test-token',
      'Content-Type': 'application/json',
    };
    const body = JSON.stringify({ action: 'scan', target: 'load-test' });
    const result = await runConcurrent(`${BASE_URL}/api/security`, {
      method: 'POST', headers, body,
    });
    logResult('POST /api/security', result);
    expect(result.p99).toBeLessThan(15_000);
  }, 30_000);

  it('GET / — 100 concurrent (root)', async () => {
    const result = await runConcurrent(`${BASE_URL}/`);
    logResult('GET /', result);
    expect(result.successRate).toBeGreaterThanOrEqual(0.95);
    expect(result.p50).toBeLessThan(5_000);
  }, 30_000);
});
