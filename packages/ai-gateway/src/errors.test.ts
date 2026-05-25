import { describe, expect, it } from "vitest";
import {
  GatewayExhaustedError,
  NoRouteError,
  NonRetryableProviderError,
  RetryableProviderError,
} from "./errors.js";

describe("error classes", () => {
  it("NoRouteError has stable code", () => {
    const e = new NoRouteError("nope");
    expect(e.code).toBe("AI_GATEWAY_NO_ROUTE");
    expect(e.name).toBe("NoRouteError");
    expect(e.message).toContain("nope");
  });

  it("NonRetryableProviderError carries status", () => {
    const e = new NonRetryableProviderError(403, "forbidden");
    expect(e.code).toBe("AI_GATEWAY_NON_RETRYABLE");
    expect(e.status).toBe(403);
  });

  it("RetryableProviderError carries status", () => {
    const e = new RetryableProviderError(503, "down");
    expect(e.code).toBe("AI_GATEWAY_RETRYABLE");
    expect(e.status).toBe(503);
  });

  it("GatewayExhaustedError preserves cause", () => {
    const cause = new Error("flake");
    const e = new GatewayExhaustedError(cause);
    expect(e.code).toBe("AI_GATEWAY_EXHAUSTED");
    expect(e.cause).toBe(cause);
  });
});
