import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Finding, Severity, ToolResult } from '../types.js';
import { run, secDir } from '../util.js';

export interface ThreatModelOpts { model?: string; }

const SCAFFOLD = `# Threagile model — scaffold; edit before running.
title: LunaOS Threat Model
date: 2026-04-27
author: { name: Luna }
business_overview: { description: "LunaOS — multi-product AI agent platform" }
data_assets:
  user_data:
    name: User Data
    description: User accounts, API keys, audit events
    confidentiality: confidential
    integrity: critical
    availability: important
technical_assets:
  api:
    name: lunaos-engine API
    type: process
    technology: web-application
    encryption: transparent
    out_of_scope: false
trust_boundaries: {}
shared_runtimes: {}
risk_tracking: {}
`;

export async function runThreatModel(opts: ThreatModelOpts = {}): Promise<ToolResult> {
  const start = Date.now();
  const path = opts.model ?? `${secDir()}/threat-model.yaml`;
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, SCAFFOLD);
  }

  const out = `${secDir()}/threat-model-report`;
  mkdirSync(out, { recursive: true });

  // Threagile distributes via docker; try docker first, fallback to native binary.
  let r = await run('docker', ['run', '--rm', '-v', `${dirname(path)}:/work`, 'threagile/threagile:latest', 'analyze', '-model', `/work/${path.split('/').pop()}`, '-output', '/work/threat-model-report'], { timeoutMs: 300_000 })
    .catch((e) => ({ code: 1, stdout: '', stderr: e.message }));
  if (r.code !== 0) {
    r = await run('threagile', ['analyze', '-model', path, '-output', out], { timeoutMs: 300_000 })
      .catch((e) => ({ code: 1, stdout: '', stderr: e.message }));
  }
  if (r.code !== 0) {
    return { tool: 'threat-model', ok: false, durationMs: Date.now() - start, findings: [], error: r.stderr.slice(0, 500) };
  }

  const findings: Finding[] = [];
  // Threagile writes risks.json with severity markings.
  try {
    const risksPath = `${out}/risks.json`;
    if (existsSync(risksPath)) {
      const j = JSON.parse(require('node:fs').readFileSync(risksPath, 'utf-8'));
      for (const r2 of j.risks ?? []) {
        findings.push({
          id: `threagile-${r2.synthetic_id ?? r2.title}`, tool: 'threagile',
          ruleId: r2.category ?? 'unknown',
          severity: (String(r2.severity ?? '').toLowerCase() as Severity) || 'medium',
          message: r2.title ?? 'threat-model risk',
        });
      }
    }
  } catch { /* ignore */ }
  return { tool: 'threat-model', ok: true, durationMs: Date.now() - start, findings };
}
