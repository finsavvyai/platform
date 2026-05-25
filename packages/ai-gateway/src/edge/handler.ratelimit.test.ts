import { describe, expect, it, vi } from "vitest";
import {
  buildHandler,
  freshToken,
  postCompletion,
} from "./handler.test-helpers.js";

describe("createEdgeHandler — rate limiting", () => {
  it("emits Retry-After + 429 when limit exhausted", async () => {
    const handler = buildHandler({ rateLimit: { windowMs: 60_000, maxRequests: 1 } });
    const tok = await freshToken();
    const first = await handler(
      postCompletion({ prompt: "hi", tier: "fast", maxTokens: 1 }, tok),
    );
    expect(first.status).toBe(200);
    const second = await handler(
      postCompletion({ prompt: "hi", tier: "fast", maxTokens: 1 }, tok),
    );
    expect(second.status).toBe(429);
    expect(second.headers.get("Retry-After")).toBeTruthy();
  });

  it("emits audit deny event when rate-limited", async () => {
    const audit = vi.fn();
    const handler = buildHandler({
      audit,
      rateLimit: { windowMs: 60_000, maxRequests: 1 },
    });
    const tok = await freshToken();
    await handler(postCompletion({ prompt: "hi", tier: "fast", maxTokens: 1 }, tok));
    await handler(postCompletion({ prompt: "hi", tier: "fast", maxTokens: 1 }, tok));
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "deny", event: "edge.rate_limit" }),
    );
  });

  it("rate-limit headers present on success", async () => {
    const handler = buildHandler({ rateLimit: { windowMs: 60_000, maxRequests: 5 } });
    const tok = await freshToken();
    const res = await handler(
      postCompletion({ prompt: "hi", tier: "fast", maxTokens: 1 }, tok),
    );
    expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("4");
  });

  it("threads injected `now` into rate limiter", async () => {
    let t = 1_000_000;
    const handler = buildHandler({
      rateLimit: { windowMs: 1_000, maxRequests: 1 },
      now: () => t,
    });
    const tok = await freshToken();
    const ok = await handler(
      postCompletion({ prompt: "hi", tier: "fast", maxTokens: 1 }, tok),
    );
    expect(ok.status).toBe(200);
    const denied = await handler(
      postCompletion({ prompt: "hi", tier: "fast", maxTokens: 1 }, tok),
    );
    expect(denied.status).toBe(429);
    t += 5_000;
    const allowed = await handler(
      postCompletion({ prompt: "hi", tier: "fast", maxTokens: 1 }, tok),
    );
    expect(allowed.status).toBe(200);
  });
});
