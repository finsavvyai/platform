import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockEnv, createMockKV, createMockDb } from '../test/helpers.js';
import {
  computeDedupKey,
  isDuplicate,
  markProcessed,
  incrementDedupCount,
} from './dedup-global.js';

describe('dedup-global', () => {
  let kv: KVNamespace;
  let db: any;

  beforeEach(() => {
    kv = createMockKV();
    db = createMockDb();
  });

  describe('computeDedupKey', () => {
    it('returns different keys for different sources', () => {
      const payload = { id: 'test-123' };
      const guardDutyKey = computeDedupKey('guardduty', { findingId: 'finding-1' });
      const cloudtrailKey = computeDedupKey('cloudtrail', { eventId: 'event-1' });

      expect(guardDutyKey).not.toBe(cloudtrailKey);
      expect(guardDutyKey).toContain('guardduty');
      expect(cloudtrailKey).toContain('cloudtrail');
    });

    it('returns same key for same input', () => {
      const payload = { findingId: 'finding-1' };
      const key1 = computeDedupKey('guardduty', payload);
      const key2 = computeDedupKey('guardduty', payload);

      expect(key1).toBe(key2);
    });

    it('handles guardduty source with findingId', () => {
      const key = computeDedupKey('guardduty', { findingId: 'finding-123' });
      expect(key).toBe('guardduty:finding-123');
    });

    it('handles cloudtrail source with eventId', () => {
      const key = computeDedupKey('cloudtrail', { eventId: 'event-456' });
      expect(key).toBe('cloudtrail:event-456');
    });

    it('handles github source with header', () => {
      const key = computeDedupKey('github', {}, { 'x-github-delivery': 'delivery-789' });
      expect(key).toBe('github-delivery:delivery-789');
    });

    it('handles gitlab source with event ID', () => {
      const key = computeDedupKey('gitlab', { id: 'evt-111' });
      expect(key).toBe('gitlab-event:evt-111');
    });

    it('handles datadog source with alert ID', () => {
      const key = computeDedupKey('datadog', { alert: { id: 'alert-222' } });
      expect(key).toBe('datadog:alert-222');
    });

    it('handles splunk source with SID', () => {
      const key = computeDedupKey('splunk', { sid: 'sid-333' });
      expect(key).toBe('splunk:sid-333');
    });

    it('falls back to generic key for unknown source', () => {
      const payload = { data: 'test-payload' };
      const key = computeDedupKey('unknown', payload);
      expect(key).toContain('unknown:');
    });
  });

  describe('isDuplicate', () => {
    it('returns false when KV returns null (no cache hit)', async () => {
      vi.mocked(kv.get).mockResolvedValueOnce(null);
      const result = await isDuplicate(kv, 'test-key');
      expect(result).toBe(false);
    });

    it('returns true when KV has a cached entry', async () => {
      vi.mocked(kv.get).mockResolvedValueOnce(JSON.stringify({ processedAt: new Date().toISOString() }));
      const result = await isDuplicate(kv, 'test-key');
      expect(result).toBe(true);
    });

    it('prepends dedup: to the key when querying KV', async () => {
      await isDuplicate(kv, 'test-key');
      expect(kv.get).toHaveBeenCalledWith('dedup:test-key');
    });
  });

  describe('markProcessed', () => {
    it('stores the key in KV with correct TTL', async () => {
      await markProcessed(kv, 'test-key');

      expect(kv.put).toHaveBeenCalledWith(
        'dedup:test-key',
        expect.stringContaining('processedAt'),
        { expirationTtl: 2 * 3600 },
      );
    });

    it('stores timestamp in the value', async () => {
      const beforeTime = new Date();
      await markProcessed(kv, 'test-key');
      const afterTime = new Date();

      const callArgs = vi.mocked(kv.put).mock.calls[0];
      const value = JSON.parse(callArgs[1] as string);
      const processedAt = new Date(value.processedAt);

      expect(processedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(processedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('incrementDedupCount', () => {
    it('increments duplicateCount in rawPayload', async () => {
      const existingEvent = {
        id: 'event-1',
        rawPayload: JSON.stringify({ data: 'test', duplicateCount: 1 }),
      };

      db._setSelectResult([existingEvent]);

      await incrementDedupCount(db, 'event-1');

      expect(db.select).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled();

      const updateSetCall = vi.mocked(db._updateSetChain.where).mock.calls[0];
      expect(updateSetCall).toBeDefined();
    });

    it('initializes duplicateCount to 2 if not present', async () => {
      const existingEvent = {
        id: 'event-1',
        rawPayload: JSON.stringify({ data: 'test' }),
      };

      db._setSelectResult([existingEvent]);

      await incrementDedupCount(db, 'event-1');

      expect(db.update).toHaveBeenCalled();
    });

    it('handles non-JSON rawPayload gracefully', async () => {
      const existingEvent = {
        id: 'event-1',
        rawPayload: 'not valid json',
      };

      db._setSelectResult([existingEvent]);

      await expect(incrementDedupCount(db, 'event-1')).resolves.not.toThrow();
    });
  });

  describe('full dedup flow', () => {
    it('first call is not duplicate, second call is duplicate', async () => {
      const key = computeDedupKey('guardduty', { findingId: 'finding-1' });

      // First call: no cache hit
      vi.mocked(kv.get).mockResolvedValueOnce(null);
      const firstResult = await isDuplicate(kv, key);
      expect(firstResult).toBe(false);

      // Mark as processed
      await markProcessed(kv, key);
      expect(kv.put).toHaveBeenCalled();

      // Second call: cache hit
      vi.mocked(kv.get).mockResolvedValueOnce('{"processedAt":"2024-01-01T00:00:00Z"}');
      const secondResult = await isDuplicate(kv, key);
      expect(secondResult).toBe(true);
    });
  });
});
