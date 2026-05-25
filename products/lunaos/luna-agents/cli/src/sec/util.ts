import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import yaml from 'yaml';
import { DEFAULT_CONFIG, SecConfig, ToolDef, Finding, Severity } from './types.js';

export interface RunOptions { cwd?: string; timeoutMs?: number; input?: string; env?: NodeJS.ProcessEnv; }
export interface RunResult { code: number; stdout: string; stderr: string; }

export function projectRoot(): string { return process.cwd(); }
export function projectName(): string { return basename(projectRoot()); }

export function secDir(): string {
  const dir = join(projectRoot(), '.luna', projectName(), 'security');
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, 'raw'), { recursive: true });
  return dir;
}

export function loadConfig(): SecConfig {
  const cfgPath = join(secDir(), 'config.yaml');
  if (!existsSync(cfgPath)) return DEFAULT_CONFIG;
  try { return { ...DEFAULT_CONFIG, ...yaml.parse(readFileSync(cfgPath, 'utf-8')) }; }
  catch { return DEFAULT_CONFIG; }
}

export function logBypass(reason: string): void {
  const p = join(secDir(), 'bypass.log');
  writeFileSync(p, `${new Date().toISOString()} ${reason}\n`, { flag: 'a' });
}

export async function which(bin: string): Promise<boolean> {
  const r = await run('command', ['-v', bin], { timeoutMs: 2000 }).catch(() => ({ code: 1, stdout: '', stderr: '' }));
  return r.code === 0;
}

export async function ensureTool(t: ToolDef): Promise<void> {
  if (await which(t.binary)) return;
  throw new Error(`Tool '${t.binary}' not installed. Install: ${t.installHint}`);
}

export function run(cmd: string, args: string[], opts: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd ?? projectRoot(),
      env: { ...process.env, ...opts.env },
      stdio: opts.input ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    const t = opts.timeoutMs ? setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`timeout: ${cmd}`)); }, opts.timeoutMs) : null;
    child.on('error', (e) => { if (t) clearTimeout(t); reject(e); });
    child.on('close', (code) => { if (t) clearTimeout(t); resolve({ code: code ?? 1, stdout, stderr }); });
    if (opts.input) child.stdin?.end(opts.input);
  });
}

export function writeRaw(name: string, content: string | object): string {
  const p = join(secDir(), 'raw', name);
  writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  return p;
}

export function dedupe(findings: Finding[]): Finding[] {
  const seen = new Map<string, Finding>();
  for (const f of findings) {
    const key = `${f.file ?? ''}|${f.line ?? ''}|${f.ruleId}`;
    const existing = seen.get(key);
    if (!existing || rankOf(f.severity) > rankOf(existing.severity)) seen.set(key, f);
  }
  return [...seen.values()];
}

function rankOf(s: Severity): number {
  return { critical: 4, high: 3, medium: 2, low: 1, info: 0 }[s];
}

export function severityGateFails(findings: Finding[], cfg: SecConfig, strict: boolean): boolean {
  if (!strict) return false;
  return findings.some((f) => cfg.severityGates[f.severity] === 'block');
}
