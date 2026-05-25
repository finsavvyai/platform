#!/usr/bin/env node
/**
 * Post-process the CJS tsc output:
 *   1. Rewrite internal `.js` imports/requires to `.cjs`.
 *   2. Rename all emitted `.js` → `.cjs` (and source maps) in `dist-cjs/`.
 *   3. Copy files into `dist/` so `dist/` holds both ESM (.js) and CJS (.cjs).
 *   4. Drop a `package.json` shim with `"type": "commonjs"` inside `dist-cjs`
 *      (not strictly required once renamed, but belt-and-braces for consumers).
 *
 * Keeps the dual-package story simple without adding tsup/rollup.
 */

import { readdirSync, readFileSync, renameSync, writeFileSync, copyFileSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, '..');
const cjsDir = join(pkgRoot, 'dist-cjs');
const distDir = join(pkgRoot, 'dist');

if (!existsSync(cjsDir)) {
  console.error(`[cjs-rename] dist-cjs not found at ${cjsDir}`);
  process.exit(1);
}

function walk(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) entries.push(...walk(full));
    else entries.push(full);
  }
  return entries;
}

const files = walk(cjsDir);

// Step 1: rewrite .js references inside .js files to .cjs
for (const file of files) {
  if (!file.endsWith('.js')) continue;
  const content = readFileSync(file, 'utf8');
  const rewritten = content
    .replace(/require\((["'])(\.\.?\/[^"']+?)\.js\1\)/g, 'require($1$2.cjs$1)')
    .replace(/from (["'])(\.\.?\/[^"']+?)\.js\1/g, 'from $1$2.cjs$1');
  if (rewritten !== content) writeFileSync(file, rewritten);
}

// Step 2: rename .js → .cjs and .js.map → .cjs.map
for (const file of files) {
  let target = null;
  if (file.endsWith('.js')) target = file.replace(/\.js$/, '.cjs');
  else if (file.endsWith('.js.map')) target = file.replace(/\.js\.map$/, '.cjs.map');
  if (target) renameSync(file, target);
}

// Step 3: copy into dist/ so everything lives in one place
function copyTree(src, dest) {
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src)) {
    const s = join(src, name);
    const d = join(dest, name);
    if (statSync(s).isDirectory()) copyTree(s, d);
    else copyFileSync(s, d);
  }
}

copyTree(cjsDir, distDir);

console.log('[cjs-rename] dual-package build complete.');
