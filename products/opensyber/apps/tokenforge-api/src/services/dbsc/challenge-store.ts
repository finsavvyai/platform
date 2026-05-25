/**
 * D1-backed ChallengeStore for DBSC routes.
 *
 * Persists challenge hashes (never the bytes) and consumes them exactly
 * once via a guarded UPDATE. The `consumed` field is read before the
 * update so the caller can detect replay even after the row has been
 * marked spent.
 */

import { eq, and } from 'drizzle-orm';
import { tfDbscChallenges } from '@opensyber/db';
import type {
  ChallengeRecord,
  ChallengeStore,
} from '@opensyber/tokenforge/server/internal';
import type { Variables } from '../../types.js';

export function makeChallengeStore(db: Variables['db']): ChallengeStore {
  return {
    async put(record: ChallengeRecord): Promise<void> {
      await db.insert(tfDbscChallenges).values({
        id: record.id,
        tenantId: record.tenantId,
        challengeHash: record.challengeHash,
        purpose: record.purpose,
        sessionId: record.sessionId ?? null,
        actionHash: record.actionHash ?? null,
        issuedAt: record.issuedAt,
        expiresAt: record.expiresAt,
        consumed: record.consumed,
      });
    },
    async takeIfFresh(hash: string, now: Date): Promise<ChallengeRecord | null> {
      const [row] = await db
        .select()
        .from(tfDbscChallenges)
        .where(eq(tfDbscChallenges.challengeHash, hash))
        .limit(1);
      if (!row) return null;
      if (new Date(row.expiresAt) < now) return null;
      const wasConsumed = row.consumed;
      const result = await db
        .update(tfDbscChallenges)
        .set({ consumed: true })
        .where(and(
          eq(tfDbscChallenges.id, row.id),
          eq(tfDbscChallenges.consumed, false),
        ));
      const meta = (result as { meta?: { changes?: number } }).meta;
      const guarded = meta?.changes ?? (wasConsumed ? 0 : 1);
      return {
        id: row.id,
        tenantId: row.tenantId,
        challengeHash: row.challengeHash,
        purpose: row.purpose as ChallengeRecord['purpose'],
        sessionId: row.sessionId,
        actionHash: row.actionHash,
        issuedAt: row.issuedAt,
        expiresAt: row.expiresAt,
        consumed: guarded === 0 ? true : wasConsumed,
      };
    },
  };
}
