import { describe, expect, it } from "vitest";
import { createBrainHostApp, type BrainHostConfig } from "./runtime.js";
import type { AuditRecord, AuthVerifier } from "./types.js";

const auth: AuthVerifier = {
  verify: async () => ({
    ok: true,
    claims: {
      sub: "analyst-1",
      iss: "iss",
      aud: "amliq-brain",
      exp: Math.floor(Date.now() / 1000) + 3600,
      roles: ["aml:decision:write"],
    },
  }),
};

const base = (
  overrides: Partial<BrainHostConfig> = {},
  records: AuditRecord[] = [],
): BrainHostConfig => ({
  version: "0.1.0-test",
  startedAtMs: 0,
  auth,
  audit: { sink: (r) => records.push(r) },
  requiredRole: "aml:decision:write",
  ...overrides,
});

const req = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { Authorization: "Bearer good", "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

describe("createBrainHostApp", () => {
  it("wires searchRuntime through the HTTP adapter", async () => {
    let runtimeBody: unknown = null;
    const { app } = createBrainHostApp(
      base({
        searchRuntime: {
          endpoint: "https://rag.internal/search",
          httpFetch: async (_url, init) => {
            runtimeBody = JSON.parse(String(init?.body));
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
      }),
    );

    const res = await app.request("/v1/search", {
      method: "POST",
      headers: { Authorization: "Bearer good", "Content-Type": "application/json" },
      body: JSON.stringify({ q: "fincen", tenant_id: "tenant-a", top_k: 2 }),
    });
    expect(res.status).toBe(200);
    expect(runtimeBody).toStrictEqual({
      query: "fincen",
      k: 2,
      tenant_id: "tenant-a",
    });
  });

  it("wires sarDraftRuntime through the HTTP generator", async () => {
    let runtimeBody: unknown = null;
    const records: AuditRecord[] = [];
    const { app } = createBrainHostApp(
      base({
        sarDraftRuntime: {
          endpoint: "https://sar.internal/draft",
          httpFetch: async (_url, init) => {
            runtimeBody = JSON.parse(String(init?.body));
            return new Response(JSON.stringify({
              draft: {
                alert_id: "A-1",
                template_id: "structuring",
                filled_text: "Draft narrative.",
                citations: [],
                confidence: 0.6,
                human_review_required: true,
              },
            }));
          },
        },
      }, records),
    );

    const res = await app.request(
      "/v1/brain/sar-draft",
      req({ tenant_id: "tenant-a", alert: { alert_id: "A-1", alert_type: "structuring" } }),
    );
    expect(res.status).toBe(200);
    expect(runtimeBody).toMatchObject({
      alert: { alert_id: "A-1", tenant_id: "tenant-a" },
    });
    expect(records[0]!.reason).toBe("generated");
  });

  it("keeps SAR route unmounted when no generator config is supplied", async () => {
    const { app } = createBrainHostApp(base());
    const res = await app.request(
      "/v1/brain/sar-draft",
      req({ tenant_id: "tenant-a", alert: { alert_id: "A-1", alert_type: "structuring" } }),
    );
    expect(res.status).toBe(404);
  });

  it("rejects ambiguous SAR generator configuration", () => {
    expect(() => createBrainHostApp(base({
      sarDraft: { generator: { draft: () => { throw new Error("unused"); } } },
      sarDraftRuntime: { endpoint: "https://sar.internal/draft" },
    }))).toThrow("brain.host.sar_draft.ambiguous");
  });

  it("rejects ambiguous search configuration", () => {
    expect(() => createBrainHostApp(base({
      search: { adapter: { query: async () => ({ hits: [], latencyMs: 1 }) } },
      searchRuntime: { endpoint: "https://rag.internal/search" },
    }))).toThrow("brain.host.search.ambiguous");
  });
});
