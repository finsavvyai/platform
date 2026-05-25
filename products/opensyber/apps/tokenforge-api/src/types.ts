import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '@opensyber/db';

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  ENVIRONMENT: string;
  LEMONSQUEEZY_API_KEY: string;
  LEMONSQUEEZY_WEBHOOK_SECRET: string;
  RESEND_API_KEY: string;
  TF_LS_VARIANT_PRO: string;
  TF_LS_VARIANT_TEAM: string;
  TF_LS_VARIANT_ENTERPRISE: string;
  TF_LS_PRODUCT_ID: string;
  CF_API_TOKEN: string;
  CF_ZONE_ID: string;
  INTERNAL_API_SECRET: string;
  AUTH_SECRET: string;
  CLAW_GATEWAY_URL?: string;
  CLAW_API_KEY?: string;
}

export interface Variables {
  db: DrizzleD1Database<typeof schema>;
  tenantId: string;
  tenantPlan: string;
}

export type TfPlan = 'free' | 'pro' | 'team' | 'enterprise';

/** Plan verification limits per month */
export const PLAN_LIMITS: Record<string, number> = {
  free: 1_000,
  pro: 50_000,
  team: 250_000,
  enterprise: Infinity,
} as const;

/** Max API keys per plan */
export const PLAN_KEY_LIMITS: Record<string, number> = {
  free: 2,
  pro: 10,
  team: 50,
  enterprise: Infinity,
} as const;

/** Max allowed domains per key per plan */
export const PLAN_DOMAIN_LIMITS: Record<string, number> = {
  free: 1,
  pro: 5,
  team: 20,
  enterprise: Infinity,
} as const;

/** Max outgoing webhook subscriptions per plan */
export const PLAN_WEBHOOK_LIMITS: Record<string, number> = {
  free: 1,
  pro: 5,
  team: 25,
  enterprise: Infinity,
} as const;
