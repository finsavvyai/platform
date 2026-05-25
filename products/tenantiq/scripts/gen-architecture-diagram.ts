#!/usr/bin/env tsx
/**
 * Auto-generate docs/ARCHITECTURE_DIAGRAM.md (mermaid) from wrangler.toml +
 * grep of external fetch hosts.
 *
 *   pnpm tsx scripts/gen-architecture-diagram.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs/ARCHITECTURE_DIAGRAM.md');
const WRANGLER = path.join(ROOT, 'apps/api/wrangler.toml');

const KNOWN_VENDORS: Record<string, string> = {
	'login.microsoftonline.com': 'Microsoft Entra ID',
	'graph.microsoft.com': 'Microsoft Graph',
	'api.anthropic.com': 'Anthropic',
	'api.resend.com': 'Resend',
	'api.twilio.com': 'Twilio',
	'lemonsqueezy.com': 'LemonSqueezy',
	'sentry.io': 'Sentry',
};

function bindings(): { kvs: string[]; r2s: string[]; d1s: string[]; queues: string[]; durables: string[]; services: string[] } {
	const t = fs.readFileSync(WRANGLER, 'utf8');
	const grab = (re: RegExp): string[] => Array.from(t.matchAll(re), (m) => m[1]);
	return {
		kvs: grab(/\[\[kv_namespaces\]\][\s\S]*?binding\s*=\s*"([^"]+)"/g),
		r2s: grab(/\[\[r2_buckets\]\][\s\S]*?binding\s*=\s*"([^"]+)"/g),
		d1s: grab(/\[\[d1_databases\]\][\s\S]*?binding\s*=\s*"([^"]+)"/g),
		queues: grab(/\[\[queues\.producers\]\][\s\S]*?binding\s*=\s*"([^"]+)"/g),
		durables: grab(/name\s*=\s*"([^"]+)"\s*,\s*class_name/g),
		services: grab(/\[\[services\]\][\s\S]*?binding\s*=\s*"([^"]+)"/g),
	};
}

function externalHosts(): Set<string> {
	const out = new Set<string>();
	let raw = '';
	try {
		raw = execSync(`grep -rIohE "https?://[a-zA-Z0-9.-]+" apps/api/src packages/ai-engine/src packages/intel/src packages/graph/src 2>/dev/null`, {
			cwd: ROOT, encoding: 'utf8',
		});
	} catch { return out; }
	for (const line of raw.split('\n')) {
		try {
			const h = new URL(line.replace(/[)>'",.]+$/, '')).hostname.toLowerCase();
			for (const k of Object.keys(KNOWN_VENDORS)) if (h.endsWith(k)) out.add(KNOWN_VENDORS[k]);
		} catch { /* skip */ }
	}
	return out;
}

function diagram(b: ReturnType<typeof bindings>, vendors: Set<string>): string {
	const vendorNodes = Array.from(vendors).map((v, i) => `V${i}["${v}"]`).join('\n    ');
	const vendorEdges = Array.from(vendors).map((_, i) => `API --> V${i}`).join('\n    ');
	return [
		'```mermaid',
		'flowchart LR',
		'    Browser["Customer browser"]',
		'    Pages["Cloudflare Pages — tenantiq-web (SvelteKit)"]',
		'    API["Cloudflare Workers — tenantiq-api (Hono)"]',
		`    ${b.d1s.map((n) => `D1_${n}[("D1 ${n}")]`).join('\n    ')}`,
		`    ${b.kvs.map((n) => `KV_${n}[("KV ${n}")]`).join('\n    ')}`,
		`    ${b.r2s.map((n) => `R2_${n}[("R2 ${n}")]`).join('\n    ')}`,
		`    ${b.queues.map((n) => `Q_${n}{{"Queue ${n}"}}`).join('\n    ')}`,
		`    ${b.durables.map((n) => `DO_${n}[/"DO ${n}"/]`).join('\n    ')}`,
		`    ${b.services.map((n) => `S_${n}[["Worker ${n}"]]`).join('\n    ')}`,
		`    ${vendorNodes}`,
		'',
		'    Browser -->|TLS 1.3| Pages',
		'    Pages -->|cookie + Bearer| API',
		`    ${b.d1s.map((n) => `API --> D1_${n}`).join('\n    ')}`,
		`    ${b.kvs.map((n) => `API --> KV_${n}`).join('\n    ')}`,
		`    ${b.r2s.map((n) => `API --> R2_${n}`).join('\n    ')}`,
		`    ${b.queues.map((n) => `API --> Q_${n}`).join('\n    ')}`,
		`    ${b.durables.map((n) => `API --> DO_${n}`).join('\n    ')}`,
		`    ${b.services.map((n) => `API --> S_${n}`).join('\n    ')}`,
		`    ${vendorEdges}`,
		'```',
	].join('\n');
}

function main() {
	const b = bindings();
	const vendors = externalHosts();
	const md = [
		'# Architecture diagram (auto-generated)',
		'',
		`> Generated: ${new Date().toISOString()}`,
		'> Regenerate: `pnpm tsx scripts/gen-architecture-diagram.ts`',
		'> Source of truth: `apps/api/wrangler.toml` + URL literals in `apps/api/src` + `packages/*`.',
		'',
		'## Bindings',
		'',
		`- D1: ${b.d1s.join(', ') || '_none_'}`,
		`- KV: ${b.kvs.join(', ') || '_none_'}`,
		`- R2: ${b.r2s.join(', ') || '_none_'}`,
		`- Queues (producers): ${b.queues.join(', ') || '_none_'}`,
		`- Durable Objects: ${b.durables.join(', ') || '_none_'}`,
		`- Service bindings: ${b.services.join(', ') || '_none_'}`,
		`- External vendors discovered in source: ${Array.from(vendors).join(', ') || '_none_'}`,
		'',
		'## Diagram',
		'',
		diagram(b, vendors),
		'',
		'## Drift check',
		'',
		'Compare the External vendors list against `docs/SUB_PROCESSORS.md`. The drift script (`scripts/check-cert-drift.ts`) enforces this in CI.',
		'',
	].join('\n');
	fs.writeFileSync(OUT, md);
	console.log(`OK  ${OUT}`);
}

main();
