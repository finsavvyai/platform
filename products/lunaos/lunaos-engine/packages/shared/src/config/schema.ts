import { z } from 'zod';

// ===================================
// ENVIRONMENT SCHEMAS
// ===================================

/**
 * Application Runtime Environment
 */
export const AppEnvironmentSchema = z.enum(['development', 'test', 'staging', 'production']);

/**
 * Feature Flags Configuration
 * Used for toggling features like the new "Investor Mode"
 */
export const FeatureFlagsSchema = z.object({
    ENABLE_INVESTOR_MODE: z.boolean().default(false),
    ENABLE_BETA_FEATURES: z.boolean().default(false),
    ENABLE_GLM_VISUALIZER: z.boolean().default(false),
    MAINTENANCE_MODE: z.boolean().default(false),
});

/**
 * Core Application Configuration
 */
export const AppConfigSchema = z.object({
    NODE_ENV: AppEnvironmentSchema.default('development'),
    APP_URL: z.string().url().default('http://localhost:3000'),
    API_URL: z.string().url().default('http://localhost:8787'),
    SECRET_KEY: z.string().min(16),

    // Deployment Metadata
    DEPLOYMENT_ID: z.string().optional(),
    COMMIT_SHA: z.string().optional(),
});

/**
 * Authentication Configuration
 */
export const AuthConfigSchema = z.object({
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.string().default('7d'),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
});

/**
 * Database Configuration (D1)
 */
export const DatabaseConfigSchema = z.object({
    DATABASE_ID: z.string().min(1),
    // D1 doesn't use traditional connection strings in Workers, 
    // but we might need this for local scripts
    DATABASE_URL: z.string().optional(),
});

/**
 * AI Service Configuration
 * Credentials for the LLMs driving the agents
 */
export const AiConfigSchema = z.object({
    OPENAI_API_KEY: z.string().min(1),
    ANTHROPIC_API_KEY: z.string().optional(),

    // Model defaults
    DEFAULT_MODEL: z.string().default('gpt-4-turbo-preview'),
});

/**
 * Observability & Monitoring
 */
export const MonitoringConfigSchema = z.object({
    SENTRY_DSN: z.string().url().optional(),
    ENABLE_TRACING: z.boolean().default(true),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

/**
 * Combined Global Env Schema
 */
export const GlobalEnvSchema = AppConfigSchema
    .merge(AuthConfigSchema)
    .merge(DatabaseConfigSchema)
    .merge(AiConfigSchema)
    .merge(MonitoringConfigSchema)
    .merge(z.object({ FEATURES: FeatureFlagsSchema }));

export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
export type GlobalEnv = z.infer<typeof GlobalEnvSchema>;

/**
 * Helper to validate partial env objects (e.g. from process.env)
 */
export const validateEnv = (env: Record<string, unknown>) => {
    try {
        // We treat FEATURES as a special nested JSON object if passed as string,
        // or we construct it from individual keys if needed.
        // For simplicity here, we assume a flat structure map for checks.

        // Note: This is an approximate mapping for runtime validation.
        // In strict Cloudflare environments, we pass the `env` object directly.
        return GlobalEnvSchema.parse(env);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const missing = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n');
            throw new Error(`Invalid Service Configuration:\n${missing}`);
        }
        throw error;
    }
};
