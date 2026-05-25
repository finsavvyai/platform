/** pull-all.ts — orchestrate every corpus pull in sequence. Public sources first. */

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

interface Step { name: string; script: string; needsHfToken?: boolean; allowFail?: boolean; cooldownMs?: number }

const STEPS: Step[] = [
  { name: 'synthetic Claude Code-style (Bucket A)',     script: 'synth-codeagent.ts' },
  { name: 'MMLU (Bucket C)',                            script: 'pull-mmlu.ts',      cooldownMs: 5_000 },
  { name: 'SWE-bench_Lite (Bucket A)',                  script: 'pull-swebench.ts',  cooldownMs: 5_000, allowFail: true },
  { name: 'Aider / exercism-python (Bucket A)',         script: 'pull-aider.ts',     cooldownMs: 5_000, allowFail: true },
  { name: 'MBPP (Bucket A)',                            script: 'pull-mbpp.ts',      cooldownMs: 5_000, allowFail: true },
  { name: 'SWE-Gym / OpenHands-style (Bucket A)',       script: 'pull-openhands.ts', cooldownMs: 10_000, allowFail: true },
  { name: 'HumanEval (Bucket A)',                       script: 'pull-humaneval.ts', cooldownMs: 5_000, allowFail: true },
  { name: 'Banking77 (Bucket C)',                       script: 'pull-banking77.ts', cooldownMs: 10_000, allowFail: true },
  { name: 'LMSYS-Chat-1M (Bucket B) — needs HF_TOKEN',  script: 'pull-lmsys.ts',     needsHfToken: true, allowFail: true },
];

const SCRIPTS_DIR = join(import.meta.dirname);

function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const summary: Array<{ name: string; status: 'ok' | 'skip' | 'fail'; reason?: string }> = [];
  for (const step of STEPS) {
    if (step.needsHfToken && !process.env.HF_TOKEN) {
      console.log(`SKIP ${step.name} — HF_TOKEN missing`);
      summary.push({ name: step.name, status: 'skip', reason: 'HF_TOKEN missing' });
      continue;
    }
    console.log(`\n=== ${step.name} ===`);
    const r = spawnSync('npx', ['tsx', join(SCRIPTS_DIR, step.script)], { stdio: 'inherit' });
    if (r.status === 0) {
      summary.push({ name: step.name, status: 'ok' });
    } else {
      summary.push({ name: step.name, status: 'fail', reason: `exit ${r.status}` });
      if (!step.allowFail) {
        console.error(`pull-all: required step "${step.name}" failed; abort.`);
        process.exit(1);
      }
    }
    if (step.cooldownMs) await sleep(step.cooldownMs);
  }
  console.log('\n=== Summary ===');
  for (const s of summary) console.log(`  ${s.status.toUpperCase().padEnd(4)} ${s.name}${s.reason ? ` (${s.reason})` : ''}`);
  const failed = summary.filter((s) => s.status === 'fail').length;
  if (failed > 0) console.log(`\n${failed} step(s) failed. Check output above; retry individually with: npx tsx scripts/<name>.ts`);
}

main().catch((e) => { console.error(e); process.exit(1); });
