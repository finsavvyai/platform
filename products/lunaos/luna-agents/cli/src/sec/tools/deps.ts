import { Finding, Severity, ToolResult } from '../types.js';
import { ensureTool, run, writeRaw } from '../util.js';

const OSV = { name: 'osv-scanner', binary: 'osv-scanner', installHint: 'brew install osv-scanner' };

const DEFAULT_LICENSE_ALLOW = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MPL-2.0', 'Unlicense', 'CC0-1.0'];

export interface DepsOpts { target?: string; licensesAllow?: string[]; }

export async function runDeps(opts: DepsOpts = {}): Promise<ToolResult> {
  const start = Date.now();
  await ensureTool(OSV);
  const target = opts.target ?? '.';
  const findings: Finding[] = [];

  const r = await run('osv-scanner', ['scan', '--format', 'sarif', '-r', target]).catch((e) => ({ code: 1, stdout: '', stderr: e.message }));
  if (r.stdout) {
    writeRaw('deps-osv.sarif', r.stdout);
    findings.push(...parseOsv(r.stdout));
  }

  const lc = await run('npx', ['--yes', 'license-checker-rseidelsohn', '--json', '--start', target]).catch((e) => ({ code: 1, stdout: '{}', stderr: e.message }));
  if (lc.stdout) {
    writeRaw('deps-licenses.json', lc.stdout);
    findings.push(...parseLicenses(lc.stdout, opts.licensesAllow ?? DEFAULT_LICENSE_ALLOW));
  }
  return { tool: 'deps', ok: true, durationMs: Date.now() - start, findings };
}

function parseOsv(s: string): Finding[] {
  try {
    const j = JSON.parse(s);
    const out: Finding[] = [];
    for (const run of j.runs ?? []) {
      for (const res of run.results ?? []) {
        const ruleId = res.ruleId ?? 'unknown';
        const sev = sevFromOsvProps(res.properties) ?? 'high';
        const loc = res.locations?.[0]?.physicalLocation;
        out.push({
          id: `osv-${ruleId}`, tool: 'osv-scanner', ruleId, severity: sev,
          message: res.message?.text ?? 'vulnerable dependency',
          file: loc?.artifactLocation?.uri, raw: res,
        });
      }
    }
    return out;
  } catch { return []; }
}

function sevFromOsvProps(p: any): Severity | undefined {
  const s = String(p?.severity ?? '').toLowerCase();
  if (s === 'critical') return 'critical';
  if (s === 'high') return 'high';
  if (s === 'medium' || s === 'moderate') return 'medium';
  if (s === 'low') return 'low';
  return undefined;
}

function parseLicenses(s: string, allow: string[]): Finding[] {
  try {
    const j = JSON.parse(s) as Record<string, { licenses?: string | string[] }>;
    const allowSet = new Set(allow);
    const out: Finding[] = [];
    for (const [pkg, info] of Object.entries(j)) {
      const lic = Array.isArray(info.licenses) ? info.licenses.join('|') : (info.licenses ?? 'UNKNOWN');
      const ok = lic.split('|').some((l) => allowSet.has(l.replace(/[*()]/g, '')));
      if (!ok) {
        out.push({
          id: `license-${pkg}`, tool: 'license-checker', ruleId: 'license-not-allowed',
          severity: 'high', message: `${pkg} license: ${lic} (not in allowlist)`,
        });
      }
    }
    return out;
  } catch { return []; }
}
