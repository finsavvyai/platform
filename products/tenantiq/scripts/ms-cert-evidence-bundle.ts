#!/usr/bin/env tsx
/**
 * Microsoft 365 Certification evidence bundle generator.
 *
 * Produces the artifact package for Phase 5 of the Microsoft partner roadmap
 * (third-party assessor review by Bureau Veritas / Schellman / LRQA).
 *
 *   pnpm tsx scripts/ms-cert-evidence-bundle.ts
 *   open .luna/ms-cert-evidence/ms-cert-evidence-<date>.zip
 *
 * Bundle contents declared in MANIFEST.md inside the zip:
 *   - docs/microsoft/* (Publisher Attestation answers, threat model,
 *     AppSource listing copy, env-var operator runbook)
 *   - docs/anthropic/SUBMISSION_PACKET.md (proves Anthropic dependency disclosure)
 *   - .luna/tenantiq/strategy/2026-05-08_microsoft_partner_plan.md
 *   - architecture diagram (regenerated from gen-architecture-diagram.ts)
 *   - sub-processor cert-drift check output
 *   - latest no-bluf report (proves we audit our own claims)
 *   - runtime stats snapshot (test count, route count, D1 table count, ...)
 *   - last 30 GitHub Actions runs of cert-status.yml workflow
 *   - sha256sums.txt over every file
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '.luna/ms-cert-evidence');
const STAMP = new Date().toISOString().slice(0, 10);
const STAGE = path.join(OUT, `bundle-${STAMP}`);
const ZIP = path.join(OUT, `ms-cert-evidence-${STAMP}.zip`);

function sh(cmd: string, allowFail = true): string {
	try {
		return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
	} catch (e) {
		if (!allowFail) throw e;
		return '';
	}
}

function copyIfExists(src: string, dst: string): boolean {
	const abs = path.join(ROOT, src);
	if (!fs.existsSync(abs)) return false;
	fs.mkdirSync(path.dirname(dst), { recursive: true });
	fs.copyFileSync(abs, dst);
	return true;
}

function copyTree(src: string, dst: string) {
	if (!fs.existsSync(src)) return;
	fs.mkdirSync(dst, { recursive: true });
	for (const e of fs.readdirSync(src, { withFileTypes: true })) {
		const s = path.join(src, e.name);
		const d = path.join(dst, e.name);
		if (e.isDirectory()) copyTree(s, d);
		else fs.copyFileSync(s, d);
	}
}

function listFiles(root: string): string[] {
	const out: string[] = [];
	for (const e of fs.readdirSync(root, { withFileTypes: true })) {
		const p = path.join(root, e.name);
		if (e.isDirectory()) out.push(...listFiles(p));
		else out.push(p);
	}
	return out;
}

function captureStats(): Record<string, string | number> {
	const stats: Record<string, string | number> = {
		generatedAt: new Date().toISOString(),
		gitCommit: sh('git rev-parse HEAD'),
		gitDescribe: sh('git describe --tags --always'),
		branch: sh('git rev-parse --abbrev-ref HEAD'),
	};
	stats.apiRouteFiles = parseInt(sh('find apps/api/src/routes -name "*.ts" -not -name "*.test.ts" | wc -l') || '0', 10);
	stats.webPages = parseInt(sh('find apps/web/src/routes -name "+page.svelte" | wc -l') || '0', 10);
	stats.svelteComponents = parseInt(sh('find apps/web/src/lib/components -name "*.svelte" | wc -l') || '0', 10);
	stats.d1Tables = parseInt(sh('grep -c "sqliteTable(" packages/db/src/schema-d1.ts') || '0', 10);
	stats.d1Migrations = parseInt(sh('ls packages/db/migrations | wc -l') || '0', 10);
	stats.apiTestFiles = parseInt(sh('find apps/api/src -name "*.test.ts" | wc -l') || '0', 10);
	stats.cronJobs = parseInt(sh('ls apps/api/src/cron 2>/dev/null | wc -l') || '0', 10);
	stats.queueHandlers = parseInt(sh('ls apps/api/src/queues 2>/dev/null | wc -l') || '0', 10);
	stats.e2eSpecs = parseInt(sh('find tests/e2e -name "*.spec.ts" | wc -l') || '0', 10);
	return stats;
}

async function main() {
	fs.rmSync(STAGE, { recursive: true, force: true });
	fs.mkdirSync(STAGE, { recursive: true });

	// 1. Microsoft-specific docs (Publisher Attestation, threat model, etc.)
	copyTree(path.join(ROOT, 'docs/microsoft'), path.join(STAGE, 'docs/microsoft'));

	// 2. Strategy + Anthropic submission disclosure
	copyIfExists('.luna/tenantiq/strategy/2026-05-08_microsoft_partner_plan.md', path.join(STAGE, 'strategy/microsoft_partner_plan.md'));
	copyIfExists('docs/anthropic/SUBMISSION_PACKET.md', path.join(STAGE, 'disclosures/anthropic_dependency.md'));

	// 3. Sub-processor disclosure (privacy page is canonical)
	copyIfExists('apps/web/src/routes/privacy/+page.svelte', path.join(STAGE, 'disclosures/privacy_page_source.svelte'));

	// 4. Architecture diagram
	const archScript = path.join(ROOT, 'scripts/gen-architecture-diagram.ts');
	if (fs.existsSync(archScript)) {
		sh(`pnpm tsx scripts/gen-architecture-diagram.ts > .luna/ms-cert-evidence/_arch.txt 2>/dev/null`);
		const arch = path.join(ROOT, '.luna/ms-cert-evidence/_arch.txt');
		if (fs.existsSync(arch)) fs.copyFileSync(arch, path.join(STAGE, 'architecture-diagram.txt'));
	}

	// 5. Sub-processor cert-drift check
	const driftOut = sh('pnpm tsx scripts/check-cert-drift.ts 2>&1 || true');
	fs.writeFileSync(path.join(STAGE, 'cert-drift-check.txt'), driftOut || '(check-cert-drift.ts not found or skipped)');

	// 6. No-bluf report (proves we audit our own marketing claims)
	copyIfExists('.luna/tenantiq/no-bluf-report.md', path.join(STAGE, 'integrity/no-bluf-report.md'));

	// 7. CI history — last 30 cert-status runs
	const ci = sh('gh run list --workflow=cert-status.yml --limit=30 --json databaseId,status,conclusion,createdAt,headSha,event --jq .');
	if (ci) {
		fs.mkdirSync(path.join(STAGE, 'ci'), { recursive: true });
		fs.writeFileSync(path.join(STAGE, 'ci/cert-status-history.json'), ci);
	}
	fs.mkdirSync(path.join(STAGE, '.github/workflows'), { recursive: true });
	for (const wf of ['cert-status.yml', 'security.yml', 'ci.yml']) {
		copyIfExists(`.github/workflows/${wf}`, path.join(STAGE, '.github/workflows', wf));
	}

	// 8. Runtime stats snapshot
	const stats = captureStats();
	fs.writeFileSync(path.join(STAGE, 'stats-snapshot.json'), JSON.stringify(stats, null, 2));

	// 9. Manifest + checksums
	const manifest = [
		'# Microsoft 365 Certification — Evidence Bundle Manifest',
		`Generated: ${stats.generatedAt}`,
		`Git commit: ${stats.gitCommit}`,
		`Git describe: ${stats.gitDescribe}`,
		`Branch: ${stats.branch}`,
		'',
		'## Bundle scope',
		'This bundle is the Microsoft 365 Certification (Phase 5) evidence package.',
		'For SOC 2 / generic customer auditor review, see cert-evidence-bundle.ts (separate output).',
		'',
		'## Production stats (verifiable in this snapshot)',
		`- API route TS files: ${stats.apiRouteFiles}`,
		`- Web pages: ${stats.webPages}`,
		`- Svelte components: ${stats.svelteComponents}`,
		`- D1 tables: ${stats.d1Tables}`,
		`- D1 migrations: ${stats.d1Migrations}`,
		`- API unit test files: ${stats.apiTestFiles}`,
		`- Cron jobs: ${stats.cronJobs}`,
		`- Queue handlers: ${stats.queueHandlers}`,
		`- E2E spec files: ${stats.e2eSpecs}`,
		'',
		'## Files',
		...listFiles(STAGE).map((f) => `- ${path.relative(STAGE, f)}`),
	].join('\n');
	fs.writeFileSync(path.join(STAGE, 'MANIFEST.md'), manifest);

	const sums = listFiles(STAGE)
		.filter((f) => f !== path.join(STAGE, 'sha256sums.txt'))
		.map((f) => `${sh(`shasum -a 256 "${f}" | awk '{print $1}'`)}  ${path.relative(STAGE, f)}`)
		.join('\n');
	fs.writeFileSync(path.join(STAGE, 'sha256sums.txt'), sums);

	// 10. Zip
	fs.rmSync(ZIP, { force: true });
	execSync(`cd "${OUT}" && zip -qr "${path.basename(ZIP)}" "bundle-${STAMP}"`, { stdio: 'inherit' });

	const sizeMb = (fs.statSync(ZIP).size / 1024 / 1024).toFixed(2);
	console.log(`OK  ${ZIP}  ${sizeMb} MB`);
	console.log(`Hand this to the Microsoft 365 Cert assessor along with the SOC 2 Type 1 report + pen test report.`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
