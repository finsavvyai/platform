import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, chmodSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import { DEFAULT_CONFIG } from './types.js';
import { secDir, projectRoot } from './util.js';

export type Hook =
  | 'pre-commit' | 'pre-push' | 'pr-workflow' | 'build-workflow'
  | 'deploy-gate' | 'runtime-workflow' | 'watch-cron'
  | 'dependabot' | 'renovate';

const ALL_HOOKS: Hook[] = [
  'pre-commit', 'pre-push', 'pr-workflow', 'build-workflow',
  'deploy-gate', 'runtime-workflow', 'watch-cron', 'dependabot', 'renovate',
];

interface Status { hook: Hook; installed: boolean; path: string; }

const TEMPLATES_DIR_REL = '../../../templates/sec-lifecycle';

function templatesDir(): string {
  // Resolve relative to compiled JS location (cli/dist/sec/lifecycle.js)
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, TEMPLATES_DIR_REL);
}

function targets(hook: Hook): string {
  const root = projectRoot();
  switch (hook) {
    case 'pre-commit': return join(root, '.husky', 'pre-commit');
    case 'pre-push': return join(root, '.husky', 'pre-push');
    case 'pr-workflow': return join(root, '.github', 'workflows', 'luna-sec-pr.yml');
    case 'build-workflow': return join(root, '.github', 'workflows', 'luna-sec-build.yml');
    case 'runtime-workflow': return join(root, '.github', 'workflows', 'luna-sec-runtime.yml');
    case 'watch-cron': return join(root, '.github', 'workflows', 'luna-sec-watch.yml');
    case 'dependabot': return join(root, '.github', 'dependabot.yml');
    case 'renovate': return join(root, 'renovate.json');
    case 'deploy-gate': return join(root, '.github', 'workflows', 'luna-sec-pr.yml'); // virtual: piggybacks PR workflow
  }
}

function source(hook: Hook): string {
  const t = templatesDir();
  switch (hook) {
    case 'pre-commit': return join(t, 'husky', 'pre-commit');
    case 'pre-push': return join(t, 'husky', 'pre-push');
    case 'pr-workflow': return join(t, 'github', 'luna-sec-pr.yml');
    case 'build-workflow': return join(t, 'github', 'luna-sec-build.yml');
    case 'runtime-workflow': return join(t, 'github', 'luna-sec-runtime.yml');
    case 'watch-cron': return join(t, 'github', 'luna-sec-watch.yml');
    case 'dependabot': return join(t, 'github', 'dependabot.yml');
    case 'renovate': return join(t, 'renovate.json');
    case 'deploy-gate': return join(t, 'github', 'luna-sec-pr.yml');
  }
}

export function install(hooks: Hook[] = ALL_HOOKS): Status[] {
  ensureConfig();
  const out: Status[] = [];
  for (const h of hooks) {
    const dst = targets(h);
    const src = source(h);
    if (!existsSync(src)) { out.push({ hook: h, installed: false, path: dst }); continue; }
    mkdirSync(dirname(dst), { recursive: true });
    copyFileSync(src, dst);
    if (h === 'pre-commit' || h === 'pre-push') chmodSync(dst, 0o755);
    out.push({ hook: h, installed: true, path: dst });
  }
  return out;
}

export function status(): Status[] {
  return ALL_HOOKS.map((h) => ({ hook: h, installed: existsSync(targets(h)), path: targets(h) }));
}

export function uninstall(): Status[] {
  const fs = require('node:fs');
  const out: Status[] = [];
  for (const h of ALL_HOOKS) {
    const p = targets(h);
    const installed = existsSync(p);
    if (installed) { try { fs.unlinkSync(p); } catch { /* ignore */ } }
    out.push({ hook: h, installed, path: p });
  }
  return out;
}

function ensureConfig(): void {
  const p = join(secDir(), 'config.yaml');
  if (existsSync(p)) return;
  writeFileSync(p, yaml.stringify(DEFAULT_CONFIG));
}
