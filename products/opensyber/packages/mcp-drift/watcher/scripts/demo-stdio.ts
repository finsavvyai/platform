// In-process demo using the stdio rugpull server. No wrangler / D1 needed:
// substitutes an in-memory store for D1 to prove the engine works against the
// stdio variant identically to the HTTP variant.

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fingerprintTool, canonicalJson, type ToolDef } from '../src/fingerprint.js';
import { classifyDrift } from '../src/differ.js';
import { formatAlertForConsole, type DriftAlert } from '../src/alert.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const SERVER_DIR = resolve(HERE, '../../server-rugpull');

interface StoredRow {
  fingerprint: string;
  description: string;
  inputSchema: string;
}
const store = new Map<string, StoredRow>();
const key = (server: string, tool: string) => `${server}::${tool}`;

async function callStdioToolsList(child: ReturnType<typeof spawn>, rl: ReturnType<typeof createInterface>, id: number): Promise<ToolDef[]> {
  const req = JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/list' }) + '\n';
  child.stdin?.write(req);
  return new Promise((resolveFn, rejectFn) => {
    const onLine = (line: string) => {
      try {
        const parsed = JSON.parse(line) as { id: number; result?: { tools?: ToolDef[] }; error?: { message: string } };
        if (parsed.id !== id) return;
        rl.off('line', onLine);
        if (parsed.error) return rejectFn(new Error(parsed.error.message));
        resolveFn(parsed.result?.tools ?? []);
      } catch { /* ignore non-JSON lines */ }
    };
    rl.on('line', onLine);
  });
}

async function scanOnce(server: string, child: ReturnType<typeof spawn>, rl: ReturnType<typeof createInterface>, id: number): Promise<DriftAlert[]> {
  const tools = await callStdioToolsList(child, rl, id);
  const out: DriftAlert[] = [];
  for (const tool of tools) {
    const newFingerprint = await fingerprintTool(tool);
    const newInputSchema = canonicalJson(tool.inputSchema);
    const prior = store.get(key(server, tool.name)) ?? null;
    const drift = classifyDrift({
      oldFingerprint: prior?.fingerprint ?? null,
      newFingerprint,
      oldDescription: prior?.description ?? '',
      newDescription: tool.description,
      oldInputSchema: prior?.inputSchema ?? '',
      newInputSchema,
    });
    out.push({
      serverUrl: server,
      toolName: tool.name,
      verdict: drift.verdict,
      reason: drift.reason,
      oldFingerprint: prior?.fingerprint ?? null,
      newFingerprint,
      diffSummary: drift.diffSummary,
      observedAt: Date.now(),
    });
    store.set(key(server, tool.name), {
      fingerprint: newFingerprint,
      description: tool.description,
      inputSchema: newInputSchema,
    });
  }
  return out;
}

async function main(): Promise<void> {
  console.log('▶  spawning stdio rugpull server (RUGPULL_AFTER=2)');
  const child = spawn('pnpm', ['run', 'start:stdio'], {
    cwd: SERVER_DIR,
    env: { ...process.env, RUGPULL_AFTER: '2' },
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  const rl = createInterface({ input: child.stdout! });

  for (let i = 1; i <= 3; i++) {
    console.log(`\n▶  scan ${i}/3`);
    const alerts = await scanOnce('stdio://rugpull-demo', child, rl, i);
    for (const a of alerts) console.log(formatAlertForConsole(a));
  }

  console.log('\n✓  stdio demo complete. Expect run 3 verdict = suspicious-injection.');
  child.kill('SIGTERM');
  process.exit(0);
}

main().catch((err) => {
  console.error('demo failed:', err);
  process.exit(1);
});
