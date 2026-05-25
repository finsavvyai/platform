#!/usr/bin/env node
// lint-prompt-storage.mjs — fail CI if a raw `prompt` column is added to the
// `requests` table. We log only `prompt_hash` per the security promise on
// /security ("Prompts: Never logged or stored. Hash-only for cache.").
//
// Usage: node tools/lint-prompt-storage.mjs [sql-path ...]
// Exit 0 = clean, exit 1 = violation.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const CWD = process.cwd();
const DEFAULT_PATHS = ['gateway/schema.sql', 'gateway/migrations'];

function listSql(path) {
  const out = [];
  let st;
  try { st = statSync(path); } catch { return out; }
  if (st.isFile() && path.endsWith('.sql')) return [path];
  if (st.isDirectory()) {
    for (const name of readdirSync(path)) {
      out.push(...listSql(join(path, name)));
    }
  }
  return out;
}

// Find every CREATE TABLE / ALTER TABLE block that targets `requests` and
// inspect its columns. A bare `prompt TEXT` (or VARCHAR/STRING/BLOB/JSON) is
// the violation. `prompt_hash`, `prompt_id`, `prompt_version` are fine.
const CREATE_RE = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?requests["`]?\s*\(([\s\S]*?)\);/gi;
const ALTER_ADD_RE = /ALTER\s+TABLE\s+["`]?requests["`]?\s+ADD\s+(?:COLUMN\s+)?["`]?prompt["`]?\s+(TEXT|VARCHAR|STRING|BLOB|JSON|CLOB)/gi;
const COLUMN_RE = /^\s*["`]?prompt["`]?\s+(TEXT|VARCHAR|STRING|BLOB|JSON|CLOB)/im;

function scanFile(file) {
  const sql = readFileSync(file, 'utf8');
  const violations = [];
  for (const m of sql.matchAll(CREATE_RE)) {
    const body = m[1];
    for (const line of body.split('\n')) {
      // Skip lines that mention prompt_hash / prompt_id / prompt_version etc.
      const trimmed = line.trim();
      if (/^["`]?prompt_/i.test(trimmed)) continue;
      if (COLUMN_RE.test(line)) {
        violations.push({ file, line: trimmed, kind: 'CREATE TABLE requests' });
      }
    }
  }
  for (const m of sql.matchAll(ALTER_ADD_RE)) {
    violations.push({ file, line: m[0].trim(), kind: 'ALTER TABLE requests' });
  }
  return violations;
}

function main(argv) {
  const targets = argv.length ? argv : DEFAULT_PATHS;
  const files = targets.flatMap(listSql);
  let total = 0;
  for (const f of files) {
    const violations = scanFile(f);
    for (const v of violations) {
      total++;
      const rel = relative(CWD, v.file);
      console.error(`bluff: ${rel}: ${v.kind} contains raw 'prompt' column: ${v.line}`);
    }
  }
  if (total > 0) {
    console.error(`\n${total} prompt-storage violation(s). The 'requests' table must store prompt_hash only.`);
    console.error("If raw prompt storage is intentional, update the /security page first AND add an explicit override in this lint.");
    process.exit(1);
  }
  console.log(`prompt-storage lint: ${files.length} SQL file(s) clean.`);
}

main(process.argv.slice(2));
