/** fake-results.ts — write synthetic per-baseline JSONL so summarize can be exercised offline. */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(import.meta.dirname, '..', 'results', 'raw', 'fake-2026-05-08');

interface Profile { skipRate: number; cacheRate: number; baseCost: number }
const PROFILES: Record<'A' | 'B' | 'C' | 'D', Profile> = {
  A: { skipRate: 0,    cacheRate: 0,    baseCost: 0.0040 }, // raw provider
  B: { skipRate: 0,    cacheRate: 0.30, baseCost: 0.0024 }, // provider with prompt caching
  C: { skipRate: 0,    cacheRate: 0.25, baseCost: 0.0030 }, // CF AI Gateway with caching
  D: { skipRate: 0.28, cacheRate: 0.22, baseCost: 0.0018 }, // ClawPipe — booster skips + cache
};

function row(baseline: 'A' | 'B' | 'C' | 'D', i: number, bucket: string): object {
  const p = PROFILES[baseline];
  const skipped = baseline === 'D' && (i % 100) < p.skipRate * 100;
  const cached = !skipped && (i % 100) < (p.skipRate + p.cacheRate) * 100;
  const lat = 50 + Math.floor(Math.random() * 250) + (skipped ? -45 : cached ? -30 : 0);
  // Bucket A: 45% synthetic, 55% real (split as MMLU/SWE-bench/etc).
  // Buckets B and C: 100% real for now.
  const isSynth = bucket === 'a' && i % 100 < 45;
  const source = isSynth ? 'synthetic' : bucket === 'a' ? 'princeton-nlp/SWE-bench_Lite' : bucket === 'b' ? 'lmsys/lmsys-chat-1m' : 'cais/mmlu';
  return {
    baseline, provider: 'openai', model: 'gpt-5-mini',
    prompt_tokens: skipped ? 0 : 200,
    completion_tokens: skipped || cached ? 0 : 80,
    cost_usd: skipped || cached ? 0 : p.baseCost,
    cached, skipped, latency_ms: lat,
    output: skipped ? `local-${i}` : cached ? `cached-${i}` : `ai-${i}`,
    request_id: `${bucket}-${i}`,
    source,
  };
}

function emit(bucket: string, baseline: 'A' | 'B' | 'C' | 'D', n: number) {
  mkdirSync(OUT, { recursive: true });
  const lines: string[] = [];
  for (let i = 0; i < n; i++) lines.push(JSON.stringify(row(baseline, i, bucket)));
  writeFileSync(join(OUT, `bucket-${bucket}-baseline-${baseline}.jsonl`), lines.join('\n') + '\n');
}

const N = 100;
for (const bucket of ['a', 'b', 'c']) {
  for (const baseline of ['A', 'B', 'C', 'D'] as const) emit(bucket, baseline, N);
}
console.log(`fake-results: wrote 12 files (${N} rows each) to ${OUT}`);
