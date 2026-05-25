import { describe, expect, it, vi } from "vitest";
import { AiGateway } from "../gateway.js";
import { NonRetryableProviderError } from "../errors.js";
import { mockAdapter, fastRef, noWait } from "../test-fixtures.js";
import type { ProviderAdapter } from "../types.js";
import {
  buildGateway,
  buildHandler,
  freshToken,
  postCompletion,
} from "./handler.test-helpers.js";

describe("createEdgeHandler — completion success", () => {
  it("200 returns a GatewayResponse-shaped JSON", async () => {
    const handler = buildHandler();
    const tok = await freshToken();
    const res = await handler(
      postCompletion({ prompt: "hi", tier: "fast", maxTokens: 10 }, tok),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      text: string;
      model: { tier: string };
      cached: boolean;
    };
    expect(body.text).toBe("ok");
    expect(body.model.tier).toBe("fast");
    expect(body.cached).toBe(false);
  });

  it("uses authed tenantId, ignoring body tenantId", async () => {
    const adapter = mockAdapter(fastRef);
    const handler = buildHandler({ gateway: buildGateway([adapter]) });
    const tok = await freshToken({ tenantId: "real-tenant" });
    await handler(
      postCompletion(
        { prompt: "hi", tier: "fast", maxTokens: 10, tenantId: "spoofed" },
        tok,
      ),
    );
    expect(adapter.complete).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "real-tenant" }),
    );
  });

  it("emits audit allow on successful completion", async () => {
    const audit = vi.fn();
    const handler = buildHandler({ audit });
    const tok = await freshToken();
    await handler(postCompletion({ prompt: "hi", tier: "fast", maxTokens: 5 }, tok));
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "allow", event: "edge.complete" }),
    );
  });
});

describe("createEdgeHandler — completion errors", () => {
  it("400 on invalid JSON body", async () => {
    const handler = buildHandler();
    const tok = await freshToken();
    const res = await handler(
      new Request("https://x.io/v1/complete", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: "{not-json",
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_json");
  });

  it("400 on body validation failure", async () => {
    const handler = buildHandler();
    const tok = await freshToken();
    const res = await handler(postCompletion({ tier: "fast", maxTokens: 10 }, tok));
    expect(res.status).toBe(400);
  });

  it("503 on no route", async () => {
    const handler = buildHandler({
      gateway: new AiGateway({ adapters: [mockAdapter(fastRef)] }),
    });
    const tok = await freshToken();
    const res = await handler(
      postCompletion({ prompt: "hi", tier: "frontier", maxTokens: 10 }, tok),
    );
    expect(res.status).toBe(503);
  });

  it("502 on non-retryable provider error", async () => {
    const failing: ProviderAdapter = {
      ref: fastRef,
      complete: async () => {
        throw new NonRetryableProviderError(400, "bad");
      },
    };
    const handler = buildHandler({ gateway: buildGateway([failing]) });
    const tok = await freshToken();
    const res = await handler(
      postCompletion({ prompt: "hi", tier: "fast", maxTokens: 10 }, tok),
    );
    expect(res.status).toBe(502);
  });

  it("504 on exhausted retries", async () => {
    const failing: ProviderAdapter = {
      ref: fastRef,
      complete: async () => {
        throw Object.assign(new Error("boom"), { status: 503 });
      },
    };
    const gateway = new AiGateway({
      adapters: [failing],
      retry: { ...noWait, maxAttempts: 2 },
    });
    const handler = buildHandler({ gateway });
    const tok = await freshToken();
    const res = await handler(
      postCompletion({ prompt: "hi", tier: "fast", maxTokens: 10 }, tok),
    );
    expect(res.status).toBe(504);
  });

  it("500 on unexpected error class", async () => {
    // 4xx status (non-408/429) is treated as non-retryable; the resulting
    // generic Error falls through to the 500 mapper.
    const failing: ProviderAdapter = {
      ref: fastRef,
      complete: async () => {
        throw Object.assign(new Error("weird"), { status: 418 });
      },
    };
    const handler = buildHandler({ gateway: buildGateway([failing]) });
    const tok = await freshToken();
    const res = await handler(
      postCompletion({ prompt: "hi", tier: "fast", maxTokens: 10 }, tok),
    );
    expect(res.status).toBe(500);
  });
});
