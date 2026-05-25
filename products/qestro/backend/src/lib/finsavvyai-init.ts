/**
 * FinsavvyAI Shared Infrastructure Initialization
 * Call this once at app startup to configure all shared packages
 */

import { initClawGateway, configureSmartRouter } from '@finsavvyai/llm';
import { configureTokens, configureAuthMiddleware } from '@finsavvyai/auth';
import { configureSentry } from '@finsavvyai/monitor';
import { logger } from '../utils/logger.js';

export function initFinsavvyAI(options: {
  validateUser?: (payload: { userId: string; email: string }) => Promise<{
    id: string;
    email: string;
    role: string;
  } | null>;
} = {}): void {
  // Phase 1: Claw Gateway
  const clawEnabled = !!process.env.CLAW_API_KEY;
  initClawGateway({
    gatewayUrl: process.env.CLAW_GATEWAY_URL || 'https://claw-gateway.workers.dev',
    projectId: process.env.CLAW_PROJECT_ID || 'qestro',
    apiKey: process.env.CLAW_API_KEY || '',
    enabled: clawEnabled,
    timeout: 30000,
  });
  if (clawEnabled) {
    logger.info('Claw Gateway connected — ReasoningBank caching active');
  }

  // Phase 2: Smart Router configuration
  configureSmartRouter({
    trivial: { provider: 'huggingface', model: 'codellama/CodeLlama-7b-Instruct-hf' },
    simple: { provider: 'openai', model: 'gpt-3.5-turbo' },
    moderate: { provider: 'openai', model: 'gpt-4-turbo' },
    complex: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
  });

  // Phase 3: Auth tokens
  const requireSecret = (name: string): string => {
    const value = process.env[name];
    if (!value && process.env.NODE_ENV === 'production') {
      throw new Error(`${name} environment variable is required in production`);
    }
    return value || `dev-only-${name}-not-for-production`;
  };
  configureTokens({
    jwtSecret: requireSecret('JWT_SECRET'),
    jwtRefreshSecret: requireSecret('JWT_REFRESH_SECRET'),
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
    issuer: 'questro',
    audience: 'questro-api',
  });

  if (options.validateUser) {
    configureAuthMiddleware({
      validateUser: options.validateUser,
      onAuthFailure: (error, req) => {
        logger.error(`Auth failure: ${error}`, { ip: req.ip, path: req.path });
      },
    });
  }

  // Phase 4: Sentry (if DSN provided)
  if (process.env.SENTRY_DSN) {
    configureSentry((error, context) => {
      logger.error(`Sentry capture: ${error.message}`, context);
      // In production, forward to actual Sentry SDK
    });
    logger.info('Sentry error tracking configured');
  }

  logger.info('FinsavvyAI shared infrastructure initialized', {
    clawGateway: clawEnabled,
    sentry: !!process.env.SENTRY_DSN,
    project: 'qestro',
  });
}
