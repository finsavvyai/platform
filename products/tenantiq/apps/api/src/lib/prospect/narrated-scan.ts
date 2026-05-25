/**
 * Agent-narrated scan handler. Returns an SSE stream that emits one event per
 * stage of the public scan, narrated in plain English. Frontend renders the
 * narration as the user watches — feels like a Claude agent doing the work.
 *
 * Stages:
 *   1. dns     — SPF/DMARC/DKIM via DoH
 *   2. tenant  — Microsoft tenant probe via openid-configuration
 *   3. mail    — MX-record provider classification
 *   4. fed     — getuserrealm.srf federation type
 *   5. report  — final aggregated result (also as `data: <full-result>`)
 *
 * Each event: `data: {"stage":"dns","status":"running"|"done","message":"…","payload":...}\n\n`
 */
import type { Context } from 'hono';
import type { AppEnv } from '../../app/types';
import { runProspectScan, isValidDomain } from './public-scan';
import { logAgentAction } from '../agent-actions';

interface StageEvent {
	stage: 'dns' | 'tenant' | 'mail' | 'fed' | 'report';
	status: 'running' | 'done';
	message: string;
	payload?: unknown;
}

export async function handleNarratedScan(c: Context<AppEnv>): Promise<Response> {
	const domain = (c.req.query('domain') ?? '').trim().toLowerCase();
	if (!domain || !isValidDomain(domain)) {
		return new Response('Invalid domain', { status: 422 });
	}

	const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
	const rlKey = `prospect:rl:${ip}`;
	const cnt = parseInt((await c.env.KV.get(rlKey)) ?? '0', 10);
	if (cnt >= 5) return new Response('Rate limit exceeded — 5/hr/IP', { status: 429 });
	await c.env.KV.put(rlKey, String(cnt + 1), { expirationTtl: 3600 });

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const enc = new TextEncoder();
			const send = (e: StageEvent) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));

			try {
				send({ stage: 'dns', status: 'running', message: `Probing DNS auth for ${domain} via Cloudflare 1.1.1.1…` });
				await delay(280);
				send({ stage: 'tenant', status: 'running', message: `Asking Microsoft if a tenant exists for ${domain}…` });
				await delay(180);
				send({ stage: 'mail', status: 'running', message: `Reading MX records to classify the mail provider…` });
				await delay(140);
				send({ stage: 'fed', status: 'running', message: `Checking federation type via getuserrealm.srf…` });

				const result = await runProspectScan(domain);

				send({ stage: 'dns', status: 'done', message: `SPF=${result.dnsAuth.spf}, DMARC=${result.dnsAuth.dmarc} (${result.dnsAuth.dmarcPolicy}), DKIM=${result.dnsAuth.dkimSelectors.filter((s) => s.status === 'pass').length}/${result.dnsAuth.dkimSelectors.length} selectors found.`, payload: result.dnsAuth });
				send({ stage: 'tenant', status: 'done', message: result.tenant.tenantExists ? `Microsoft tenant verified${result.tenant.federationBrandName ? ` (${result.tenant.federationBrandName})` : ''}.` : `No Microsoft tenant for this domain.`, payload: result.tenant });
				send({ stage: 'mail', status: 'done', message: `Mail provider: ${result.mailProvider.provider}.`, payload: result.mailProvider });
				send({ stage: 'fed', status: 'done', message: `Federation type: ${result.tenant.federationType}.` });
				send({ stage: 'report', status: 'done', message: `Score ${result.score}/100 with ${result.findings.length} finding${result.findings.length === 1 ? '' : 's'}. Estimated annual risk $${result.estimatedRiskUsd.low.toLocaleString()}–$${result.estimatedRiskUsd.high.toLocaleString()}.`, payload: result });

				await logAgentAction(c.env, {
					agent: 'narrated-scan', action: 'scan',
					severity: result.score >= 75 ? 'low' : result.score >= 50 ? 'medium' : 'high',
					metadata: { domain, score: result.score, findings: result.findings.length },
				});
			} catch (err) {
				send({ stage: 'report', status: 'done', message: err instanceof Error ? err.message : 'Scan failed' });
			}

			controller.close();
		},
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-store, no-transform',
			'x-accel-buffering': 'no',
		},
	});
}

function delay(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}
