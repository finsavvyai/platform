import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Finding, ToolResult } from '../types.js';
import { run, secDir } from '../util.js';

export type FuzzLang = 'auto' | 'js' | 'ts' | 'python' | 'go';

export interface FuzzOpts {
  target: string;
  language?: FuzzLang;
  durationSeconds?: number;
  corpusDir?: string;
}

export async function runFuzz(opts: FuzzOpts): Promise<ToolResult> {
  const start = Date.now();
  const lang = (opts.language && opts.language !== 'auto') ? opts.language : detectLang(opts.target);
  const duration = opts.durationSeconds ?? 300;
  const corpus = opts.corpusDir ?? join(secDir(), 'fuzz', 'corpus');
  const crashes = join(secDir(), 'fuzz', 'crashes');
  mkdirSync(corpus, { recursive: true });
  mkdirSync(crashes, { recursive: true });

  let cmd: string, args: string[];
  if (lang === 'js' || lang === 'ts') {
    cmd = 'npx'; args = ['--yes', '@jazzer.js/jest-runner', opts.target, '--', `--max-total-time=${duration}`];
  } else if (lang === 'python') {
    cmd = 'python'; args = [opts.target, '-atheris_runs=0', `-max_total_time=${duration}`];
  } else {
    cmd = 'go'; args = ['test', '-fuzz', '.', `-fuzztime=${duration}s`, opts.target];
  }

  const r = await run(cmd, args, { timeoutMs: (duration + 60) * 1000 }).catch((e) => ({ code: 1, stdout: '', stderr: e.message }));
  const findings: Finding[] = [];
  const crashLines = (r.stdout + r.stderr).match(/(panic|crash|FUZZ_TARGET_CRASH|libFuzzer: deadly signal)/gi);
  if (crashLines && crashLines.length > 0) {
    findings.push({
      id: `fuzz-${lang}-${Date.now()}`, tool: 'fuzz', ruleId: 'fuzz-crash',
      severity: 'high', message: `Fuzzer found ${crashLines.length} crash(es). See ${crashes}.`,
      file: opts.target,
    });
  }
  return { tool: 'fuzz', ok: true, durationMs: Date.now() - start, findings };
}

function detectLang(p: string): FuzzLang {
  if (p.endsWith('.ts')) return 'ts';
  if (p.endsWith('.js')) return 'js';
  if (p.endsWith('.py')) return 'python';
  if (p.endsWith('.go') || existsSync(join(p, 'go.mod'))) return 'go';
  return 'js';
}
