import { describe, expect, it, vi } from "vitest";
import { buildHandler, freshToken, postCompletion } from "./handler.test-helpers.js";

describe("createEdgeHandler — health", () => {
  it("GET /health returns 200 with status ok", async () => {
    const handler = buildHandler();
    const res = await handler(new Request("https://x.io/health"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("non-GET to /health returns 404 (only /v1/complete supports other methods)", async () => {
    const handler = buildHandler();
    const res = await handler(new Request("https://x.io/health", { method: "POST" }));
    expect(res.status).toBe(404);
  });
});

describe("createEdgeHandler — routing", () => {
  it("unknown path returns 404 JSON", async () => {
    const handler = buildHandler();
    const res = await handler(new Request("https://x.io/nope"));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("not_found");
  });

  it("non-POST to /v1/complete returns 405 with Allow header", async () => {
    const handler = buildHandler();
    const res = await handler(
      new Request("https://x.io/v1/complete", { method: "GET" }),
    );
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST");
  });
});

describe("createEdgeHandler — auth", () => {
  it("401 when Authorization missing", async () => {
    const handler = buildHandler();
    const res = await handler(postCompletion({}));
    expect(res.status).toBe(401);
  });

  it("401 when JWT is invalid", async () => {
    const handler = buildHandler();
    const res = await handler(postCompletion({}, "bad.jwt.here"));
    expect(res.status).toBe(401);
  });

  it("emits audit deny on auth failure", async () => {
    const audit = vi.fn();
    const handler = buildHandler({ audit });
    await handler(postCompletion({}));
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "deny",
        event: "edge.auth",
        actorId: "anonymous",
      }),
    );
  });
});

describe("createEdgeHandler — security headers", () => {
  it("applies HSTS when configured", async () => {
    const handler = buildHandler({ enableHsts: true });
    const res = await handler(new Request("https://x.io/health"));
    expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=31536000");
  });

  it("applies custom gateway version header", async () => {
    const handler = buildHandler({ gatewayVersion: "edge/2.0" });
    const res = await handler(new Request("https://x.io/health"));
    expect(res.headers.get("X-Gateway-Version")).toBe("edge/2.0");
  });
});

// Smoke: success path exists (full assertions in handler.completion.test.ts).
describe("createEdgeHandler — smoke", () => {
  it("returns 200 for a valid completion request", async () => {
    const handler = buildHandler();
    const tok = await freshToken();
    const res = await handler(
      postCompletion({ prompt: "hi", tier: "fast", maxTokens: 10 }, tok),
    );
    expect(res.status).toBe(200);
  });
});
