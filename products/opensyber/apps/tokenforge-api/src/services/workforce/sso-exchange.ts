/**
 * Workforce SSO exchange — OIDC ID token → DBSC challenge.
 *
 * Pure orchestration over the OIDC verifier, JWKS cache, subject
 * upsert, and DBSC challenge issuer. The route layer (sso.ts) handles
 * tenant auth, rate-limiting, and HTTP framing; this module stays
 * unit-testable by accepting all dependencies as parameters.
 */

import { eq, and } from 'drizzle-orm';
import { tfSubjects, tfWorkforceApps } from '@opensyber/db';
import {
  issueChallenge,
  verifyOidcIdToken,
  type ChallengeStore,
  type JwksKey,
} from '@opensyber/tokenforge/server/internal';
import type { Variables } from '../../types.js';

export interface ExchangeInput {
  tenantId: string;
  workforceAppId: string;
  idToken: string;
  jwks: { keys: JwksKey[] };
}

export type ExchangeResult =
  | {
      ok: true;
      subjectId: string;
      externalSubject: string;
      email: string | null;
      challenge: string;
      challengeExpiresAt: string;
    }
  | { ok: false; reason: string };

export async function exchangeSso(
  db: Variables['db'],
  store: ChallengeStore,
  input: ExchangeInput,
): Promise<ExchangeResult> {
  const [app] = await db
    .select()
    .from(tfWorkforceApps)
    .where(and(
      eq(tfWorkforceApps.id, input.workforceAppId),
      eq(tfWorkforceApps.tenantId, input.tenantId),
    ))
    .limit(1);
  if (!app) return { ok: false, reason: 'workforce_app_not_found' };
  if (!app.enabled) return { ok: false, reason: 'workforce_app_disabled' };

  const verified = await verifyOidcIdToken(input.idToken, {
    expectedIssuer: app.issuer,
    expectedAudience: app.audience,
    jwks: input.jwks,
  });
  if (!verified.ok) return { ok: false, reason: verified.reason };

  const claims = verified.claims;
  const subjectId = await upsertSubject(db, {
    tenantId: input.tenantId,
    workforceAppId: app.id,
    externalSubject: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : null,
    name: typeof claims.name === 'string' ? claims.name : null,
    metadata: extractMetadata(claims),
  });

  const issued = await issueChallenge(store, {
    tenantId: input.tenantId,
    purpose: 'register',
    ttlSeconds: 120,
  });

  return {
    ok: true,
    subjectId,
    externalSubject: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : null,
    challenge: issued.challenge,
    challengeExpiresAt: issued.record.expiresAt,
  };
}

interface UpsertInput {
  tenantId: string;
  workforceAppId: string;
  externalSubject: string;
  email: string | null;
  name: string | null;
  metadata: string | null;
}

async function upsertSubject(db: Variables['db'], inp: UpsertInput): Promise<string> {
  const [existing] = await db
    .select()
    .from(tfSubjects)
    .where(and(
      eq(tfSubjects.workforceAppId, inp.workforceAppId),
      eq(tfSubjects.externalSubject, inp.externalSubject),
    ))
    .limit(1);

  const now = new Date().toISOString();
  if (existing) {
    await db
      .update(tfSubjects)
      .set({
        email: inp.email,
        name: inp.name,
        metadata: inp.metadata,
        lastSeenAt: now,
      })
      .where(eq(tfSubjects.id, existing.id));
    return existing.id;
  }

  const id = `tf-sub-${crypto.randomUUID()}`;
  await db.insert(tfSubjects).values({
    id,
    tenantId: inp.tenantId,
    workforceAppId: inp.workforceAppId,
    externalSubject: inp.externalSubject,
    email: inp.email,
    name: inp.name,
    metadata: inp.metadata,
    firstSeenAt: now,
    lastSeenAt: now,
  });
  return id;
}

function extractMetadata(claims: Record<string, unknown>): string | null {
  const meta: Record<string, unknown> = {};
  if (Array.isArray(claims.groups)) meta.groups = claims.groups;
  if (typeof claims.preferred_username === 'string') {
    meta.preferred_username = claims.preferred_username;
  }
  if (typeof claims.locale === 'string') meta.locale = claims.locale;
  return Object.keys(meta).length === 0 ? null : JSON.stringify(meta);
}
