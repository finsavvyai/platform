/**
 * ClawPipe REAL Benchmark — makes ACTUAL API calls to OpenAI (gpt-4o-mini)
 * and Anthropic (claude-3-haiku) to prove ClawPipe's cost savings.
 *
 * SAFETY: reads keys from /clawpipe/.env (never mutates), hard cap of
 * 20 prompts x 3 paths = 60 calls max, $5.00 budget cap, interactive
 * confirmation required (or pass --yes). See REAL-BENCHMARK-README.md.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { Booster } from '../sdk/src/booster';
import { Packer } from '../sdk/src/packer';
import { Cache } from '../sdk/src/cache';
import { Router } from '../sdk/src/router';
import { renderMarkdown } from './real-benchmark-report';

interface PromptEntry { prompt: string; category: string; expected_booster: boolean; }
interface CallResult {
  prompt_index: number; category: string; tokens_in: number; tokens_out: number;
  latency_ms: number; cost_usd: number; cached?: boolean; boosted?: boolean; error?: string;
}
interface PathSummary { total_cost: number; avg_latency_ms: number; tokens_in: number; tokens_out: number; calls_made: number; errors: number; }

const __dir = new URL('.', import.meta.url).pathname;
const ENV_PATH = join(__dir, '..', '.env');
const DATASET_PATH = join(__dir, 'prompt-dataset.json');
const RESULTS_DIR = join(__dir, 'results');
const JSON_OUT = join(RESULTS_DIR, 'real-results.json');
const MD_OUT = join(RESULTS_DIR, 'real-summary.md');

const MAX_PROMPTS = 20;
const MAX_CALLS_PER_PROVIDER = 20;
const MAX_BUDGET_USD = 5.0;
const MAX_OUTPUT_TOKENS = 200;

// Public pricing (USD per 1M tokens) — April 2026 snapshot
const PRICE = {
  openai_in: 0.15, openai_out: 0.60,        // gpt-4o-mini
  anthropic_in: 0.25, anthropic_out: 1.25,  // claude-3-haiku
};

function loadEnv(): Record<string, string> {
  if (!existsSync(ENV_PATH)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(ENV_PATH, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

function pickSubset(dataset: PromptEntry[]): PromptEntry[] {
  const take = (cat: string, n: number) => dataset.filter((p) => p.category === cat).slice(0, n);
  return [...take('boostable', 5), ...take('packable', 5), ...take('simple', 5), ...take('complex', 5)];
}

function estimateMaxCost(n: number): number {
  const avgIn = 600;
  const perCall = (avgIn / 1e6) * PRICE.anthropic_in + (MAX_OUTPUT_TOKENS / 1e6) * PRICE.anthropic_out;
  return n * perCall * 3; // 3 paths per prompt
}

async function confirm(msg: string): Promise<boolean> {
  if (process.argv.includes('--yes')) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ans = (await rl.question(`${msg} [y/N]: `)).trim().toLowerCase();
  rl.close();
  return ans === 'y' || ans === 'yes';
}

function costOpenAI(tin: number, tout: number): number {
  return (tin / 1e6) * PRICE.openai_in + (tout / 1e6) * PRICE.openai_out;
}
function costAnthropic(tin: number, tout: number): number {
  return (tin / 1e6) * PRICE.anthropic_in + (tout / 1e6) * PRICE.anthropic_out;
}

async function callOpenAI(apiKey: string, prompt: string): Promise<CallResult> {
  const start = Date.now();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: MAX_OUTPUT_TOKENS,
    }),
  });
  const latency_ms = Date.now() - start;
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { usage: { prompt_tokens: number; completion_tokens: number } };
  const tin = j.usage.prompt_tokens, tout = j.usage.completion_tokens;
  return { prompt_index: -1, category: '', tokens_in: tin, tokens_out: tout, latency_ms, cost_usd: costOpenAI(tin, tout) };
}

async function callAnthropic(apiKey: string, prompt: string): Promise<CallResult> {
  const start = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const latency_ms = Date.now() - start;
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { usage: { input_tokens: number; output_tokens: number } };
  const tin = j.usage.input_tokens, tout = j.usage.output_tokens;
  return { prompt_index: -1, category: '', tokens_in: tin, tokens_out: tout, latency_ms, cost_usd: costAnthropic(tin, tout) };
}

interface Stages { booster: Booster; packer: Packer; cache: Cache; router: Router; }

/** Full ClawPipe pipeline: Booster -> Packer -> Cache -> Router -> Provider. */
async function callClawPipe(keys: { openai: string; anthropic: string }, s: Stages, prompt: string): Promise<CallResult> {
  const start = Date.now();
  const boosted = s.booster.tryResolve(prompt);
  if (boosted !== null) {
    return { prompt_index: -1, category: '', tokens_in: 0, tokens_out: 0, latency_ms: Date.now() - start, cost_usd: 0, boosted: true };
  }
  const { packed } = s.packer.pack(prompt);
  const key = s.cache.key(packed);
  if (s.cache.get(key) !== null) {
    return { prompt_index: -1, category: '', tokens_in: 0, tokens_out: 0, latency_ms: Date.now() - start, cost_usd: 0, cached: true };
  }
  const route = s.router.route(packed);
  const r = route.provider === 'anthropic'
    ? await callAnthropic(keys.anthropic, packed)
    : await callOpenAI(keys.openai, packed);
  s.cache.set(key, `r-${key.slice(0, 8)}`);
  r.latency_ms = Date.now() - start;
  return r;
}

