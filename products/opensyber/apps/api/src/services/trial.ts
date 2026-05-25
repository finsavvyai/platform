import { eq, and, isNotNull } from 'drizzle-orm';
import { users } from '@opensyber/db';
import { createDb } from '../lib/db.js';
import { emailService } from './email.js';
import type { Env } from '../types.js';

export async function processTrialEmails(env: Env): Promise<void> {
  const db = createDb(env.DB);

  const freeUsers = await db
    .select()
    .from(users)
    .where(and(eq(users.plan, 'free'), isNotNull(users.trialStartedAt)));

  const now = Date.now();

  for (const user of freeUsers) {
    const trialStart = new Date(user.trialStartedAt!).getTime();
    const daysSinceStart = Math.floor((now - trialStart) / (1000 * 60 * 60 * 24));
    const flags = user.emailFlags ? JSON.parse(user.emailFlags) : {};

    try {
      // Day 5: trial ending soon
      if (daysSinceStart >= 5 && !flags.trialEndingSent) {
        const daysLeft = 7 - daysSinceStart;
        await emailService.sendTrialEndingEmail({
          to: user.email,
          userName: user.name,
          daysLeft: Math.max(daysLeft, 1),
          apiKey: env.RESEND_API_KEY,
        });
        flags.trialEndingSent = true;
        await db.update(users).set({ emailFlags: JSON.stringify(flags) }).where(eq(users.id, user.id));
      }

      // Day 7: trial expired
      if (daysSinceStart >= 7 && !flags.trialExpiredSent) {
        await emailService.sendTrialExpiredEmail({
          to: user.email,
          userName: user.name,
          apiKey: env.RESEND_API_KEY,
        });
        flags.trialExpiredSent = true;
        await db.update(users).set({ emailFlags: JSON.stringify(flags) }).where(eq(users.id, user.id));
      }
    } catch (err) {
      console.error(`[Trial] Failed to process trial emails for user ${user.id}:`, err);
    }
  }
}
