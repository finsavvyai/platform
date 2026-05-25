import { Finding, Severity, ToolResult } from '../types.js';
import { ensureTool, run, writeRaw } from '../util.js';

const SEMGREP = { name: 'semgrep', binary: 'semgrep', installHint: 'pipx install semgrep' };

export interface SastOpts {
  target?: string;
  rulesets?: string;
  baseline?: string;
}

const DEFAULT_RULESETS = 'p/owasp-top-ten,p/cwe-top-25,p/javascript,p/typescript,p/python,p/golang,p/secrets';

export async function runSast(opts: SastOpts = {}): Promise<ToolResult> {
  const start = Date.now();
  await ensureTool(SEMGREP);
  const target = opts.target ?? '.';
  const rulesets = (opts.rulesets ?? DEFAULT_RULESETS).split(',').map((s) => s.trim());

  const args = ['--sarif', '--quiet', '--metrics=off'];
  for (const r of rulesets) args.push('--config', r);
  if (opts.baseline) args.push('--baseline-commit', opts.baseline);
  args.push(target);

  const r = await run('semgrep', args, { timeoutMs: 600_000 }).catch((e) => ({ code: 2, stdout: '', stderr: e.message }));
  const findings: Finding[] = [];
  if (r.stdout) {
    writeRaw('sast-semgrep.sarif', r.stdout);
    findings.push(...parseSemgrep(r.stdout));
  }
  return { tool: 'sast', ok: true, durationMs: Date.now() - start, findings };
}

function parseSemgrep(s: string): Finding[] {
  try {
    const j = JSON.parse(s);
    const out: Finding[] = [];
    for (const run of j.runs ?? []) {
      const rules = new Map<string, Severity>();
      for (const rule of run.tool?.driver?.rules ?? []) {
        rules.set(rule.id, mapLevel(rule.defaultConfiguration?.level ?? rule.properties?.security_severity ?? 'warning'));
      }
      for (const res of run.results ?? []) {
        const loc = res.locations?.[0]?.physicalLocation;
        out.push({
          id: `semgrep-${res.ruleId}-${loc?.artifactLocation?.uri ?? ''}-${loc?.region?.startLine ?? 0}`,
          tool: 'semgrep', ruleId: res.ruleId ?? 'unknown',
          severity: rules.get(res.ruleId ?? '') ?? mapLevel(res.level ?? 'warning'),
          message: res.message?.text ?? 'sast finding',
          file: loc?.artifactLocation?.uri, line: loc?.region?.startLine, raw: res,
        });
      }
    }
    return out;
  } catch { return []; }
}

function mapLevel(level: string): Severity {
  const l = String(level).toLowerCase();
  if (l === 'error' || l === 'critical') return 'critical';
  if (l === 'high') return 'high';
  if (l === 'warning' || l === 'medium') return 'medium';
  if (l === 'note' || l === 'low') return 'low';
  return 'info';
}
