/**
 * Claw Booster — skips AI for known M365 patterns.
 *
 * Some queries can be answered directly from Graph API data or pattern
 * matching, avoiding LLM latency and cost entirely.
 *
 * Categories:
 * 1. License count queries -> direct from cached SKU data
 * 2. User list queries -> direct from cached user data
 * 3. Known security misconfigs -> instant alert from pattern DB
 */

import type { TenantContext } from './ai-anthropic';

/** Result from the booster. If `handled` is true, skip AI. */
export interface BoosterResult {
	handled: boolean;
	answer?: string;
	source: 'booster' | 'ai-required';
}

/** Pattern matcher entry for known questions. */
interface PatternRule {
	patterns: RegExp[];
	handler: (ctx: TenantContext, question: string) => string;
}

const LICENSE_PATTERNS: PatternRule = {
	patterns: [
		/how many (?:licenses?|skus?|subscriptions?)/i,
		/license (?:count|total|usage|summary)/i,
		/(?:total|all) licenses/i,
		/what licenses (?:do we|does? (?:the|this) tenant) have/i,
	],
	handler: (ctx) => {
		const lines = ctx.licenses
			.filter((l) => l.enabled > 0)
			.map((l) => `- **${l.name}**: ${l.consumed}/${l.enabled} assigned ($${l.costPerUnit}/user/mo, ${l.unused} unused)`);
		const total = ctx.licenses.reduce((s, l) => s + l.enabled, 0);
		const assigned = ctx.licenses.reduce((s, l) => s + l.consumed, 0);
		return `## License Summary\n\n${lines.join('\n')}\n\n**Total**: ${assigned}/${total} assigned | **Waste**: $${ctx.totalWaste.toFixed(0)}/mo`;
	},
};

const USER_LIST_PATTERNS: PatternRule = {
	patterns: [
		/how many users/i,
		/user (?:count|total|summary)/i,
		/(?:total|all) users/i,
		/(?:active|inactive|disabled|guest) (?:user )?count/i,
		/how many (?:active|inactive|disabled|guest)/i,
	],
	handler: (ctx) => {
		return [
			`## User Summary for ${ctx.displayName}`,
			'',
			`- **Total users**: ${ctx.userCount}`,
			`- **Active**: ${ctx.activeUserCount}`,
			`- **Inactive (90d+)**: ${ctx.inactiveCount}`,
			`- **Disabled**: ${ctx.disabledCount}`,
			`- **Guests**: ${ctx.guestCount}`,
			`- **MFA disabled**: ${ctx.mfaDisabledCount}`,
		].join('\n');
	},
};

/** Known security misconfigurations that need no AI to detect. */
const SECURITY_MISCONFIG_PATTERNS: PatternRule = {
	patterns: [
		/(?:mfa|multi.?factor) (?:status|disabled|not enabled|missing)/i,
		/(?:security|risk) (?:issues?|problems?|misconfig)/i,
		/what(?:'s| is) (?:wrong|insecure|misconfigured)/i,
		/legacy (?:auth|authentication)/i,
		/security (?:posture|score|summary)/i,
	],
	handler: (ctx) => {
		const issues: string[] = [];
		if (ctx.mfaDisabledCount > 0) {
			issues.push(`- **MFA disabled for ${ctx.mfaDisabledCount} accounts** — high risk. Enable MFA immediately.`);
		}
		if (ctx.inactiveCount > ctx.userCount * 0.15) {
			issues.push(`- **${ctx.inactiveCount} inactive users (${Math.round((ctx.inactiveCount / ctx.userCount) * 100)}%)** with active licenses — orphaned access risk.`);
		}
		if (ctx.guestCount > ctx.userCount * 0.25) {
			issues.push(`- **${ctx.guestCount} guest users (${Math.round((ctx.guestCount / ctx.userCount) * 100)}%)** — excessive external access.`);
		}
		if (ctx.disabledCount > 0) {
			issues.push(`- **${ctx.disabledCount} disabled accounts** still present — remove to reduce attack surface.`);
		}
		const critical = ctx.alertsBySeverity['critical'] || 0;
		const high = ctx.alertsBySeverity['high'] || 0;
		if (critical > 0) issues.push(`- **${critical} critical alerts** unresolved.`);
		if (high > 0) issues.push(`- **${high} high-severity alerts** need attention.`);

		const cisLine = ctx.cisScore != null
			? `**CIS Score**: ${ctx.cisScore}/100`
			: '**CIS Score**: No scan yet — run a CIS benchmark scan.';

		if (issues.length === 0) {
			return `## Security Posture — ${ctx.displayName}\n\nNo critical misconfigurations detected.\n\n${cisLine}`;
		}

		return `## Security Issues — ${ctx.displayName}\n\n${issues.join('\n')}\n\n${cisLine}\n\n**Recommendation**: Address critical items first, then high-severity.`;
	},
};

const ALL_RULES: PatternRule[] = [
	LICENSE_PATTERNS,
	USER_LIST_PATTERNS,
	SECURITY_MISCONFIG_PATTERNS,
];

/**
 * Try to answer the question without AI.
 * Returns { handled: true, answer } if a pattern matched.
 */
export function tryBoost(ctx: TenantContext, question: string): BoosterResult {
	for (const rule of ALL_RULES) {
		for (const pattern of rule.patterns) {
			if (pattern.test(question)) {
				return {
					handled: true,
					answer: rule.handler(ctx, question),
					source: 'booster',
				};
			}
		}
	}
	return { handled: false, source: 'ai-required' };
}
