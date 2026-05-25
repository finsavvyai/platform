/**
 * Google Gemini API provider — free tier.
 * Uses generativelanguage.googleapis.com REST endpoint.
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
import { GEMINI } from './constants';

export async function callGemini(apiKey: string, context: string, question: string): Promise<string> {
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
	return callGemini(apiKey, contextStr, CHAIN_PROMPTS[preset] || CHAIN_PROMPTS['full-assessment']);
}

async function callApi(apiKey: string, system: string, userMsg: string): Promise<string> {
	const url = `${GEMINI.BASE_URL}/${GEMINI.MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			systemInstruction: { parts: [{ text: system }] },
			contents: [{ role: 'user', parts: [{ text: userMsg }] }],
			generationConfig: {
				maxOutputTokens: GEMINI.MAX_TOKENS_DEFAULT,
				temperature: GEMINI.TEMPERATURE_DEFAULT,
			},
		}),
	});
	if (!res.ok) return 'Unable to get AI response';
	const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
	return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to get AI response';
}
