import { Finding, Severity, ToolResult } from '../types.js';
import { ensureTool, run, writeRaw } from '../util.js';

const NUCLEI = { name: 'nuclei', binary: 'nuclei', installHint: 'brew install nuclei' };
const ZAP = { name: 'zap-baseline', binary: 'zap-baseline.py', installHint: 'brew install zaproxy' };

export interface DastOpts {
  targetUrl: string;
  profile?: 'baseline' | 'full' | 'api';
  templates?: string;
  prodConfirmed?: boolean;
}

const PROD_HINTS = ['api.', 'app.', 'www.', '.com', '.ai', '.io', '.dev'];

export async function runDast(opts: DastOpts): Promise<ToolResult> {
  const start = Date.now();
  if (!opts.prodConfirmed && looksProd(opts.targetUrl)) {
    const f: Finding = {
      id: 'dast-prod-not-confirmed', tool: 'dast-guard', ruleId: 'authorization-required',
      severity: 'high',
      message: `Refusing to scan ${opts.targetUrl} — looks like prod. Pass prodConfirmed=true with documented authorization.`,
    };
    return { tool: 'dast', ok: false, durationMs: Date.now() - start, findings: [f] };
  }

  const findings: Finding[] = [];
  const tmpl = opts.templates ?? 'cves,exposures,misconfiguration,default-logins,vulnerabilities';

  await ensureTool(NUCLEI);
  const n = await run('nuclei', ['-u', opts.targetUrl, '-jsonl', '-silent', '-rl', '100', '-t', tmpl], { timeoutMs: 600_000 })
    .catch((e) => ({ code: 1, stdout: '', stderr: e.message }));
  if (n.stdout) {
    writeRaw('dast-nuclei.json', n.stdout);
    findings.push(...parseNuclei(n.stdout));
  }

  if (await ensureTool(ZAP).then(() => true, () => false)) {
    const args = ['-t', opts.targetUrl, '-J', '/tmp/zap.json', '-r', '/tmp/zap.html'];
    const z = await run('zap-baseline.py', args, { timeoutMs: 900_000 }).catch((e) => ({ code: 1, stdout: '', stderr: e.message }));
    if (z.stdout || z.stderr) writeRaw('dast-zap.html', z.stdout || z.stderr);
  }
  return { tool: 'dast', ok: true, durationMs: Date.now() - start, findings };
}

function looksProd(url: string): boolean {
  const u = url.toLowerCase();
  if (u.includes('localhost') || u.includes('127.0.0.1') || u.includes('staging') || u.includes('preview')) return false;
  return PROD_HINTS.some((h) => u.includes(h));
}

function parseNuclei(s: string): Finding[] {
  const out: Finding[] = [];
  for (const line of s.split('\n').filter(Boolean)) {
    try {
      const j = JSON.parse(line);
      out.push({
        id: `nuclei-${j['template-id']}-${j.host}`, tool: 'nuclei', ruleId: j['template-id'] ?? 'unknown',
        severity: (String(j.info?.severity ?? '').toLowerCase() as Severity) || 'medium',
        message: j.info?.name ?? 'nuclei finding', file: j.host, raw: j,
      });
    } catch { /* skip */ }
  }
  return out;
}
