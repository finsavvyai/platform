import { Finding, Severity, ToolResult } from '../types.js';
import { ensureTool, run, writeRaw } from '../util.js';

const TRIVY = { name: 'trivy', binary: 'trivy', installHint: 'brew install trivy' };
const HADOLINT = { name: 'hadolint', binary: 'hadolint', installHint: 'brew install hadolint' };
const DOCKLE = { name: 'dockle', binary: 'dockle', installHint: 'brew install goodwithtech/r/dockle' };

export interface ContainerOpts { image: string; dockerfile?: string; severity?: string; }

export async function runContainer(opts: ContainerOpts): Promise<ToolResult> {
  const start = Date.now();
  const findings: Finding[] = [];
  const sevFlag = opts.severity ?? 'CRITICAL,HIGH';

  await ensureTool(TRIVY);
  const trivy = await run('trivy', ['image', '--quiet', '--format', 'sarif', '--severity', sevFlag, opts.image]).catch((e) => ({ code: 1, stdout: '', stderr: e.message }));
  if (trivy.stdout) {
    writeRaw('container-trivy.sarif', trivy.stdout);
    findings.push(...parseTrivy(trivy.stdout));
  }

  if (opts.dockerfile && await ensureTool(HADOLINT).then(() => true, () => false)) {
    const h = await run('hadolint', ['-f', 'json', opts.dockerfile]).catch((e) => ({ code: 1, stdout: '[]', stderr: e.message }));
    if (h.stdout) {
      writeRaw('container-hadolint.json', h.stdout);
      findings.push(...parseHadolint(h.stdout));
    }
  }

  if (await ensureTool(DOCKLE).then(() => true, () => false)) {
    const d = await run('dockle', ['-f', 'json', opts.image]).catch((e) => ({ code: 1, stdout: '{}', stderr: e.message }));
    if (d.stdout) {
      writeRaw('container-dockle.json', d.stdout);
      findings.push(...parseDockle(d.stdout));
    }
  }
  return { tool: 'container', ok: true, durationMs: Date.now() - start, findings };
}

function parseTrivy(s: string): Finding[] {
  try {
    const j = JSON.parse(s);
    const out: Finding[] = [];
    for (const r of j.runs ?? []) {
      for (const res of r.results ?? []) {
        const loc = res.locations?.[0]?.physicalLocation;
        out.push({
          id: `trivy-${res.ruleId}`, tool: 'trivy', ruleId: res.ruleId ?? 'unknown',
          severity: mapTrivy(res.level ?? 'warning'),
          message: res.message?.text ?? 'image vuln',
          file: loc?.artifactLocation?.uri, raw: res,
        });
      }
    }
    return out;
  } catch { return []; }
}

function parseHadolint(s: string): Finding[] {
  try {
    return (JSON.parse(s) as any[]).map((h) => ({
      id: `hadolint-${h.code}-${h.line}`, tool: 'hadolint', ruleId: h.code ?? 'DL?',
      severity: (h.level === 'error' ? 'high' : h.level === 'warning' ? 'medium' : 'low') as Severity,
      message: h.message ?? 'dockerfile lint', file: h.file, line: h.line,
    }));
  } catch { return []; }
}

function parseDockle(s: string): Finding[] {
  try {
    const j = JSON.parse(s);
    return (j.details ?? []).map((d: any) => ({
      id: `dockle-${d.code}`, tool: 'dockle', ruleId: d.code ?? 'CIS?',
      severity: (d.level === 'FATAL' ? 'critical' : d.level === 'WARN' ? 'high' : 'medium') as Severity,
      message: d.title ?? 'image hardening', raw: d,
    }));
  } catch { return []; }
}

function mapTrivy(l: string): Severity {
  const v = l.toLowerCase();
  if (v === 'error') return 'critical';
  if (v === 'warning') return 'high';
  if (v === 'note') return 'medium';
  return 'low';
}
