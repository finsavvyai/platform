import { describe, expect, it, vi } from "vitest";
import { NonRetryableProviderError } from "./errors.js";
import { AiGateway } from "./gateway.js";
import type { GatewayRequest, ProviderAdapter } from "./types.js";
import { baseReq, frontierRef, noWait } from "./test-fixtures.js";

describe("AiGateway retry integration", () => {
  it("retries on 429 and reports attempts", async () => {
    let calls = 0;
    const a: ProviderAdapter = {
      ref: frontierRef,
      complete: vi.fn(async () => {
        calls += 1;
        if (calls < 3) throw Object.assign(new Error("rate limited"), { status: 429 });
        return { text: "done", promptTokens: 5, completionTokens: 7 };
      }),
    };
    const g = new AiGateway({ adapters: [a], retry: { ...noWait, maxAttempts: 5 } });
    const res = await g.complete(baseReq);
    expect(res.attempts).toBe(3);
    expect(res.text).toBe("done");
  });

  it("does NOT retry on 400", async () => {
    const a: ProviderAdapter = {
      ref: frontierRef,
      complete: vi.fn(async () => {
        throw Object.assign(new Error("bad req"), { status: 400 });
      }),
    };
    const g = new AiGateway({ adapters: [a], retry: { ...noWait, maxAttempts: 5 } });
    await expect(g.complete(baseReq)).rejects.toMatchObject({ status: 400 });
    expect(a.complete).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on NonRetryableProviderError", async () => {
    const a: ProviderAdapter = {
      ref: frontierRef,
      complete: vi.fn(async () => {
        throw new NonRetryableProviderError(403, "forbidden");
      }),
    };
    const g = new AiGateway({ adapters: [a], retry: { ...noWait, maxAttempts: 5 } });
    await expect(g.complete(baseReq)).rejects.toBeInstanceOf(NonRetryableProviderError);
    expect(a.complete).toHaveBeenCalledTimes(1);
  });

  it("preserves idempotency key across retries", async () => {
    const seen: (string | undefined)[] = [];
    let calls = 0;
    const a: ProviderAdapter = {
      ref: frontierRef,
      complete: vi.fn(async (r: GatewayRequest) => {
        seen.push(r.idempotencyKey);
        calls += 1;
        if (calls < 2) throw Object.assign(new Error("flaky"), { status: 503 });
        return { text: "ok", promptTokens: 1, completionTokens: 1 };
      }),
    };
    const g = new AiGateway({ adapters: [a], retry: { ...noWait, maxAttempts: 3 } });
    await g.complete({ ...baseReq, idempotencyKey: "user-supplied-1" });
    expect(seen).toEqual(["user-supplied-1", "user-supplied-1"]);
  });

  it("auto-generates idempotency key when none supplied", async () => {
    let captured: string | undefined;
    const a: ProviderAdapter = {
      ref: frontierRef,
      complete: vi.fn(async (r: GatewayRequest) => {
        captured = r.idempotencyKey;
        return { text: "ok", promptTokens: 1, completionTokens: 1 };
      }),
    };
    const g = new AiGateway({ adapters: [a], retry: noWait });
    await g.complete(baseReq);
    expect(captured).toBeDefined();
    expect(captured!.length).toBeGreaterThan(0);
  });
});
