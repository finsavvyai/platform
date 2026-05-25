/**
 * DbAccess interface — the surface the route handlers depend on.
 *
 * Decoupling routes from drizzle directly lets unit tests inject an
 * in-memory store without spinning Miniflare. The Drizzle adapter
 * lives in ./db-drizzle.ts.
 */

import type { App, Session, Subject, AuditEvent } from '@tokenforge/db';
import type { BindingClass } from '@tokenforge/protocol';

export interface DbAccess {
  findApp(appId: string): Promise<App | null>;
  findSubject(appId: string, externalSubject: string): Promise<Subject | null>;
  insertSubject(input: NewSubject): Promise<Subject>;
  touchSubject(subjectId: string, at: Date): Promise<void>;
  insertSession(input: NewSession): Promise<void>;
  findSession(sessionId: string): Promise<Session | null>;
  updateSessionRefresh(input: SessionRefreshUpdate): Promise<void>;
  revokeSession(sessionId: string, reason: string, at: Date): Promise<void>;
  listActiveSessions(appId: string, subjectId: string): Promise<Session[]>;
  insertAudit(input: NewAuditEvent): Promise<void>;
}

export interface NewSubject {
  id: string;
  appId: string;
  externalSubject: string;
  metadata?: Record<string, unknown> | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface NewSession {
  id: string;
  appId: string;
  subjectId: string;
  publicKeyJwk: JsonWebKey;
  bindingClass: BindingClass;
  origin: string;
  userAgent?: string | null;
  ipFirst?: string | null;
  geoFirst?: string | null;
  asnFirst?: string | null;
  boundCookieHash: string;
  boundCookieIssuedAt: Date;
  boundCookieExpiresAt: Date;
  longCookieHash?: string | null;
  longCookieExpiresAt?: Date | null;
  createdAt: Date;
  expiresAt: Date;
}

export interface SessionRefreshUpdate {
  sessionId: string;
  lastRefreshAt: Date;
  boundCookieHash: string;
  boundCookieIssuedAt: Date;
  boundCookieExpiresAt: Date;
}

export interface NewAuditEvent {
  id: string;
  appId: string;
  sessionId?: string | null;
  type: string;
  severity?: AuditEvent['severity'];
  ip?: string | null;
  geo?: string | null;
  ua?: string | null;
  payload?: Record<string, unknown> | null;
  at: Date;
}
