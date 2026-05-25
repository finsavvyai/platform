/**
 * Billing Middleware — enforce tier-based execution limits
 *
 * Checks user's usage against their tier limit before allowing
 * agent or chain execution. Returns 403 with upgrade prompt if exceeded.
 */

import { createMiddleware } from 'hono/factory';
import type { Env } from '../worker';

const TIER_LIMITS: Record<string, number> = {
    free: 100,
    pro: 10000,
    team: 100000,
};

/**
 * Check execution limit middleware
 * Place AFTER requireAuth, BEFORE execution logic
 */
export const checkExecutionLimit = createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const userId = c.get('userId');
    const tier = c.get('userTier');
    const limit = TIER_LIMITS[tier] || TIER_LIMITS.free;

    // Get current month boundaries
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Count executions this month (agents + chains)
    const agentCount = await c.env.DB.prepare(
        'SELECT COUNT(*) as c FROM executions WHERE user_id = ? AND created_at >= ?'
    ).bind(userId, monthStart).first<{ c: number }>();

    const chainCount = await c.env.DB.prepare(
        'SELECT COUNT(*) as c FROM chain_executions WHERE user_id = ? AND created_at >= ?'
    ).bind(userId, monthStart).first<{ c: number }>();

    const used = (agentCount?.c || 0) + (chainCount?.c || 0);

    if (used >= limit) {
        return c.json({
            error: 'Monthly execution limit reached',
            tier,
            used,
            limit,
            upgradeUrl: 'https://agents.lunaos.ai/pricing',
            message: tier === 'free'
                ? 'Upgrade to Pro ($29/mo) for 10,000 executions'
                : tier === 'pro'
                    ? 'Upgrade to Team ($79/mo) for 100,000 executions'
                    : 'Contact support for enterprise limits',
        }, 403);
    }

    // Set usage warning header at 80%
    const percentUsed = Math.round((used / limit) * 100);
    if (percentUsed >= 80) {
        c.header('X-Usage-Warning', `${percentUsed}% of monthly limit reached (${used}/${limit})`);
    }

    // Set usage headers for transparency
    c.header('X-Usage-Used', String(used));
    c.header('X-Usage-Limit', String(limit));
    c.header('X-Usage-Remaining', String(limit - used));

    await next();
});
