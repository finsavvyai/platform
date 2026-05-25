/** synth-codeagent.ts — synthetic Claude Code-style traffic. Deterministic seed. */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(import.meta.dirname, '..', 'corpora', 'a', 'synth-codeagent.jsonl');
const TARGET = 1500;

// Patterns that mimic real coding-agent traffic. Booster's strong suit:
// arithmetic, JSON keys, datetime ops, file path manipulation, regex matching.
const TEMPLATES = [
  () => ({ kind: 'math', prompt: `Compute: ${rint(2, 999)} * ${rint(2, 999)}`, expected_kind: 'integer' }),
  () => ({ kind: 'math', prompt: `What is ${rint(100, 99999)} divided by ${rint(2, 99)} (integer division)?`, expected_kind: 'integer' }),
  () => ({ kind: 'json', prompt: `Extract the "user.email" field from this JSON:\n{"user":{"name":"Test","email":"x${rint(1,9999)}@example.com"}}`, expected_kind: 'string' }),
  () => ({ kind: 'json', prompt: `Pretty-print this JSON with 2-space indent:\n{"a":1,"b":[2,3,${rint(4,999)}],"c":{"d":${rint(1,99)}}}`, expected_kind: 'json' }),
  () => ({ kind: 'datetime', prompt: `What day of the week is 2026-${pad(rint(1,12))}-${pad(rint(1,28))}?`, expected_kind: 'weekday' }),
  () => ({ kind: 'datetime', prompt: `How many days between 2026-01-01 and 2026-${pad(rint(1,12))}-${pad(rint(1,28))}?`, expected_kind: 'integer' }),
  () => ({ kind: 'path', prompt: `Get the parent directory of /Users/dev/projects/foo/${pickWord()}/${pickWord()}.ts`, expected_kind: 'path' }),
  () => ({ kind: 'path', prompt: `Get the file extension of build/output/${pickWord()}.${pickExt()}`, expected_kind: 'string' }),
  () => ({ kind: 'regex', prompt: `Does the string "${pickWord()}-${rint(100,9999)}" match /^[a-z]+-\\d{3,5}$/?`, expected_kind: 'boolean' }),
  () => ({ kind: 'encoding', prompt: `Base64-encode the string "${pickWord()}${rint(0,999)}".`, expected_kind: 'string' }),
];

const WORDS = ['handler', 'router', 'cache', 'auth', 'budget', 'webhook', 'index', 'config', 'utils', 'parse'];
const EXTS = ['ts', 'js', 'json', 'md', 'sql', 'yml'];

let seed = hashSeed('2026-05-02-clawpipe-booster');
function rng(): number { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; }
function rint(lo: number, hi: number): number { return lo + Math.floor(rng() * (hi - lo + 1)); }
function pad(n: number): string { return String(n).padStart(2, '0'); }
function pickWord(): string { return WORDS[Math.floor(rng() * WORDS.length)]; }
function pickExt(): string { return EXTS[Math.floor(rng() * EXTS.length)]; }
function hashSeed(s: string): number { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

function main() {
  mkdirSync(join(import.meta.dirname, '..', 'corpora', 'a'), { recursive: true });
  const out: string[] = [];
  for (let i = 0; i < TARGET; i++) {
    const t = TEMPLATES[i % TEMPLATES.length];
    const row = t();
    out.push(JSON.stringify({ id: `synth-codeagent-${i}`, source: 'synthetic', kind: row.kind, prompt: row.prompt, expected_kind: row.expected_kind }));
  }
  writeFileSync(OUT, out.join('\n') + '\n');
  console.log(`synth-codeagent: wrote ${out.length} rows to ${OUT}`);
}

main();
