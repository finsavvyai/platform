/** run.ts — smoke + full benchmark runner. */

import { readFileSync, mkdirSync, appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASELINES, MODELS, type BenchRequest } from '../baselines/index';

interface Args { smoke: boolean; bucket?: 'a' | 'b' | 'c'; baseline?: 'A' | 'B' | 'C' | 'D'; runId: string }

function parseArgs(): Args {
  const a = process.argv.slice(2);
  return {
    smoke: a.includes('--smoke'),
    bucket: (a.find((x) => x.startsWith('--bucket='))?.split('=')[1] ?? undefined) as Args['bucket'],
    baseline: (a.find((x) => x.startsWith('--baseline='))?.split('=')[1] ?? undefined) as Args['baseline'],
    runId: a.find((x) => x.startsWith('--run='))?.split('=')[1] ?? new Date().toISOString().replace(/[:.]/g, '-'),
  };
}

const ROOT = join(import.meta.dirname, '..');
const CORPORA = { a: ['swebench.jsonl', 'aider.jsonl', 'synth-codeagent.jsonl'], b: ['lmsys.jsonl'], c: ['mmlu.jsonl'] };
const SPEND_CAP = Number(process.env.BENCH_SPEND_CAP_USD ?? 80);
const SPEND_KILL = SPEND_CAP * 1.25; // hard kill at 25% over cap

function loadBucket(bucket: 'a' | 'b' | 'c', sampleN: number): BenchRequest[] {
  const out: BenchRequest[] = [];
  for (const fname of CORPORA[bucket]) {
    const path = join(ROOT, 'corpora', bucket, fname);
    if (!existsSync(path)) { console.warn(`  (missing: ${path})`); continue; }
    const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const obj = JSON.parse(line) as { id: string; prompt: string; source?: string; expected_kind?: string };
        out.push({ id: obj.id, prompt: obj.prompt, bucket, source: obj.source ?? fname.replace('.jsonl', ''), expected_kind: obj.expected_kind });
      } catch { /* skip malformed */ }
    }
  }
  // Stable shuffle by id-hash so smoke uses a deterministic subset.
  out.sort((x, y) => x.id.localeCompare(y.id));
  return out.slice(0, sampleN);
}

let totalSpend = 0;
function checkSpend(addCost: number): boolean {
  totalSpend += addCost;
  if (totalSpend > SPEND_KILL) {
    console.error(`HARD KILL: spend ${totalSpend.toFixed(2)} > ${SPEND_KILL.toFixed(2)} cap. Aborting.`);
    return false;
  }
  return true;
}

async function run(args: Args) {
  const sampleN = args.smoke ? 50 : 5000;
  const buckets: Array<'a' | 'b' | 'c'> = args.bucket ? [args.bucket] : ['a', 'b', 'c'];
  const baselines: Array<'A' | 'B' | 'C' | 'D'> = args.baseline ? [args.baseline] : ['A', 'B', 'C', 'D'];

  const outDir = join(ROOT, 'results', 'raw', args.runId);
  mkdirSync(outDir, { recursive: true });

  console.log(`Run ${args.runId} — ${args.smoke ? 'SMOKE' : 'FULL'} — buckets=${buckets.join(',')} baselines=${baselines.join(',')} sampleN=${sampleN}`);
  console.log(`Spend cap: $${SPEND_CAP} (hard kill at $${SPEND_KILL})\n`);

  const summary: Array<{ bucket: string; baseline: string; n: number; cost_usd: number; skipped: number; cached: number; errors: number }> = [];

  for (const bucket of buckets) {
    const reqs = loadBucket(bucket, sampleN);
    if (reqs.length === 0) { console.warn(`  bucket ${bucket}: no requests, skip`); continue; }
    console.log(`Bucket ${bucket.toUpperCase()}: ${reqs.length} requests loaded`);

    for (const baselineKey of baselines) {
      const baseline = BASELINES[baselineKey];
      const outFile = join(outDir, `bucket-${bucket}-baseline-${baselineKey}.jsonl`);
      writeFileSync(outFile, '');
      let n = 0, cost = 0, skipped = 0, cached = 0, errors = 0;

      for (const req of reqs) {
        // For Baselines A/B/C/D we rotate models; choose deterministically by id-hash.
        const m = MODELS[Math.abs(hashCode(req.id)) % MODELS.length];
        const r = await baseline.call(req, m);
        appendFileSync(outFile, JSON.stringify({ ...r, request_id: req.id, source: req.source, prompt_len: req.prompt.length }) + '\n');
        n++; cost += r.cost_usd;
        if (r.skipped) skipped++;
        if (r.cached) cached++;
        if (r.error) errors++;
        if (!checkSpend(r.cost_usd)) return;
      }

      summary.push({ bucket, baseline: baselineKey, n, cost_usd: round4(cost), skipped, cached, errors });
      console.log(`  ${bucket}/${baselineKey}: n=${n} cost=$${cost.toFixed(4)} skipped=${skipped} cached=${cached} errors=${errors}`);
    }
  }

  writeFileSync(join(outDir, 'summary.json'), JSON.stringify({ runId: args.runId, totalSpend: round4(totalSpend), summary }, null, 2));
  console.log(`\nTotal spend: $${totalSpend.toFixed(4)}`);
  console.log(`Results: ${outDir}/`);
}

function hashCode(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
function round4(n: number): number { return Math.round(n * 10000) / 10000; }

run(parseArgs()).catch((e) => { console.error(e); process.exit(1); });
