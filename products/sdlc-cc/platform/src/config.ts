export type AppEnvironment = 'development' | 'test' | 'production';
export type AppLogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface AppConfig {
  env: AppEnvironment;
  host: string;
  port: number;
  trustProxy: boolean;
  jsonBodyLimit: string;
  shutdownTimeoutMs: number;
  logLevel: AppLogLevel;
  serviceName: string;
  version: string;
}

const DEFAULT_PORT = 3000;
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;
const allowedLogLevels = new Set<AppLogLevel>([
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
]);

function normalizeEnvironment(value?: string): AppEnvironment {
  if (value === 'production' || value === 'test') {
    return value;
  }

  return 'development';
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return value === 'true' || value === '1';
}

function parseInteger(
  value: string | undefined,
  fallback: number,
  label: string,
  bounds: { min: number; max: number },
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < bounds.min || parsed > bounds.max) {
    throw new Error(`${label} must be between ${bounds.min} and ${bounds.max}`);
  }

  return parsed;
}

function parseLogLevel(value: string | undefined): AppLogLevel {
  if (!value) {
    return 'info';
  }

  if (!allowedLogLevels.has(value as AppLogLevel)) {
    throw new Error(`LOG_LEVEL must be one of: ${Array.from(allowedLogLevels).join(', ')}`);
  }

  return value as AppLogLevel;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    env: normalizeEnvironment(env.NODE_ENV),
    host: env.HOST?.trim() || '0.0.0.0',
    port: parseInteger(env.PORT, DEFAULT_PORT, 'PORT', { min: 1, max: 65535 }),
    trustProxy: parseBoolean(env.TRUST_PROXY, true),
    jsonBodyLimit: env.JSON_BODY_LIMIT?.trim() || '1mb',
    shutdownTimeoutMs: parseInteger(
      env.SHUTDOWN_TIMEOUT_MS,
      DEFAULT_SHUTDOWN_TIMEOUT_MS,
      'SHUTDOWN_TIMEOUT_MS',
      { min: 1000, max: 120000 }
    ),
    logLevel: parseLogLevel(env.LOG_LEVEL),
    serviceName: env.SERVICE_NAME?.trim() || 'sdlc-platform',
    version: env.APP_VERSION?.trim() || '1.0.0',
  };
}
