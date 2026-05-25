/**
 * Smart context packer for AI calls — prioritizes relevant sections
 * and trims low-priority data when context exceeds token budget.
 */

import type { TenantContext } from './ai-anthropic';

export interface PackingOptions {
	maxTokens?: number;
	question?: string;
	includeAlertDetails?: boolean;
}

interface Section {
	key: string;
	priority: number;
	content: string;
}

const DEFAULT_MAX_TOKENS = 1500;
const CHARS_PER_TOKEN = 4;

/** Rough token estimate: ~4 characters per token. */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Map question keywords to section keys that should be boosted. */
const KEYWORD_BOOSTS: Record<string, string[]> = {
	license: ['licenses', 'spend'],
	cost: ['licenses', 'spend'],
	waste: ['licenses', 'spend'],
	spend: ['licenses', 'spend'],
	security: ['alerts', 'mfa', 'cis'],
	alert: ['alerts'],
	threat: ['alerts'],
	mfa: ['mfa'],
	user: ['users', 'inactive'],
	inactive: ['inactive'],
	guest: ['users'],
	compliance: ['cis', 'alerts'],
	cis: ['cis'],
	benchmark: ['cis'],
};

/** Detect which section keys should be priority-boosted based on the question. */
function detectBoosts(question: string | undefined): Set<string> {
	if (!question) return new Set();
	const lower = question.toLowerCase();
	const boosted = new Set<string>();
	for (const [keyword, keys] of Object.entries(KEYWORD_BOOSTS)) {
		if (lower.includes(keyword)) {
			for (const k of keys) boosted.add(k);
		}
	}
	return boosted;
}

/** Build the header section (always included). */
function buildHeader(ctx: TenantContext): string {
	return `Tenant: ${ctx.displayName} (${ctx.domain})\nLast Sync: ${ctx.lastSyncAgo}`;
}

/** Build prioritized sections from tenant context. */
function buildSections(ctx: TenantContext, opts: PackingOptions): Section[] {
	const sections: Section[] = [];

	// Priority 1 — always include
	sections.push({
		key: 'users',
		priority: 1,
		content: `Users: ${ctx.userCount} total, ${ctx.activeUserCount} active, ${ctx.mfaDisabledCount} MFA-disabled`,
	});

	sections.push({
		key: 'mfa',
		priority: 1,
		content: `MFA: ${ctx.mfaDisabledCount} users without MFA out of ${ctx.userCount}`,
	});

	const sevParts = ['critical', 'high', 'medium', 'low']
		.filter((s) => ctx.alertsBySeverity[s])
		.map((s) => `${ctx.alertsBySeverity[s]} ${s}`);
	sections.push({
		key: 'alerts',
		priority: 1,
		content: `Alerts: ${sevParts.join(', ') || 'none'} (${ctx.activeAlertCount} active)`,
	});

	const cisText =
		ctx.cisScore != null
			? `CIS Score: ${ctx.cisScore}/100 (last scan: ${ctx.cisScannedAt || 'unknown'})`
			: 'CIS Score: No scan yet';
	sections.push({ key: 'cis', priority: 1, content: cisText });

	// Priority 2 — include if space
	const licLines = ctx.licenses
		.filter((l) => l.enabled > 0)
		.map((l) => {
			const waste = l.wastePerMonth > 0 ? ` — ${l.unused} unused = $${l.wastePerMonth}/mo waste` : '';
			return `- ${l.name}: ${l.consumed}/${l.enabled} ($${l.costPerUnit}/user/mo)${waste}`;
		})
		.join('\n');
	sections.push({
		key: 'licenses',
		priority: 2,
		content: `License SKUs:\n${licLines || '(none)'}`,
	});

	sections.push({
		key: 'spend',
		priority: 2,
		content: `Total Spend: $${ctx.totalSpend.toFixed(0)}/mo | Total Waste: $${ctx.totalWaste.toFixed(0)}/mo`,
	});

	// Priority 3 — trim first
	const alertDetails = ctx.alerts
		.filter((a) => a.status === 'active')
		.slice(0, 5)
		.map((a) => `[${a.severity}] ${a.title}`)
		.join(', ');
	if (alertDetails && opts.includeAlertDetails !== false) {
		sections.push({ key: 'alertDetails', priority: 3, content: `Recent: ${alertDetails}` });
	}

	sections.push({
		key: 'inactive',
		priority: 3,
		content: `Inactive: ${ctx.inactiveCount} (90d+), ${ctx.disabledCount} disabled, ${ctx.guestCount} guests`,
	});

	return sections;
}

/** Apply question-aware priority boosts to sections. */
function applyBoosts(sections: Section[], boosts: Set<string>): Section[] {
	if (boosts.size === 0) return sections;
	return sections.map((s) => ({
		...s,
		priority: boosts.has(s.key) ? Math.max(0, s.priority - 1) : s.priority,
	}));
}

/**
 * Pack tenant context into a token-budgeted string.
 * Trims lowest-priority sections first when over budget.
 */
export function packContext(ctx: TenantContext, options?: PackingOptions): string {
	const opts = options ?? {};
	const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
	const maxChars = maxTokens * CHARS_PER_TOKEN;
	const boosts = detectBoosts(opts.question);

	const header = buildHeader(ctx);
	let sections = buildSections(ctx, opts);
	sections = applyBoosts(sections, boosts);

	// Sort by priority ascending (lower = higher priority)
	sections.sort((a, b) => a.priority - b.priority);

	const parts: string[] = [header];
	let charCount = header.length;

	for (const section of sections) {
		const addition = '\n\n' + section.content;
		if (charCount + addition.length > maxChars) continue;
		parts.push(section.content);
		charCount += addition.length;
	}

	return parts.join('\n\n');
}
