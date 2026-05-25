/**
 * Application Configuration Stub
 * Provides centralized configuration for the application
 */
export const config = {
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0'),
    },
    cache: {
        defaultTTL: 3600,
        maxSize: 1000,
        enabled: process.env.CACHE_ENABLED !== 'false',
    },
    database: {
        url: process.env.DATABASE_URL || '',
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
    },
    server: {
        port: parseInt(process.env.PORT || '3000'),
        host: process.env.HOST || '0.0.0.0',
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'default-secret',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    },
    ai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.AI_MODEL || 'gpt-4',
    },
    environment: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV !== 'production',
};

export default config;
