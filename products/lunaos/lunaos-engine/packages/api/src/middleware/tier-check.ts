/**
 * Tier Check Middleware — enforce subscription tier access
 *
 * requireTier(tier) — blocks users below the required tier
 * checkAgentTier — reads agent slug from body and checks tier access
 */

import { createMiddleware } from 'hono/factory';
import type { Env } from '../worker';
import { getAgentTier } from '../data/agent-tiers';

const TIER_RANK: Record<string, number> = { free: 0, pro: 1, team: 2 };

function tierRank(tier: string): number {
    return TIER_RANK[tier] ?? 0;
}

/**
 * Require a minimum subscription tier.
 * Place AFTER requireAuth so userTier is available on context.
 *
 * @param requiredTier - minimum tier needed ('pro' | 'team')
 */
export function requireTier(requiredTier: 'pro' | 'team') {
    return createMiddleware<{ Bindings: Env }>(async (c, next) => {
        const userTier = c.get('userTier') || 'free';
        const required = tierRank(requiredTier);
        const current = tierRank(userTier);

        if (current >= required) {
            await next();
            return;
        }

        const upgradeTarget = requiredTier === 'team' ? 'Team' : 'Pro';
        const price = requiredTier === 'team' ? 79 : 29;

        return c.json({
            error: `Upgrade to ${upgradeTarget} to use this feature`,
            code: `${requiredTier}_required`,
            currentTier: userTier,
            requiredTier,
            upgradeUrl: '/billing/checkout',
            message: `This feature requires a ${upgradeTarget} plan ($${price}/mo).`,
        }, 403);
    });
}

/**
 * Check agent tier middleware for the execute route.
 * Reads the agent slug from the request body and verifies the
 * user's tier is sufficient to run that agent.
 *
 * Place AFTER requireAuth, BEFORE execution logic.
 * Non-destructive: clones the request body so downstream can re-read.
 */
export const checkAgentTier = createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const userTier = c.get('userTier') || 'free';

    let body: { agent?: string };
    try {
        body = await c.req.json();
    } catch {
        // Let downstream validation handle malformed JSON
        await next();
        return;
    }

    const agentSlug = body?.agent;
    if (!agentSlug) {
        // No agent specified — let route validation handle it
        await next();
        return;
    }

    const requiredTier = getAgentTier(agentSlug);
    const userRank = tierRank(userTier);
    const requiredRank = tierRank(requiredTier);

    if (userRank >= requiredRank) {
        await next();
        return;
    }

    // getAgentTier currently returns only 'free' | 'pro' — Pro upgrade path.
    const upgradeTarget = 'Pro';
    const price = 29;

    return c.json({
        error: `Upgrade to ${upgradeTarget} to use this agent`,
        code: `${requiredTier}_required`,
        agent: agentSlug,
        currentTier: userTier,
        requiredTier,
        upgradeUrl: '/billing/checkout',
        message: `The "${agentSlug}" agent requires a ${upgradeTarget} plan ($${price}/mo).`,
    }, 403);
});
