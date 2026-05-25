#!/usr/bin/env tsx
/**
 * Cert-drift PR check.
 * Fails CI when:
 *   1. A vendor host appears in source but is missing from SUB_PROCESSORS.md.
 *   2. A scope appears in GRAPH.OAUTH_SCOPES but is missing from GRAPH_PERMISSIONS.md.
 *   3. SUB_PROCESSORS.md lists a vendor that has zero source references.
 *
 *   pnpm tsx scripts/check-cert-drift.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(__dirname, '..');
const SUB = path.join(ROOT, 'docs/SUB_PROCESSORS.md');
const PERMS = path.join(ROOT, 'docs/GRAPH_PERMISSIONS.md');
const CONSTANTS = path.join(ROOT, 'apps/api/src/lib/constants.ts');

const KNOWN_VENDOR_HOSTS: Record<string, string> = {
	'login.microsoftonline.com': 'Microsoft',
	'graph.microsoft.com': 'Microsoft',
	'api.anthropic.com': 'Anthropic',
	'api.resend.com': 'Resend',
	'api.twilio.com': 'Twilio',
	'lemonsqueezy.com': 'LemonSqueezy',
	'sentry.io': 'Sentry',
	'cloudflare.com': 'Cloudflare',
};

const failures: string[] = [];

function discoveredVendors(): Set<string> {
	const out = new Set<string>();

	// Scan source for URL literals.
	let raw = '';
	try {
		raw = execSync(`grep -rIohE "https?://[a-zA-Z0-9.-]+|sentry\\.io|ingest\\.sentry" apps/api/src apps/web/src packages 2>/dev/null`, {
			cwd: ROOT, encoding: 'utf8',
		});
	} catch { /* no matches */ }
	for (const line of raw.split('\n')) {
		try {
			const h = new URL(line.replace(/[)>'",.]+$/, '').replace(/^([a-z]+\.)/, 'https://$1')).hostname.toLowerCase();
			for (const k of Object.keys(KNOWN_VENDOR_HOSTS)) if (h.endsWith(k)) out.add(KNOWN_VENDOR_HOSTS[k]);
		} catch { /* skip */ }
	}

	// Cloudflare presence is proven by wrangler.toml bindings, not URL literals.
	if (fs.existsSync(path.join(ROOT, 'apps/api/wrangler.toml'))) {
		out.add('Cloudflare');
	}

	// Sentry presence is also proven by SDK import (apps/api/src/lib/sentry.ts uses
	// @sentry/cloudflare; web uses a custom envelope but references sentry.io).
	try {
		const sentryRefs = execSync(
			`grep -rIl "@sentry/\\|sentry\\.io\\|ingest\\.sentry\\|SENTRY_DSN" apps/api/src apps/web/src 2>/dev/null`,
			{ cwd: ROOT, encoding: 'utf8' },
		);
		if (sentryRefs.trim()) out.add('Sentry');
	} catch { /* none */ }

	return out;
}

function listedVendors(): Set<string> {
	const md = fs.readFileSync(SUB, 'utf8');
	const out = new Set<string>();
	for (const m of md.matchAll(/^\| ([A-Z][A-Za-z0-9 ]+) \|/gm)) {
		const v = m[1].trim();
		if (v && v !== 'Provider') out.add(v);
	}
	return out;
}

function oauthScopes(): string[] {
	const src = fs.readFileSync(CONSTANTS, 'utf8');
	const block = src.match(/OAUTH_SCOPES:\s*\[([\s\S]*?)\]\.join/);
	if (!block) return [];
	return Array.from(block[1].matchAll(/'([A-Za-z._-]+)'/g), (m) => m[1]);
}

function permsMd(): string {
	return fs.readFileSync(PERMS, 'utf8');
}

function check() {
	const codeVendors = discoveredVendors();
	const docVendors = listedVendors();

	for (const v of codeVendors) {
		if (!docVendors.has(v)) failures.push(`SUB_PROCESSORS.md missing vendor "${v}" — found in source code.`);
	}
	for (const v of docVendors) {
		if (!codeVendors.has(v)) failures.push(`SUB_PROCESSORS.md lists "${v}" but no source reference found — drop or justify.`);
	}

	const scopes = oauthScopes();
	const docs = permsMd();
	for (const s of scopes) {
		if (s === 'openid' || s === 'profile' || s === 'email' || s === 'offline_access') continue;
		if (!docs.includes(s)) failures.push(`GRAPH_PERMISSIONS.md missing scope "${s}" — present in OAUTH_SCOPES.`);
	}
}

check();

if (failures.length === 0) {
	console.log('OK  cert-drift: no drift detected.');
	process.exit(0);
}

console.error(`FAIL  cert-drift: ${failures.length} issue(s).`);
for (const f of failures) console.error(`  - ${f}`);
process.exit(1);
