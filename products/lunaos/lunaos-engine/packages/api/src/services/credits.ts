/**
 * Credit System + Achievements Service
 *
 * Gamification layer: earn credits for actions, spend on premium features,
 * auto-award achievement badges at execution milestones.
 */

/** Credit rewards per action type */
const CREDIT_ACTIONS: Record<string, number> = {
  signup: 100,
  first_execution: 50,
  daily_login: 5,
  share_workflow: 25,
  report_bug: 10,
  milestone_10: 20,
  milestone_100: 50,
  milestone_1000: 200,
};

/** Achievement badge definitions */
const MILESTONE_THRESHOLDS = [
  { count: 10, badge: 'milestone_10', credits: 20 },
  { count: 100, badge: 'milestone_100', credits: 50 },
  { count: 1000, badge: 'milestone_1000', credits: 200 },
] as const;

export interface Achievement {
  id: string;
  userId: string;
  badge: string;
  earnedAt: string;
}

/**
 * Award credits for a completed action.
 * @returns New balance after awarding credits
 */
export async function addCredits(
  db: D1Database, userId: string, action: string, amount?: number,
): Promise<number> {
  const reward = amount ?? CREDIT_ACTIONS[action] ?? 0;
  if (reward <= 0) return getCredits(db, userId);

  const txId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.batch([
    db.prepare(
      `INSERT INTO user_credits (user_id, balance, lifetime_earned, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         balance = balance + ?,
         lifetime_earned = lifetime_earned + ?,
         updated_at = ?`,
    ).bind(userId, reward, reward, now, reward, reward, now),
    db.prepare(
      `INSERT INTO credit_transactions (id, user_id, action, amount, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(txId, userId, action, reward, now),
  ]);

  return getCredits(db, userId);
}

/**
 * Get current credit balance for a user.
 */
export async function getCredits(db: D1Database, userId: string): Promise<number> {
  const row = await db.prepare(
    'SELECT balance FROM user_credits WHERE user_id = ?',
  ).bind(userId).first<{ balance: number }>();
  return row?.balance ?? 0;
}

/**
 * Spend credits. Returns true if successful, false if insufficient balance.
 */
export async function spendCredits(
  db: D1Database, userId: string, amount: number,
): Promise<boolean> {
  if (amount <= 0) return false;

  const balance = await getCredits(db, userId);
  if (balance < amount) return false;

  const txId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.batch([
    db.prepare(
      `UPDATE user_credits SET balance = balance - ?, updated_at = ? WHERE user_id = ?`,
    ).bind(amount, now, userId),
    db.prepare(
      `INSERT INTO credit_transactions (id, user_id, action, amount, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(txId, userId, 'spend', -amount, now),
  ]);

  return true;
}

/**
 * List all achievements earned by a user.
 */
export async function getAchievements(
  db: D1Database, userId: string,
): Promise<Achievement[]> {
  const result = await db.prepare(
    'SELECT id, user_id, badge, earned_at FROM achievements WHERE user_id = ? ORDER BY earned_at DESC',
  ).bind(userId).all<{ id: string; user_id: string; badge: string; earned_at: string }>();

  return (result.results ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    badge: r.badge,
    earnedAt: r.earned_at,
  }));
}

/**
 * Check execution milestones and auto-award achievements + credits.
 * Call after every successful agent execution.
 * @returns Newly awarded achievements (empty if none)
 */
export async function checkMilestones(
  db: D1Database, userId: string,
): Promise<Achievement[]> {
  const countRow = await db.prepare(
    'SELECT COUNT(*) as total FROM executions WHERE user_id = ?',
  ).bind(userId).first<{ total: number }>();
  const total = countRow?.total ?? 0;

  const existing = await getAchievements(db, userId);
  const earnedBadges = new Set(existing.map((a) => a.badge));
  const newAchievements: Achievement[] = [];

  for (const milestone of MILESTONE_THRESHOLDS) {
    if (total >= milestone.count && !earnedBadges.has(milestone.badge)) {
      const achId = crypto.randomUUID();
      const now = new Date().toISOString();

      await db.prepare(
        `INSERT OR IGNORE INTO achievements (id, user_id, badge, earned_at) VALUES (?, ?, ?, ?)`,
      ).bind(achId, userId, milestone.badge, now).run();

      await addCredits(db, userId, milestone.badge, milestone.credits);

      newAchievements.push({
        id: achId, userId, badge: milestone.badge, earnedAt: now,
      });
    }
  }

  // First execution badge
  if (total === 1 && !earnedBadges.has('first_execution')) {
    const achId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT OR IGNORE INTO achievements (id, user_id, badge, earned_at) VALUES (?, ?, ?, ?)`,
    ).bind(achId, userId, 'first_execution', now).run();
    await addCredits(db, userId, 'first_execution');
    newAchievements.push({
      id: achId, userId, badge: 'first_execution', earnedAt: now,
    });
  }

  return newAchievements;
}

/** Supported credit action names (exported for validation) */
export const VALID_ACTIONS = Object.keys(CREDIT_ACTIONS);
