import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Finding, ToolResult } from '../types.js';
import { ensureTool, run, secDir } from '../util.js';

const COSIGN = { name: 'cosign', binary: 'cosign', installHint: 'brew install cosign' };

export interface SignOpts {
  artifact: string;
  kind: 'image' | 'blob' | 'sbom' | 'attestation';
  predicateType?: string;
  oidcIssuer?: string;
}

export async function runSign(opts: SignOpts): Promise<ToolResult> {
  const start = Date.now();
  await ensureTool(COSIGN);
  const dir = join(secDir(), 'signatures');
  mkdirSync(dir, { recursive: true });

  let args: string[];
  if (opts.kind === 'image') {
    args = ['sign', '--yes', opts.artifact];
  } else if (opts.kind === 'blob') {
    args = ['sign-blob', '--yes', '--output-signature', join(dir, 'blob.sig'), '--output-certificate', join(dir, 'blob.pem'), opts.artifact];
  } else if (opts.kind === 'sbom') {
    args = ['attach', 'sbom', '--sbom', opts.artifact, opts.artifact];
  } else {
    const pt = opts.predicateType ?? 'cyclonedx';
    args = ['attest', '--yes', '--predicate', opts.artifact, '--type', pt, opts.artifact];
  }

  const env: NodeJS.ProcessEnv = { COSIGN_EXPERIMENTAL: '1' };
  if (opts.oidcIssuer) env.COSIGN_OIDC_ISSUER = opts.oidcIssuer;

  const r = await run('cosign', args, { env, timeoutMs: 300_000 }).catch((e) => ({ code: 1, stdout: '', stderr: e.message }));
  if (r.code !== 0) {
    const finding: Finding = {
      id: 'cosign-fail', tool: 'cosign', ruleId: 'sign-failed',
      severity: 'high', message: `cosign ${opts.kind} failed: ${r.stderr.split('\n')[0]}`,
    };
    return { tool: 'sign', ok: false, durationMs: Date.now() - start, findings: [finding], error: r.stderr.slice(0, 500) };
  }
  return { tool: 'sign', ok: true, durationMs: Date.now() - start, findings: [] };
}
