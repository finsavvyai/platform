import { Finding, Severity, ToolResult } from '../types.js';
import { ensureTool, run, writeRaw } from '../util.js';

const CHECKOV = { name: 'checkov', binary: 'checkov', installHint: 'pipx install checkov' };
const TFSEC = { name: 'tfsec', binary: 'tfsec', installHint: 'brew install tfsec' };

export interface IacOpts { target?: string; frameworks?: string; }

export async function runIac(opts: IacOpts = {}): Promise<ToolResult> {
  const start = Date.now();
  const target = opts.target ?? '.';
  const findings: Finding[] = [];

  if (await tryEnsure(CHECKOV)) {
    const r = await run('checkov', ['-d', target, '-o', 'sarif', '--soft-fail']).catch((e) => ({ code: 1, stdout: '', stderr: e.message }));
    if (r.stdout) {
      writeRaw('iac-checkov.sarif', r.stdout);
      findings.push(...parseSarif(r.stdout, 'checkov'));
    }
  }
  if (await tryEnsure(TFSEC)) {
    const r = await run('tfsec', [target, '-f', 'sarif']).catch((e) => ({ code: 1, stdout: '', stderr: e.message }));
    if (r.stdout) {
      writeRaw('iac-tfsec.sarif', r.stdout);
      findings.push(...parseSarif(r.stdout, 'tfsec'));
    }
  }
  return { tool: 'iac', ok: true, durationMs: Date.now() - start, findings };
}

async function tryEnsure(t: { name: string; binary: string; installHint: string }): Promise<boolean> {
  return ensureTool(t).then(() => true, () => false);
}

function parseSarif(s: string, tool: string): Finding[] {
  try {
    const j = JSON.parse(s);
    const out: Finding[] = [];
    for (const run of j.runs ?? []) {
      const ruleSev = new Map<string, Severity>();
      for (const r of run.tool?.driver?.rules ?? []) {
        const sev = (r.properties?.['security-severity'] as string) ?? r.defaultConfiguration?.level ?? 'medium';
        ruleSev.set(r.id, mapSev(sev));
      }
      for (const res of run.results ?? []) {
        const loc = res.locations?.[0]?.physicalLocation;
        const sev = ruleSev.get(res.ruleId ?? '') ?? mapSev(res.level ?? 'warning');
        out.push({
          id: `${tool}-${res.ruleId}-${loc?.artifactLocation?.uri ?? ''}-${loc?.region?.startLine ?? 0}`,
          tool, ruleId: res.ruleId ?? 'unknown', severity: sev,
          message: res.message?.text ?? 'iac finding',
          file: loc?.artifactLocation?.uri, line: loc?.region?.startLine, raw: res,
        });
      }
    }
    return out;
  } catch { return []; }
}

function mapSev(level: string | number): Severity {
  if (typeof level === 'number') {
    if (level >= 9) return 'critical';
    if (level >= 7) return 'high';
    if (level >= 4) return 'medium';
    return 'low';
  }
  const l = String(level).toLowerCase();
  if (l === 'critical' || l === 'error') return 'critical';
  if (l === 'high') return 'high';
  if (l === 'medium' || l === 'warning') return 'medium';
  if (l === 'low' || l === 'note') return 'low';
  return 'info';
}
