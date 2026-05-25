/**
 * Feature Flags API Routes
 * Admin endpoints for managing feature flags
 */

import { Hono } from 'hono';
import type { Env } from '../middleware/auth';
import { FeatureFlagService, type FeatureFlag } from '../middleware/featureflags';

export const featureFlagsRouter = new Hono<{ Bindings: Env }>();

// Get all feature flags
featureFlagsRouter.get('/', async (c) => {
    const featureFlags = new FeatureFlagService(c.env.MCP_KV);
    const flags = await featureFlags.getAllFlags();
    return c.json({ flags });
});

// Get single feature flag
featureFlagsRouter.get('/:name', async (c) => {
    const { name } = c.req.param();
    const featureFlags = new FeatureFlagService(c.env.MCP_KV);
    const flag = await featureFlags.getFlag(name);

    if (!flag) {
        return c.json({ error: 'Feature flag not found' }, 404);
    }

    return c.json({ flag });
});

// Check if feature is enabled for current user
featureFlagsRouter.get('/:name/check', async (c) => {
    const { name } = c.req.param();
    const userId = c.get('userId') as string | undefined;
    const userPlan = c.get('userPlan') as string | undefined;

    const featureFlags = new FeatureFlagService(c.env.MCP_KV);
    const enabled = await featureFlags.isEnabled(name, { userId, plan: userPlan });

    return c.json({ flag: name, enabled });
});

// Create or update a feature flag (admin only)
featureFlagsRouter.put('/:name', async (c) => {
    const { name } = c.req.param();
    const body = await c.req.json<Partial<FeatureFlag>>();

    // Validate required fields
    if (body.enabled === undefined) {
        return c.json({ error: 'enabled field is required' }, 400);
    }

    const flag: FeatureFlag = {
        name,
        enabled: body.enabled,
        rolloutPercentage: body.rolloutPercentage,
        allowedUsers: body.allowedUsers,
        allowedPlans: body.allowedPlans,
        metadata: body.metadata,
    };

    const featureFlags = new FeatureFlagService(c.env.MCP_KV);
    await featureFlags.setFlag(name, flag);

    return c.json({ success: true, flag });
});

// Partially update a feature flag (admin only)
featureFlagsRouter.patch('/:name', async (c) => {
    const { name } = c.req.param();
    const updates = await c.req.json<Partial<FeatureFlag>>();

    const featureFlags = new FeatureFlagService(c.env.MCP_KV);
    const updated = await featureFlags.updateFlag(name, updates);

    if (!updated) {
        return c.json({ error: 'Feature flag not found' }, 404);
    }

    return c.json({ success: true, flag: updated });
});

// Delete a feature flag (admin only)
featureFlagsRouter.delete('/:name', async (c) => {
    const { name } = c.req.param();

    const featureFlags = new FeatureFlagService(c.env.MCP_KV);
    const deleted = await featureFlags.deleteFlag(name);

    if (!deleted) {
        return c.json({ error: 'Feature flag not found' }, 404);
    }

    return c.json({ success: true });
});

// Bulk check multiple flags
featureFlagsRouter.post('/check', async (c) => {
    const { flags: flagNames } = await c.req.json<{ flags: string[] }>();
    const userId = c.get('userId') as string | undefined;
    const userPlan = c.get('userPlan') as string | undefined;

    const featureFlags = new FeatureFlagService(c.env.MCP_KV);
    const results: Record<string, boolean> = {};

    for (const name of flagNames) {
        results[name] = await featureFlags.isEnabled(name, { userId, plan: userPlan });
    }

    return c.json({ flags: results });
});
