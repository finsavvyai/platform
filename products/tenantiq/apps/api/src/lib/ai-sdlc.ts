/**
 * sdlc.cc-backed AI client — parallel skill to ai-clawpipe.ts.
 *
 * For TenantIQ customers in regulated tiers (FI MSPs, healthcare,
 * gov), AI calls flow through sdlc.cc's compliance gateway:
 * MaskAML scrub (PAN/IBAN/BIC + email/phone) before reaching
 * Anthropic, audit log per call, per-tenant SAML, quotas.
 *
 * NOT a replacement for ai-clawpipe.ts — both ship side-by-side
 * and ai-router.ts picks per-customer based on the customer's
 * compliance tier setting. ClawPipe stays for cost-optimised
 * SMB customers; sdlc.cc serves regulated FI MSP customers.
 *
 * Migration:
 *   import { askAiSdlc } from './ai-sdlc';
 *   const answer = await askAiSdlc(ctx, question, env);
 */

import type { TenantContext } from './ai-anthropic';
import { buildContextString } from './ai-anthropic';

interface Env {
	SDLC_CC_BASE_URL?: string;
	SDLC_CC_API_KEY?: string;
}

const DEFAULT_BASE_URL = 'https://api.sdlc.cc/v1/messages';

interface MessagesResponse {
	id?: string;
	type?: string;
	role?: string;
	content?: Array<{ type: string; text: string }>;
	model?: string;
	stop_reason?: string;
	usage?: { input_tokens: number; output_tokens: number };
}

/** Main entry — POST to sdlc.cc and return the assistant text. */
export async function askAiSdlc(
	ctx: TenantContext,
	question: string,
	env: Env,
): Promise<{ text: string; source: 'sdlc-cc'; meta?: Record<string, unknown> }> {
	const baseURL = env.SDLC_CC_BASE_URL ?? DEFAULT_BASE_URL;
	const apiKey = env.SDLC_CC_API_KEY;
	if (!apiKey) {
		throw new Error('SDLC_CC_API_KEY not configured');
	}

	const system = `You are a Microsoft 365 security analyst. Answer concisely using the tenant context below.\n\n${buildContextString(ctx)}`;

	const resp = await fetch(baseURL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-API-Key': apiKey,
			'anthropic-version': '2023-06-01',
		},
		body: JSON.stringify({
			model: 'claude-haiku-4-5',
			max_tokens: 1500,
			system,
			messages: [{ role: 'user', content: question }],
		}),
	});

	if (!resp.ok) {
		const body = await resp.text();
		throw new Error(`sdlc-cc HTTP ${resp.status}: ${body.slice(0, 200)}`);
	}

	const json = (await resp.json()) as { data?: MessagesResponse } | MessagesResponse;
	// sdlc-cc wraps in {data: ...} per its Success() helper; accept both shapes.
	const payload: MessagesResponse =
		'data' in json && json.data ? json.data : (json as MessagesResponse);

	const textBlocks = payload.content?.filter((b) => b.type === 'text') ?? [];
	const text = textBlocks.map((b) => b.text).join('\n').trim();
	if (!text) {
		throw new Error('sdlc-cc: empty response');
	}

	return {
		text,
		source: 'sdlc-cc',
		meta: {
			tokensIn: payload.usage?.input_tokens,
			tokensOut: payload.usage?.output_tokens,
			model: payload.model,
		},
	};
}
