/**
 * Groq API provider — OpenAI-compatible, free tier.
 * Ultra-fast LPU inference, default model llama-3.3-70b-versatile.
 * Reuses shared prompts/parsers from ai-anthropic.ts.
 */

import {
	type TenantContext,
	buildContextString,
	EXPERT_SYSTEM,
	SECURITY_SYSTEM,
	LICENSE_SYSTEM,
	CHAIN_PROMPTS,
	parseSecurityJson,
	parseLicenseJson,
} from './ai-anthropic';
import { GROQ } from './constants';

export async function callGroq(apiKey: string, context: string, question: string): Promise<string> {
	return callApi(apiKey, EXPERT_SYSTEM, `${context}\n\nQuestion: ${question}`);
}

export async function runSecurityScan(apiKey: string, ctx: TenantContext) {
	const text = await callApi(apiKey, SECURITY_SYSTEM, `Analyze security posture:\n${buildContextString(ctx)}`);
	return parseSecurityJson(text, ctx);
}

export async function runLicenseOptimize(apiKey: string, ctx: TenantContext) {
	const text = await callApi(apiKey, LICENSE_SYSTEM, `Analyze license efficiency:\n${buildContextString(ctx)}`);
	return parseLicenseJson(text, ctx);
}

export async function runChain(apiKey: string, preset: string, contextStr: string): Promise<string> {
	return callGroq(apiKey, contextStr, CHAIN_PROMPTS[preset] || CHAIN_PROMPTS['full-assessment']);
}

async function callApi(apiKey: string, system: string, userMsg: string): Promise<string> {
	const res = await fetch(GROQ.BASE_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: GROQ.MODEL,
			max_tokens: GROQ.MAX_TOKENS_DEFAULT,
			temperature: GROQ.TEMPERATURE_DEFAULT,
			messages: [
				{ role: 'system', content: system },
				{ role: 'user', content: userMsg },
			],
		}),
	});
	if (!res.ok) return 'Unable to get AI response';
	const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
	return data.choices?.[0]?.message?.content || 'Unable to get AI response';
}
