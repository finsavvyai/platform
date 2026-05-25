// Tests for the Cepien AI integration helpers. Pure unit tests — stubs
// globalThis.fetch for the callback path, uses WebCrypto for HMAC.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  hmacSha256Hex,
  timingSafeEqual,
  verifySignature,
  maskRecommendationId,
  validatePayload,
  postCallback,
  type CepienWebhookPayload,
  type CepienCallbackBody,
} from "./cepien-integration";

const originalFetch = globalThis.fetch;

const validPayload: CepienWebhookPayload = {
  event: "recommendation.code_generated",
  recommendation_id: "rec_abc123456789",
  title: "Add dark mode toggle",
  pr: {
    url: "https://github.com/org/repo/pull/42",
    owner: "org",
    repo: "repo",
    number: 42,
    branch: "cepien/rec_abc123-dark-mode",
    head_sha: "abc123def456",
  },
  source: { generator: "claude-code", model: "claude-opus-4-7" },
  cepien_workspace_id: "ws_xyz",
  callback_url: "https://api.cepien.ai/webhooks/status/rec_abc123",
};

describe("hmacSha256Hex + verifySignature", () => {
  it("produces a deterministic hex digest", async () => {
    const a = await hmacSha256Hex("secret", "payload");
    const b = await hmacSha256Hex("secret", "payload");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different digests for different secrets", async () => {
    const a = await hmacSha256Hex("secret1", "payload");
    const b = await hmacSha256Hex("secret2", "payload");
    expect(a).not.toBe(b);
  });

  it("verifies a matching sha256= header", async () => {
    const body = '{"hello":"world"}';
    const digest = await hmacSha256Hex("shh", body);
    expect(await verifySignature(body, `sha256=${digest}`, "shh")).toBe(true);
    expect(await verifySignature(body, digest, "shh")).toBe(true); // bare hex also accepted
  });

  it("rejects a tampered body", async () => {
    const body = '{"hello":"world"}';
    const digest = await hmacSha256Hex("shh", body);
    expect(await verifySignature('{"hello":"tampered"}', digest, "shh")).toBe(false);
  });

  it("rejects missing, empty or non-hex signatures", async () => {
    expect(await verifySignature("body", undefined, "shh")).toBe(false);
    expect(await verifySignature("body", "", "shh")).toBe(false);
    expect(await verifySignature("body", "sha256=not-hex!!", "shh")).toBe(false);
  });

  it("rejects when the workspace secret is empty", async () => {
    const digest = await hmacSha256Hex("real", "body");
    expect(await verifySignature("body", digest, "")).toBe(false);
  });
});

describe("timingSafeEqual", () => {
  it("returns true for identical strings", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
  });
  it("returns false for differing strings and different lengths", () => {
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});

describe("maskRecommendationId", () => {
  it("exposes only the last 6 chars", () => {
    expect(maskRecommendationId("rec_abc123456789")).toBe("***456789");
  });
  it("short ids become ***", () => {
    expect(maskRecommendationId("rec")).toBe("***");
  });
  it("handles empty", () => {
    expect(maskRecommendationId("")).toBe("<empty>");
  });
});

describe("validatePayload", () => {
  it("accepts the canonical payload", () => {
    expect(validatePayload(validPayload)).toBeNull();
  });

  it("rejects non-object input", () => {
    expect(validatePayload(null)).toMatch(/object/);
    expect(validatePayload("string")).toMatch(/object/);
  });

  it("rejects unknown event types", () => {
    expect(validatePayload({ ...validPayload, event: "other" })).toMatch(/event/);
  });

  it("rejects missing recommendation_id / title / workspace_id", () => {
    const noRec = { ...validPayload, recommendation_id: "" };
    expect(validatePayload(noRec)).toMatch(/recommendation_id/);
    const noWs = { ...validPayload, cepien_workspace_id: "" };
    expect(validatePayload(noWs)).toMatch(/cepien_workspace_id/);
  });

  it("rejects non-https callback_url", () => {
    expect(validatePayload({ ...validPayload, callback_url: "http://a.test/x" })).toMatch(/https/);
  });

  it("rejects malformed pr object", () => {
    const badPr = { ...validPayload, pr: { ...validPayload.pr, number: "42" as unknown as number } };
    expect(validatePayload(badPr)).toMatch(/pr\.number/);
  });

  it("rejects unknown generators", () => {
    const bad = { ...validPayload, source: { generator: "gpt-9" as unknown as "cursor", model: "x" } };
    expect(validatePayload(bad)).toMatch(/source\.generator/);
  });
});

describe("postCallback", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  const body: CepienCallbackBody = {
    status: "passed", passed: true,
    run_url: "https://pushci.dev/runs/abc",
    duration_ms: 12345,
    recommendation_id: "rec_abc123",
  };

  it("POSTs JSON with Authorization when token present", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const res = await postCallback("https://cepien.ai/cb/1", "tok_123", body);
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    const [[url, init]] = fetchMock.mock.calls;
    expect(url).toBe("https://cepien.ai/cb/1");
    const h = (init as RequestInit).headers as Record<string, string>;
    expect(h["Content-Type"]).toBe("application/json");
    expect(h.Authorization).toBe("Bearer tok_123");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual(body);
  });

  it("omits Authorization when token not supplied", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await postCallback("https://cepien.ai/cb/1", undefined, body);
    const [[, init]] = fetchMock.mock.calls;
    const h = (init as RequestInit).headers as Record<string, string>;
    expect(h.Authorization).toBeUndefined();
  });

  it("surfaces upstream non-2xx as ok=false", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
    const res = await postCallback("https://cepien.ai/cb/1", "t", body);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(500);
  });
});
