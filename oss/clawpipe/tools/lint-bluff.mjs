#!/usr/bin/env node
// lint-bluff.mjs — flag phantom-metric / hyperbole language in markdown
// without nearby evidence references. Drill-derived guardrail.
//
// Usage: node tools/lint-bluff.mjs [path ...]
// Exit 0 = clean, exit 1 = bluffs found.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const CWD = process.cwd();

// Bluff words (case-insensitive). Each entry is matched as a whole-word regex.
const BLUFFS = [
  'comprehensive',
  'production-ready',
  'fully implemented',
  'fully complete',
  '100% complete',
  'enterprise-grade',
  'world-class',
  'state-of-the-art',
];

// Evidence patterns. If any of these appear in the same line OR within the
// 3 lines following the bluff hit, the line is considered backed.
const EVIDENCE_RE = new RegExp([
  '\\.(json|test\\.ts|test\\.tsx|md)\\b',
  'npm pack',
  'vitest',
  'pytest',
  'coverage',
  'exit code',
  '\\d+/\\d+',                 // e.g. "12/12"
  '\\b\\d+\\s*tests?\\b',      // e.g. "200 tests"
  '\\b\\d+\\s*files?\\b',      // e.g. "136 files"
  '\\bsha-?256\\b',
].join('|'), 'i');

// Paths to skip entirely (substring match against repo-relative path).
const SKIP_DIRS = ['node_modules', '.git', 'dist', '.wrangler', '.next', 'build'];
// File basenames to skip when located anywhere under .luna/
// (these reports discuss the bluff words by name).
const SKIP_LUNA_BASENAMES = new Set([
  'no-bluf-report.md',
  'drill-report.md',
]);

const DEFAULT_ROOTS = [
  'CHANGELOG.md',
  'README.md',
  'AUDIT-REPORT.md',
  '.luna',
  'docs',
];

function shouldSkip(absPath) {
  const rel = relative(CWD, absPath);
  const segs = rel.split(sep);
  for (const seg of SKIP_DIRS) {
    if (segs.includes(seg)) return true;
  }
  // Skip drill / no-bluf reports anywhere under .luna/.
  if (segs[0] === '.luna') {
    const base = segs[segs.length - 1];
    if (SKIP_LUNA_BASENAMES.has(base)) return true;
  }
  // Skip our own lint + any CLAUDE.md (rule file that *defines* the bluff list).
  if (rel.endsWith(join('tools', 'lint-bluff.mjs'))) return true;
  if (segs[segs.length - 1] === 'CLAUDE.md') return true;
  return false;
}

function collectFiles(root, out) {
  if (!existsSync(root)) return;
  const st = statSync(root);
  if (st.isFile()) {
    if (root.endsWith('.md') && !shouldSkip(root)) out.push(root);
    return;
  }
  if (!st.isDirectory()) return;
  for (const entry of readdirSync(root)) {
    const child = join(root, entry);
    if (shouldSkip(child)) continue;
    const cs = statSync(child);
    if (cs.isDirectory()) collectFiles(child, out);
    else if (cs.isFile() && child.endsWith('.md')) out.push(child);
  }
}

function buildBluffRegex() {
  // Word-boundary-ish: lookbehind/ahead for non-word chars, with hyphen allowed.
  const escaped = BLUFFS.map(w =>
    w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  return new RegExp(`(?<![\\w-])(${escaped.join('|')})(?![\\w-])`, 'gi');
}

function lintFile(absPath, rel, hits) {
  const text = readFileSync(absPath, 'utf8');
  const lines = text.split('\n');
  const re = buildBluffRegex();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(line)) !== null) {
      const word = m[1];
      // Look at this line + next 3 for evidence.
      const window = lines.slice(i, Math.min(i + 4, lines.length)).join('\n');
      if (EVIDENCE_RE.test(window)) continue;
      hits.push({ file: rel, line: i + 1, word });
    }
  }
}

function main() {
  const args = process.argv.slice(2);
  const roots = (args.length ? args : DEFAULT_ROOTS).map(r => resolve(CWD, r));

  const files = [];
  for (const r of roots) collectFiles(r, files);

  const hits = [];
  for (const f of files) lintFile(f, relative(CWD, f), hits);

  console.log('TAP version 14');
  if (hits.length === 0) {
    console.log('1..1');
    console.log('ok 1 - lint-bluff: no bluff words without evidence');
    console.log(`# scanned ${files.length} markdown file(s)`);
    process.exit(0);
  }
  console.log(`1..${hits.length}`);
  hits.forEach((h, idx) => {
    console.log(
      `not ok ${idx + 1} - ${h.file}:${h.line} bluff word "${h.word}" without evidence`
    );
  });
  console.log(`# scanned ${files.length} markdown file(s), ${hits.length} bluff hit(s)`);
  process.exit(1);
}

main();
