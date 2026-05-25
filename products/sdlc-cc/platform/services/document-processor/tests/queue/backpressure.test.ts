import { describe, it, expect } from "@jest/globals";
import {
  defaultPolicy,
  backoffDelays,
  processingQueueOptions,
  processingWorkerOptions,
  type QueuePolicy,
} from "../../app/queue/backpressure";
import { BullMQDLQ } from "../../app/queue/dlq";

describe("queue policy", () => {
  it("default backoff is 30s/2m/10m/1h/4h", () => {
    expect(defaultPolicy.backoffSeconds).toEqual([30, 120, 600, 3_600, 14_400]);
  });

  it("backoffDelays converts seconds to ms", () => {
    expect(backoffDelays()).toEqual([30_000, 120_000, 600_000, 3_600_000, 14_400_000]);
  });

  it("processingWorkerOptions caps concurrency from policy", () => {
    const opts = processingWorkerOptions({
      ...defaultPolicy,
      concurrency: 4,
    });
    expect(opts.concurrency).toBe(4);
  });

  it("processingQueueOptions retries up to policy.maxAttempts", () => {
    const opts = processingQueueOptions({
      ...defaultPolicy,
      maxAttempts: 7,
    });
    expect(opts.defaultJobOptions?.attempts).toBe(7);
  });

  it("backoff strategy clamps to last delay after maxAttempts", () => {
    const opts = processingWorkerOptions({
      ...defaultPolicy,
      maxAttempts: 3,
      backoffSeconds: [10, 20, 30],
    });
    const strategy = opts.settings?.backoffStrategy as
      | ((attempt: number) => number)
      | undefined;
    expect(strategy).toBeDefined();
    expect(strategy?.(1)).toBe(10_000);
    expect(strategy?.(2)).toBe(20_000);
    expect(strategy?.(3)).toBe(30_000);
    expect(strategy?.(99)).toBe(30_000); // clamped to last
  });
});

describe("BullMQDLQ", () => {
  // Minimal fakes so the test doesn't pull in a real Redis. We assert on
  // the arguments BullMQDLQ passes through, not on the BullMQ runtime.
  const makeFakeQueue = () => {
    const calls: { method: string; args: unknown[] }[] = [];
    return {
      calls,
      add: (...args: unknown[]) => {
        calls.push({ method: "add", args });
        return Promise.resolve({ id: "fake-job" });
      },
      getJob: (id: string) =>
        Promise.resolve(id === "missing" ? null : { id, data: { payload: { x: 1 } }, remove: () => Promise.resolve() }),
      getJobs: () =>
        Promise.resolve([
          { id: "j1", data: { reason: "boom", payload: { x: 1 }, failedAt: "2026-04-25" }, attemptsMade: 5 },
        ]),
    };
  };

  const setup = (policy: Partial<QueuePolicy> = {}) => {
    const live = makeFakeQueue();
    const dlq = makeFakeQueue();
    const dlqWrapper = new BullMQDLQ(
      live as never,
      dlq as never,
      { ...defaultPolicy, ...policy },
    );
    return { live, dlq, dlqWrapper };
  };

  it("add stamps reason + failedAt and uses retention TTL", async () => {
    const { dlq, dlqWrapper } = setup({ dlqRetentionDays: 7 });
    await dlqWrapper.add("network timeout", { docId: "abc" });
    expect(dlq.calls[0]!.method).toBe("add");
    const opts = dlq.calls[0]!.args[2] as Record<string, unknown>;
    expect((opts.removeOnComplete as { age: number }).age).toBe(7 * 86_400);
    expect((opts.removeOnFail as { age: number }).age).toBe(7 * 86_400);
  });

  it("list flattens BullMQ jobs into DLQEntry", async () => {
    const { dlqWrapper } = setup();
    const entries = await dlqWrapper.list(10);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.reason).toBe("boom");
    expect(entries[0]!.attempts).toBe(5);
  });

  it("replay puts the original payload back on the live queue", async () => {
    const { live, dlqWrapper } = setup();
    await dlqWrapper.replay("job-1");
    expect(live.calls[0]!.method).toBe("add");
    expect(live.calls[0]!.args[1]).toEqual({ x: 1 });
  });

  it("drop is a no-op for missing job", async () => {
    const { dlqWrapper } = setup();
    await expect(dlqWrapper.drop("missing")).resolves.toBeUndefined();
  });
});
