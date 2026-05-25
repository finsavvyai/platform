/**
 * In-memory `DbAccess` for unit + integration tests.
 *
 * Pure JS, no D1, no Miniflare. Stable enough to hit every code path
 * the route handlers use and fast enough that the protocol round-trip
 * suite stays under a second.
 */

import type { App, Session, Subject, AuditEvent } from '@tokenforge/db';
import type {
  DbAccess,
  NewAuditEvent,
  NewSession,
  NewSubject,
  SessionRefreshUpdate,
} from './db-access.js';

export class InMemoryDb implements DbAccess {
  apps = new Map<string, App>();
  subjects = new Map<string, Subject>();
  sessions = new Map<string, Session>();
  audit: AuditEvent[] = [];

  async findApp(appId: string) {
    return this.apps.get(appId) ?? null;
  }

  async findSubject(appId: string, externalSubject: string) {
    for (const s of this.subjects.values()) {
      if (s.appId === appId && s.externalSubject === externalSubject) return s;
    }
    return null;
  }

  async insertSubject(i: NewSubject) {
    const row: Subject = {
      id: i.id,
      appId: i.appId,
      externalSubject: i.externalSubject,
      metadata: i.metadata ?? null,
      firstSeenAt: i.firstSeenAt,
      lastSeenAt: i.lastSeenAt,
    } as Subject;
    this.subjects.set(i.id, row);
    return row;
  }

  async touchSubject(id: string, at: Date) {
    const s = this.subjects.get(id);
    if (s) (s as any).lastSeenAt = at;
  }

  async insertSession(i: NewSession) {
    this.sessions.set(i.id, {
      ...i,
      userAgent: i.userAgent ?? null,
      ipFirst: i.ipFirst ?? null,
      geoFirst: i.geoFirst ?? null,
      asnFirst: i.asnFirst ?? null,
      longCookieHash: i.longCookieHash ?? null,
      longCookieExpiresAt: i.longCookieExpiresAt ?? null,
      lastRefreshAt: null,
      revokedAt: null,
      revokedReason: null,
    } as Session);
  }

  async findSession(id: string) {
    return this.sessions.get(id) ?? null;
  }

  async updateSessionRefresh(i: SessionRefreshUpdate) {
    const s = this.sessions.get(i.sessionId);
    if (!s) return;
    Object.assign(s, {
      lastRefreshAt: i.lastRefreshAt,
      boundCookieHash: i.boundCookieHash,
      boundCookieIssuedAt: i.boundCookieIssuedAt,
      boundCookieExpiresAt: i.boundCookieExpiresAt,
    });
  }

  async revokeSession(id: string, reason: string, at: Date) {
    const s = this.sessions.get(id);
    if (!s) return;
    Object.assign(s, { revokedAt: at, revokedReason: reason });
  }

  async listActiveSessions(appId: string, subjectId: string) {
    const now = new Date();
    return [...this.sessions.values()].filter(
      (s) =>
        s.appId === appId &&
        s.subjectId === subjectId &&
        s.revokedAt == null &&
        s.expiresAt > now,
    );
  }

  async insertAudit(i: NewAuditEvent) {
    this.audit.push({
      id: i.id,
      appId: i.appId,
      sessionId: i.sessionId ?? null,
      type: i.type,
      severity: i.severity ?? 'info',
      ip: i.ip ?? null,
      geo: i.geo ?? null,
      ua: i.ua ?? null,
      payload: i.payload ?? null,
      at: i.at,
    } as AuditEvent);
  }
}
