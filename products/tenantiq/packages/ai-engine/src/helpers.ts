/**
 * TenantIQ AI Engine — Helper Functions
 */

import { callAnthropic, getBestLLMClient } from './lib/llm';
import { OpenClawBridge } from './services/openclaw-bridge';
import type { Bindings } from './types';

export function getOpenClawBridge(env: Bindings): OpenClawBridge | null {
	if (!env.OPENCLAW_URL) return null;
	return new OpenClawBridge(env.OPENCLAW_URL, env.OPENCLAW_SERVICE_KEY || '');
}

export function hasAI(env: Bindings): boolean {
	return !!(
		env.OPENAI_API_KEY || env.ANTHROPIC_API_KEY || env.GROQ_API_KEY ||
		env.MISTRAL_API_KEY || env.TOGETHER_API_KEY || env.GEMINI_API_KEY ||
		env.OPENCLAW_URL
	);
}

/**
 * Ask AI a question about an M365 tenant.
 * Falls back through: OpenClaw -> Groq -> OpenAI -> Mistral -> Together -> Gemini -> Anthropic -> fallback
 */
export async function askTenantAI(
	env: Bindings,
	question: string,
	tenantContext: string,
): Promise<{ answer: string; source: string }> {
	const bridge = getOpenClawBridge(env);
	const systemPrompt = `You are TenantIQ, an intelligent Microsoft 365 tenant management assistant.
You help administrators optimize security, reduce costs, ensure compliance, and manage their M365 tenant efficiently.
Always provide specific, actionable recommendations based on the tenant data provided.`;

	// Try OpenClaw (Luna agents) first
	if (bridge) {
		try {
			const result = await bridge.runAgent('365-security', `${question}\n\nTenant Context:\n${tenantContext}`);
			return { answer: result.output, source: 'openclaw' };
		} catch (_e) {
			// fall through
		}
	}

	// Try best available OpenAI-compatible provider
	const best = getBestLLMClient(env);
	if (best) {
		const answer = await best.client.complete(
			`${question}\n\nTenant Context:\n${tenantContext}`,
			systemPrompt,
		);
		return { answer, source: best.provider };
	}

	// Try Anthropic (native API)
	if (env.ANTHROPIC_API_KEY) {
		const answer = await callAnthropic(
			env.ANTHROPIC_API_KEY,
			systemPrompt,
			`${question}\n\nTenant Context:\n${tenantContext}`,
		);
		return { answer, source: 'anthropic' };
	}

	// Fallback response (no AI provider configured)
	return {
		answer: `Based on your question about "${question}", here are my recommendations:

**Security:** Ensure MFA is enabled for all admin accounts and review conditional access policies regularly.
**Cost Optimization:** Review inactive licenses and remove assignments for users who haven't signed in for 90+ days.
**Compliance:** Regularly audit privileged roles and maintain audit logs.

Note: Connect an AI provider (OPENAI_API_KEY, ANTHROPIC_API_KEY) or OpenClaw for personalized tenant-specific analysis.`,
		source: 'fallback',
	};
}
