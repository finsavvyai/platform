/**
 * Just-In-Time (JIT) Access Manager
 *
 * Handles temporary secret access requests with approval workflow
 * and automatic expiration.
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { jitAccessRequests } from '@opensyber/db';

type Db = DrizzleD1Database<Record<string, unknown>>;

export interface JitRequestInput {
  id: string;
  orgId: string;
  requesterId: string;
  secretId: string;
  reason: string;
  durationMinutes: number;
}

export async function createJitRequest(db: Db, input: JitRequestInput): Promise<void> {
  await db.insert(jitAccessRequests).values({
    id: input.id,
    orgId: input.orgId,
    requesterId: input.requesterId,
    secretId: input.secretId,
    reason: input.reason,
    durationMinutes: input.durationMinutes,
    status: 'pending',
  });
}

export async function approveJitRequest(
  db: Db, orgId: string, requestId: string, approvedBy: string,
): Promise<boolean> {
  const [request] = await db.select().from(jitAccessRequests)
    .where(and(eq(jitAccessRequests.id, requestId), eq(jitAccessRequests.orgId, orgId)));

  if (!request || request.status !== 'pending') return false;

  const expiresAt = new Date(Date.now() + request.durationMinutes * 60000).toISOString();
  await db.update(jitAccessRequests)
    .set({ status: 'approved', approvedBy, expiresAt })
    .where(eq(jitAccessRequests.id, requestId));
  return true;
}

export async function denyJitRequest(db: Db, orgId: string, requestId: string): Promise<boolean> {
  const [request] = await db.select().from(jitAccessRequests)
    .where(and(eq(jitAccessRequests.id, requestId), eq(jitAccessRequests.orgId, orgId)));

  if (!request || request.status !== 'pending') return false;

  await db.update(jitAccessRequests)
    .set({ status: 'denied' })
    .where(eq(jitAccessRequests.id, requestId));
  return true;
}

export async function expireOverdueRequests(db: Db, orgId: string): Promise<number> {
  const approved = await db.select().from(jitAccessRequests)
    .where(and(eq(jitAccessRequests.orgId, orgId), eq(jitAccessRequests.status, 'approved')));

  const now = new Date();
  let expired = 0;
  for (const req of approved) {
    if (req.expiresAt && new Date(req.expiresAt) < now) {
      await db.update(jitAccessRequests)
        .set({ status: 'expired' })
        .where(eq(jitAccessRequests.id, req.id));
      expired++;
    }
  }
  return expired;
}
