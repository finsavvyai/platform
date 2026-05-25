/**
 * Dead-letter queue helpers for document processing.
 *
 * Day 14 of the production-ready roadmap.
 *
 * The live processing queue retries each job up to QueuePolicy.maxAttempts
 * with the configured exponential backoff. After the last attempt, the
 * worker hands the job + failure reason to a BullMQDLQ instance which
 * persists it on a separate `documents:dlq` BullMQ queue. Operators can
 * inspect, replay, or drop entries via the admin UI; the policy class
 * lives in backpressure.ts and is reused here.
 */

import type { Queue } from "bullmq";
import { defaultPolicy, type QueuePolicy } from "./backpressure";

export const dlqQueueName = "documents:dlq";

export interface DLQEntry {
  id: string;
  reason: string;
  payload: unknown;
  failedAt: string; // ISO-8601
  attempts: number;
}

export interface DLQ {
  /** Move a job from live processing into the DLQ with a reason. */
  add(reason: string, payload: unknown): Promise<void>;
  /** List up to `limit` DLQ entries. */
  list(limit: number): Promise<DLQEntry[]>;
  /** Replay a DLQ entry back onto the live queue. */
  replay(jobId: string): Promise<void>;
  /** Permanently drop a DLQ entry. */
  drop(jobId: string): Promise<void>;
}

/**
 * BullMQ-backed DLQ. Construct with the live + dlq Queue pair. Replays
 * preserve the original payload but reset the attempts counter so a
 * fixed transient cause gets a fresh retry budget.
 */
export class BullMQDLQ implements DLQ {
  constructor(
    private readonly liveQueue: Queue,
    private readonly dlqQueue: Queue,
    private readonly policy: QueuePolicy = defaultPolicy,
  ) {}

  async add(reason: string, payload: unknown): Promise<void> {
    await this.dlqQueue.add(
      "dlq",
      { reason, payload, failedAt: new Date().toISOString() },
      {
        // Keep DLQ entries for the configured retention then purge.
        removeOnComplete: { age: this.policy.dlqRetentionDays * 86_400 },
        removeOnFail: { age: this.policy.dlqRetentionDays * 86_400 },
        attempts: 1,
      },
    );
  }

  async list(limit: number): Promise<DLQEntry[]> {
    const jobs = await this.dlqQueue.getJobs(
      ["wait", "delayed", "completed"],
      0,
      limit - 1,
    );
    return jobs.map((j) => ({
      id: String(j.id ?? ""),
      reason: (j.data?.reason as string) ?? "",
      payload: j.data?.payload,
      failedAt: (j.data?.failedAt as string) ?? "",
      attempts: j.attemptsMade ?? 0,
    }));
  }

  async replay(jobId: string): Promise<void> {
    const job = await this.dlqQueue.getJob(jobId);
    if (!job) return;
    await this.liveQueue.add("retry", job.data?.payload, {
      attempts: this.policy.maxAttempts,
    });
    await job.remove();
  }

  async drop(jobId: string): Promise<void> {
    const job = await this.dlqQueue.getJob(jobId);
    if (job) await job.remove();
  }
}

/**
 * Convenience helper used by the admin endpoint so callers don't have
 * to know the wrapper exists. Returns the DLQEntry for the replayed
 * job before it was removed, or null if the job had already been
 * dropped.
 */
export async function replayJob(
  dlq: DLQ,
  jobId: string,
): Promise<DLQEntry | null> {
  const entries = await dlq.list(1_000);
  const found = entries.find((e) => e.id === jobId) ?? null;
  await dlq.replay(jobId);
  return found;
}

/**
 * Convenience helper that proxies through to DLQ.list with sane
 * defaults. Wrapped so the admin handler can pass a DLQ interface and
 * not the BullMQ-specific class.
 */
export async function listDLQ(
  dlq: DLQ,
  opts: { limit?: number } = {},
): Promise<DLQEntry[]> {
  return dlq.list(opts.limit ?? 100);
}