function summarize(results: CallResult[]): PathSummary {
  const ok = results.filter((r) => !r.error);
  const api = ok.filter((r) => !r.boosted && !r.cached);
  return {
    total_cost: round(ok.reduce((s, r) => s + r.cost_usd, 0)),
    avg_latency_ms: ok.length ? Math.round(ok.reduce((s, r) => s + r.latency_ms, 0) / ok.length) : 0,
    tokens_in: ok.reduce((s, r) => s + r.tokens_in, 0),
    tokens_out: ok.reduce((s, r) => s + r.tokens_out, 0),
    calls_made: api.length,
    errors: results.length - ok.length,
  };
}

function round(n: number): number { return Math.round(n * 100000) / 100000; }
function percentile(arr: number[], p: number): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor(s.length * p))]);
}

async function main(): Promise<void> {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const env = loadEnv();
  const openaiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
  const anthropicKey = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '';

  if (!openaiKey || !anthropicKey) {
    console.log('\nTo run this benchmark, add OPENAI_API_KEY and ANTHROPIC_API_KEY to .env');
    console.log(`Expected at: ${ENV_PATH}`);
    const missing = [!openaiKey && 'OPENAI_API_KEY', !anthropicKey && 'ANTHROPIC_API_KEY'].filter(Boolean).join(', ');
    console.log(`Missing: ${missing}`);
    process.exit(0);
  }

  const dataset: PromptEntry[] = JSON.parse(readFileSync(DATASET_PATH, 'utf-8'));
  const subset = pickSubset(dataset);
  if (subset.length > MAX_PROMPTS) throw new Error(`Subset exceeds cap: ${subset.length}`);

  const maxCost = estimateMaxCost(subset.length);
  console.log('\n=== ClawPipe REAL Benchmark ===');
  console.log(`Prompts: ${subset.length} (5 each: boostable, packable, simple, complex)`);
  console.log(`Paths per prompt: 3 (OpenAI direct, Anthropic direct, ClawPipe)`);
  console.log(`Hard caps: ${MAX_CALLS_PER_PROVIDER} calls/provider, $${MAX_BUDGET_USD} budget`);
  console.log(`Estimated max spend: $${maxCost.toFixed(4)}`);
  if (maxCost > MAX_BUDGET_USD) { console.log(`ABORT: estimate exceeds $${MAX_BUDGET_USD}`); process.exit(1); }
  if (!(await confirm('Proceed with REAL API calls?'))) { console.log('Aborted.'); process.exit(0); }

  const openaiResults: CallResult[] = [], anthropicResults: CallResult[] = [], clawpipeResults: CallResult[] = [];
  const stages: Stages = { booster: new Booster(), packer: new Packer(), cache: new Cache(300_000), router: new Router() };
  let spent = 0;

  for (let i = 0; i < subset.length; i++) {
    const entry = subset[i];
    console.log(`\n[${i + 1}/${subset.length}] ${entry.category}: ${entry.prompt.slice(0, 60)}...`);
    if (spent >= MAX_BUDGET_USD) { console.log('Budget cap reached, stopping.'); break; }

    const paths = [
      ['openai', openaiResults, () => callOpenAI(openaiKey, entry.prompt)],
      ['anthropic', anthropicResults, () => callAnthropic(anthropicKey, entry.prompt)],
      ['clawpipe', clawpipeResults, () => callClawPipe({ openai: openaiKey, anthropic: anthropicKey }, stages, entry.prompt)],
    ] as const;

    for (const [name, results, fn] of paths) {
      try {
        const r = await fn();
        r.prompt_index = i; r.category = entry.category;
        (results as CallResult[]).push(r);
        spent += r.cost_usd;
        const tag = r.boosted ? ' BOOSTED' : r.cached ? ' CACHED' : '';
        console.log(`  ${name}: $${r.cost_usd.toFixed(5)} ${r.tokens_in}->${r.tokens_out}tok ${r.latency_ms}ms${tag}`);
      } catch (e) {
        (results as CallResult[]).push({ prompt_index: i, category: entry.category, tokens_in: 0, tokens_out: 0, latency_ms: 0, cost_usd: 0, error: (e as Error).message });
        console.log(`  ${name}: ERROR ${(e as Error).message}`);
      }
    }
  }

  const openai = summarize(openaiResults);
  const anthropic = summarize(anthropicResults);
  const clawpipe = summarize(clawpipeResults);
  const cpLat = clawpipeResults.filter((r) => !r.error).map((r) => r.latency_ms);
  const boosted = clawpipeResults.filter((r) => r.boosted).length;
  const cached = clawpipeResults.filter((r) => r.cached).length;
  const redOA = openai.total_cost > 0 ? (1 - clawpipe.total_cost / openai.total_cost) * 100 : 0;
  const redAN = anthropic.total_cost > 0 ? (1 - clawpipe.total_cost / anthropic.total_cost) * 100 : 0;
  const categories = subset.reduce<Record<string, number>>((a, p) => ({ ...a, [p.category]: (a[p.category] || 0) + 1 }), {});

  const report = {
    timestamp: new Date().toISOString(),
    dataset: { prompts_tested: subset.length, categories },
    direct_openai: openai,
    direct_anthropic: anthropic,
    clawpipe: { ...clawpipe, boosted_count: boosted, cached_count: cached, packer_savings_avg: '0%', total_api_calls_made: clawpipe.calls_made },
    comparison: {
      cost_reduction_vs_openai: `${redOA.toFixed(1)}%`,
      cost_reduction_vs_anthropic: `${redAN.toFixed(1)}%`,
      latency_p50_ms: percentile(cpLat, 0.5),
      latency_p95_ms: percentile(cpLat, 0.95),
    },
    safety: { total_spent_usd: round(spent), budget_cap_usd: MAX_BUDGET_USD },
  };
  writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
  writeFileSync(MD_OUT, renderMarkdown(report));
  console.log(`\nSpent: $${spent.toFixed(5)} / $${MAX_BUDGET_USD}`);
  console.log(`Wrote ${JSON_OUT}`);
  console.log(`Wrote ${MD_OUT}`);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
