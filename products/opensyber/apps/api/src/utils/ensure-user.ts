import { eq } from 'drizzle-orm';
import { users } from '@opensyber/db';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

type AnySchema = Record<string, unknown>;

/**
 * JIT user provisioning: ensures the authenticated user exists in D1.
 *
 * Email is the stable identity — Auth.js JWT sub changes per session.
 * Returns the canonical D1 user ID (may differ from JWT sub).
 */
export async function ensureUser(
  db: DrizzleD1Database<AnySchema>,
  userId: string,
  email?: string,
  name?: string,
): Promise<{ userId: string; isNew: boolean }> {
  // 1. Check by ID
  const [byId] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (byId) return { userId: byId.id, isNew: false };

  // 2. Check by email (handles ID changes across sessions)
  if (email) {
    const [byEmail] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (byEmail) return { userId: byEmail.id, isNew: false };
  }

  // 3. New user — create
  const now = new Date().toISOString();
  await db
    .insert(users)
    .values({
      id: userId,
      email: email ?? `${userId}@opensyber.cloud`,
      name: name ?? null,
      plan: 'free',
      referralCode: `REF-${crypto.randomUUID().slice(0, 6)}`,
      trialStartedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  return { userId, isNew: true };
}
