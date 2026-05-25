import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Finding, ToolResult } from '../types.js';
import { ensureTool, run, secDir } from '../util.js';

const SYFT = { name: 'syft', binary: 'syft', installHint: 'brew install syft' };
const GRYPE = { name: 'grype', binary: 'grype', installHint: 'brew install grype' };

export interface SbomOpts { target: string; formats?: string[]; runGrype?: boolean; }

export async function runSbom(opts: SbomOpts): Promise<ToolResult> {
  const start = Date.now();
  await ensureTool(SYFT);
  const findings: Finding[] = [];
  const formats = opts.formats ?? ['cyclonedx-json', 'spdx-json'];
  const dir = join(secDir(), 'sbom');
  mkdirSync(dir, { recursive: true });

  for (const fmt of formats) {
    const file = join(dir, `sbom.${fmt.startsWith('cyclonedx') ? 'cdx' : 'spdx'}.json`);
    const r = await run('syft', [opts.target, '-q', '-o', `${fmt}=${file}`]).catch((e) => ({ code: 1, stdout: '', stderr: e.message }));
    if (r.code !== 0) {
      return { tool: 'sbom', ok: false, durationMs: Date.now() - start, findings: [], error: r.stderr.slice(0, 500) };
    }
  }

  const cdxPath = join(dir, 'sbom.cdx.json');
  try {
    const buf = readFileSync(cdxPath);
    const sha = createHash('sha256').update(buf).digest('hex');
    writeFileSync(join(dir, 'sbom.sha256'), sha + '\n');
  } catch { /* ignore */ }

  if (opts.runGrype && await ensureTool(GRYPE).then(() => true, () => false)) {
    const g = await run('grype', [`sbom:${cdxPath}`, '-o', 'json']).catch((e) => ({ code: 1, stdout: '{}', stderr: e.message }));
    if (g.stdout) findings.push(...parseGrype(g.stdout));
  }
  return { tool: 'sbom', ok: true, durationMs: Date.now() - start, findings, rawOutputPath: cdxPath };
}

function parseGrype(s: string): Finding[] {
  try {
    const j = JSON.parse(s);
    return (j.matches ?? []).map((m: any) => ({
      id: `grype-${m.vulnerability?.id}`, tool: 'grype', ruleId: m.vulnerability?.id ?? 'unknown',
      severity: (String(m.vulnerability?.severity ?? '').toLowerCase() as any) || 'medium',
      message: `${m.vulnerability?.id} in ${m.artifact?.name}@${m.artifact?.version}`,
    }));
  } catch { return []; }
}
