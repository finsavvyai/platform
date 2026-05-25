/**
 * Dunning Retry Scheduler Service
 * Tracks failed payments, schedules retries with configurable backoff,
 * and manages the dunning state machine: active -> succeeded | exhausted.
 */

import {
  DunningSchedule,
  DunningConfig,
  DunningAttempt,
  DunningScheduleStatus,
  DunningAttemptStatus,
  createDefaultDunningConfig,
  generateIdempotencyKey,
  calculateNextRetryAt,
} from './dunning-models';

/** Payment provider interface for retry attempts */
export interface PaymentProvider {
  retryPayment(
    invoiceId: string,
    idempotencyKey: string
  ): Promise<{ success: boolean; error?: string; providerResponse?: string }>;
}

/** Storage interface for dunning schedules */
export interface DunningStore {
  save(schedule: DunningSchedule): Promise<void>;
  findById(id: string): Promise<DunningSchedule | null>;
  findBySubscription(subscriptionId: string): Promise<DunningSchedule | null>;
  findDueRetries(now: Date): Promise<DunningSchedule[]>;
  update(schedule: DunningSchedule): Promise<void>;
}

/** Callback for final actions when dunning is exhausted */
export interface DunningActionHandler {
  executeAction(
    subscriptionId: string,
    action: string
  ): Promise<void>;
}

export class DunningScheduler {
  constructor(
    private readonly store: DunningStore,
    private readonly paymentProvider: PaymentProvider,
    private readonly actionHandler: DunningActionHandler,
    private readonly defaultConfig?: DunningConfig
  ) {}

  /** Start a dunning flow for a failed payment */
  async initiateDunning(
    subscriptionId: string,
    invoiceId: string,
    tenantId: string,
    config?: DunningConfig
  ): Promise<DunningSchedule> {
    const existing = await this.store.findBySubscription(subscriptionId);
    if (existing && existing.current_status === DunningScheduleStatus.ACTIVE) {
      return existing;
    }

    const dunningConfig = config ?? this.defaultConfig ?? createDefaultDunningConfig();
    const now = new Date();
    const nextRetry = calculateNextRetryAt(dunningConfig, 0, now);

    const schedule: DunningSchedule = {
      id: crypto.randomUUID(),
      subscription_id: subscriptionId,
      invoice_id: invoiceId,
      tenant_id: tenantId,
      config: dunningConfig,
      attempts: [],
      current_status: DunningScheduleStatus.ACTIVE,
      next_retry_at: nextRetry ? nextRetry.toISOString() : null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    await this.store.save(schedule);
    return schedule;
  }

  /** Execute the next retry attempt for a schedule */
  async executeRetry(scheduleId: string): Promise<DunningAttempt> {
    const schedule = await this.store.findById(scheduleId);
    if (!schedule) {
      throw new Error(`Dunning schedule not found: ${scheduleId}`);
    }
    if (schedule.current_status !== DunningScheduleStatus.ACTIVE) {
      throw new Error(`Schedule ${scheduleId} is not active`);
    }

    const attemptNumber = schedule.attempts.length + 1;
    const idempotencyKey = generateIdempotencyKey(scheduleId, attemptNumber);
    const duplicate = schedule.attempts.find(
      (a) => a.idempotency_key === idempotencyKey
    );
    if (duplicate) {
      return duplicate;
    }

    const attempt: DunningAttempt = {
      attempt_number: attemptNumber,
      scheduled_at: new Date().toISOString(),
      executed_at: null,
      status: DunningAttemptStatus.PROCESSING,
      error_message: null,
      payment_provider_response: null,
      idempotency_key: idempotencyKey,
    };

    const result = await this.paymentProvider.retryPayment(
      schedule.invoice_id,
      idempotencyKey
    );

    attempt.executed_at = new Date().toISOString();

    if (result.success) {
      attempt.status = DunningAttemptStatus.SUCCEEDED;
      schedule.current_status = DunningScheduleStatus.SUCCEEDED;
      schedule.next_retry_at = null;
    } else {
      attempt.status = DunningAttemptStatus.FAILED;
      attempt.error_message = result.error ?? 'Payment failed';
      attempt.payment_provider_response = result.providerResponse ?? null;
      const nextRetry = calculateNextRetryAt(
        schedule.config,
        attemptNumber,
        new Date()
      );
      schedule.next_retry_at = nextRetry ? nextRetry.toISOString() : null;
    }

    schedule.attempts.push(attempt);
    schedule.updated_at = new Date().toISOString();
    await this.store.update(schedule);
    return attempt;
  }

  /** Get all schedules due for retry */
  async getNextRetries(): Promise<DunningSchedule[]> {
    return this.store.findDueRetries(new Date());
  }

  /** Mark dunning as successfully resolved */
  async handleSuccess(scheduleId: string): Promise<void> {
    const schedule = await this.store.findById(scheduleId);
    if (!schedule) {
      throw new Error(`Dunning schedule not found: ${scheduleId}`);
    }
    schedule.current_status = DunningScheduleStatus.SUCCEEDED;
    schedule.next_retry_at = null;
    schedule.updated_at = new Date().toISOString();
    await this.store.update(schedule);
  }

  /** Execute the configured final action after all retries exhausted */
  async handleExhaustion(scheduleId: string): Promise<void> {
    const schedule = await this.store.findById(scheduleId);
    if (!schedule) {
      throw new Error(`Dunning schedule not found: ${scheduleId}`);
    }
    schedule.current_status = DunningScheduleStatus.EXHAUSTED;
    schedule.next_retry_at = null;
    schedule.updated_at = new Date().toISOString();
    await this.store.update(schedule);
    await this.actionHandler.executeAction(
      schedule.subscription_id,
      schedule.config.final_action
    );
  }

  /** Check if a schedule has exhausted all retries */
  isExhausted(schedule: DunningSchedule): boolean {
    return schedule.attempts.length >= schedule.config.max_retries;
  }
}
