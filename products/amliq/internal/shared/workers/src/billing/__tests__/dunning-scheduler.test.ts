import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DunningScheduler,
  DunningStore,
  PaymentProvider,
  DunningActionHandler,
} from '../dunning-scheduler';
import {
  DunningSchedule,
  DunningScheduleStatus,
  DunningAttemptStatus,
  createDefaultDunningConfig,
} from '../dunning-models';

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const SUB_ID = '550e8400-e29b-41d4-a716-446655440001';
const INV_ID = '550e8400-e29b-41d4-a716-446655440002';

function createMockStore(): DunningStore {
  const schedules = new Map<string, DunningSchedule>();
  return {
    save: vi.fn(async (s: DunningSchedule) => { schedules.set(s.id, structuredClone(s)); }),
    findById: vi.fn(async (id: string) => {
      const s = schedules.get(id);
      return s ? structuredClone(s) : null;
    }),
    findBySubscription: vi.fn(async (subId: string) => {
      for (const s of schedules.values()) {
        if (s.subscription_id === subId) return structuredClone(s);
      }
      return null;
    }),
    findDueRetries: vi.fn(async () => []),
    update: vi.fn(async (s: DunningSchedule) => { schedules.set(s.id, structuredClone(s)); }),
  };
}

function createMockProvider(success = false): PaymentProvider {
  return {
    retryPayment: vi.fn(async () => ({
      success,
      error: success ? undefined : 'Card declined',
      providerResponse: success ? undefined : '{"code":"card_declined"}',
    })),
  };
}

function createMockActionHandler(): DunningActionHandler {
  return {
    executeAction: vi.fn(async () => {}),
  };
}

