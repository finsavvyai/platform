import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enqueueWebhookRetry, processRetryQueue, type WebhookPayload } from './retry-queue.js';

interface MockEntry {
  id: string;
  source: string;
  eventType: string;
  payload: string;
  errorMessage: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: string | null;
  status: string;
  createdAt: string;
  lastAttemptAt: string | null;
}

function createMockDb() {
  const rows: MockEntry[] = [];
  const db = {
    _rows: rows,
    insert: vi.fn(() => ({
      values: vi.fn((v: MockEntry) => {
        rows.push(v);
        return Promise.resolve();
      }),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(rows.filter((r) => r.status !== 'resolved'))),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((updates: Partial<MockEntry>) => ({
        where: vi.fn(() => {
          // Mock applies updates to the first non-resolved row
          const entry = rows.find((r) => r.status !== 'resolved');
          if (entry) Object.assign(entry, updates);
          return Promise.resolve();
        }),
      })),
    })),
  };
  return db;
}

const samplePayload: WebhookPayload = {
  channelId: 'ch_1',
  channelType: 'slack',
  webhookUrl: 'https://hooks.slack.com/test',
  body: { text: 'alert' },
};

describe('retry-queue', () => {
  describe('enqueueWebhookRetry', () => {
    it('inserts a pending entry with retry schedule', async () => {
      const db = createMockDb();
      await enqueueWebhookRetry(db as never, samplePayload, 'Connection timeout');

      expect(db.insert).toHaveBeenCalled();
      expect(db._rows).toHaveLength(1);
      expect(db._rows[0].source).toBe('alerts');
      expect(db._rows[0].eventType).toBe('webhook.slack');
      expect(db._rows[0].status).toBe('pending');
      expect(db._rows[0].retryCount).toBe(0);
      expect(db._rows[0].maxRetries).toBe(3);
      expect(db._rows[0].errorMessage).toBe('Connection timeout');
      expect(db._rows[0].nextRetryAt).not.toBeNull();
    });

    it('truncates long error messages to 500 chars', async () => {
      const db = createMockDb();
      const longError = 'x'.repeat(1000);
      await enqueueWebhookRetry(db as never, samplePayload, longError);
      expect(db._rows[0].errorMessage.length).toBe(500);
    });
  });

  describe('processRetryQueue', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('returns zero counts when queue is empty', async () => {
      const db = createMockDb();
      const sendFn = vi.fn();
      const result = await processRetryQueue(db as never, sendFn);
      expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 });
      expect(sendFn).not.toHaveBeenCalled();
    });

    it('marks entry as resolved on successful delivery', async () => {
      const db = createMockDb();
      await enqueueWebhookRetry(db as never, samplePayload, 'initial failure');
      const sendFn = vi.fn().mockResolvedValue(undefined);

      const result = await processRetryQueue(db as never, sendFn);
      expect(result.succeeded).toBe(1);
      expect(sendFn).toHaveBeenCalledTimes(1);
    });

    it('increments retry count on failure', async () => {
      const db = createMockDb();
      await enqueueWebhookRetry(db as never, samplePayload, 'initial failure');
      const sendFn = vi.fn().mockRejectedValue(new Error('Still failing'));

      const result = await processRetryQueue(db as never, sendFn);
      expect(result.failed).toBe(1);
    });
  });
});
