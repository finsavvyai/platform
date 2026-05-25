/**
 * Per-customer AI gateway router.
 *
 * Each TenantIQ customer carries a `compliance_tier` setting:
 *   - 'standard' (default) → ai-clawpipe.ts (cost-optimised, ClawPipe)
 *   - 'regulated' → ai-sdlc.ts (compliance gateway with DLP + audit)
 *   - 'direct' → ai-anthropic.ts (no gateway; internal dev only)
 *
 * The router stays thin so swapping a customer's tier (e.g. SMB
 * graduating to a regulated FI parent) is a single config change,
 * not a code path migration.
 */

import type { TenantContext } from './ai-anthropic';
import { askAi as askAiClawPipe } from './ai-clawpipe';
import { askAiSdlc } from './ai-sdlc';

export type ComplianceTier = 'standard' | 'regulated' | 'direct';

interface Env {
	CLAWPIPE_API_KEY?: string;
	ANTHROPIC_API_KEY?: string;
	GOOGLE_API_KEY?: string;
	SDLC_CC_BASE_URL?: string;
	SDLC_CC_API_KEY?: string;
}

export interface AskAiResult {
	text: string;
	source: 'local' | 'clawpipe' | 'sdlc-cc' | 'direct';
	meta?: Record<string, unknown>;
}

/** Route an AI request through the right gateway for this customer. */
export async function askAiRouted(
	ctx: TenantContext,
	question: string,
	env: Env,
	tier: ComplianceTier = 'standard',
): Promise<AskAiResult> {
	switch (tier) {
		case 'regulated':
			return askAiSdlc(ctx, question, env);
		case 'direct':
			throw new Error(
				'direct tier is internal-only and not yet wired in router; ' +
					'use ai-anthropic.ts directly if you need it',
			);
		case 'standard':
		default:
			return askAiClawPipe(ctx, question, env);
	}
}
