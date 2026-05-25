/**
 * Day 14: dead-letter queue helpers.
 *
 * These tests use a hand-rolled fake of the BullMQ Queue surface so
 * we don't need a live Redis. They cover the lifecycle the admin UI
 * relies on: add → list → replay → drop.
 */

import { describe, it, expect } from "@jest/globals";
import {
  BullMQDLQ,
  listDLQ,
  replayJob,
  dlqQueueName,
} from "../../app/queue/dlq";
import { defaultPolicy } from "../../app/queue/backpressure";

const makeFakeQueue = () => {
  const calls: { method: string; args: unknown[] }[] = [];
  const jobs: Record<string, { id: string; data: unknown; remove: () => Promise<void> }> = {};
  return {
    calls,
    jobs,
    add: (...args: unknown[]) => {
      calls.push({ method: "add", args });
      return Promise.resolve({ id: "fake-job" });
    },
    getJob: (id: string) =>
      Promise.resolve(
        id === "missing"
          ? null
          : {
              id,
              data: { payload: { docId: "abc" } },
              remove: () => {
                delete jobs[id];
                return Promise.resolve();
              },
            },
      ),
    getJobs: () =>
      Promise.resolve([
        {
          id: "j1",
          data: { reason: "boom", payload: { docId: "abc" }, failedAt: "2026-04-25T00:00:00Z" },
          attemptsMade: 5,
        },
      ]),
  };
};

describe("dlqQueueName", () => {
  it("is the canonical DLQ name", () => {
    expect(dlqQueueName).toBe("documents:dlq");
  });
});

describe("BullMQDLQ", () => {
  it("add stamps reason + failedAt and uses retention TTL", async () => {
    const live = makeFakeQueue();
    const dlq = makeFakeQueue();
    const wrapper = new BullMQDLQ(live as never, dlq as never, {
      ...defaultPolicy,
      dlqRetentionDays: 7,
    });
    await wrapper.add("network timeout", { docId: "abc" });
    expect(dlq.calls[0]!.method).toBe("add");
    const opts = dlq.calls[0]!.args[2] as Record<string, unknown>;
    expect((opts.removeOnComplete as { age: number }).age).toBe(7 * 86_400);
    expect((opts.removeOnFail as { age: number }).age).toBe(7 * 86_400);
  });

  it("list flattens BullMQ jobs into DLQEntry", async () => {
    const live = makeFakeQueue();
    const dlq = makeFakeQueue();
    const wrapper = new BullMQDLQ(live as never, dlq as never);
    const entries = await wrapper.list(10);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.reason).toBe("boom");
    expect(entries[0]!.attempts).toBe(5);
  });

  it("replay puts the original payload back on the live queue", async () => {
    const live = makeFakeQueue();
    const dlq = makeFakeQueue();
    const wrapper = new BullMQDLQ(live as never, dlq as never);
    await wrapper.replay("job-1");
    expect(live.calls[0]!.method).toBe("add");
    expect(live.calls[0]!.args[1]).toEqual({ docId: "abc" });
  });

  it("drop is a no-op for missing job", async () => {
    const live = makeFakeQueue();
    const dlq = makeFakeQueue();
    const wrapper = new BullMQDLQ(live as never, dlq as never);
    await expect(wrapper.drop("missing")).resolves.toBeUndefined();
  });

  it("listDLQ helper proxies to DLQ.list with default limit", async () => {
    const live = makeFakeQueue();
    const dlq = makeFakeQueue();
    const wrapper = new BullMQDLQ(live as never, dlq as never);
    const entries = await listDLQ(wrapper);
    expect(entries).toHaveLength(1);
  });

  it("replayJob helper returns the entry that was replayed", async () => {
    const live = makeFakeQueue();
    const dlq = makeFakeQueue();
    const wrapper = new BullMQDLQ(live as never, dlq as never);
    const replayed = await replayJob(wrapper, "j1");
    expect(replayed?.reason).toBe("boom");
  });
});
