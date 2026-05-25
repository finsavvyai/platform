import { describe, expect, it } from "vitest";
import { createBrainApp } from "../server.js";
import type { AuditRecord, AuditSink } from "../types.js";
import type { SearchAdapterQuery } from "./types.js";
import {
  baseConfig,
  body,
  doc,
  errAdapter,
  stubAdapter,
} from "./search-handler.test-helpers.js";

describe("POST /v1/search — primary paths", () => {
  it("happy path → 200 with SearchResult[] and citations linked", async () => {
    let seen: SearchAdapterQuery | null = null;
    const adapter = stubAdapter(
      [
        {
          doc: doc({ doc_id: "d1", source: "fincen_rss" }),
          snippet: "FinCEN advisory text",
          score: 0.91,
        },
      ],
      (q) => {
        seen = q;
      },
    );
    const { app } = createBrainApp(baseConfig(adapter));
    const res = await app.request(
      "/v1/search",
      body({ q: "advisory", tenant_id: "tenant-a" }),
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      ok: boolean;
      query: string;
      results: { doc_id: string; citations: unknown[] }[];
    };
    expect(j.ok).toBe(true);
    expect(j.query).toBe("advisory");
    expect(j.results).toHaveLength(1);
    expect(j.results[0]!.doc_id).toBe("d1");
    expect(j.results[0]!.citations).toHaveLength(1);
    expect(seen).not.toBeNull();
    expect(seen!.tenantId).toBe("tenant-a"); // tenant scope enforced
    expect(seen!.text).toBe("advisory");
  });

  it("missing tenant → 403 with stable code and audit-logged deny", async () => {
    const records: AuditRecord[] = [];
    const sink: AuditSink = (r) => {
      records.push(r);
    };
    const { app } = createBrainApp(
      baseConfig(stubAdapter([]), { sink }),
    );
    const res = await app.request(
      "/v1/search",
      body({ q: "x", tenant_id: "" }),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toStrictEqual({
      ok: false,
      error: "missing_tenant",
    });
    expect(records).toHaveLength(1);
    expect(records[0]!.decision).toBe("deny");
    expect(records[0]!.reason).toBe("missing_tenant");
    // PII-free reason rule: no query text in the audit reason.
    expect(records[0]!.reason).not.toContain("x");
  });

  it("missing query → 400 with stable code", async () => {
    const records: AuditRecord[] = [];
    const { app } = createBrainApp(
      baseConfig(stubAdapter([]), { sink: (r) => records.push(r) }),
    );
    const res = await app.request(
      "/v1/search",
      body({ q: "   ", tenant_id: "tenant-a" }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toStrictEqual({
      ok: false,
      error: "missing_query",
    });
    expect(records[0]!.reason).toBe("missing_query");
  });

  it("auth failure → 401 (handler never reached)", async () => {
    const { app } = createBrainApp(baseConfig(stubAdapter([])));
    const res = await app.request("/v1/search", {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(401);
  });

  it("downstream adapter error → 503 with audit emitted", async () => {
    const records: AuditRecord[] = [];
    const { app } = createBrainApp(
      baseConfig(errAdapter, { sink: (r) => records.push(r) }),
    );
    const res = await app.request(
      "/v1/search",
      body({ q: "x", tenant_id: "t1" }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toStrictEqual({
      ok: false,
      error: "adapter_error",
    });
    expect(records.at(-1)!.reason).toBe("adapter_error");
    expect(records.at(-1)!.decision).toBe("error");
  });

  it("invalid JSON body → treated as missing tenant (400/403)", async () => {
    const { app } = createBrainApp(baseConfig(stubAdapter([])));
    const res = await app.request("/v1/search", {
      method: "POST",
      headers: {
        Authorization: "Bearer good",
        "Content-Type": "application/json",
      },
      body: "not json",
    });
    expect(res.status).toBe(403);
  });

  it("JSON null body → treated as missing tenant", async () => {
    const { app } = createBrainApp(baseConfig(stubAdapter([])));
    const res = await app.request("/v1/search", {
      method: "POST",
      headers: {
        Authorization: "Bearer good",
        "Content-Type": "application/json",
      },
      body: "null",
    });
    expect(res.status).toBe(403);
  });
});
