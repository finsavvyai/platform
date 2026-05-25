/**
 * Database query helpers for common operations.
 * Provides typed query builders for users, tokens, subscriptions, and sessions.
 */

import { eq } from 'drizzle-orm';
import type { DB } from './client.js';
import { users, subscriptions, tokens, sessions } from './schema.js';
import type { UserRow, SubscriptionRow, CreateUserInput, CreateSubscriptionInput } from './types.js';

export async function getUserByEmail(db: DB, email: string): Promise<UserRow | undefined> {
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function getUserById(db: DB, id: string): Promise<UserRow | undefined> {
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function createUser(db: DB, data: CreateUserInput): Promise<UserRow> {
  const id = data.id || crypto.randomUUID();
  const user: typeof users.$inferInsert = {
    id,
    email: data.email,
    name: data.name,
    role: data.role || 'user',
  };

  await db.insert(users).values(user);
  const result = await getUserById(db, id);
  if (!result) throw new Error('Failed to create user');
  return result;
}

export async function getSubscription(db: DB, userId: string): Promise<SubscriptionRow | undefined> {
  const result = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.user_id, userId))
    .limit(1);
  return result[0];
}

export async function createSubscription(
  db: DB,
  data: CreateSubscriptionInput,
): Promise<SubscriptionRow> {
  const id = crypto.randomUUID();
  const now = new Date();
  const subscription: typeof subscriptions.$inferInsert = {
    id,
    user_id: data.user_id,
    plan: data.plan,
    status: 'active',
    started_at: now,
    expires_at: data.expires_at,
  };

  await db.insert(subscriptions).values(subscription);
  const result = await getSubscription(db, data.user_id);
  if (!result) throw new Error('Failed to create subscription');
  return result;
}

export async function updateSubscription(
  db: DB,
  userId: string,
  updates: { status?: 'active' | 'expired' | 'cancelled'; expires_at?: Date },
): Promise<SubscriptionRow | undefined> {
  await db
    .update(subscriptions)
    .set({
      ...updates,
      updated_at: new Date(),
    })
    .where(eq(subscriptions.user_id, userId));

  return getSubscription(db, userId);
}

export async function createSession(
  db: DB,
  userId: string,
  ip: string,
  userAgent: string,
  expiresAt: Date,
): Promise<typeof sessions.$inferSelect> {
  const id = crypto.randomUUID();
  const session: typeof sessions.$inferInsert = {
    id,
    user_id: userId,
    ip,
    user_agent: userAgent,
    expires_at: expiresAt,
  };

  await db.insert(sessions).values(session);
  const result = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  return result[0]!;
}

export async function deleteExpiredSessions(db: DB): Promise<number> {
  const result = await db.delete(sessions).where(eq(sessions.expires_at, new Date()));
  return result.success ? 1 : 0;
}
