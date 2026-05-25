import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { OrchestratorReport, formatHistogram, topFindings } from './orchestrator.js';
import { secDir } from './util.js';
import { Severity } from './types.js';

export function writeReport(name: string, r: OrchestratorReport): string {
  const path = join(secDir(), name);
  writeFileSync(path, renderMarkdown(name, r));
  appendTrend(r);
  return path;
}

export function renderMarkdown(name: string, r: OrchestratorReport): string {
  const date = new Date().toISOString().slice(0, 10);
  const histogram = formatHistogram(r.histogram);
  const status = r.bypassed ? 'BYPASSED' : r.blocked ? 'BLOCKED' : 'OK';
  const top = topFindings(r.findings, 10);

  let md = `# ${name.replace('.md', '')} — ${date}\n\n`;
  md += `**Status**: ${status}  ·  ${histogram}\n\n`;
  md += `## Tool runs\n\n`;
  md += `| tool | ok | findings | durationMs | error |\n|------|----|----------|------------|-------|\n`;
  for (const t of r.results) {
    md += `| ${t.tool} | ${t.ok ? '✓' : '✗'} | ${t.findings.length} | ${t.durationMs} | ${(t.error ?? '').replace(/\|/g, '/').slice(0, 60)} |\n`;
  }
  if (top.length > 0) {
    md += `\n## Top findings\n\n`;
    for (const f of top) {
      md += `- **[${f.severity.toUpperCase()}]** ${f.tool}/${f.ruleId} — ${f.message}`;
      if (f.file) md += `  \`${f.file}${f.line ? ':' + f.line : ''}\``;
      md += `\n`;
    }
  } else {
    md += `\n## Top findings\n\nNo findings.\n`;
  }
  return md;
}

interface TrendRecord { ts: string; histogram: Record<Severity, number>; }

function appendTrend(r: OrchestratorReport): void {
  const path = join(secDir(), 'trend.json');
  const arr: TrendRecord[] = existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : [];
  arr.push({ ts: new Date().toISOString(), histogram: r.histogram });
  // keep last 90 days
  const cutoff = Date.now() - 90 * 24 * 3600 * 1000;
  const trimmed = arr.filter((rec) => Date.parse(rec.ts) >= cutoff);
  writeFileSync(path, JSON.stringify(trimmed, null, 2));
}

export function aggregateAll(): string {
  // Roll latest summaries into SUMMARY.md
  const names = ['precommit-summary.md', 'pr-summary.md', 'build-summary.md', 'deploy-summary.md', 'runtime-summary.md', 'watch-latest-summary.md', 'PUSH_REPORT.md'];
  let body = `# Security SUMMARY — ${new Date().toISOString().slice(0, 10)}\n\n`;
  for (const n of names) {
    const p = join(secDir(), n);
    if (!existsSync(p)) continue;
    body += `\n---\n\n## ${n}\n\n` + readFileSync(p, 'utf-8') + '\n';
  }
  const out = join(secDir(), 'SUMMARY.md');
  writeFileSync(out, body);
  return out;
}
