/**
 * Public, unauthenticated MCP namespace. Anyone with Claude Desktop pointed
 * at https://api.tenantiq.app/api/mcp-public can call `scan_domain` without
 * an account. Lead-gen via Claude itself.
 *
 *   tools: scan_domain(domain)
 *   resources: tenantiq://public/cis-catalog | compliance-frameworks | msp-stack
 *
 * KV-rate-limited 5 scans / hr / IP (same bucket as the existing prospect
 * route, so users can't sidestep by switching transports).
 */
import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { runProspectScan, isValidDomain } from '../lib/prospect/public-scan';
import { logAgentAction } from '../lib/agent-actions';

export const mcpPublicRoutes = new Hono<AppEnv>();

interface McpRequest {
	jsonrpc: '2.0';
	id?: string | number;
	method: string;
	params?: Record<string, unknown>;
}

const PUBLIC_TOOLS = [
	{
		name: 'scan_domain',
		description: 'Run a free public M365 security scan on any domain. Returns DNS auth (SPF/DMARC/DKIM), Microsoft tenant identity, federation type, mail provider, findings, and a 0–100 risk score. No signup required.',
		inputSchema: {
			type: 'object' as const,
			properties: { domain: { type: 'string', description: 'e.g. "acme.com"' } },
			required: ['domain'],
		},
		annotations: { readOnlyHint: true },
	},
];

const PUBLIC_RESOURCES = [
	{ uri: 'tenantiq://public/cis-catalog', name: 'CIS M365 v3.1 catalog', description: '121 controls across 7 domains, L1/L2 tagged.', mimeType: 'application/json' },
	{ uri: 'tenantiq://public/compliance-frameworks', name: 'Compliance frameworks', description: 'SOC 2 / HIPAA / GDPR / ISO 27001 catalog.', mimeType: 'application/json' },
	{ uri: 'tenantiq://public/msp-stack', name: 'TenantIQ MSP stack', description: 'Named integrations TenantIQ ships with.', mimeType: 'application/json' },
];

mcpPublicRoutes.post('/', async (c) => {
	const body = await c.req.json<McpRequest>().catch(() => null);
	if (!body || body.jsonrpc !== '2.0' || !body.method) {
		return c.json({ jsonrpc: '2.0', id: body?.id ?? null, error: { code: -32600, message: 'Invalid Request' } }, 400);
	}

	switch (body.method) {
		case 'initialize':
			return c.json({
				jsonrpc: '2.0', id: body.id,
				result: {
					protocolVersion: '2025-06-18',
					capabilities: { tools: {}, resources: {} },
					serverInfo: { name: 'tenantiq-public', version: '0.1.0' },
					instructions: 'Public-only namespace — no auth required. For tenant-scoped tools, mint an API key at https://app.tenantiq.app/settings/api-keys and connect to /api/mcp.',
				},
			});

		case 'tools/list':
			return c.json({ jsonrpc: '2.0', id: body.id, result: { tools: PUBLIC_TOOLS } });

		case 'tools/call': {
			const name = (body.params as { name?: string })?.name;
			const args = (body.params as { arguments?: Record<string, unknown> })?.arguments ?? {};
			if (name !== 'scan_domain') {
				return c.json({ jsonrpc: '2.0', id: body.id, error: { code: -32602, message: `Unknown tool: ${name}` } });
			}
			const text = await runScan(c, args.domain);
			return c.json({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text }] } });
		}

		case 'resources/list':
			return c.json({ jsonrpc: '2.0', id: body.id, result: { resources: PUBLIC_RESOURCES } });

		case 'resources/read': {
			const uri = (body.params as { uri?: string })?.uri ?? '';
			const text = readResource(uri);
			if (text === null) {
				return c.json({ jsonrpc: '2.0', id: body.id, error: { code: -32602, message: `Unknown resource: ${uri}` } });
			}
			return c.json({ jsonrpc: '2.0', id: body.id, result: { contents: [{ uri, mimeType: 'application/json', text }] } });
		}

		default:
			return c.json({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: `Method not found: ${body.method}` } });
	}
});

async function runScan(c: { env: AppEnv['Bindings']; req: { header(n: string): string | undefined } }, domainArg: unknown): Promise<string> {
	const domain = String(domainArg ?? '').trim().toLowerCase();
	if (!domain || !isValidDomain(domain)) {
		return JSON.stringify({ error: 'Invalid domain. Pass e.g. {"domain": "acme.com"}.' });
	}

	const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
	const rlKey = `prospect:rl:${ip}`;
	const cnt = parseInt((await c.env.KV.get(rlKey)) ?? '0', 10);
	if (cnt >= 5) {
		return JSON.stringify({ error: 'Rate limit reached (5 scans/hr/IP). Mint an API key at app.tenantiq.app/settings/api-keys for unlimited.' });
	}
	await c.env.KV.put(rlKey, String(cnt + 1), { expirationTtl: 3600 });

	try {
		const result = await runProspectScan(domain);
		await logAgentAction(c.env, {
			agent: 'mcp-public-call',
			action: 'scan',
			severity: result.score >= 75 ? 'low' : result.score >= 50 ? 'medium' : 'high',
			metadata: { domain, score: result.score, findings: result.findings.length },
		});
		return JSON.stringify(result, null, 2);
	} catch (err) {
		return JSON.stringify({ error: err instanceof Error ? err.message : 'Scan failed' });
	}
}

function readResource(uri: string): string | null {
	switch (uri) {
		case 'tenantiq://public/cis-catalog':
			return JSON.stringify({ name: 'CIS Microsoft 365 Foundations Benchmark v3.1', controlCount: 121, domains: ['identity', 'apps', 'audit', 'ci/cd', 'data', 'device', 'email'], levels: ['L1', 'L2'], realGraphEvaluation: 31 });
		case 'tenantiq://public/compliance-frameworks':
			return JSON.stringify({ frameworks: [
				{ id: 'soc2', controls: ['CC6.1','CC6.2','CC7.2','CC8.1'] },
				{ id: 'hipaa', controls: ['164.312a','164.312b','164.312c','164.312e'] },
				{ id: 'gdpr', controls: ['Art.5.1','Art.17','Art.25','Art.32','Art.33'] },
				{ id: 'iso27001', telemetryEvaluable: 25, organisationalOutOfScope: 68 },
			]});
		case 'tenantiq://public/msp-stack':
			return JSON.stringify({
				psa: ['ConnectWise', 'Datto Autotask', 'Kaseya VSA/BMS'],
				cosell: ['Microsoft Commercial Marketplace', 'OpenClaw'],
				billing: ['LemonSqueezy', 'Resend'],
				security: ['Microsoft Graph', 'Defender XDR', 'Intune', 'Entra ID PIM', 'CIS v3.1', 'Cloudflare DoH', 'Anthropic Claude'],
			});
		default: return null;
	}
}
