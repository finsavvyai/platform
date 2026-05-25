#!/usr/bin/env tsx
/**
 * Cert evidence bundle generator.
 * Produces a single zip the M365 / SOC 2 / customer auditor can download.
 *
 *   pnpm tsx scripts/cert-evidence-bundle.ts
 *   open .luna/cert-evidence/cert-evidence-<date>.zip
 *
 * Bundle contents (declared in MANIFEST.md inside the zip):
 *   - all docs/* (cert artefacts)
 *   - .github/workflows/security.yml + cert-status.yml
 *   - last 90 days of GH Actions security run summaries (if `gh` available)
 *   - last Playwright smoke result JSON (if present)
 *   - sha256sums.txt covering every file
 *   - cover-letter.md (auto-filled — see scripts/gen-cover-letter.ts)
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '.luna/cert-evidence');
const STAMP = new Date().toISOString().slice(0, 10);
const STAGE = path.join(OUT, `bundle-${STAMP}`);
const ZIP = path.join(OUT, `cert-evidence-${STAMP}.zip`);

function copyTree(src: string, dst: string) {
	fs.mkdirSync(dst, { recursive: true });
	for (const e of fs.readdirSync(src, { withFileTypes: true })) {
		const s = path.join(src, e.name);
		const d = path.join(dst, e.name);
		if (e.isDirectory()) copyTree(s, d);
		else fs.copyFileSync(s, d);
	}
}

function sh(cmd: string): string {
	try {
		return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
	} catch {
		return '';
	}
}

async function main() {
	fs.rmSync(STAGE, { recursive: true, force: true });
	fs.mkdirSync(STAGE, { recursive: true });

	copyTree(path.join(ROOT, 'docs'), path.join(STAGE, 'docs'));
	fs.mkdirSync(path.join(STAGE, '.github/workflows'), { recursive: true });
	for (const wf of ['security.yml', 'cert-status.yml', 'ci.yml']) {
		const src = path.join(ROOT, '.github/workflows', wf);
		if (fs.existsSync(src)) fs.copyFileSync(src, path.join(STAGE, '.github/workflows', wf));
	}

	const ciHistory = sh('gh run list --workflow=security.yml --limit=20 --json databaseId,status,conclusion,createdAt,headSha,event --jq .');
	if (ciHistory) fs.writeFileSync(path.join(STAGE, 'ci-security-history.json'), ciHistory);

	const smoke = path.join(ROOT, 'test-results/results.json');
	if (fs.existsSync(smoke)) fs.copyFileSync(smoke, path.join(STAGE, 'playwright-smoke-latest.json'));

	const gitHead = sh('git rev-parse HEAD');
	const gitTag = sh('git describe --tags --always');
	const branch = sh('git rev-parse --abbrev-ref HEAD');

	const manifest = [
		'# Evidence bundle manifest',
		`Generated: ${new Date().toISOString()}`,
		`Git commit: ${gitHead}`,
		`Git describe: ${gitTag}`,
		`Branch: ${branch}`,
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

	fs.rmSync(ZIP, { force: true });
	execSync(`cd "${OUT}" && zip -qr "${path.basename(ZIP)}" "bundle-${STAMP}"`, { stdio: 'inherit' });

	const sizeMb = (fs.statSync(ZIP).size / 1024 / 1024).toFixed(2);
	console.log(`OK  ${ZIP}  ${sizeMb} MB`);
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

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
