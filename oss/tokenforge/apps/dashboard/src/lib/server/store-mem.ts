/**
 * In-memory `DashboardStore` for dev + tests.
 *
 * Extends `MemoryDashboardCore` with the workforce surface introduced
 * in Phase 10 (subjects derived from sessions, policies, revoke).
 * Kept here so the core file stays under the 200-line cap while the
 * single class still implements the full `DashboardStore` interface.
 */

import { MemoryDashboardCore } from './store-mem-core.js';
import { newAuditId, randomB64Url } from './ids.js';
import { seedDemoData } from './store-mem-seed.js';
import type {
  DashboardPolicy,
  DashboardStore,
  DashboardSubject,
  NewPolicyInput,
} from './store.js';

export class MemoryDashboardStore extends MemoryDashboardCore implements DashboardStore {
  policies = new Map<string, DashboardPolicy>();

  async listSubjects(appId: string): Promise<DashboardSubject[]> {
    const byExternal = new Map<string, DashboardSubject>();
    const now = new Date();
    for (const s of this.sessions.values()) {
      if (s.appId !== appId) continue;
      const key = s.subjectExternal;
      const isActive = !s.revokedAt && s.expiresAt > now;
      const existing = byExternal.get(key);
      if (existing) {
        existing.lastSeenAt = s.createdAt > existing.lastSeenAt ? s.createdAt : existing.lastSeenAt;
        existing.firstSeenAt = s.createdAt < existing.firstSeenAt ? s.createdAt : existing.firstSeenAt;
        existing.activeSessions += isActive ? 1 : 0;
      } else {
        byExternal.set(key, {
          id: `sub_${key}`,
          appId,
          externalSubject: key,
          email: null,
          firstSeenAt: s.createdAt,
          lastSeenAt: s.createdAt,
          activeSessions: isActive ? 1 : 0,
        });
      }
    }
    return [...byExternal.values()].sort(
      (a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime(),
    );
  }

  async revokeSession(sessionId: string, reason: string): Promise<void> {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    s.revokedAt = new Date();
    this.audit.push({
      id: newAuditId(),
      appId: s.appId,
      sessionId,
      type: 'revoke',
      severity: 'warn',
      payload: { reason },
      at: new Date(),
    });
  }

  async listPolicies(appId: string): Promise<DashboardPolicy[]> {
    return [...this.policies.values()]
      .filter((p) => p.appId === appId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getPolicy(id: string): Promise<DashboardPolicy | null> {
    return this.policies.get(id) ?? null;
  }

  async insertPolicy(input: NewPolicyInput): Promise<DashboardPolicy> {
    const row: DashboardPolicy = {
      id: `pol_${randomB64Url(18)}`,
      appId: input.appId,
      name: input.name,
      rules: input.rules,
      enabled: true,
      createdAt: new Date(),
    };
    this.policies.set(row.id, row);
    this.audit.push({
      id: newAuditId(),
      appId: input.appId,
      sessionId: null,
      type: 'policy_created',
      severity: 'info',
      payload: { name: input.name },
      at: new Date(),
    });
    return row;
  }

  async setPolicyEnabled(id: string, enabled: boolean): Promise<void> {
    const p = this.policies.get(id);
    if (p) p.enabled = enabled;
  }

  async deletePolicy(id: string): Promise<void> {
    this.policies.delete(id);
  }

  seedDemoData(tenantId: string): void {
    seedDemoData(this, tenantId);
  }
}
