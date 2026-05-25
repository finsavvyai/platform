import { runOrchestrated, OrchestratorReport } from './orchestrator.js';
import { runSecrets } from './tools/secrets.js';
import { runSast } from './tools/sast.js';
import { runDeps } from './tools/deps.js';
import { runIac } from './tools/iac.js';
import { runContainer } from './tools/container.js';
import { runSbom } from './tools/sbom.js';
import { runSign } from './tools/sign.js';
import { runDast } from './tools/dast.js';
import { runFuzz } from './tools/fuzz.js';
import { runThreatModel } from './tools/threat-model.js';
import { writeReport } from './report.js';

export interface BundleOpts {
  strict?: boolean; bypass?: boolean;
  image?: string; targetUrl?: string; dockerfile?: string;
}

export async function runPrecommit(opts: BundleOpts = {}): Promise<OrchestratorReport> {
  const r = await runOrchestrated([() => runSecrets({ scope: 'staged' })], opts);
  writeReport('precommit-summary.md', r);
  return r;
}

export async function runPr(opts: BundleOpts = {}): Promise<OrchestratorReport> {
  const r = await runOrchestrated([
    () => runSecrets(),
    () => runSast(),
    () => runDeps(),
  ], opts);
  writeReport('pr-summary.md', r);
  return r;
}

export async function runBuild(opts: BundleOpts & { artifact?: string } = {}): Promise<OrchestratorReport> {
  const artifact = opts.artifact ?? opts.image;
  if (!artifact) throw new Error('build bundle requires --artifact');
  const r = await runOrchestrated([
    () => runSbom({ target: artifact, runGrype: true }),
    () => runSign({ artifact, kind: 'image' }),
  ], opts);
  writeReport('build-summary.md', r);
  return r;
}

export async function runDeploy(opts: BundleOpts = {}): Promise<OrchestratorReport> {
  if (!opts.image) throw new Error('deploy bundle requires --image');
  const r = await runOrchestrated([
    () => runContainer({ image: opts.image!, dockerfile: opts.dockerfile }),
    () => runIac(),
  ], opts);
  writeReport('deploy-summary.md', r);
  return r;
}

export async function runRuntime(opts: BundleOpts = {}): Promise<OrchestratorReport> {
  if (!opts.targetUrl) throw new Error('runtime bundle requires --target-url');
  const r = await runOrchestrated([() => runDast({ targetUrl: opts.targetUrl! })], opts);
  writeReport('runtime-summary.md', r);
  return r;
}

export async function runWatch(opts: BundleOpts = {}): Promise<OrchestratorReport> {
  const steps = [() => runDeps(), () => runIac()];
  if (opts.targetUrl) steps.push(() => runDast({ targetUrl: opts.targetUrl! }));
  const r = await runOrchestrated(steps, { ...opts, strict: false });
  writeReport('watch-latest-summary.md', r);
  return r;
}

export async function runPush(opts: BundleOpts & { mode?: 'fast' | 'full' | 'ci' } = {}): Promise<OrchestratorReport> {
  const mode = opts.mode ?? 'fast';
  const steps: Array<() => Promise<any>> = [
    () => runSecrets(),
    () => runSast(),
    () => runDeps(),
    () => runIac(),
  ];
  if (opts.image) {
    steps.push(() => runContainer({ image: opts.image!, dockerfile: opts.dockerfile }));
    steps.push(() => runSbom({ target: opts.image!, runGrype: true }));
  }
  if (mode === 'full') {
    if (opts.targetUrl) steps.push(() => runDast({ targetUrl: opts.targetUrl! }));
    steps.push(() => runFuzz({ target: '.', durationSeconds: 60 }));
    steps.push(() => runThreatModel());
  }
  const r = await runOrchestrated(steps, opts);
  writeReport('PUSH_REPORT.md', r);
  return r;
}
