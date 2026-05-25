import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '@opensyber/db';
import type { Role, OrgMember, Plan, PlanConfig } from '@opensyber/shared';

export interface Env {
  // Cloudflare bindings
  DB: D1Database;
  CREDENTIAL_VAULT: KVNamespace;
  CACHE: KVNamespace;
  TF_NONCES: KVNamespace;
  STORAGE: R2Bucket;
  AGENT_DO: DurableObjectNamespace;
  AI?: Ai;
  VECTORIZE?: VectorizeIndex;

  // Environment variables
  ENVIRONMENT: string;
  AUTH_SECRET: string;
  // LemonSqueezy (shared store — prefixed with OPENSYBER_)
  LEMONSQUEEZY_API_KEY: string;
  LEMONSQUEEZY_WEBHOOK_SECRET: string;
  LEMONSQUEEZY_STORE_ID: string;
  OPENSYBER_LS_PRODUCT_ID: string;
  OPENSYBER_LS_VARIANT_PERSONAL: string;
  OPENSYBER_LS_VARIANT_PRO: string;
  OPENSYBER_LS_VARIANT_TEAM: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  ENCRYPTION_KEY: string;
  RESEND_API_KEY: string;
  CLERK_WEBHOOK_SECRET: string;
  ANTHROPIC_API_KEY?: string;
  AGENT_IMAGE?: string;
  API_BASE_URL?: string;
  OPENSYBER_API_URL?: string;
  SENTRY_DSN?: string;
  // WebAuthn relying-party origin (defaults to https://opensyber.cloud)
  TOKENFORGE_RP_ORIGIN?: string;

  // Tailscale zero-trust networking (optional — graceful degradation if absent)
  TAILSCALE_API_KEY?: string;
  TAILSCALE_TAILNET?: string;

  // Ed25519 JWK used to sign skill tarballs at publish time. Agents
  // verify with the matching public key baked into their image.
  SKILL_SIGNING_PRIVATE_KEY?: string;
  SKILL_SIGNING_PUBLIC_KEY?: string;
  MARKETPLACE_ARTIFACT_POLICY?: 'enforce' | 'warn' | 'off';

  // Optional secondary HMAC secret layered on top of X-Gitlab-Token.
  GITLAB_WEBHOOK_SECRET?: string;
  GITLAB_WEBHOOK_HMAC_SECRET?: string;

  // Optional JWT issuer / audience enforcement — leave unset for back-compat.
  AUTH_JWT_ISSUER?: string;
  AUTH_JWT_AUDIENCE?: string;

  // Audit queue binding (optional)
  AUDIT_QUEUE?: { send: (msg: unknown) => Promise<void> };
}

export interface Variables {
  db: DrizzleD1Database<typeof schema>;
  userId: string;
  orgId: string | null;
  role: Role | null;
  orgMember: OrgMember | null;
  planConfig?: {
    plan: Plan;
    config: PlanConfig;
    isOrg: boolean;
  };
}
