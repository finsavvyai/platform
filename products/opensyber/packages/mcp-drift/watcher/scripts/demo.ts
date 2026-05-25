// End-to-end demo: HTTP rugpull server + wrangler dev watcher + 3 scans.
// Usage: pnpm --filter @opensyber/mcp-drift-watcher demo

import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const SERVER_DIR = resolve(HERE, '../../server-rugpull');
const WATCHER_DIR = resolve(HERE, '..');
const RUGPULL_URL = 'http://localhost:7331/';
const WATCHER_URL = 'http://localhost:8787/scan';
const RUGPULL_AFTER = '2';

const procs: ChildProcess[] = [];

function start(cmd: string, args: string[], cwd: string, env: Record<string, string> = {}, label: string): ChildProcess {
  const p = spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  p.stdout?.on('data', (d) => process.stdout.write(`[${label}] ${d}`));
  p.stderr?.on('data', (d) => process.stderr.write(`[${label}] ${d}`));
  procs.push(p);
  return p;
}

async function waitForOk(url: string, label: string, attempts = 60): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* not yet */ }
    await sleep(500);
  }
  throw new Error(`${label} never became ready at ${url}`);
}

async function scan(): Promise<unknown> {
  const res = await fetch(WATCHER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serverUrl: RUGPULL_URL }),
  });
  return res.json();
}

function shutdown(): void {
  for (const p of procs) {
    try { p.kill('SIGTERM'); } catch { /* ignore */ }
  }
}

process.on('SIGINT', () => { shutdown(); process.exit(130); });
process.on('SIGTERM', () => { shutdown(); process.exit(143); });

async function main(): Promise<void> {
  console.log('▶  starting rugpull HTTP server (RUGPULL_AFTER=2)…');
  start('pnpm', ['run', 'start:http'], SERVER_DIR, { RUGPULL_AFTER, PORT: '7331' }, 'rugpull');
  await waitForOk('http://localhost:7331/_state', 'rugpull');

  console.log('▶  starting wrangler dev watcher (local D1)…');
  start('pnpm', ['run', 'dev', '--', '--port', '8787'], WATCHER_DIR, {}, 'watcher');
  await waitForOk('http://localhost:8787/health', 'watcher');

  for (let i = 1; i <= 3; i++) {
    console.log(`\n▶  scan ${i}/3`);
    const result = await scan();
    console.log(JSON.stringify(result, null, 2));
  }

  console.log('\n✓  demo complete. Expect run 3 verdict = suspicious-injection.');
  shutdown();
  await sleep(200);
  process.exit(0);
}

main().catch((err) => {
  console.error('demo failed:', err);
  shutdown();
  process.exit(1);
});
