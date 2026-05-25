/**
 * Drizzle-backed `DbAccess` adapter.
 *
 * One thin file per query; everything stays explicit because D1 is
 * cheap on simple SELECT/INSERT and we don't want hidden N+1s. Tests
 * use the in-memory adapter in ./db-mem.ts instead.
 */

import { and, eq, gt, isNull } from 'drizzle-orm';
import { drizzle, apps, subjects, sessions, auditEvents } from '@tokenforge/db';
import type { App, Session, Subject } from '@tokenforge/db';
import type {
  DbAccess,
  NewAuditEvent,
  NewSession,
  NewSubject,
  SessionRefreshUpdate,
} from './db-access.js';

export function drizzleDb(d1: D1Database): DbAccess {
  const db = drizzle(d1);
  return {
    async findApp(appId): Promise<App | null> {
      const rows = await db.select().from(apps).where(eq(apps.id, appId)).limit(1);
      return (rows[0] as App | undefined) ?? null;
    },

    async findSubject(appId, externalSubject): Promise<Subject | null> {
      const rows = await db
        .select()
        .from(subjects)
        .where(and(eq(subjects.appId, appId), eq(subjects.externalSubject, externalSubject)))
        .limit(1);
      return (rows[0] as Subject | undefined) ?? null;
    },

    async insertSubject(input: NewSubject): Promise<Subject> {
      await db.insert(subjects).values({
        id: input.id,
        appId: input.appId,
        externalSubject: input.externalSubject,
        metadata: input.metadata ?? null,
        firstSeenAt: input.firstSeenAt,
        lastSeenAt: input.lastSeenAt,
      });
      return {
        id: input.id,
        appId: input.appId,
        externalSubject: input.externalSubject,
        metadata: input.metadata ?? null,
        firstSeenAt: input.firstSeenAt,
        lastSeenAt: input.lastSeenAt,
      } as Subject;
    },

    async touchSubject(subjectId, at): Promise<void> {
      await db.update(subjects).set({ lastSeenAt: at }).where(eq(subjects.id, subjectId));
    },

    async insertSession(input: NewSession): Promise<void> {
      await db.insert(sessions).values({
        id: input.id,
        appId: input.appId,
        subjectId: input.subjectId,
        publicKeyJwk: input.publicKeyJwk,
        bindingClass: input.bindingClass,
        origin: input.origin,
        userAgent: input.userAgent ?? null,
        ipFirst: input.ipFirst ?? null,
        geoFirst: input.geoFirst ?? null,
        asnFirst: input.asnFirst ?? null,
        boundCookieHash: input.boundCookieHash,
        boundCookieIssuedAt: input.boundCookieIssuedAt,
        boundCookieExpiresAt: input.boundCookieExpiresAt,
        longCookieHash: input.longCookieHash ?? null,
        longCookieExpiresAt: input.longCookieExpiresAt ?? null,
        createdAt: input.createdAt,
        expiresAt: input.expiresAt,
      });
    },

    async findSession(sessionId): Promise<Session | null> {
      const rows = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
      return (rows[0] as Session | undefined) ?? null;
    },

    async updateSessionRefresh(input: SessionRefreshUpdate): Promise<void> {
      await db
        .update(sessions)
        .set({
          lastRefreshAt: input.lastRefreshAt,
          boundCookieHash: input.boundCookieHash,
          boundCookieIssuedAt: input.boundCookieIssuedAt,
          boundCookieExpiresAt: input.boundCookieExpiresAt,
        })
        .where(eq(sessions.id, input.sessionId));
    },

    async revokeSession(sessionId, reason, at): Promise<void> {
      await db
        .update(sessions)
        .set({ revokedAt: at, revokedReason: reason })
        .where(eq(sessions.id, sessionId));
    },

    async listActiveSessions(appId, subjectId): Promise<Session[]> {
      const rows = await db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.appId, appId),
            eq(sessions.subjectId, subjectId),
            isNull(sessions.revokedAt),
            gt(sessions.expiresAt, new Date()),
          ),
        );
      return rows as Session[];
    },

    async insertAudit(input: NewAuditEvent): Promise<void> {
      await db.insert(auditEvents).values({
        id: input.id,
        appId: input.appId,
        sessionId: input.sessionId ?? null,
        type: input.type,
        severity: input.severity ?? 'info',
        ip: input.ip ?? null,
        geo: input.geo ?? null,
        ua: input.ua ?? null,
        payload: input.payload ?? null,
        at: input.at,
      });
    },
  };
}
