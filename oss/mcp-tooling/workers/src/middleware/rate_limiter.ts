
import { Context, Next } from 'hono';
import { Env, AccessUser } from './auth';

interface RateLimitConfig {
    windowSeconds: number;
    limit: number;
}

const LIMITS: Record<string, RateLimitConfig> = {
    enterprise: { windowSeconds: 60, limit: 10000 },
    pro: { windowSeconds: 60, limit: 1000 },
    free: { windowSeconds: 60, limit: 60 },
    anonymous: { windowSeconds: 60, limit: 20 }
};

export const rateLimiter = async (c: Context<{ Bindings: Env }>, next: Next) => {
    // Determine user plan and identifier
    const user = c.get('user');
    let plan = 'anonymous';
    let keyIdentifier = c.req.header('CF-Connecting-IP') || 'unknown';

    if (user) {
        // Plan logic would ideally come from DB user record
        // Mocking behavior based on ID prefix or group
        if (user.groups?.includes('enterprise')) {
            plan = 'enterprise';
        } else if (user.groups?.includes('pro')) {
            plan = 'pro';
        } else {
            plan = 'free';
        }
        keyIdentifier = user.id;
    }

    const config = LIMITS[plan];
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - (now % config.windowSeconds);
    const key = `ratelimit:${plan}:${keyIdentifier}:${windowStart}`;

    try {
        // Increment counter in KV
        // Note: This requires KV namespace to be bound as MCP_KV
        if (!c.env.MCP_KV) {
            // If KV not available, skip rate limiting (fail open)
            return next();
        }

        const currentCountStr = await c.env.MCP_KV.get(key);
        let currentCount = parseInt(currentCountStr || '0', 10);

        if (currentCount >= config.limit) {
            c.header('X-RateLimit-Limit', config.limit.toString());
            c.header('X-RateLimit-Remaining', '0');
            c.header('Retry-After', (config.windowSeconds - (now % config.windowSeconds)).toString());
            return c.json({ error: 'Too Many Requests', message: `Rate limit specific to ${plan} plan exceeded.` }, 429);
        }

        // Increment and set expiry (atomic increment not available in standard KV put, using simplified read-modify-write)
        // For production high scale, use Durable Objects for counters. KV is eventually consistent.
        await c.env.MCP_KV.put(key, (currentCount + 1).toString(), { expirationTtl: config.windowSeconds * 2 });

        c.header('X-RateLimit-Limit', config.limit.toString());
        c.header('X-RateLimit-Remaining', (config.limit - currentCount - 1).toString());

    } catch (e) {
        console.error('Rate limiter error:', e);
        // Fail open
    }

    await next();
};
