import { describe, expect, it } from "vitest";
import { HttpSarDraftGenerator } from "./http-generator.js";
import {
  SarDraftGeneratorError,
  type SarAlertInput,
  type SarDraft,
} from "./types.js";

const alert: SarAlertInput = {
  alert_id: "A-1",
  tenant_id: "tenant-a",
  alert_type: "structuring",
  transaction_ids: ["tx-1"],
  parties: [],
  timestamps: [],
  jurisdiction: "US",
};

const draft: SarDraft = {
  alert_id: "A-1",
  template_id: "structuring",
  filled_text: "Draft narrative.",
  citations: [
    { doc_id: "d1", span_start: 0, span_end: 12, source: "fincen" },
  ],
  confidence: 0.6,
  human_review_required: true,
  audit_event_id: "audit-1",
};

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("HttpSarDraftGenerator", () => {
  it("POSTs the alert to the runtime and parses envelope responses", async () => {
    let seen: { url: string; init?: RequestInit } | null = null;
    const gen = new HttpSarDraftGenerator({
      endpoint: "https://sar.internal/draft",
      headers: { Authorization: "Bearer runtime" },
      httpFetch: async (url, init) => {
        seen = { url: String(url), init };
        return jsonRes({ ok: true, draft });
      },
    });

    await expect(gen.draft(alert)).resolves.toStrictEqual(draft);
    expect(seen!.url).toBe("https://sar.internal/draft");
    expect(seen!.init!.method).toBe("POST");
    expect(seen!.init!.headers).toMatchObject({
      Authorization: "Bearer runtime",
      Accept: "application/json",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(seen!.init!.body))).toStrictEqual({ alert });
  });

  it("also accepts a bare draft response", async () => {
    const gen = new HttpSarDraftGenerator({
      endpoint: "https://sar.internal/draft",
      httpFetch: async () => jsonRes(draft),
    });
    await expect(gen.draft(alert)).resolves.toStrictEqual(draft);
  });

  it("maps non-2xx responses to upstream_error", async () => {
    const gen = new HttpSarDraftGenerator({
      endpoint: "https://sar.internal/draft",
      httpFetch: async () => jsonRes({ ok: false }, 503),
    });
    await expect(gen.draft(alert)).rejects.toMatchObject({
      code: "upstream_error",
      status: 503,
    });
  });

  it("rejects malformed draft responses", async () => {
    const gen = new HttpSarDraftGenerator({
      endpoint: "https://sar.internal/draft",
      httpFetch: async () => jsonRes({ draft: { ...draft, citations: [{}] } }),
    });
    await expect(gen.draft(alert)).rejects.toMatchObject({
      code: "bad_response",
    });
  });

  it("rejects responses that disable human review", async () => {
    const gen = new HttpSarDraftGenerator({
      endpoint: "https://sar.internal/draft",
      httpFetch: async () => jsonRes({ draft: { ...draft, human_review_required: false } }),
    });
    await expect(gen.draft(alert)).rejects.toMatchObject({
      code: "bad_response",
      message: "human review disabled",
    });
  });

  it("maps fetch failures to network_error", async () => {
    const gen = new HttpSarDraftGenerator({
      endpoint: "https://sar.internal/draft",
      httpFetch: async () => {
        throw new Error("socket closed");
      },
    });
    await expect(gen.draft(alert)).rejects.toMatchObject({
      code: "network_error",
    });
  });

  it("maps aborts to timeout", async () => {
    const gen = new HttpSarDraftGenerator({
      endpoint: "https://sar.internal/draft",
      httpFetch: async () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        throw err;
      },
    });
    await expect(gen.draft(alert)).rejects.toMatchObject({ code: "timeout" });
  });

  it("throws SarDraftGeneratorError instances", async () => {
    const gen = new HttpSarDraftGenerator({
      endpoint: "https://sar.internal/draft",
      httpFetch: async () => jsonRes("not-an-object"),
    });
    await expect(gen.draft(alert)).rejects.toBeInstanceOf(SarDraftGeneratorError);
  });
});
