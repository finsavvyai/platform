/**
 * Better Auth setup for TokenForge dashboard.
 *
 * Phase 1 placeholder — wires the basic email signup/sign-in. Phase 6
 * extends with org/team support, API key management, and LemonSqueezy
 * billing webhooks.
 *
 * Reference: https://www.better-auth.com/docs/adapters/drizzle
 */

import { betterAuth } from 'better-auth';
import type { D1Database } from '@cloudflare/workers-types';

export interface AuthEnv {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  PUBLIC_BASE_URL: string;
}

export function createAuth(env: AuthEnv) {
  return betterAuth({
    database: undefined, // TODO Phase 6: drizzleAdapter(drizzle(env.DB), { provider: 'sqlite' })
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.PUBLIC_BASE_URL,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    socialProviders: {
      // Phase 6 wires Google + GitHub once OAuth apps are registered
    },
  });
}
