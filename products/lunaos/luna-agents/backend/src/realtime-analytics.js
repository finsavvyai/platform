/**
 * Real-time Analytics Engine — Task 3.1
 * Event tracking, funnel analysis, cohort analysis.
 * Stores to Cloudflare D1; streams live updates via SSE.
 */

export class RealtimeAnalytics {
  constructor(env) {
    this.db = env.DB;
    this.kv = env.CACHE;
  }

  /** Track a custom event with arbitrary properties. */
  async track(event) {
    const {
      type, userId, sessionId, properties = {}, timestamp = Date.now()
    } = event;

    if (!type || !userId) {
      throw new Error('event.type and event.userId are required');
    }

    await this.db.prepare(
      `INSERT INTO analytics_events (type, user_id, session_id, properties, occurred_at)
       VALUES (?, ?, ?, ?, datetime(?, 'unixepoch', 'milliseconds'))`
    ).bind(type, userId, sessionId ?? null, JSON.stringify(properties), timestamp).run();

    // Invalidate cached summaries
    await this.kv?.delete(`analytics:summary:${userId}`).catch(() => null);
    return { tracked: true, type, userId, timestamp };
  }

  /** Query recent events, optionally filtered by type and userId. */
  async queryEvents({ type, userId, since, limit = 50 } = {}) {
    const conditions = [];
    const bindings = [];

    if (type) { conditions.push('type = ?'); bindings.push(type); }
    if (userId) { conditions.push('user_id = ?'); bindings.push(userId); }
    if (since) {
      conditions.push("occurred_at >= datetime(?, 'unixepoch', 'milliseconds')");
      bindings.push(since);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM analytics_events ${where} ORDER BY occurred_at DESC LIMIT ?`;

    const result = await this.db.prepare(sql)
      .bind(...bindings, limit)
      .all();
    return result.results ?? [];
  }

  /**
   * Funnel analysis: for a sequence of event types, compute how many users
   * reach each step.
   */
  async funnelAnalysis({ steps, since, userId }) {
    if (!steps || steps.length < 2) {
      throw new Error('At least 2 funnel steps required');
    }

    const userFilter = userId ? 'AND user_id = ?' : '';
    const bindings = since ? [since] : [];
    if (userId) bindings.push(userId);

    const counts = await Promise.all(
      steps.map((step) =>
        this.db.prepare(
          `SELECT COUNT(DISTINCT user_id) as cnt FROM analytics_events
           WHERE type = ?
           ${since ? "AND occurred_at >= datetime(?, 'unixepoch', 'milliseconds')" : ''}
           ${userFilter}`
        ).bind(step, ...bindings).first()
      )
    );

    const top = counts[0]?.cnt ?? 0;
    return steps.map((step, i) => ({
      step,
      users: counts[i]?.cnt ?? 0,
      conversionRate: top > 0 ? ((counts[i]?.cnt ?? 0) / top) : 0,
      dropoffRate: i === 0 ? 0
        : top > 0 ? 1 - ((counts[i]?.cnt ?? 0) / (counts[i - 1]?.cnt ?? top))
        : 0,
    }));
  }

  /**
   * Cohort analysis: group users by the week they first appeared,
   * then track retention by week offset.
   */
  async cohortAnalysis({ cohortEvent = 'signup', retentionEvent = 'query', weeks = 4 }) {
    const cohorts = await this.db.prepare(
      `SELECT user_id,
              strftime('%Y-W%W', MIN(occurred_at)) as cohort_week,
              MIN(occurred_at) as first_seen
       FROM analytics_events
       WHERE type = ?
       GROUP BY user_id`
    ).bind(cohortEvent).all();

    const users = cohorts.results ?? [];
    if (users.length === 0) return [];

    const result = await Promise.all(
      users.map(async (u) => {
        const weekRetention = await Promise.all(
          Array.from({ length: weeks }, (_, w) =>
            this.db.prepare(
              `SELECT COUNT(*) as cnt FROM analytics_events
               WHERE user_id = ? AND type = ?
               AND occurred_at >= datetime(first_seen, '+' || ? || ' days')
               AND occurred_at < datetime(first_seen, '+' || ? || ' days')`
            ).bind(u.user_id, retentionEvent, w * 7, (w + 1) * 7).first()
          )
        );
        return { userId: u.user_id, cohortWeek: u.cohort_week, weekRetention };
      })
    );

    return result;
  }

  /**
   * SSE-compatible generator: yields a JSON summary every `intervalMs`.
   * Caller wraps this in a ReadableStream response.
   */
  async *liveStream(userId, intervalMs = 5000) {
    for (let i = 0; i < 60; i++) {
      const events = await this.queryEvents({ userId, limit: 10 });
      yield JSON.stringify({ events, ts: Date.now() });
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  /** SQL migration — run once at startup. */
  static get migrationSQL() {
    return `
      CREATE TABLE IF NOT EXISTS analytics_events (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        type       TEXT NOT NULL,
        user_id    TEXT NOT NULL,
        session_id TEXT,
        properties TEXT DEFAULT '{}',
        occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ae_user ON analytics_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_ae_type ON analytics_events(type);
      CREATE INDEX IF NOT EXISTS idx_ae_ts   ON analytics_events(occurred_at);
    `;
  }
}
