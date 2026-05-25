/** @vitest-environment node */
/**
 * Deprecation parity check — every `@deprecated` JSDoc tag in src/ must
 * have a matching row in sdk/DEPRECATIONS.md so callers know how to
 * migrate before the next major.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname);
const DEPRECATIONS = join(__dirname, '..', 'DEPRECATIONS.md');

function* walk(root: string): Iterable<string> {
  for (const name of readdirSync(root)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const path = join(root, name);
    const st = statSync(path);
    if (st.isDirectory()) yield* walk(path);
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) yield path;
  }
}

interface Annotation { file: string; line: number; symbol: string }

/** Find every `@deprecated` JSDoc tag in src/, returning the symbol name on the
 *  next non-comment line so the test can match against DEPRECATIONS.md. */
function collectAnnotations(): Annotation[] {
  const out: Annotation[] = [];
  for (const file of walk(SRC)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!/@deprecated\b/.test(lines[i])) continue;
      // Walk forward past the closing */ to the next code line.
      let j = i + 1;
      while (j < lines.length && /^\s*(\*|\*\/|\/\/)/.test(lines[j])) j++;
      const code = (lines[j] ?? '').trim();
      const match = /(?:export\s+(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+)([A-Za-z_$][A-Za-z0-9_$]*)/.exec(code);
      if (match) out.push({ file, line: i + 1, symbol: match[1] });
    }
  }
  return out;
}

function readDeprecationTable(): string[] {
  const md = readFileSync(DEPRECATIONS, 'utf8');
  const symbols: string[] = [];
  for (const line of md.split('\n')) {
    const m = /^\|\s*`([^`]+)`\s*\|/.exec(line);
    if (m) symbols.push(m[1]);
  }
  return symbols;
}

describe('deprecation parity', () => {
  it('every @deprecated tag in src/ has a row in DEPRECATIONS.md', () => {
    const annotations = collectAnnotations();
    if (annotations.length === 0) {
      // No deprecations yet — sanity-check the doc still exists.
      expect(() => readFileSync(DEPRECATIONS, 'utf8')).not.toThrow();
      return;
    }
    const tableSymbols = new Set(readDeprecationTable());
    const missing = annotations.filter((a) => !tableSymbols.has(a.symbol));
    expect(missing, `Missing DEPRECATIONS.md rows: ${missing.map((m) => `${m.symbol} (${m.file}:${m.line})`).join(', ')}`).toEqual([]);
  });

  it('DEPRECATIONS.md exists and is readable', () => {
    expect(() => readFileSync(DEPRECATIONS, 'utf8')).not.toThrow();
  });

  it('migrate-v3-to-v4.mjs codemod runner exists', () => {
    const path = join(__dirname, '..', '..', 'tools', 'migrate-v3-to-v4.mjs');
    expect(() => readFileSync(path, 'utf8')).not.toThrow();
  });
});
