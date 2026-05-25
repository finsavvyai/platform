import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createBrainWorkerFetch, type BrainWorkerEnv } from "./worker.js";

const draft = {
  alert_id: "A-1",
  template_id: "structuring",
  filled_text: "Draft narrative.",
  citations: [],
  confidence: 0.6,
  human_review_required: true,
};

const request = (token = "secret"): RequestInit => ({
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    tenant_id: "tenant-a",
    alert: { alert_id: "A-1", alert_type: "structuring" },
  }),
});

const env = (overrides: Partial<BrainWorkerEnv> = {}): BrainWorkerEnv => ({
  VERSION: "0.1.0-test",
  BRAIN_AUTH_TOKEN: "secret",
  BRAIN_SEARCH_ENDPOINT: "https://rag.internal/search",
  BRAIN_SAR_DRAFT_ENDPOINT: "https://sar.internal/draft",
  ...overrides,
});

const base64Url = (input: Buffer | string): string =>
  Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const signWorkerJwt = (): string => {
  const encodedHeader = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const encodedPayload = base64Url(JSON.stringify({
    sub: "user-1",
    iss: "https://auth.finsavvy.test",
    aud: "amliq-brain",
    exp: Math.floor(Date.now() / 1000) + 3600,
    roles: ["aml:decision:write"],
  }));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", "jwt-secret")
    .update(signingInput)
    .digest();
  return `${signingInput}.${base64Url(signature)}`;
};

describe("Brain worker adapter", () => {
  it("serves health without auth", async () => {
    const fetchBrain = createBrainWorkerFetch(env());
    const res = await fetchBrain(new Request("https://brain.local/health"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      status: "ok",
      version: "0.1.0-test",
    });
  });

  it("wires auth, SAR runtime fetch, and R2 audit sink", async () => {
    const writes: { key: string; value: string }[] = [];
    let authHeader = "";
    const fetchBrain = createBrainWorkerFetch(
      env({
        BRAIN_SAR_DRAFT_AUTHORIZATION: "Bearer sar-runtime",
        AUDIT_LOG_BUCKET: {
          put: async (key, value) => {
            writes.push({ key, value });
          },
        },
      }),
      {
        httpFetch: async (_url, init) => {
          authHeader = String((init?.headers as Record<string, string>).Authorization);
          return new Response(JSON.stringify({ draft }));
        },
        clock: () => new Date("2026-05-26T00:00:00.000Z"),
      },
    );

    const res = await fetchBrain(
      new Request("https://brain.local/v1/brain/sar-draft", request()),
    );
    expect(res.status).toBe(200);
    expect(authHeader).toBe("Bearer sar-runtime");
    expect(writes).toHaveLength(1);
    expect(writes[0]!.key).toContain("brain.sar_draft.generate");
    expect(JSON.parse(writes[0]!.value)).toMatchObject({ reason: "generated" });
  });

  it("wires search runtime fetch and authorization", async () => {
    let seenAuth = "";
    let seenBody: unknown = null;
    const fetchBrain = createBrainWorkerFetch(
      env({ BRAIN_SEARCH_AUTHORIZATION: "Bearer rag-runtime" }),
      {
        httpFetch: async (_url, init) => {
          seenAuth = String((init?.headers as Record<string, string>).Authorization);
          seenBody = JSON.parse(String(init?.body));
          return new Response(JSON.stringify({
            results: [{
              doc_id: "d1",
              content: "FinCEN body",
              score: 0.9,
              meta: { title: "Doc", sha256: "a".repeat(64) },
            }],
          }));
        },
      },
    );

    const res = await fetchBrain(
      new Request("https://brain.local/v1/search", {
        method: "POST",
        headers: {
          Authorization: "Bearer secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: "fincen", tenant_id: "tenant-a", top_k: 2 }),
      }),
    );
    expect(res.status).toBe(200);
    expect(seenAuth).toBe("Bearer rag-runtime");
    expect(seenBody).toStrictEqual({ query: "fincen", k: 2, tenant_id: "tenant-a" });
  });

  it("accepts JWT auth when Worker JWT env is configured", async () => {
    const fetchBrain = createBrainWorkerFetch(env({
      BRAIN_AUTH_TOKEN: undefined,
      BRAIN_JWT_HS256_SECRET: "jwt-secret",
      BRAIN_JWT_ISSUER: "https://auth.finsavvy.test",
      BRAIN_JWT_AUDIENCE: "amliq-brain",
    }), {
      httpFetch: async () => new Response(JSON.stringify({ draft })),
    });

    const res = await fetchBrain(
      new Request("https://brain.local/v1/brain/sar-draft", request(signWorkerJwt())),
    );
    expect(res.status).toBe(200);
  });

  it("rejects invalid bearer tokens", async () => {
    const fetchBrain = createBrainWorkerFetch(env());
    const res = await fetchBrain(
      new Request("https://brain.local/v1/brain/sar-draft", request("bad")),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toStrictEqual({ ok: false, error: "invalid_token" });
  });

  it("leaves SAR route unmounted without endpoint config", async () => {
    const fetchBrain = createBrainWorkerFetch(env({ BRAIN_SAR_DRAFT_ENDPOINT: undefined }));
    const res = await fetchBrain(
      new Request("https://brain.local/v1/brain/sar-draft", request()),
    );
    expect(res.status).toBe(404);
  });
});
