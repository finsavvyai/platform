/**
 * Base in-memory store — tenants, apps, sessions, audit, webhooks.
 *
 * Workforce-only surface (subjects, policies, revoke) lives in
 * `store-mem.ts` as a subclass to keep this file under the 200-line
 * cap.
 */

import { newAppId, newAuditId, randomB64Url } from './ids.js';
import type {
  DashboardApp,
  DashboardAudit,
  DashboardSession,
  DashboardTenant,
  DashboardWebhook,
  DashboardWebhookWithSecret,
  NewAppInput,
  NewWebhookInput,
  Plan,
} from './store.js';

export class MemoryDashboardCore {
  tenants = new Map<string, DashboardTenant>();
  apps = new Map<string, DashboardApp>();
  sessions = new Map<string, DashboardSession>();
  audit: DashboardAudit[] = [];
  webhooks = new Map<string, DashboardWebhookWithSecret>();

  async getTenant(id: string) {
    return this.tenants.get(id) ?? null;
  }

  async upsertTenant(t: DashboardTenant) {
    this.tenants.set(t.id, t);
  }

  async setPlan(tenantId: string, plan: Plan) {
    const t = this.tenants.get(tenantId);
    if (t) t.plan = plan;
  }

  async listApps(tenantId: string) {
    return [...this.apps.values()].filter((a) => a.tenantId === tenantId);
  }

  async getApp(appId: string) {
    return this.apps.get(appId) ?? null;
  }

  async insertApp(input: NewAppInput): Promise<DashboardApp> {
    const id = newAppId();
    const row: DashboardApp = {
      id,
      tenantId: input.tenantId,
      mode: input.mode,
      name: input.name,
      origin: input.origin,
      apiKeyHash: input.apiKeyHash,
      shortCookieTtlSec: 300,
      longCookieTtlSec: 2_592_000,
      createdAt: new Date(),
    };
    this.apps.set(id, row);
    this.audit.push({
      id: newAuditId(),
      appId: id,
      sessionId: null,
      type: 'app_created',
      severity: 'info',
      payload: { name: input.name, mode: input.mode, origin: input.origin },
      at: new Date(),
    });
    return row;
  }

  async deleteApp(appId: string) {
    this.apps.delete(appId);
    for (const [id, s] of this.sessions) {
      if (s.appId === appId) this.sessions.delete(id);
    }
  }

  async listSessions(appId: string, q?: { subject?: string; limit?: number }) {
    const limit = q?.limit ?? 50;
    let rows = [...this.sessions.values()].filter((s) => s.appId === appId);
    if (q?.subject) rows = rows.filter((s) => s.subjectExternal.includes(q.subject!));
    return rows
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async listAuditEvents(appId: string | null, tenantId: string, limit = 100) {
    const tenantApps = new Set(
      [...this.apps.values()].filter((a) => a.tenantId === tenantId).map((a) => a.id),
    );
    return this.audit
      .filter((e) => tenantApps.has(e.appId))
      .filter((e) => (appId ? e.appId === appId : true))
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, limit);
  }

  async countActiveSessions(appId: string) {
    const now = new Date();
    let n = 0;
    for (const s of this.sessions.values()) {
      if (s.appId === appId && !s.revokedAt && s.expiresAt > now) n++;
    }
    return n;
  }

  async listWebhooks(appId: string): Promise<DashboardWebhook[]> {
    return [...this.webhooks.values()]
      .filter((w) => w.appId === appId)
      .map((w) => ({
        id: w.id,
        appId: w.appId,
        url: w.url,
        events: w.events,
        enabled: w.enabled,
        createdAt: w.createdAt,
      }));
  }

  async insertWebhook(input: NewWebhookInput): Promise<DashboardWebhookWithSecret> {
    const w: DashboardWebhookWithSecret = {
      id: `whk_${randomB64Url(18)}`,
      appId: input.appId,
      url: input.url,
      events: input.events,
      enabled: true,
      createdAt: new Date(),
      secret: `whsec_${randomB64Url(32)}`,
    };
    this.webhooks.set(w.id, w);
    return w;
  }

  async deleteWebhook(id: string): Promise<void> {
    this.webhooks.delete(id);
  }
}
