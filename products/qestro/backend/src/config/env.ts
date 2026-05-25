/**
 * Centralized Environment Configuration
 *
 * This module provides a single source of truth for all environment variables.
 * All values are parsed, typed, and validated on startup to prevent runtime errors.
 *
 * Usage:
 * ```typescript
 * import { env } from './config/env';
 * console.log(env.server.port); // 8000
 * console.log(env.isDev);       // false
 * ```
 */

/**
 * Parse and validate environment variables
 * Throws if required variables are missing in production
 */
function parseEnv(): Env {
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Validation helper
  const requireVar = (name: string, fallback?: string): string => {
    const value = process.env[name] || fallback;
    if (!value && nodeEnv === 'production') {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return value || '';
  };

  const optionalVar = (name: string, fallback = ''): string => {
    return process.env[name] || fallback;
  };

  const optionalInt = (name: string, fallback: number): number => {
    const value = process.env[name];
    return value ? parseInt(value, 10) : fallback;
  };

  const optionalBool = (name: string, fallback = false): boolean => {
    const value = process.env[name];
    if (!value) return fallback;
    return value.toLowerCase() === 'true' || value === '1';
  };

  const optionalArray = (name: string, fallback: string[] = []): string[] => {
    const value = process.env[name];
    if (!value) return fallback;
    return value.split(',').map((s) => s.trim());
  };

  return {
    // ============================================
    // SERVER CONFIGURATION
    // ============================================
    server: {
      port: optionalInt('PORT', 8000),
      host: optionalVar('HOST', '0.0.0.0'),
      nodeEnv: nodeEnv as 'development' | 'staging' | 'production',
    },

    // ============================================
    // DATABASE CONFIGURATION
    // ============================================
    database: {
      // Connection string (takes precedence if provided)
      url:
        process.env.DATABASE_URL ||
        optionalVar(
          'DATABASE_URL',
          nodeEnv === 'production'
            ? ''
            : 'postgresql://qestro_user:qestro_password@localhost:5432/qestro_development'
        ),

      // Connection details (used to construct url if DATABASE_URL not provided)
      host: optionalVar('DB_HOST', 'localhost'),
      port: optionalInt('DB_PORT', 5432),
      name: optionalVar('DB_NAME', 'qestro_development'),
      user: optionalVar('DB_USER', 'qestro_user'),
      password: optionalVar('DB_PASSWORD', 'qestro_password'),

      // Connection pooling
      poolMin: optionalInt('DB_POOL_MIN', 5),
      poolMax: optionalInt('DB_POOL_MAX', 20),
      poolIdleTimeoutMs: optionalInt('DB_POOL_IDLE_TIMEOUT', 30000),
      connectionTimeoutMs: optionalInt('DB_CONNECTION_TIMEOUT', 30000),
      idleInTransactionSessionTimeoutMs: optionalInt(
        'DB_IDLE_IN_TRANSACTION_TIMEOUT',
        60000
      ),

      // SSL for production
      ssl: optionalBool('DB_SSL', nodeEnv === 'production'),
    },

    // ============================================
    // REDIS CONFIGURATION
    // ============================================
    redis: {
      url: optionalVar(
        'REDIS_URL',
        nodeEnv === 'production'
          ? ''
          : 'redis://localhost:6379'
      ),
      host: optionalVar('REDIS_HOST', 'localhost'),
      port: optionalInt('REDIS_PORT', 6379),
      password: optionalVar('REDIS_PASSWORD', ''),
      db: optionalInt('REDIS_DB', 0),
      tls: optionalBool('REDIS_TLS', nodeEnv === 'production'),
      maxRetries: optionalInt('REDIS_MAX_RETRIES', 3),
      retryDelayMs: optionalInt('REDIS_RETRY_DELAY', 1000),
    },

    // ============================================
    // JWT/AUTHENTICATION CONFIGURATION
    // ============================================
    jwt: {
      secret: requireVar('JWT_SECRET'),
      refreshSecret: requireVar('JWT_REFRESH_SECRET'),
      accessExpiresIn: optionalVar('JWT_EXPIRES_IN', '15m'),
      refreshExpiresIn: optionalVar('JWT_REFRESH_EXPIRES_IN', '7d'),
    },

    // ============================================
    // EMAIL CONFIGURATION
    // ============================================
    email: {
      smtpHost: optionalVar('SMTP_HOST', 'smtp.sendgrid.net'),
      smtpPort: optionalInt('SMTP_PORT', 587),
      smtpUser: optionalVar('SMTP_USER', 'apikey'),
      smtpPassword: optionalVar('SMTP_PASSWORD', process.env.SENDGRID_API_KEY || ''),
      fromEmail: optionalVar('EMAIL_FROM', 'noreply@qestro.app'),
      fromName: optionalVar('EMAIL_FROM_NAME', 'Qestro'),

      // Provider: sendgrid, resend, etc.
      provider: optionalVar('EMAIL_PROVIDER', 'sendgrid'),
      sendgridApiKey: optionalVar('SENDGRID_API_KEY', ''),
      resendApiKey: optionalVar('RESEND_API_KEY', ''),
    },

    // ============================================
    // STRIPE/PAYMENT CONFIGURATION
    // ============================================
    stripe: {
      secretKey: requireVar('STRIPE_SECRET_KEY', ''),
      webhookSecret: requireVar('STRIPE_WEBHOOK_SECRET', ''),
      priceIds: {
        starter: optionalVar('STRIPE_PRICE_STARTER', ''),
        pro: optionalVar('STRIPE_PRICE_PRO', ''),
        enterprise: optionalVar('STRIPE_PRICE_ENTERPRISE', ''),
      },
    },

    // ============================================
    // OAUTH CONFIGURATION (Google & GitHub)
    // ============================================
    oauth: {
      google: {
        clientId: optionalVar('GOOGLE_OAUTH_CLIENT_ID', ''),
        clientSecret: optionalVar('GOOGLE_OAUTH_CLIENT_SECRET', ''),
        callbackUrl: optionalVar(
          'GOOGLE_OAUTH_CALLBACK_URL',
          'http://localhost:8000/auth/google/callback'
        ),
      },
      github: {
        clientId: optionalVar('GITHUB_OAUTH_CLIENT_ID', ''),
        clientSecret: optionalVar('GITHUB_OAUTH_CLIENT_SECRET', ''),
        callbackUrl: optionalVar(
          'GITHUB_OAUTH_CALLBACK_URL',
          'http://localhost:8000/auth/github/callback'
        ),
      },
    },

    // ============================================
    // CORS CONFIGURATION
    // ============================================
    cors: {
      origins: optionalArray(
        'CORS_ORIGINS',
        nodeEnv === 'production'
          ? ['https://qestro.app', 'https://qestro.io']
          : ['http://localhost:3000', 'http://localhost:3001']
      ),
      credentials: optionalBool('CORS_CREDENTIALS', true),
      maxAge: optionalInt('CORS_MAX_AGE', 86400),
    },

    // ============================================
    // FILE STORAGE CONFIGURATION (S3 / R2)
    // ============================================
    storage: {
      s3Bucket: requireVar('AWS_S3_BUCKET', ''),
      s3Region: optionalVar('AWS_REGION', 'us-west-2'),
      s3AccessKey: requireVar('AWS_ACCESS_KEY_ID', ''),
      s3SecretKey: requireVar('AWS_SECRET_ACCESS_KEY', ''),

      // Cloudflare R2 (alternative to S3)
      r2Bucket: optionalVar('CLOUDFLARE_R2_BUCKET', ''),
      r2AccessKey: optionalVar('CLOUDFLARE_R2_ACCESS_KEY_ID', ''),
      r2SecretKey: optionalVar('CLOUDFLARE_R2_SECRET_ACCESS_KEY', ''),
      r2AccountId: optionalVar('CLOUDFLARE_ACCOUNT_ID', ''),

      // Default storage type: 's3' or 'r2'
      type: optionalVar('STORAGE_TYPE', 's3') as 'r2' | 's3',
    },

    // ============================================
    // FEATURE FLAGS
    // ============================================
    features: {
      enableRecording: optionalBool('ENABLE_RECORDING', true),
      enableMobileTesting: optionalBool('ENABLE_MOBILE_TESTING', true),
      enableAI: optionalBool('ENABLE_AI_GENERATION', true),
      enableBilling: optionalBool('ENABLE_BILLING', nodeEnv === 'production'),
      enableMetrics: optionalBool('ENABLE_METRICS', true),
      enableWebSockets: optionalBool('ENABLE_WEBSOCKETS', true),
    },

    // ============================================
    // AI SERVICES CONFIGURATION
    // ============================================
    ai: {
      openaiApiKey: optionalVar('OPENAI_API_KEY', ''),
      openaiModel: optionalVar('OPENAI_MODEL', 'gpt-4'),
      openaiMaxTokens: optionalInt('OPENAI_MAX_TOKENS', 4000),
      openaiTemperature: parseFloat(optionalVar('OPENAI_TEMPERATURE', '0.3')),
    },

    // ============================================
    // FRONTEND CONFIGURATION
    // ============================================
    frontendUrl: optionalVar(
      'FRONTEND_URL',
      nodeEnv === 'production'
        ? 'https://qestro.app'
        : 'http://localhost:3000'
    ),

    // ============================================
    // RATE LIMITING
    // ============================================
    rateLimit: {
      windowMs: optionalInt('RATE_LIMIT_WINDOW', 15) * 60 * 1000,
      max: optionalInt('RATE_LIMIT_MAX', 1000),
    },

    // ============================================
    // LOGGING
    // ============================================
    logging: {
      level: optionalVar('LOG_LEVEL', nodeEnv === 'production' ? 'info' : 'debug'),
    },
  };
}

/**
 * Type definition for environment configuration
 */
interface Env {
  server: {
    port: number;
    host: string;
    nodeEnv: 'development' | 'staging' | 'production';
  };
  database: {
    url: string;
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    poolMin: number;
    poolMax: number;
    poolIdleTimeoutMs: number;
    connectionTimeoutMs: number;
    idleInTransactionSessionTimeoutMs: number;
    ssl: boolean;
  };
  redis: {
    url: string;
    host: string;
    port: number;
    password: string;
    db: number;
    tls: boolean;
    maxRetries: number;
    retryDelayMs: number;
  };
  jwt: {
    secret: string;
    refreshSecret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
  };
  email: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    fromEmail: string;
    fromName: string;
    provider: string;
    sendgridApiKey: string;
    resendApiKey: string;
  };
  stripe: {
    secretKey: string;
    webhookSecret: string;
    priceIds: {
      starter: string;
      pro: string;
      enterprise: string;
    };
  };
  oauth: {
    google: {
      clientId: string;
      clientSecret: string;
      callbackUrl: string;
    };
    github: {
      clientId: string;
      clientSecret: string;
      callbackUrl: string;
    };
  };
  cors: {
    origins: string[];
    credentials: boolean;
    maxAge: number;
  };
  storage: {
    s3Bucket: string;
    s3Region: string;
    s3AccessKey: string;
    s3SecretKey: string;
    r2Bucket: string;
    r2AccessKey: string;
    r2SecretKey: string;
    r2AccountId: string;
    type: 'r2' | 's3';
  };
  features: {
    enableRecording: boolean;
    enableMobileTesting: boolean;
    enableAI: boolean;
    enableBilling: boolean;
    enableMetrics: boolean;
    enableWebSockets: boolean;
  };
  ai: {
    openaiApiKey: string;
    openaiModel: string;
    openaiMaxTokens: number;
    openaiTemperature: number;
  };
  frontendUrl: string;
  rateLimit: {
    windowMs: number;
    max: number;
  };
  logging: {
    level: string;
  };
}

// Parse and export configuration
export const env = parseEnv();

/**
 * Convenience helpers
 */
export const isDev = env.server.nodeEnv === 'development';
export const isStaging = env.server.nodeEnv === 'staging';
export const isProd = env.server.nodeEnv === 'production';

export type { Env };
export default env;
