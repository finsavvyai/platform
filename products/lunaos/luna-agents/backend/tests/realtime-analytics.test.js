/**
 * Tests for RealtimeAnalytics — Task 3.1
 */
import { jest } from '@jest/globals';
import { RealtimeAnalytics } from '../src/realtime-analytics.js';

function makeDb(rows = []) {
  const stmt = {
    bind: jest.fn().mockReturnThis(),
    run: jest.fn().mockResolvedValue({ success: true }),
    all: jest.fn().mockResolvedValue({ results: rows }),
    first: jest.fn().mockResolvedValue({ cnt: rows.length }),
  };
  return { prepare: jest.fn().mockReturnValue(stmt), _stmt: stmt };
}

function makeEnv(rows = []) {
  return { DB: makeDb(rows), CACHE: { delete: jest.fn().mockResolvedValue(null) } };
}

describe('RealtimeAnalytics', () => {
  describe('track', () => {
    it('inserts an event and returns tracked:true', async () => {
      const env = makeEnv();
      const analytics = new RealtimeAnalytics(env);
      const result = await analytics.track({
        type: 'query', userId: 'u1', sessionId: 's1', properties: { q: 'test' }
      });
      expect(result.tracked).toBe(true);
      expect(result.type).toBe('query');
      expect(env.DB.prepare).toHaveBeenCalled();
    });

    it('throws when type is missing', async () => {
      const env = makeEnv();
      const analytics = new RealtimeAnalytics(env);
      await expect(analytics.track({ userId: 'u1' })).rejects.toThrow('event.type');
    });

    it('throws when userId is missing', async () => {
      const env = makeEnv();
      const analytics = new RealtimeAnalytics(env);
      await expect(analytics.track({ type: 'query' })).rejects.toThrow('event.userId');
    });

    it('invalidates the user cache on track', async () => {
      const env = makeEnv();
      const analytics = new RealtimeAnalytics(env);
      await analytics.track({ type: 'query', userId: 'u2' });
      expect(env.CACHE.delete).toHaveBeenCalledWith('analytics:summary:u2');
    });
  });

  describe('queryEvents', () => {
    it('returns rows from the database', async () => {
      const rows = [{ id: 1, type: 'query', user_id: 'u1' }];
      const env = makeEnv(rows);
      const analytics = new RealtimeAnalytics(env);
      const events = await analytics.queryEvents({ userId: 'u1' });
      expect(events).toEqual(rows);
    });

    it('returns empty array when no results', async () => {
      const env = makeEnv([]);
      const analytics = new RealtimeAnalytics(env);
      const events = await analytics.queryEvents();
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe('funnelAnalysis', () => {
    it('throws when fewer than 2 steps provided', async () => {
      const env = makeEnv();
      const analytics = new RealtimeAnalytics(env);
      await expect(
        analytics.funnelAnalysis({ steps: ['signup'] })
      ).rejects.toThrow('At least 2 funnel steps');
    });

    it('returns one object per step', async () => {
      const env = makeEnv();
      env.DB._stmt.first = jest.fn().mockResolvedValue({ cnt: 100 });
      const analytics = new RealtimeAnalytics(env);
      const funnel = await analytics.funnelAnalysis({
        steps: ['signup', 'query', 'share']
      });
      expect(funnel.length).toBe(3);
      expect(funnel[0].step).toBe('signup');
    });

    it('computes conversionRate relative to first step', async () => {
      const env = makeEnv();
      let callCount = 0;
      env.DB._stmt.first = jest.fn().mockImplementation(() =>
        Promise.resolve({ cnt: callCount++ === 0 ? 100 : 50 })
      );
      const analytics = new RealtimeAnalytics(env);
      const funnel = await analytics.funnelAnalysis({ steps: ['a', 'b'] });
      expect(funnel[1].conversionRate).toBeCloseTo(0.5);
    });

    it('returns 0 conversionRate when first step has 0 users', async () => {
      const env = makeEnv();
      env.DB._stmt.first = jest.fn().mockResolvedValue({ cnt: 0 });
      const analytics = new RealtimeAnalytics(env);
      const funnel = await analytics.funnelAnalysis({ steps: ['a', 'b'] });
      expect(funnel[0].conversionRate).toBe(0);
    });
  });

  describe('cohortAnalysis', () => {
    it('returns empty array when no users found', async () => {
      const env = makeEnv([]);
      const analytics = new RealtimeAnalytics(env);
      const result = await analytics.cohortAnalysis({});
      expect(result).toEqual([]);
    });

    it('returns one entry per user', async () => {
      const env = makeEnv([
        { user_id: 'u1', cohort_week: '2026-W01', first_seen: '2026-01-01' },
        { user_id: 'u2', cohort_week: '2026-W01', first_seen: '2026-01-01' },
      ]);
      env.DB._stmt.first = jest.fn().mockResolvedValue({ cnt: 3 });
      const analytics = new RealtimeAnalytics(env);
      const result = await analytics.cohortAnalysis({ weeks: 2 });
      expect(result.length).toBe(2);
      expect(result[0].userId).toBe('u1');
    });
  });

  describe('migrationSQL', () => {
    it('contains CREATE TABLE for analytics_events', () => {
      expect(RealtimeAnalytics.migrationSQL).toContain('CREATE TABLE IF NOT EXISTS analytics_events');
    });

    it('contains indexes for user_id, type, and occurred_at', () => {
      const sql = RealtimeAnalytics.migrationSQL;
      expect(sql).toContain('idx_ae_user');
      expect(sql).toContain('idx_ae_type');
      expect(sql).toContain('idx_ae_ts');
    });
  });
});
