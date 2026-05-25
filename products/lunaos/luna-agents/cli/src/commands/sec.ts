import { Command } from 'commander';
import chalk from 'chalk';
import { runSecrets } from '../sec/tools/secrets.js';
import { runSast } from '../sec/tools/sast.js';
import { runDeps } from '../sec/tools/deps.js';
import { runIac } from '../sec/tools/iac.js';
import { runContainer } from '../sec/tools/container.js';
import { runSbom } from '../sec/tools/sbom.js';
import { runSign } from '../sec/tools/sign.js';
import { runDast } from '../sec/tools/dast.js';
import { runFuzz } from '../sec/tools/fuzz.js';
import { runThreatModel } from '../sec/tools/threat-model.js';
import { runPrecommit, runPr, runBuild, runDeploy, runRuntime, runWatch, runPush } from '../sec/bundles.js';
import { aggregateAll } from '../sec/report.js';
import { install, uninstall, status as lifecycleStatus, Hook } from '../sec/lifecycle.js';
import { OrchestratorReport, formatHistogram } from '../sec/orchestrator.js';

function exitOnBlock(r: OrchestratorReport): void {
  console.log(chalk.dim(formatHistogram(r.histogram)));
  if (r.bypassed) console.log(chalk.yellow('  bypassed (LUNA_SEC_BYPASS=1) — see bypass.log'));
  if (r.blocked) { console.log(chalk.red('  ✗ blocked: critical/high findings')); process.exit(1); }
  console.log(chalk.green('  ✓ passed'));
}

export const secCommand = new Command('sec').description('Luna security lifecycle commands');

// Atomic
secCommand.command('secrets')
  .option('--scope <s>', 'staged|working|history|all', 'all')
  .option('--strict <b>', 'true|false', 'true')
  .action(async (o) => {
    const r = await runSecrets({ scope: o.scope });
    exitOnBlock({ findings: r.findings, histogram: histo(r.findings), results: [r], blocked: o.strict === 'true' && r.findings.some((f) => f.severity === 'critical' || f.severity === 'high'), bypassed: false });
  });

secCommand.command('sast')
  .option('--target <p>', 'path', '.')
  .option('--rulesets <r>', 'comma rulesets')
  .action(async (o) => {
    const r = await runSast({ target: o.target, rulesets: o.rulesets });
    exitOnBlock(wrap([r]));
  });

secCommand.command('deps').option('--target <p>', 'path', '.')
  .action(async (o) => exitOnBlock(wrap([await runDeps({ target: o.target })])));

secCommand.command('iac').option('--target <p>', 'path', '.')
  .action(async (o) => exitOnBlock(wrap([await runIac({ target: o.target })])));

secCommand.command('container')
  .requiredOption('--image <ref>', 'image ref')
  .option('--dockerfile <p>', 'Dockerfile path')
  .action(async (o) => exitOnBlock(wrap([await runContainer({ image: o.image, dockerfile: o.dockerfile })])));

secCommand.command('sbom').requiredOption('--target <ref>', 'path or image')
  .action(async (o) => exitOnBlock(wrap([await runSbom({ target: o.target, runGrype: true })])));

secCommand.command('sign').requiredOption('--artifact <ref>', 'image/blob/sbom')
  .option('--kind <k>', 'image|blob|sbom|attestation', 'image')
  .action(async (o) => exitOnBlock(wrap([await runSign({ artifact: o.artifact, kind: o.kind })])));

secCommand.command('dast').requiredOption('--target-url <u>', 'live URL')
  .option('--profile <p>', 'baseline|full|api', 'baseline')
  .option('--prod-confirmed', 'authorize prod scan', false)
  .action(async (o) => exitOnBlock(wrap([await runDast({ targetUrl: o.targetUrl, profile: o.profile, prodConfirmed: o.prodConfirmed })])));

secCommand.command('fuzz').requiredOption('--target <p>', 'path or symbol')
  .option('--language <l>', 'auto|js|ts|python|go', 'auto')
  .option('--duration <s>', 'seconds', '300')
  .action(async (o) => exitOnBlock(wrap([await runFuzz({ target: o.target, language: o.language, durationSeconds: Number(o.duration) })])));

secCommand.command('threat-model').option('--model <p>', 'yaml path')
  .action(async (o) => exitOnBlock(wrap([await runThreatModel({ model: o.model })])));

// Bundles
secCommand.command('precommit').action(async () => exitOnBlock(await runPrecommit()));
secCommand.command('pr').action(async () => exitOnBlock(await runPr()));
secCommand.command('build').requiredOption('--artifact <ref>').action(async (o) => exitOnBlock(await runBuild({ artifact: o.artifact, image: o.artifact })));
secCommand.command('deploy').requiredOption('--image <ref>').option('--dockerfile <p>').action(async (o) => exitOnBlock(await runDeploy({ image: o.image, dockerfile: o.dockerfile })));
secCommand.command('runtime').requiredOption('--target-url <u>').action(async (o) => exitOnBlock(await runRuntime({ targetUrl: o.targetUrl })));
secCommand.command('watch').option('--target-url <u>').action(async (o) => exitOnBlock(await runWatch({ targetUrl: o.targetUrl })));
secCommand.command('push')
  .option('--mode <m>', 'fast|full|ci', 'fast').option('--image <ref>').option('--target-url <u>').option('--strict <b>', 'true|false', 'true')
  .action(async (o) => exitOnBlock(await runPush({ mode: o.mode, image: o.image, targetUrl: o.targetUrl, strict: o.strict === 'true' })));

// Meta
secCommand.command('report').action(() => { console.log(aggregateAll()); });
secCommand.command('lifecycle')
  .option('--action <a>', 'install|status|uninstall', 'install')
  .option('--hooks <list>', 'comma list')
  .action((o) => {
    const hooks = o.hooks ? (o.hooks.split(',') as Hook[]) : undefined;
    const out = o.action === 'status' ? lifecycleStatus() : o.action === 'uninstall' ? uninstall() : install(hooks);
    for (const s of out) console.log(`${s.installed ? '✓' : '✗'}  ${s.hook.padEnd(20)} ${s.path}`);
  });

// helpers
function histo(findings: any[]) { const h: any = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }; for (const f of findings) h[f.severity]++; return h; }
function wrap(results: any[]): OrchestratorReport {
  const all = results.flatMap((r) => r.findings);
  return { findings: all, histogram: histo(all), results, blocked: all.some((f) => f.severity === 'critical' || f.severity === 'high'), bypassed: false };
}
