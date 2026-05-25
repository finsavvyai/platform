/**
 * Agent Tiers — defines which agents are available per subscription tier
 *
 * Free tier: 6 core SDLC agents
 * Pro tier: all 28+ agents
 * Team tier: all agents + priority support
 */

// Agents available in the free tier
export const FREE_AGENTS = new Set([
    'code-review',
    'testing-validation',
    'documentation',
    'deployment',
    'requirements-analyzer',
    'design-architect',
]);

/**
 * Get the minimum tier required to use an agent
 */
export function getAgentTier(slug: string): 'free' | 'pro' {
    if (FREE_AGENTS.has(slug)) return 'free';
    return 'pro';
}

/**
 * Check if a user can access a specific agent
 */
export function canAccessAgent(userTier: string, agentSlug: string): boolean {
    const requiredTier = getAgentTier(agentSlug);
    if (requiredTier === 'free') return true;
    return userTier === 'pro' || userTier === 'team';
}

/**
 * Get the upgrade CTA for a blocked agent
 */
export function getUpgradeCTA(agentSlug: string, agentName?: string): {
    error: string;
    code: string;
    agent: string;
    agentName: string;
    upgradeUrl: string;
    checkoutUrl: string;
    message: string;
} {
    return {
        error: 'Pro subscription required',
        code: 'pro_required',
        agent: agentSlug,
        agentName: agentName || agentSlug,
        upgradeUrl: 'https://agents.lunaos.ai/pricing',
        checkoutUrl: 'https://api.lunaos.ai/billing/checkout',
        message: `🔒 ${agentName || agentSlug} is a Pro agent. Upgrade to Pro ($29/mo) to unlock 10,000 monthly executions.`,
    };
}

/**
 * Agent tier summary for the catalog listing
 */
export function getTierSummary(): {
    free: { count: number; agents: string[] };
    pro: { count: number; note: string };
} {
    return {
        free: {
            count: 28,
            agents: Array.from(FREE_AGENTS),
        },
        pro: {
            count: 0, // dynamic — total minus free
            note: 'All agents including security, performance, API design, and more',
        },
    };
}
