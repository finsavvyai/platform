import { Finding, Severity, SEVERITY_RANK, ToolResult } from './types.js';
import { dedupe, loadConfig, logBypass, secDir, severityGateFails } from './util.js';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SEV_LABEL: Record<Severity, string> = {
  critical: 'CRITICAL', high: 'HIGH', medium: 'MEDIUM', low: 'LOW', info: 'INFO',
};

export interface RunOpts { strict?: boolean; bypass?: boolean; }

export interface OrchestratorReport {
  findings: Finding[];
  histogram: Record<Severity, number>;
  results: ToolResult[];
  blocked: boolean;
  bypassed: boolean;
}

export async function runOrchestrated(
  steps: Array<() => Promise<ToolResult>>,
  opts: RunOpts = {},
): Promise<OrchestratorReport> {
  const bypass = opts.bypass || process.env.LUNA_SEC_BYPASS === '1';
  if (bypass) logBypass('orchestrator bypass via LUNA_SEC_BYPASS=1 or --bypass');

  const cfg = loadConfig();
  const strict = opts.strict ?? cfg.strict;
  const results: ToolResult[] = [];
  const all: Finding[] = [];

  for (const step of steps) {
    try {
      const r = await step();
      results.push(r);
      all.push(...r.findings);
    } catch (e) {
      results.push({ tool: 'unknown', ok: false, durationMs: 0, findings: [], error: (e as Error).message });
    }
  }

  const findings = dedupe(all);
  const histogram = histogramOf(findings);
  const blocked = !bypass && severityGateFails(findings, cfg, strict);
  return { findings, histogram, results, blocked, bypassed: bypass };
}

export function histogramOf(findings: Finding[]): Record<Severity, number> {
  const h: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) h[f.severity]++;
  return h;
}

export function formatHistogram(h: Record<Severity, number>): string {
  const parts: string[] = [];
  for (const s of Object.keys(SEV_LABEL) as Severity[]) parts.push(`${SEV_LABEL[s]}=${h[s]}`);
  return parts.join('  ');
}

export function topFindings(findings: Finding[], n = 10): Finding[] {
  return [...findings].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]).slice(0, n);
}

export function writeSummary(name: string, body: string): string {
  const p = join(secDir(), name);
  writeFileSync(p, body);
  return p;
}
