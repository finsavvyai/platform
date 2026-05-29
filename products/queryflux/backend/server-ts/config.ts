import { z } from 'zod';

const ConfigSchema = z.object({
  port: z.number().default(8080),
  host: z.string().default('0.0.0.0'),
  env: z.enum(['development', 'production', 'test']).default('development'),
  jwtSecret: z.string().min(16),
  corsOrigins: z.array(z.string()).default(['http://localhost:5198']),
  rateLimitWindowMs: z.number().default(60_000),
  rateLimitMax: z.number().default(100),
  queryTimeoutMs: z.number().default(30_000),
  maxResultRows: z.number().default(10_000),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

const INSECURE_DEFAULTS = new Set([
  'dev-secret-change-in-production',
  'change-me-use-a-strong-secret-in-production',
  'secret',
  'password',
]);

export function loadConfig(): AppConfig {
  const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-in-production';

  const isProduction = (process.env.NODE_ENV || 'development') === 'production';
  if (isProduction && INSECURE_DEFAULTS.has(jwtSecret)) {
    throw new Error('[QueryFlux] JWT_SECRET must be set to a strong secret in production.');
  }

  const raw = {
    port: parseInt(process.env.PORT || '8080', 10),
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development',
    jwtSecret,
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5198').split(','),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    queryTimeoutMs: parseInt(process.env.QUERY_TIMEOUT || '30000', 10),
    maxResultRows: parseInt(process.env.MAX_RESULT_ROWS || '10000', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
  };

  return ConfigSchema.parse(raw);
}
