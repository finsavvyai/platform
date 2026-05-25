/**
 * Provider dispatch — routes a SmartRouter pathway decision to the concrete
 * provider call (groq/gemini/deepseek/anthropic/claw-gateway/openclaw).
 * Keeps route handlers thin and centralizes fallback order.
 */

import type { Env } from '../app/types';
import type { Pathway } from './smart-router';
import type { TenantContext } from './ai-anthropic';
import {
	callAnthropic, runSecurityScan, runLicenseOptimize, runChain as runAnthropicChain,
	buildContextString, SECURITY_SYSTEM, LICENSE_SYSTEM, parseSecurityJson, parseLicenseJson,
} from './ai-anthropic';
import { callDeepSeek, runSecurityScan as dsSecurity, runLicenseOptimize as dsLicense, runChain as dsChain } from './ai-deepseek';
import { callGroq, runSecurityScan as grqSecurity, runLicenseOptimize as grqLicense, runChain as grqChain } from './ai-groq';
import { callGemini, runSecurityScan as gmSecurity, runLicenseOptimize as gmLicense, runChain as gmChain } from './ai-gemini';
import { createClawClient, type ClawClient } from './claw-client';
import { getOpenClawBridge } from './openclaw-bridge';
import { AI } from './constants';

async function clawSecurity(claw: ClawClient, ctx: TenantContext) {
	const { text } = await claw.prompt({
		prompt: `Analyze security posture:\n${buildContextString(ctx)}`,
		system: SECURITY_SYSTEM, maxTokens: AI.MAX_TOKENS_DEFAULT,
	});
	return parseSecurityJson(text, ctx);
}

async function clawLicense(claw: ClawClient, ctx: TenantContext) {
	const { text } = await claw.prompt({
		prompt: `Analyze license efficiency:\n${buildContextString(ctx)}`,
		system: LICENSE_SYSTEM, maxTokens: AI.MAX_TOKENS_DEFAULT,
	});
	return parseLicenseJson(text, ctx);
}

export function preferredSource(env: Env): string {
	if (env.GROQ_API_KEY) return 'groq';
	if (env.GEMINI_API_KEY) return 'gemini';
	if (env.DEEPSEEK_API_KEY) return 'deepseek';
	if (env.ANTHROPIC_API_KEY) return 'anthropic';
	return 'openclaw';
}

export async function dispatchSecurityScan(env: Env, pathway: Pathway, ctx: TenantContext, tid: string) {
	if (pathway === 'groq' && env.GROQ_API_KEY) return grqSecurity(env.GROQ_API_KEY, ctx);
	if (pathway === 'gemini' && env.GEMINI_API_KEY) return gmSecurity(env.GEMINI_API_KEY, ctx);
	if (pathway === 'deepseek' && env.DEEPSEEK_API_KEY) return dsSecurity(env.DEEPSEEK_API_KEY, ctx);
	if (pathway === 'claw-gateway') {
		const claw = createClawClient(env);
		if (claw) return clawSecurity(claw, ctx);
	}
	if (pathway === 'anthropic' && env.ANTHROPIC_API_KEY) return runSecurityScan(env.ANTHROPIC_API_KEY, ctx);
	const bridge = getOpenClawBridge(env);
	if (!bridge) throw new Error('AI not configured');
	return bridge.analyzeSecurityPosture({
		tenantId: tid, displayName: ctx.displayName, userCount: ctx.userCount,
		mfaDisabledCount: ctx.mfaDisabledCount, inactiveUserCount: ctx.inactiveCount,
		adminCount: 0, guestCount: ctx.guestCount, riskyUsers: [],
		alerts: ctx.alerts.map((a) => ({ type: a.severity, severity: a.severity, title: a.title })),
	});
}

export async function dispatchLicenseOptimize(env: Env, ctx: TenantContext, tid: string) {
	if (env.GROQ_API_KEY) return grqLicense(env.GROQ_API_KEY, ctx);
	if (env.GEMINI_API_KEY) return gmLicense(env.GEMINI_API_KEY, ctx);
	if (env.DEEPSEEK_API_KEY) return dsLicense(env.DEEPSEEK_API_KEY, ctx);
	if (env.CLAW_API_KEY) {
		const claw = createClawClient(env);
		if (claw) return clawLicense(claw, ctx);
	}
	if (env.ANTHROPIC_API_KEY) return runLicenseOptimize(env.ANTHROPIC_API_KEY, ctx);
	const bridge = getOpenClawBridge(env);
	if (!bridge) throw new Error('AI not configured');
	return bridge.analyzeLicenseWaste({
		tenantId: tid, displayName: ctx.displayName,
		licenses: ctx.licenses.map((l) => ({
			skuName: l.name, assigned: l.consumed,
			active: l.consumed - Math.floor(ctx.inactiveCount * (l.consumed / Math.max(ctx.userCount, 1))),
			cost: l.costPerUnit,
		})),
		inactiveUsers: [],
	});
}

export async function dispatchAsk(
	env: Env, pathway: Pathway, contextStr: string, question: string, agent: string, provider: string,
): Promise<string> {
	if (pathway === 'groq' && env.GROQ_API_KEY) return callGroq(env.GROQ_API_KEY, contextStr, question);
	if (pathway === 'gemini' && env.GEMINI_API_KEY) return callGemini(env.GEMINI_API_KEY, contextStr, question);
	if (pathway === 'deepseek' && env.DEEPSEEK_API_KEY) return callDeepSeek(env.DEEPSEEK_API_KEY, contextStr, question);
	const claw = createClawClient(env);
	if (pathway === 'claw-gateway' && claw) return (await claw.prompt({ prompt: contextStr, maxTokens: AI.MAX_TOKENS_DEFAULT })).text;
	if (pathway === 'anthropic' && env.ANTHROPIC_API_KEY) return callAnthropic(env.ANTHROPIC_API_KEY, contextStr, question);
	const bridge = getOpenClawBridge(env);
	if (!bridge) throw new Error('AI not configured.');
	return (await bridge.runAgent(agent, contextStr, { provider })).output;
}

export async function dispatchChain(env: Env, preset: string, contextStr: string, provider: string): Promise<string> {
	if (env.GROQ_API_KEY) return grqChain(env.GROQ_API_KEY, preset, contextStr);
	if (env.GEMINI_API_KEY) return gmChain(env.GEMINI_API_KEY, preset, contextStr);
	if (env.DEEPSEEK_API_KEY) return dsChain(env.DEEPSEEK_API_KEY, preset, contextStr);
	if (env.ANTHROPIC_API_KEY) return runAnthropicChain(env.ANTHROPIC_API_KEY, preset, contextStr);
	const bridge = getOpenClawBridge(env);
	if (!bridge) throw new Error('AI not configured.');
	return (await bridge.runChain(preset, contextStr, { provider })).output;
}
