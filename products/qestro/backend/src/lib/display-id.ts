/**
 * Human-readable display ID allocator.
 *
 * Each entity type has a single row in `id_counters`. We atomically bump it
 * via `UPDATE ... RETURNING current` (D1/SQLite supports RETURNING on
 * UPDATE since SQLite 3.35), format the sequence with a fixed prefix, and
 * return a string like "TC-0042".
 *
 * The UNIQUE index on display_id catches the extremely rare race where two
 * concurrent workers see the same counter value; we retry up to 3 times
 * before surfacing the error to the caller.
 *
 * See migration 0007_display_ids.sql for the schema.
 * See .luna/heal/heal-report-pass2.md section 9 for the design rationale.
 */
export type DisplayIdEntity = 'test_case' | 'test_run' | 'test_plan';

const PREFIX: Record<DisplayIdEntity, string> = {
  test_case: 'TC',
  test_run: 'RN',
  test_plan: 'TP',
};

const MAX_ATTEMPTS = 3;

/** Format a sequence as "{PREFIX}-NNNN". Uppercase, zero-padded to 4. */
export function formatDisplayId(entity: DisplayIdEntity, seq: number): string {
  const prefix = PREFIX[entity];
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

/**
 * Atomically allocate the next display ID for the given entity.
 *
 * Implementation detail: we run two statements in a single D1 batch so the
 * bump happens inside one implicit transaction:
 *   1. INSERT OR IGNORE — seeds the counter row if the migration hasn't run.
 *   2. UPDATE ... RETURNING current — bumps and returns the new value.
 *
 * D1 serializes writes, so two concurrent allocations will see sequential
 * counter values. The UNIQUE index on display_id is the safety net in case
 * a different code path (or a backfill script) races with us.
 */
export async function allocateDisplayId(
  db: D1Database,
  entity: DisplayIdEntity,
): Promise<string> {
  const now = Date.now();
  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const statements = [
        db
          .prepare(
            'INSERT OR IGNORE INTO id_counters (entity, current, updated_at) VALUES (?, 0, ?)',
          )
          .bind(entity, now),
        db
          .prepare(
            `UPDATE id_counters
               SET current = current + 1,
                   updated_at = ?
             WHERE entity = ?
             RETURNING current AS seq`,
          )
          .bind(now, entity),
      ];

      const results = await db.batch(statements);
      const updateResult = results[1];
      const rows = (updateResult.results ?? []) as Array<{ seq: number }>;
      if (rows.length === 0 || typeof rows[0].seq !== 'number') {
        throw new Error(
          `display-id allocator: empty result for entity=${entity}`,
        );
      }

      const seq = rows[0].seq;
      return formatDisplayId(entity, seq);
    } catch (error) {
      lastError = error;
      // Only retry on UNIQUE constraint collisions (if a later INSERT fails
      // because the caller hit a display_id that already exists). All other
      // errors propagate immediately.
      const message = error instanceof Error ? error.message : String(error);
      if (!/UNIQUE|constraint failed/i.test(message)) {
        throw error;
      }
    }
  }

  throw new Error(
    `display-id allocator: exhausted ${MAX_ATTEMPTS} attempts for entity=${entity}: ${String(lastError)}`,
  );
}
