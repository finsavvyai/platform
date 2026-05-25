#!/usr/bin/env node
/**
 * migrate-v3-to-v4.mjs — codemod skeleton for the next ClawPipe major.
 *
 * Walks .ts/.tsx/.js/.mjs files under the supplied paths and applies any
 * registered transforms. Each transform is a pure (source) -> source
 * function, kept colocated here so a v3 -> v4 migration is a single
 * `npx clawpipe-migrate-v3-to-v4 ./src` away from being applied.
 *
 * Currently zero transforms registered (the v3.6.x line has no
 * deprecations yet). Adding a transform requires an updated row in
 * sdk/DEPRECATIONS.md so the deprecation-lint check stays green.
 *
 * Usage:
 *   node tools/migrate-v3-to-v4.mjs ./src
 *   node tools/migrate-v3-to-v4.mjs ./packages/web/src ./packages/api/src
 *   node tools/migrate-v3-to-v4.mjs --dry ./src
 */

import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';

/** @type {Array<{ name: string; description: string; transform: (src: string) => string }>} */
const TRANSFORMS = [
  // Each entry will look like:
  // {
  //   name: 'rename-router-route',
  //   description: 'router.route(prompt, opts) -> router.routePrompt(prompt, opts)',
  //   transform: (src) => src.replace(/\.route\(/g, '.routePrompt('),
  // },
];

const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs']);

function* walk(root) {
  const entries = readdirSync(root);
  for (const name of entries) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const path = join(root, name);
    const st = statSync(path);
    if (st.isDirectory()) yield* walk(path);
    else if (EXTENSIONS.has(extname(name))) yield path;
  }
}

function applyAll(src) {
  let out = src;
  const applied = [];
  for (const t of TRANSFORMS) {
    const next = t.transform(out);
    if (next !== out) applied.push(t.name);
    out = next;
  }
  return { out, applied };
}

function main(args) {
  const dry = args.includes('--dry');
  const paths = args.filter((a) => a !== '--dry');
  if (paths.length === 0) {
    process.stderr.write('Usage: migrate-v3-to-v4.mjs [--dry] <path> [path ...]\n');
    process.exit(2);
  }
  if (TRANSFORMS.length === 0) {
    process.stdout.write('No transforms registered for this version. Nothing to do.\n');
    process.exit(0);
  }
  let touched = 0;
  for (const root of paths) {
    for (const file of walk(root)) {
      const src = readFileSync(file, 'utf8');
      const { out, applied } = applyAll(src);
      if (applied.length > 0) {
        touched++;
        if (!dry) writeFileSync(file, out);
        process.stdout.write(`${dry ? '[dry] ' : ''}${file}: ${applied.join(', ')}\n`);
      }
    }
  }
  process.stdout.write(`${dry ? 'Would touch' : 'Touched'} ${touched} file(s).\n`);
}

main(process.argv.slice(2));
