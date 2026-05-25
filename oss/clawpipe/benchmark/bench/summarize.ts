/** summarize.ts — aggregate JSONL outputs into per-bucket per-baseline numbers with 95% CIs. */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

interface Row {
  baseline: 'A' | 'B' | 'C' | 'D';
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  cached: boolean;
  skipped: boolean;
  latency_ms: number;
  output: string;
  error?: string;
  request_id: string;
  source?: string;
}

interface BucketBaselineKey { bucket: string; baseline: 'A' | 'B' | 'C' | 'D' }
interface Aggregate {
  n: number;
  errors: number;
  cost_usd_total: number;
  cost_usd_per_1k: number;
  skip_rate: number;
  cache_rate: number;
  latency_ms_p50: number;
  latency_ms_p95: number;
}

function loadRunDir(runDir: string): Map<string, Row[]> {
  const out = new Map<string, Row[]>();
  for (const f of readdirSync(runDir)) {
    if (!f.endsWith('.jsonl')) continue;
    const m = f.match(/^bucket-(.+?)-baseline-([ABCD])\.jsonl$/);
    if (!m) continue;
    const key = `${m[1]}:${m[2]}`;
    const lines = readFileSync(join(runDir, f), 'utf8').split('\n').filter(Boolean);
    out.set(key, lines.map((l) => JSON.parse(l) as Row));
  }
  return out;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const i = Math.floor((s.length - 1) * p);
  return s[i];
}

function aggregate(rows: Row[]): Aggregate {
  const ok = rows.filter((r) => !r.error);
  const lat = ok.map((r) => r.latency_ms);
  const totalCost = rows.reduce((s, r) => s + (r.cost_usd ?? 0), 0);
  return {
    n: rows.length,
    errors: rows.length - ok.length,
    cost_usd_total: round4(totalCost),
    cost_usd_per_1k: rows.length > 0 ? round4((totalCost / rows.length) * 1000) : 0,
    skip_rate: ok.length > 0 ? round4(ok.filter((r) => r.skipped).length / ok.length) : 0,
    cache_rate: ok.length > 0 ? round4(ok.filter((r) => r.cached).length / ok.length) : 0,
    latency_ms_p50: percentile(lat, 0.5),
    latency_ms_p95: percentile(lat, 0.95),
  };
}

/** Wilson score 95% CI for a proportion. Better than normal-approx for small N or extreme p. */
function wilson95(successes: number, n: number): { lo: number; hi: number } {
  if (n === 0) return { lo: 0, hi: 0 };
  const z = 1.96;
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { lo: round4(Math.max(0, center - margin)), hi: round4(Math.min(1, center + margin)) };
}

function round4(n: number): number { return Math.round(n * 10000) / 10000; }

function deltaPct(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return round4(((denominator - numerator) / denominator) * 100);
}

function summarize(runDirs: string[]): string {
  const allRuns: Map<string, Row[]>[] = runDirs.map(loadRunDir);
  // Merge runs per (bucket, baseline) — keep arrays separate so we can compute cross-run CIs later.
  const keys = new Set<string>();
  for (const m of allRuns) for (const k of m.keys()) keys.add(k);

  const lines: string[] = [];
  lines.push('# Booster Benchmark — Summary');
  lines.push('');
  lines.push(`**Runs included:** ${runDirs.length}`);
  lines.push('');
  lines.push('## Per-bucket × per-baseline');
  lines.push('');
  lines.push('| Bucket | Baseline | N | Errors | Skip rate (95% CI) | Cache rate | Cost $/1K | p50 ms | p95 ms |');
  lines.push('|---|---|---|---|---|---|---|---|---|');

  const baselineLookup: Record<string, Aggregate> = {};
  for (const k of [...keys].sort()) {
    const allRows = allRuns.flatMap((m) => m.get(k) ?? []);
    if (allRows.length === 0) continue;
    const a = aggregate(allRows);
    const okRows = allRows.filter((r) => !r.error);
    const ci = wilson95(okRows.filter((r) => r.skipped).length, okRows.length);
    const [bucket, baseline] = k.split(':');
    baselineLookup[k] = a;
    lines.push(`| ${bucket.toUpperCase()} | ${baseline} | ${a.n} | ${a.errors} | ${a.skip_rate} (${ci.lo}–${ci.hi}) | ${a.cache_rate} | $${a.cost_usd_per_1k} | ${a.latency_ms_p50} | ${a.latency_ms_p95} |`);
  }

  lines.push('');
  lines.push('## Real-vs-synthetic split per bucket (Baseline D rows)');
  lines.push('');
  lines.push('| Bucket | Real source rows | Synthetic rows | Synth share |');
  lines.push('|---|---|---|---|');
  for (const bucket of ['a', 'b', 'c']) {
    const rows = allRuns.flatMap((m) => m.get(`${bucket}:D`) ?? []);
    if (rows.length === 0) continue;
    const synth = rows.filter((r) => (r.source ?? '').toLowerCase().includes('synth')).length;
    const real = rows.length - synth;
    const share = rows.length > 0 ? round4(synth / rows.length) : 0;
    lines.push(`| ${bucket.toUpperCase()} | ${real} | ${synth} | ${share} |`);
  }

  lines.push('');
  lines.push('## Decision-relevant deltas (D vs B, D vs C, per bucket)');
  lines.push('');
  lines.push('| Bucket | D vs A (% saved) | **D vs B (% saved)** | D vs C (% saved) |');
  lines.push('|---|---|---|---|');
  for (const bucket of ['a', 'b', 'c']) {
    const a = baselineLookup[`${bucket}:A`]?.cost_usd_per_1k ?? 0;
    const b = baselineLookup[`${bucket}:B`]?.cost_usd_per_1k ?? 0;
    const c = baselineLookup[`${bucket}:C`]?.cost_usd_per_1k ?? 0;
    const d = baselineLookup[`${bucket}:D`]?.cost_usd_per_1k ?? 0;
    lines.push(`| ${bucket.toUpperCase()} | ${deltaPct(d, a) ?? 'n/a'}% | **${deltaPct(d, b) ?? 'n/a'}%** | ${deltaPct(d, c) ?? 'n/a'}% |`);
  }
  lines.push('');
  lines.push('Decision rule applies to **Bucket A delta vs Baseline B** — see DECISION-RULE.md.');
  lines.push('');
  return lines.join('\n');
}

function main() {
  const root = join(import.meta.dirname, '..', 'results', 'raw');
  if (!existsSync(root)) { console.error(`No results dir at ${root}. Run npm run bench first.`); process.exit(1); }
  const dirs = readdirSync(root).map((d) => join(root, d)).filter((d) => existsSync(d));
  if (dirs.length === 0) { console.error('No run subdirs found.'); process.exit(1); }
  const md = summarize(dirs);
  const out = join(import.meta.dirname, '..', 'results', 'summary.md');
  writeFileSync(out, md);
  console.log(`summarize: wrote ${out} (${dirs.length} run(s) folded in)`);
  console.log('\n' + md);
}

main();
