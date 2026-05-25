/**
 * Demo-data seeder — kept as a free function so the store class
 * stays focused on data access.
 */

import { newAppId, newAuditId, newSessionId } from './ids.js';
import type { MemoryDashboardCore } from './store-mem-core.js';
import type { DashboardApp, DashboardTenant } from './store.js';

export function seedDemoData(store: MemoryDashboardCore, tenantId: string): void {
  if (store.tenants.has(tenantId)) return;
  const tenant: DashboardTenant = {
    id: tenantId,
    name: 'Demo Tenant',
    ownerEmail: 'owner@demo.test',
    plan: 'free',
    createdAt: new Date(),
  };
  store.tenants.set(tenantId, tenant);

  const sampleApp: DashboardApp = {
    id: newAppId(),
    tenantId,
    mode: 'customer',
    name: 'Sample SaaS App',
    origin: 'https://app.demo.test',
    apiKeyHash: 'seed-placeholder-hash',
    shortCookieTtlSec: 300,
    longCookieTtlSec: 2_592_000,
    createdAt: new Date(),
  };
  store.apps.set(sampleApp.id, sampleApp);

  for (let i = 0; i < 3; i++) {
    const sid = newSessionId();
    const subj = `user_${i + 1}@demo.test`;
    store.sessions.set(sid, {
      id: sid,
      appId: sampleApp.id,
      subjectExternal: subj,
      bindingClass: 'webcrypto',
      origin: sampleApp.origin,
      ipFirst: `203.0.113.${10 + i}`,
      createdAt: new Date(Date.now() - i * 60_000),
      lastRefreshAt: new Date(Date.now() - i * 30_000),
      expiresAt: new Date(Date.now() + 86_400_000),
      revokedAt: null,
    });
    store.audit.push({
      id: newAuditId(),
      appId: sampleApp.id,
      sessionId: sid,
      type: 'register',
      severity: 'info',
      payload: { subject: subj, binding_class: 'webcrypto' },
      at: new Date(Date.now() - i * 60_000),
    });
  }
}
