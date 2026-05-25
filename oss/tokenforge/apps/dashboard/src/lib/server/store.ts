/**
 * `DashboardStore` — server-side data surface for the SvelteKit pages.
 *
 * This abstraction lets the dashboard run against an in-memory store
 * in dev (immediate productivity, no D1 required) and switch to a
 * Drizzle/D1 adapter in prod without touching any `+page.server.ts`.
 */

export type AppMode = 'customer' | 'workforce';
export type Plan = 'free' | 'pro' | 'scale' | 'workforce';

export interface DashboardTenant {
  id: string;
  name: string;
  ownerEmail: string;
  plan: Plan;
  createdAt: Date;
}

export interface DashboardApp {
  id: string;
  tenantId: string;
  mode: AppMode;
  name: string;
  origin: string;
  apiKeyHash: string;
  shortCookieTtlSec: number;
  longCookieTtlSec: number;
  createdAt: Date;
}

export interface DashboardSession {
  id: string;
  appId: string;
  subjectExternal: string;
  bindingClass: 'native_dbsc' | 'webauthn' | 'webcrypto';
  origin: string;
  ipFirst: string | null;
  createdAt: Date;
  lastRefreshAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface DashboardAudit {
  id: string;
  appId: string;
  sessionId: string | null;
  type: string;
  severity: 'info' | 'warn' | 'critical';
  payload: Record<string, unknown> | null;
  at: Date;
}

export interface NewAppInput {
  tenantId: string;
  mode: AppMode;
  name: string;
  origin: string;
  apiKeyHash: string;
}

export interface DashboardStore {
  getTenant(tenantId: string): Promise<DashboardTenant | null>;
  upsertTenant(t: DashboardTenant): Promise<void>;
  setPlan(tenantId: string, plan: Plan): Promise<void>;

  listApps(tenantId: string): Promise<DashboardApp[]>;
  getApp(appId: string): Promise<DashboardApp | null>;
  insertApp(input: NewAppInput): Promise<DashboardApp>;
  deleteApp(appId: string): Promise<void>;

  listSessions(appId: string, query?: { subject?: string; limit?: number }): Promise<DashboardSession[]>;
  listAuditEvents(appId: string | null, tenantId: string, limit?: number): Promise<DashboardAudit[]>;

  countActiveSessions(appId: string): Promise<number>;

  listWebhooks(appId: string): Promise<DashboardWebhook[]>;
  insertWebhook(input: NewWebhookInput): Promise<DashboardWebhookWithSecret>;
  deleteWebhook(id: string): Promise<void>;

  listSubjects(appId: string): Promise<DashboardSubject[]>;
  revokeSession(sessionId: string, reason: string): Promise<void>;

  listPolicies(appId: string): Promise<DashboardPolicy[]>;
  getPolicy(id: string): Promise<DashboardPolicy | null>;
  insertPolicy(input: NewPolicyInput): Promise<DashboardPolicy>;
  setPolicyEnabled(id: string, enabled: boolean): Promise<void>;
  deletePolicy(id: string): Promise<void>;
}

export interface DashboardSubject {
  id: string;
  appId: string;
  externalSubject: string;
  email: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  activeSessions: number;
}

export interface DashboardPolicy {
  id: string;
  appId: string;
  name: string;
  rules: Record<string, unknown>;
  enabled: boolean;
  createdAt: Date;
}

export interface NewPolicyInput {
  appId: string;
  name: string;
  rules: Record<string, unknown>;
}

export interface DashboardWebhook {
  id: string;
  appId: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: Date;
}

export interface DashboardWebhookWithSecret extends DashboardWebhook {
  /** Returned exactly once on insert. */
  secret: string;
}

export interface NewWebhookInput {
  appId: string;
  url: string;
  events: string[];
}
