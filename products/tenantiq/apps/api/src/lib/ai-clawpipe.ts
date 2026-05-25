/**
 * ClawPipe-backed AI client — drop-in replacement for ai-anthropic.ts /
 * ai-gemini.ts call sites.
 *
 * Every prompt now flows through ClawPipe's full pipeline (Booster +
 * Packer + Cache + Router). For known M365 patterns (license counts,
 * MFA status, CIS score), we use clawpipe-ai's classifyM365Intent helper
 * + a local handler — skipping the LLM entirely.
 *
 * Migration:
 *   import { askAi } from './ai-clawpipe';
 *   const answer = await askAi(ctx, question, env);
 */
import { ClawPipe, classifyM365Intent, type M365Intent } from 'clawpipe-ai';
import type { TenantContext } from './ai-anthropic';
import { buildContextString } from './ai-anthropic';

interface Env {
	CLAWPIPE_API_KEY?: string;
	ANTHROPIC_API_KEY?: string;
	GOOGLE_API_KEY?: string;
}

const DEFAULT_GATEWAY = 'https://api.clawpipe.ai/v1';
let pipeCache: ClawPipe | null = null;

function getPipe(env: Env, projectId: string): ClawPipe {
	if (pipeCache) return pipeCache;
	pipeCache = new ClawPipe({
		apiKey: env.CLAWPIPE_API_KEY ?? 'cp_dev',
		projectId,
		gatewayUrl: DEFAULT_GATEWAY,
		enableBooster: true,
		enablePacker: true,
		enableCache: true,
	});
	return pipeCache;
}

/** Resolve a query locally if ClawPipe's M365 intent classifier matches. */
function tryLocalHandler(intent: M365Intent, ctx: TenantContext): string | null {
	if (!intent) return null;
	switch (intent) {
		case 'license_summary': {
			const lines = ctx.licenses.filter((l) => l.enabled > 0).map(
				(l) => `- **${l.name}**: ${l.consumed}/${l.enabled} ($${l.costPerUnit}/user/mo, ${l.unused} unused)`,
			);
			const total = ctx.licenses.reduce((s, l) => s + l.enabled, 0);
			const assigned = ctx.licenses.reduce((s, l) => s + l.consumed, 0);
			return `## License Summary\n\n${lines.join('\n')}\n\n**Total**: ${assigned}/${total} assigned | **Waste**: $${ctx.totalWaste.toFixed(0)}/mo`;
		}
		case 'user_summary':
			return [
				`## User Summary for ${ctx.displayName}`, '',
				`- **Total**: ${ctx.userCount}`, `- **Active**: ${ctx.activeUserCount}`,
				`- **Inactive (90d+)**: ${ctx.inactiveCount}`, `- **Disabled**: ${ctx.disabledCount}`,
				`- **Guests**: ${ctx.guestCount}`, `- **MFA disabled**: ${ctx.mfaDisabledCount}`,
			].join('\n');
		case 'mfa_status':
			return `## MFA — ${ctx.displayName}\n\n**${ctx.mfaDisabledCount}** users without MFA out of ${ctx.userCount} total (${Math.round((1 - ctx.mfaDisabledCount / Math.max(ctx.userCount, 1)) * 100)}% coverage).`;
		case 'guest_audit':
			return `## Guests — ${ctx.displayName}\n\n**${ctx.guestCount}** guest accounts (${Math.round((ctx.guestCount / Math.max(ctx.userCount, 1)) * 100)}% of total). Audit recommended if > 25%.`;
		case 'inactive_users':
			return `## Inactive — ${ctx.displayName}\n\n**${ctx.inactiveCount}** users inactive 90+ days. Cost of inactive licenses: ~$${ctx.totalWaste.toFixed(0)}/mo.`;
		case 'cis_score':
			return ctx.cisScore != null
				? `**CIS Benchmark Score**: ${ctx.cisScore}/100 (last scan: ${ctx.cisScannedAt ?? 'unknown'})`
				: '**CIS Benchmark Score**: No scan yet — run a CIS benchmark scan from /security/cis.';
		case 'security_misconfig': {
			const issues: string[] = [];
			if (ctx.mfaDisabledCount > 0) issues.push(`- **MFA disabled for ${ctx.mfaDisabledCount} accounts** — high risk.`);
			if (ctx.inactiveCount > ctx.userCount * 0.15) issues.push(`- **${ctx.inactiveCount} inactive users** with active licenses.`);
			if (ctx.guestCount > ctx.userCount * 0.25) issues.push(`- **${ctx.guestCount} guests (excessive)** — review external access.`);
			if (issues.length === 0) return `## Security Posture — ${ctx.displayName}\n\nNo critical misconfigurations detected.`;
			return `## Security Issues — ${ctx.displayName}\n\n${issues.join('\n')}`;
		}
	}
	return null;
}

/** Main entry — try local handler first, otherwise route via ClawPipe. */
export async function askAi(
	ctx: TenantContext,
	question: string,
	env: Env,
	projectId = `tenant_${ctx.domain}`,
): Promise<{ text: string; source: 'local' | 'clawpipe'; meta?: Record<string, unknown> }> {
	const intent = classifyM365Intent(question);
	const local = tryLocalHandler(intent, ctx);
	if (local) return { text: local, source: 'local' };

	const pipe = getPipe(env, projectId);
	const system = `You are a Microsoft 365 security analyst. Answer concisely using the tenant context below.\n\n${buildContextString(ctx)}`;
	const result = await pipe.prompt(question, { system, maxTokens: 1500 });
	return {
		text: result.text, source: 'clawpipe',
		meta: { tokensIn: result.meta.tokensIn, tokensOut: result.meta.tokensOut, costUsd: result.meta.estimatedCostUsd, cached: result.meta.cached },
	};
}
