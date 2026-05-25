/**
 * FinSavvy Shield - Shared Auth Configuration
 * 
 * Environment-based configuration for unified authentication across all services.
 * Both QuantumBeam and PipeWarden should use these same secrets.
 */

// Auth configuration shared across services
export interface AuthConfig {
    // JWT Settings
    jwtSecret: string;
    jwtRefreshSecret: string;
    jwtIssuer: string;
    jwtAudience: string;
    accessTokenTTL: number;   // seconds
    refreshTokenTTL: number;  // seconds

    // API Key Settings
    apiKeyPrefix: string;
    apiKeyHashSalt: string;

    // Rate Limiting
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;

    // Redis (for token blacklist & sessions)
    redisUrl?: string;
}

/**
 * Get auth config from environment variables
 */
export function getAuthConfig(env: Record<string, string | undefined>): AuthConfig {
    return {
        // JWT - MUST be the same in QuantumBeam config.yaml and PipeWarden wrangler.toml
        jwtSecret: env.JWT_SECRET || env.FINSAVVY_JWT_SECRET || 'finsavvy-dev-secret-change-in-prod',
        jwtRefreshSecret: env.JWT_REFRESH_SECRET || env.FINSAVVY_JWT_REFRESH_SECRET || 'finsavvy-refresh-secret-change-in-prod',
        jwtIssuer: env.JWT_ISSUER || 'finsavvy-shield',
        jwtAudience: env.JWT_AUDIENCE || 'finsavvy-api',
        accessTokenTTL: parseInt(env.ACCESS_TOKEN_TTL || '3600'),  // 1 hour
        refreshTokenTTL: parseInt(env.REFRESH_TOKEN_TTL || '604800'), // 7 days

        // API Keys
        apiKeyPrefix: env.API_KEY_PREFIX || 'fs',
        apiKeyHashSalt: env.API_KEY_SALT || 'finsavvy-key-salt',

        // Rate Limiting
        rateLimitWindowMs: parseInt(env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
        rateLimitMaxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS || '100'),

        // Redis
        redisUrl: env.REDIS_URL || env.UPSTASH_REDIS_URL,
    };
}

/**
 * Pricing tier rate limits (requests per minute)
 */
export const TIER_RATE_LIMITS = {
    free: 60,
    startup: 600,
    growth: 3000,
    enterprise: 30000,
} as const;

/**
 * Pricing tier API call limits (per month)
 */
export const TIER_MONTHLY_LIMITS = {
    free: 1000,
    startup: 10000,
    growth: 100000,
    enterprise: Infinity,
} as const;

/**
 * Role permissions
 */
export const ROLE_PERMISSIONS = {
    admin: ['read', 'write', 'delete', 'manage_users', 'manage_billing', 'view_analytics'],
    developer: ['read', 'write', 'view_analytics'],
    analyst: ['read', 'view_analytics'],
    viewer: ['read'],
} as const;

export type Role = keyof typeof ROLE_PERMISSIONS;
export type PricingTier = keyof typeof TIER_RATE_LIMITS;
