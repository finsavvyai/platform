import { Finding, Severity, ToolResult } from '../types.js';
import { ensureTool, run, writeRaw } from '../util.js';

const GITLEAKS = { name: 'gitleaks', binary: 'gitleaks', installHint: 'brew install gitleaks' };
const TRUFFLEHOG = { name: 'trufflehog', binary: 'trufflehog', installHint: 'brew install trufflehog' };

export interface SecretsOpts { scope?: 'staged' | 'working' | 'history' | 'all'; target?: string; }

export async function runSecrets(opts: SecretsOpts = {}): Promise<ToolResult> {
  const start = Date.now();
  const target = opts.target ?? '.';
  const scope = opts.scope ?? 'all';
  const findings: Finding[] = [];

  await ensureTool(GITLEAKS).catch(() => { /* warn-only; trufflehog still tries */ });
  const args = scope === 'staged' ? ['protect', '--staged', '--report-format=sarif', '--report-path=-']
    : ['detect', '--source', target, '--report-format=sarif', '--report-path=-', '--no-banner'];
  const gl = await run('gitleaks', args).catch((e) => ({ code: 1, stdout: '', stderr: e.message }));
  if (gl.stdout) {
    writeRaw('secrets-gitleaks.sarif', gl.stdout);
    findings.push(...parseGitleaksSarif(gl.stdout));
  }

  const truffleAvail = await ensureTool(TRUFFLEHOG).then(() => true, () => false);
  if (truffleAvail) {
    const th = await run('trufflehog', ['filesystem', target, '--json', '--only-verified']).catch((e) => ({ code: 1, stdout: '', stderr: e.message }));
    if (th.stdout) {
      writeRaw('secrets-trufflehog.json', th.stdout);
      findings.push(...parseTrufflehog(th.stdout));
    }
  }

  return { tool: 'secrets', ok: true, durationMs: Date.now() - start, findings };
}

function parseGitleaksSarif(s: string): Finding[] {
  try {
    const j = JSON.parse(s);
    const out: Finding[] = [];
    for (const run of j.runs ?? []) {
      for (const r of run.results ?? []) {
        const loc = r.locations?.[0]?.physicalLocation;
        out.push({
          id: `gitleaks-${r.ruleId}-${loc?.artifactLocation?.uri ?? ''}-${loc?.region?.startLine ?? 0}`,
          tool: 'gitleaks', ruleId: r.ruleId ?? 'unknown',
          severity: (r.level === 'error' ? 'high' : 'medium') as Severity,
          message: r.message?.text ?? 'secret detected',
          file: loc?.artifactLocation?.uri, line: loc?.region?.startLine, raw: r,
        });
      }
    }
    return out;
  } catch { return []; }
}

function parseTrufflehog(s: string): Finding[] {
  const out: Finding[] = [];
  for (const line of s.split('\n').filter(Boolean)) {
    try {
      const j = JSON.parse(line);
      out.push({
        id: `trufflehog-${j.DetectorName}-${j.SourceMetadata?.Data?.Filesystem?.file ?? ''}-${j.SourceMetadata?.Data?.Filesystem?.line ?? 0}`,
        tool: 'trufflehog', ruleId: j.DetectorName ?? 'unknown',
        severity: j.Verified ? 'critical' : 'high',
        message: `${j.DetectorName} secret${j.Verified ? ' (verified live)' : ''}`,
        file: j.SourceMetadata?.Data?.Filesystem?.file,
        line: j.SourceMetadata?.Data?.Filesystem?.line, raw: j,
      });
    } catch { /* skip */ }
  }
  return out;
}
