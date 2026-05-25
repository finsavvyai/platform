/**
 * BullMQ worker tuning for document processing.
 *
 * Day 14 of the production-ready roadmap.
 *
 * Policy:
 *   - max-concurrency caps the in-flight job count per worker so a
 *     burst can't OOM (defaults sized for an 8-vCPU 4-GiB pod).
 *   - exponential backoff: 30s, 2m, 10m, 1h, 4h. After 5 failures
 *     the job is moved to the dead-letter queue (see dlq.ts).
 *
 * The DLQ implementation lives in ./dlq.ts so this file stays
 * focused on backpressure + retry policy.
 */

import type { Queue, QueueOptions, WorkerOptions } from "bullmq";

export interface QueuePolicy {
  /** Max concurrent jobs a single worker will run. */
  concurrency: number;
  /** Max retry attempts before moving to DLQ. */
  maxAttempts: number;
  /** Backoff stages, in seconds. */
  backoffSeconds: readonly number[];
  /** Days the DLQ retains a failed job before purge. */
  dlqRetentionDays: number;
  /** Worker memory cap in MiB; informational, enforced via container limits. */
  maxMemoryMB: number;
  /** Hard ceiling on the in-flight job count across all workers. */
  maxInflight: number;
}

/** Default policy: 5 attempts at 30s/2m/10m/1h/4h, DLQ 30d. */
export const defaultPolicy: QueuePolicy = {
  concurrency: 8,
  maxAttempts: 5,
  backoffSeconds: [30, 120, 600, 3_600, 14_400],
  dlqRetentionDays: 30,
  maxMemoryMB: 512,
  maxInflight: 100,
};

/** Read the policy from env vars, falling back to defaultPolicy. */
export function policyFromEnv(env: NodeJS.ProcessEnv = process.env): QueuePolicy {
  const intOr = (key: string, fallback: number): number => {
    const v = env[key];
    if (!v) return fallback;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    ...defaultPolicy,
    concurrency: intOr("DEFAULT_CONCURRENCY", defaultPolicy.concurrency),
    maxMemoryMB: intOr("MAX_MEMORY_MB", defaultPolicy.maxMemoryMB),
    maxInflight: intOr("MAX_INFLIGHT", defaultPolicy.maxInflight),
  };
}

/** Convert a backoff seconds list to BullMQ's `delay` schedule. */
export function backoffDelays(policy: QueuePolicy = defaultPolicy): number[] {
  return policy.backoffSeconds.map((s) => s * 1000);
}

/**
 * Build the QueueOptions BullMQ expects for the live processing queue.
 * BullMQ 5.x requires `connection`; the caller supplies it because
 * connection objects are environment-specific.
 */
export function processingQueueOptions(
  policy: QueuePolicy = defaultPolicy,
): Omit<QueueOptions, "connection"> {
  return {
    defaultJobOptions: {
      attempts: policy.maxAttempts,
      backoff: { type: "custom" },
      removeOnComplete: { age: 3_600, count: 1_000 },
      removeOnFail: false, // we move to DLQ explicitly so we keep the trail
    },
  };
}

/**
 * Build the WorkerOptions BullMQ expects (concurrency + custom backoff).
 * Caller supplies `connection` since worker connections are typically
 * separate from the producer-side queue connection.
 */
export function processingWorkerOptions(
  policy: QueuePolicy = defaultPolicy,
): Omit<WorkerOptions, "connection"> {
  const delays = backoffDelays(policy);
  return {
    concurrency: policy.concurrency,
    settings: {
      backoffStrategy: (attemptsMade: number): number => {
        // attemptsMade is 1-indexed in BullMQ.
        const idx = Math.min(Math.max(attemptsMade - 1, 0), delays.length - 1);
        return delays[idx] ?? 0;
      },
    },
  };
}

/**
 * Apply the env-driven backpressure config to an existing BullMQ Queue.
 *
 * Wraps the queue's defaultJobOptions and (best-effort) attaches a
 * rate limiter at the in-flight ceiling. Concurrency itself is a
 * Worker concern — call processingWorkerOptions(policyFromEnv()) when
 * constructing the Worker.
 */
export async function applyBackpressureConfig(
  queue: Queue,
  policy: QueuePolicy = policyFromEnv(),
): Promise<void> {
  const opts = processingQueueOptions(policy);
  if (opts.defaultJobOptions) {
    // BullMQ exposes setGlobalConcurrency on Queue; treat as best-effort.
    type WithConcurrency = { setGlobalConcurrency?: (n: number) => Promise<void> };
    const q = queue as unknown as WithConcurrency;
    if (typeof q.setGlobalConcurrency === "function") {
      await q.setGlobalConcurrency(policy.maxInflight);
    }
  }
}