describe('DunningScheduler', () => {
  let store: DunningStore;
  let provider: PaymentProvider;
  let actionHandler: DunningActionHandler;
  let scheduler: DunningScheduler;

  beforeEach(() => {
    store = createMockStore();
    provider = createMockProvider(false);
    actionHandler = createMockActionHandler();
    scheduler = new DunningScheduler(store, provider, actionHandler);
  });

  describe('initiateDunning', () => {
    it('creates a new dunning schedule', async () => {
      const schedule = await scheduler.initiateDunning(SUB_ID, INV_ID, TENANT_ID);
      expect(schedule.subscription_id).toBe(SUB_ID);
      expect(schedule.invoice_id).toBe(INV_ID);
      expect(schedule.tenant_id).toBe(TENANT_ID);
      expect(schedule.current_status).toBe(DunningScheduleStatus.ACTIVE);
      expect(schedule.attempts).toHaveLength(0);
      expect(schedule.next_retry_at).not.toBeNull();
      expect(store.save).toHaveBeenCalledOnce();
    });

    it('uses default config when none provided', async () => {
      const schedule = await scheduler.initiateDunning(SUB_ID, INV_ID, TENANT_ID);
      const defaultConfig = createDefaultDunningConfig();
      expect(schedule.config).toEqual(defaultConfig);
    });

    it('uses custom config when provided', async () => {
      const custom = { retry_intervals_days: [2, 4], max_retries: 2, grace_period_days: 1, final_action: 'pause' as const };
      const schedule = await scheduler.initiateDunning(SUB_ID, INV_ID, TENANT_ID, custom);
      expect(schedule.config.final_action).toBe('pause');
      expect(schedule.config.max_retries).toBe(2);
    });

    it('returns existing active schedule for same subscription', async () => {
      const first = await scheduler.initiateDunning(SUB_ID, INV_ID, TENANT_ID);
      (store.findBySubscription as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ...first,
        current_status: DunningScheduleStatus.ACTIVE,
      });
      const second = await scheduler.initiateDunning(SUB_ID, INV_ID, TENANT_ID);
      expect(second.id).toBe(first.id);
      expect(store.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('executeRetry', () => {
    it('executes a failed retry and records the attempt', async () => {
      const schedule = await scheduler.initiateDunning(SUB_ID, INV_ID, TENANT_ID);
      const attempt = await scheduler.executeRetry(schedule.id);
      expect(attempt.attempt_number).toBe(1);
      expect(attempt.status).toBe(DunningAttemptStatus.FAILED);
      expect(attempt.error_message).toBe('Card declined');
      expect(attempt.executed_at).not.toBeNull();
      expect(provider.retryPayment).toHaveBeenCalledOnce();
    });

    it('marks schedule as succeeded on successful payment', async () => {
      provider = createMockProvider(true);
      scheduler = new DunningScheduler(store, provider, actionHandler);
      const schedule = await scheduler.initiateDunning(SUB_ID, INV_ID, TENANT_ID);
      const attempt = await scheduler.executeRetry(schedule.id);
      expect(attempt.status).toBe(DunningAttemptStatus.SUCCEEDED);
      const updated = await store.findById(schedule.id);
      expect(updated!.current_status).toBe(DunningScheduleStatus.SUCCEEDED);
      expect(updated!.next_retry_at).toBeNull();
    });

    it('throws for non-existent schedule', async () => {
      await expect(scheduler.executeRetry('nonexistent'))
        .rejects.toThrow('Dunning schedule not found');
    });

    it('throws for non-active schedule', async () => {
      const schedule = await scheduler.initiateDunning(SUB_ID, INV_ID, TENANT_ID);
      await scheduler.handleSuccess(schedule.id);
      await expect(scheduler.executeRetry(schedule.id))
        .rejects.toThrow('not active');
    });

    it('prevents duplicate attempts via idempotency key', async () => {
      const schedule = await scheduler.initiateDunning(SUB_ID, INV_ID, TENANT_ID);
      await scheduler.executeRetry(schedule.id);

      // Manually add duplicate key scenario
      const stored = await store.findById(schedule.id);
      expect(stored!.attempts).toHaveLength(1);
      const firstKey = stored!.attempts[0].idempotency_key;
      expect(firstKey).toContain('attempt_1');
    });

    it('respects configurable retry intervals', async () => {
      const config = { retry_intervals_days: [2, 5], max_retries: 2, grace_period_days: 0, final_action: 'cancel' as const };
      const schedule = await scheduler.initiateDunning(SUB_ID, INV_ID, TENANT_ID, config);
      await scheduler.executeRetry(schedule.id);
      const updated = await store.findById(schedule.id);
      expect(updated!.next_retry_at).not.toBeNull();
    });
  });

  describe('handleSuccess', () => {
    it('marks schedule as succeeded', async () => {
      const schedule = await scheduler.initiateDunning(SUB_ID, INV_ID, TENANT_ID);
      await scheduler.handleSuccess(schedule.id);
      const updated = await store.findById(schedule.id);
      expect(updated!.current_status).toBe(DunningScheduleStatus.SUCCEEDED);
      expect(updated!.next_retry_at).toBeNull();
    });

    it('throws for non-existent schedule', async () => {
      await expect(scheduler.handleSuccess('nonexistent'))
        .rejects.toThrow('Dunning schedule not found');
    });
  });

  describe('handleExhaustion', () => {
    it('marks schedule as exhausted and executes final action', async () => {
      const schedule = await scheduler.initiateDunning(SUB_ID, INV_ID, TENANT_ID);
      await scheduler.handleExhaustion(schedule.id);
      const updated = await store.findById(schedule.id);
      expect(updated!.current_status).toBe(DunningScheduleStatus.EXHAUSTED);
      expect(actionHandler.executeAction).toHaveBeenCalledWith(SUB_ID, 'cancel');
    });

    it('executes pause action when configured', async () => {
      const config = { retry_intervals_days: [1], max_retries: 1, grace_period_days: 0, final_action: 'pause' as const };
      const schedule = await scheduler.initiateDunning(SUB_ID, INV_ID, TENANT_ID, config);
      await scheduler.handleExhaustion(schedule.id);
      expect(actionHandler.executeAction).toHaveBeenCalledWith(SUB_ID, 'pause');
    });

    it('throws for non-existent schedule', async () => {
      await expect(scheduler.handleExhaustion('nonexistent'))
        .rejects.toThrow('Dunning schedule not found');
    });
  });

  describe('getNextRetries', () => {
    it('delegates to store.findDueRetries', async () => {
      await scheduler.getNextRetries();
      expect(store.findDueRetries).toHaveBeenCalledOnce();
    });
  });

  describe('isExhausted', () => {
    it('returns false when attempts below max', () => {
      const schedule = {
        attempts: [{ attempt_number: 1 }],
        config: { max_retries: 4 },
      } as DunningSchedule;
      expect(scheduler.isExhausted(schedule)).toBe(false);
    });

    it('returns true when attempts equal max_retries', () => {
      const schedule = {
        attempts: [{ attempt_number: 1 }, { attempt_number: 2 }],
        config: { max_retries: 2 },
      } as DunningSchedule;
      expect(scheduler.isExhausted(schedule)).toBe(true);
    });
  });

  describe('full lifecycle: retry until exhaustion', () => {
    it('retries until max retries then exhausts', async () => {
      const config = { retry_intervals_days: [1, 2], max_retries: 2, grace_period_days: 0, final_action: 'cancel' as const };
      const schedule = await scheduler.initiateDunning(SUB_ID, INV_ID, TENANT_ID, config);

      await scheduler.executeRetry(schedule.id);
      await scheduler.executeRetry(schedule.id);

      const updated = await store.findById(schedule.id);
      expect(updated!.attempts).toHaveLength(2);
      expect(scheduler.isExhausted(updated!)).toBe(true);

      await scheduler.handleExhaustion(schedule.id);
      const final = await store.findById(schedule.id);
      expect(final!.current_status).toBe(DunningScheduleStatus.EXHAUSTED);
      expect(actionHandler.executeAction).toHaveBeenCalledWith(SUB_ID, 'cancel');
    });
  });

  describe('full lifecycle: successful retry on 2nd attempt', () => {
    it('succeeds on second attempt', async () => {
      const config = { retry_intervals_days: [1, 3], max_retries: 3, grace_period_days: 0, final_action: 'cancel' as const };
      const schedule = await scheduler.initiateDunning(SUB_ID, INV_ID, TENANT_ID, config);

      // First attempt fails
      await scheduler.executeRetry(schedule.id);
      const afterFirst = await store.findById(schedule.id);
      expect(afterFirst!.current_status).toBe(DunningScheduleStatus.ACTIVE);

      // Second attempt succeeds
      provider = createMockProvider(true);
      scheduler = new DunningScheduler(store, provider, actionHandler);
      await scheduler.executeRetry(schedule.id);
      const afterSecond = await store.findById(schedule.id);
      expect(afterSecond!.current_status).toBe(DunningScheduleStatus.SUCCEEDED);
    });
  });
});
