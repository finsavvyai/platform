import { describe, expect, it } from "vitest";
import {
  EdgeAuthError,
  EdgeBadRequestError,
  EdgeRateLimitedError,
} from "./errors.js";

describe("EdgeAuthError", () => {
  it("carries stable code and status", () => {
    const e = new EdgeAuthError(401, "bad token");
    expect(e.code).toBe("AI_GATEWAY_EDGE_AUTH");
    expect(e.status).toBe(401);
    expect(e.name).toBe("EdgeAuthError");
    expect(e.message).toContain("bad token");
  });

  it("supports 403", () => {
    const e = new EdgeAuthError(403, "forbidden");
    expect(e.status).toBe(403);
  });
});

describe("EdgeRateLimitedError", () => {
  it("carries stable code, 429 status, and retry-after", () => {
    const e = new EdgeRateLimitedError(45);
    expect(e.code).toBe("AI_GATEWAY_EDGE_RATE_LIMITED");
    expect(e.status).toBe(429);
    expect(e.retryAfterSeconds).toBe(45);
    expect(e.name).toBe("EdgeRateLimitedError");
  });
});

describe("EdgeBadRequestError", () => {
  it("carries stable code and 400 status", () => {
    const e = new EdgeBadRequestError("missing field x");
    expect(e.code).toBe("AI_GATEWAY_EDGE_BAD_REQUEST");
    expect(e.status).toBe(400);
    expect(e.name).toBe("EdgeBadRequestError");
    expect(e.message).toContain("missing field x");
  });
});
