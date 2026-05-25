/**
 * Feature Flags Middleware
 * Cloudflare KV-based feature flags for gradual rollouts
 */

import { Context, Next } from 'hono';
import type { Env } from './auth';

// Feature flag definitions
export interface FeatureFlag {
    name: string;
    enabled: boolean;
    rolloutPercentage?: number;  // 0-100 for gradual rollout
    allowedUsers?: string[];     // Specific user IDs to enable for
    allowedPlans?: string[];     // Pro, Enterprise, etc.
    metadata?: Record<string, unknown>;
}

// Default feature flags
const DEFAULT_FLAGS: Record<string, FeatureFlag> = {
    'interactive-demo': {
        name: 'interactive-demo',
        enabled: true,
        rolloutPercentage: 100,
    },
    'ai-chat-widget': {
        name: 'ai-chat-widget',
        enabled: false,
        rolloutPercentage: 0,
    },
    'graphql-support': {
        name: 'graphql-support',
        enabled: true,
        rolloutPercentage: 100,
    },
    'postman-import': {
        name: 'postman-import',
        enabled: true,
        rolloutPercentage: 100,
    },
    'beta-features': {
        name: 'beta-features',
        enabled: false,
        rolloutPercentage: 10,
        allowedPlans: ['Pro', 'Enterprise'],
    },
    'advanced-analytics': {
        name: 'advanced-analytics',
        enabled: true,
        allowedPlans: ['Pro', 'Enterprise'],
    },
    'team-collaboration': {
        name: 'team-collaboration',
        enabled: false,
        rolloutPercentage: 25,
        allowedPlans: ['Pro', 'Enterprise'],
    },
};

// Hash function for consistent user-based rollout
function hashUserId(userId: string, flagName: string): number {
    const str = `${userId}:${flagName}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash % 100);
}

// Feature flag service class
export class FeatureFlagService {
    private kv: KVNamespace;
    private cache: Map<string, FeatureFlag> = new Map();
    private cacheExpiry: number = 0;
    private cacheTTL: number = 60000; // 1 minute cache

    constructor(kv: KVNamespace) {
        this.kv = kv;
    }

    private async loadFlags(): Promise<Record<string, FeatureFlag>> {
        // Check cache first
        if (Date.now() < this.cacheExpiry && this.cache.size > 0) {
            return Object.fromEntries(this.cache);
        }

        try {
            const flagsJson = await this.kv.get('feature-flags');
            if (flagsJson) {
                const flags = JSON.parse(flagsJson) as Record<string, FeatureFlag>;
                this.cache = new Map(Object.entries(flags));
                this.cacheExpiry = Date.now() + this.cacheTTL;
                return flags;
            }
        } catch (error) {
            console.error('Error loading feature flags:', error);
        }

        // Return defaults and save them
        await this.saveFlags(DEFAULT_FLAGS);
        return DEFAULT_FLAGS;
    }

    private async saveFlags(flags: Record<string, FeatureFlag>): Promise<void> {
        await this.kv.put('feature-flags', JSON.stringify(flags));
        this.cache = new Map(Object.entries(flags));
        this.cacheExpiry = Date.now() + this.cacheTTL;
    }

    async isEnabled(
        flagName: string,
        context?: { userId?: string; plan?: string }
    ): Promise<boolean> {
        const flags = await this.loadFlags();
        const flag = flags[flagName];

        if (!flag) return false;
        if (!flag.enabled) return false;

        // Check plan restrictions
        if (flag.allowedPlans && flag.allowedPlans.length > 0) {
            if (!context?.plan || !flag.allowedPlans.includes(context.plan)) {
                return false;
            }
        }

        // Check specific user allowlist
        if (flag.allowedUsers && flag.allowedUsers.length > 0) {
            if (context?.userId && flag.allowedUsers.includes(context.userId)) {
                return true;
            }
        }

        // Check rollout percentage
        if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
            if (!context?.userId) return false;
            const userHash = hashUserId(context.userId, flagName);
            return userHash < flag.rolloutPercentage;
        }

        return true;
    }

    async getFlag(flagName: string): Promise<FeatureFlag | null> {
        const flags = await this.loadFlags();
        return flags[flagName] || null;
    }

    async getAllFlags(): Promise<Record<string, FeatureFlag>> {
        return this.loadFlags();
    }

    async setFlag(flagName: string, flag: FeatureFlag): Promise<void> {
        const flags = await this.loadFlags();
        flags[flagName] = flag;
        await this.saveFlags(flags);
    }

    async updateFlag(flagName: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag | null> {
        const flags = await this.loadFlags();
        const existing = flags[flagName];
        if (!existing) return null;

        const updated = { ...existing, ...updates };
        flags[flagName] = updated;
        await this.saveFlags(flags);
        return updated;
    }

    async deleteFlag(flagName: string): Promise<boolean> {
        const flags = await this.loadFlags();
        if (!flags[flagName]) return false;
        delete flags[flagName];
        await this.saveFlags(flags);
        return true;
    }
}

// Middleware to attach feature flags to context
export const featureFlagsMiddleware = async (c: Context<{ Bindings: Env }>, next: Next) => {
    const featureFlags = new FeatureFlagService(c.env.MCP_KV);
    c.set('featureFlags', featureFlags);
    await next();
};

// Helper to check feature flag in handlers
export async function checkFeature(
    c: Context<{ Bindings: Env }>,
    flagName: string,
    userId?: string,
    plan?: string
): Promise<boolean> {
    const featureFlags = c.get('featureFlags') as FeatureFlagService;
    return featureFlags.isEnabled(flagName, { userId, plan });
}
