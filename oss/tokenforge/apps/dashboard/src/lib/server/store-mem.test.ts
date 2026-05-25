import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryDashboardStore } from './store-mem.js';
import type { DashboardSession } from './store.js';

const TENANT = 'tnt_t1';

let store: MemoryDashboardStore;

beforeEach(() => {
  store = new MemoryDashboardStore();
  store.upsertTenant({
    id: TENANT,
    name: 'Test',
    ownerEmail: 'a@b.c',
    plan: 'free',
    createdAt: new Date(),
  });
});

describe('MemoryDashboardStore', () => {
  it('inserts an app and lists it', async () => {
    const app = await store.insertApp({
      tenantId: TENANT, mode: 'customer', name: 'My App',
      origin: 'https://x', apiKeyHash: 'h',
    });
    const list = await store.listApps(TENANT);
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(app.id);
    const audit = await store.listAuditEvents(null, TENANT);
    expect(audit.find((e) => e.type === 'app_created')).toBeTruthy();
  });

  it('countActiveSessions excludes revoked + expired', async () => {
    const app = await store.insertApp({
      tenantId: TENANT, mode: 'customer', name: 'A',
      origin: 'https://x', apiKeyHash: 'h',
    });
    const future = new Date(Date.now() + 86_400_000);
    const past = new Date(Date.now() - 1000);
    const live: DashboardSession = {
      id: 's1', appId: app.id, subjectExternal: 'u',
      bindingClass: 'webcrypto', origin: 'https://x', ipFirst: null,
      createdAt: new Date(), lastRefreshAt: null, expiresAt: future, revokedAt: null,
    };
    const revoked = { ...live, id: 's2', revokedAt: new Date() };
    const expired = { ...live, id: 's3', expiresAt: past };
    store.sessions.set(live.id, live);
    store.sessions.set(revoked.id, revoked);
    store.sessions.set(expired.id, expired);
    expect(await store.countActiveSessions(app.id)).toBe(1);
  });

  it('listSessions filters by subject substring + sorts newest-first', async () => {
    const app = await store.insertApp({
      tenantId: TENANT, mode: 'customer', name: 'A',
      origin: 'https://x', apiKeyHash: 'h',
    });
    for (const [id, subj, age] of [
      ['s1', 'alice@x', 100],
      ['s2', 'bob@x', 50],
      ['s3', 'alice@x', 10],
    ] as const) {
      store.sessions.set(id, {
        id, appId: app.id, subjectExternal: subj,
        bindingClass: 'webcrypto', origin: 'https://x', ipFirst: null,
        createdAt: new Date(Date.now() - age * 1000),
        lastRefreshAt: null, expiresAt: new Date(Date.now() + 86_400_000), revokedAt: null,
      });
    }
    const alice = await store.listSessions(app.id, { subject: 'alice' });
    expect(alice.map((s) => s.id)).toEqual(['s3', 's1']);
  });

  it('deleteApp removes the row and its sessions', async () => {
    const app = await store.insertApp({
      tenantId: TENANT, mode: 'customer', name: 'A',
      origin: 'https://x', apiKeyHash: 'h',
    });
    store.sessions.set('s', {
      id: 's', appId: app.id, subjectExternal: 'u',
      bindingClass: 'webcrypto', origin: 'https://x', ipFirst: null,
      createdAt: new Date(), lastRefreshAt: null,
      expiresAt: new Date(Date.now() + 86_400_000), revokedAt: null,
    });
    await store.deleteApp(app.id);
    expect(await store.getApp(app.id)).toBeNull();
    expect(store.sessions.size).toBe(0);
  });

  it('setPlan updates the tenant plan', async () => {
    await store.setPlan(TENANT, 'pro');
    const t = await store.getTenant(TENANT);
    expect(t?.plan).toBe('pro');
  });

  it('seedDemoData is idempotent', () => {
    const s = new MemoryDashboardStore();
    s.seedDemoData('tnt_demo');
    const before = s.apps.size;
    s.seedDemoData('tnt_demo');
    expect(s.apps.size).toBe(before);
  });

  it('listSubjects aggregates sessions per external subject', async () => {
    const app = await store.insertApp({
      tenantId: TENANT, mode: 'workforce', name: 'A', origin: 'https://x', apiKeyHash: 'h',
    });
    const future = new Date(Date.now() + 86_400_000);
    for (const [id, subj, age] of [
      ['s1', 'alice@x', 1000],
      ['s2', 'alice@x', 100],
      ['s3', 'bob@x', 500],
    ] as const) {
      store.sessions.set(id, {
        id, appId: app.id, subjectExternal: subj,
        bindingClass: 'webcrypto', origin: 'https://x', ipFirst: null,
        createdAt: new Date(Date.now() - age * 1000),
        lastRefreshAt: null, expiresAt: future, revokedAt: null,
      });
    }
    const subjects = await store.listSubjects(app.id);
    expect(subjects).toHaveLength(2);
    const alice = subjects.find((s) => s.externalSubject === 'alice@x');
    expect(alice?.activeSessions).toBe(2);
  });

  it('revokeSession marks the row + writes an audit row', async () => {
    const app = await store.insertApp({
      tenantId: TENANT, mode: 'customer', name: 'A', origin: 'https://x', apiKeyHash: 'h',
    });
    store.sessions.set('s1', {
      id: 's1', appId: app.id, subjectExternal: 'u',
      bindingClass: 'webcrypto', origin: 'https://x', ipFirst: null,
      createdAt: new Date(), lastRefreshAt: null,
      expiresAt: new Date(Date.now() + 86_400_000), revokedAt: null,
    });
    await store.revokeSession('s1', 'admin_test');
    expect(store.sessions.get('s1')?.revokedAt).not.toBeNull();
    expect(store.audit.find((e) => e.type === 'revoke')).toBeTruthy();
  });

  it('revokeSession is a no-op for an unknown id', async () => {
    await expect(store.revokeSession('missing', 'r')).resolves.toBeUndefined();
  });

  it('insertPolicy + listPolicies + setPolicyEnabled + delete round-trip', async () => {
    const app = await store.insertApp({
      tenantId: TENANT, mode: 'workforce', name: 'A', origin: 'https://x', apiKeyHash: 'h',
    });
    const p = await store.insertPolicy({
      appId: app.id,
      name: 'Block RU',
      rules: { rules: [{ if_any: [{ geo_country_in: ['RU'] }], then: 'block' }] },
    });
    expect(p.id.startsWith('pol_')).toBe(true);
    expect(p.enabled).toBe(true);

    const list = await store.listPolicies(app.id);
    expect(list).toHaveLength(1);

    await store.setPolicyEnabled(p.id, false);
    expect((await store.getPolicy(p.id))?.enabled).toBe(false);

    await store.deletePolicy(p.id);
    expect(await store.getPolicy(p.id)).toBeNull();
  });

  it('listAuditEvents filters by appId and tenant ownership', async () => {
    const a = await store.insertApp({
      tenantId: TENANT, mode: 'customer', name: 'A',
      origin: 'https://x', apiKeyHash: 'h',
    });
    const otherTenant = 'tnt_other';
    store.upsertTenant({
      id: otherTenant, name: 'O', ownerEmail: 'o@x', plan: 'free', createdAt: new Date(),
    });
    const b = await store.insertApp({
      tenantId: otherTenant, mode: 'customer', name: 'B',
      origin: 'https://y', apiKeyHash: 'h',
    });
    void a; void b;
    const own = await store.listAuditEvents(null, TENANT);
    expect(own.every((e) => e.appId === a.id)).toBe(true);
    const filtered = await store.listAuditEvents(a.id, TENANT);
    expect(filtered.every((e) => e.appId === a.id)).toBe(true);
  });
});
