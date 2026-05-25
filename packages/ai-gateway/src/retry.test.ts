import { describe, expect, it, vi } from "vitest";
import {
  GatewayExhaustedError,
  NonRetryableProviderError,
  RetryableProviderError,
} from "./errors.js";
import { backoffDelayMs, isRetryable, runWithRetry } from "./retry.js";

describe("isRetryable", () => {
  it("retries 429", () => {
    expect(isRetryable(Object.assign(new Error(), { status: 429 }))).toBe(true);
  });
  it("retries 408", () => {
    expect(isRetryable(Object.assign(new Error(), { status: 408 }))).toBe(true);
  });
  it("does NOT retry 400", () => {
    expect(isRetryable(Object.assign(new Error(), { status: 400 }))).toBe(false);
  });
  it("does NOT retry 401", () => {
    expect(isRetryable(Object.assign(new Error(), { status: 401 }))).toBe(false);
  });
  it("retries 503", () => {
    expect(isRetryable(Object.assign(new Error(), { status: 503 }))).toBe(true);
  });
  it("retries generic Error (network-like)", () => {
    expect(isRetryable(new Error("ECONNRESET"))).toBe(true);
  });
  it("retries null/undefined errors", () => {
    expect(isRetryable(null)).toBe(true);
    expect(isRetryable(undefined)).toBe(true);
  });
  it("ignores non-numeric status", () => {
    expect(isRetryable({ status: "oops" })).toBe(true);
  });
  it("NonRetryableProviderError never retries", () => {
    expect(isRetryable(new NonRetryableProviderError(500, "x"))).toBe(false);
  });
  it("RetryableProviderError always retries", () => {
    expect(isRetryable(new RetryableProviderError(400, "x"))).toBe(true);
  });
});

describe("backoffDelayMs", () => {
  it("monotonic exponential (jitter=1, no cap hit)", () => {
    const d1 = backoffDelayMs(1, 100, 10_000, () => 1);
    const d2 = backoffDelayMs(2, 100, 10_000, () => 1);
    const d3 = backoffDelayMs(3, 100, 10_000, () => 1);
    expect(d2).toBeGreaterThan(d1);
    expect(d3).toBeGreaterThan(d2);
  });
  it("respects max cap", () => {
    const d = backoffDelayMs(10, 100, 500, () => 1);
    expect(d).toBeLessThanOrEqual(500);
  });
  it("jitter floor is base", () => {
    const d = backoffDelayMs(5, 100, 10_000, () => 0);
    expect(d).toBe(100);
  });
  it("clamps NaN jitter to 0", () => {
    const d = backoffDelayMs(1, 100, 10_000, () => Number.NaN);
    expect(d).toBe(100);
  });
  it("clamps out-of-range jitter", () => {
    expect(backoffDelayMs(1, 100, 10_000, () => -5)).toBe(100);
    expect(backoffDelayMs(2, 100, 10_000, () => 99)).toBe(200);
  });
});

describe("runWithRetry", () => {
  const noWait = { sleep: async () => {}, jitter: () => 0 };

  it("returns value on first success", async () => {
    const { value, attempts } = await runWithRetry(async () => 42, noWait);
    expect(value).toBe(42);
    expect(attempts).toBe(1);
  });

  it("retries until success", async () => {
    let n = 0;
    const { attempts } = await runWithRetry(async () => {
      n += 1;
      if (n < 3) throw Object.assign(new Error(), { status: 503 });
      return "ok";
    }, { ...noWait, maxAttempts: 5 });
    expect(attempts).toBe(3);
  });

  it("throws GatewayExhaustedError after exhausting attempts", async () => {
    await expect(
      runWithRetry(async () => {
        throw Object.assign(new Error(), { status: 503 });
      }, { ...noWait, maxAttempts: 2 }),
    ).rejects.toBeInstanceOf(GatewayExhaustedError);
  });

  it("short-circuits on non-retryable error", async () => {
    const op = vi.fn(async () => {
      throw Object.assign(new Error("bad"), { status: 400 });
    });
    await expect(
      runWithRetry(op, { ...noWait, maxAttempts: 5 }),
    ).rejects.toMatchObject({ status: 400 });
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("rejects maxAttempts < 1", async () => {
    await expect(
      runWithRetry(async () => 1, { ...noWait, maxAttempts: 0 }),
    ).rejects.toThrow();
  });

  it("uses Math.random + setTimeout defaults when not injected", async () => {
    // Force one retry path through defaults to cover them.
    let n = 0;
    const { value } = await runWithRetry(async () => {
      n += 1;
      if (n < 2) throw Object.assign(new Error(), { status: 503 });
      return "ok";
    }, { baseDelayMs: 1, maxDelayMs: 2, maxAttempts: 3 });
    expect(value).toBe("ok");
  });
});
