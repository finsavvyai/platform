import { describe, expect, it } from "vitest";
import { createBrainApp } from "../server.js";
import type { AuditRecord, AuditSink, AuthVerifier, BrainApiConfig } from "../types.js";
import type { SarAlertInput, SarDraft, SarDraftGenerator } from "./types.js";

const okVerifier: AuthVerifier = {
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

const draft = (overrides: Partial<SarDraft> = {}): SarDraft => ({
  alert_id: "A-1",
  template_id: "structuring",
  filled_text: "Draft SAR narrative for analyst review.",
  citations: [],
  confidence: 0.6,
  human_review_required: true,
  audit_event_id: "agent-audit-1",
  ...overrides,
});

const generator = (
  spy?: (alert: SarAlertInput) => void,
  out: SarDraft | Error = draft(),
): SarDraftGenerator => ({
  draft: async (alert) => {
    spy?.(alert);
    if (out instanceof Error) throw out;
    return out;
  },
});

const baseConfig = (
  gen: SarDraftGenerator,
  audit?: BrainApiConfig["audit"],
): BrainApiConfig => ({
  version: "0.1.0-test",
  startedAtMs: 0,
  auth: okVerifier,
  requiredRole: "aml:decision:write",
  audit: audit ?? { sink: () => undefined },
  sarDraft: { generator: gen },
});

const body = (j: unknown): RequestInit => ({
  method: "POST",
  headers: { Authorization: "Bearer good", "Content-Type": "application/json" },
  body: JSON.stringify(j),
});

describe("POST /v1/brain/sar-draft", () => {
  it("returns a human-review SAR draft and emits one API audit record", async () => {
    const records: AuditRecord[] = [];
    let seen: SarAlertInput | null = null;
    const sink: AuditSink = (r) => records.push(r);
    const { app } = createBrainApp(
      baseConfig(generator((alert) => { seen = alert; }), { sink }),
    );

    const res = await app.request(
      "/v1/brain/sar-draft",
      body({
        tenant_id: "tenant-a",
        alert: {
          alert_id: "A-1",
          tenant_id: "tenant-a",
          alert_type: "structuring",
          parties: ["Sensitive Person"],
          amount: 99999.99,
        },
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toStrictEqual({ ok: true, draft: draft() });
    expect(seen).toMatchObject({
      alert_id: "A-1",
      tenant_id: "tenant-a",
      alert_type: "structuring",
      jurisdiction: "US",
    });
    expect(records).toHaveLength(1);
    expect(records[0]!.event).toBe("brain.sar_draft.generate");
    expect(records[0]!.reason).toBe("generated");
    expect(records[0]!.decision).toBe("allow");
    expect(JSON.stringify(records[0]!.meta)).not.toContain("Sensitive Person");
    expect(JSON.stringify(records[0]!.meta)).not.toContain("99999.99");
  });

  it("allows tenant_id from the alert body when top-level tenant is absent", async () => {
    let seen: SarAlertInput | null = null;
    const { app } = createBrainApp(
      baseConfig(generator((alert) => { seen = alert; })),
    );
    const res = await app.request(
      "/v1/brain/sar-draft",
      body({ alert_id: "A-1", tenant_id: "tenant-a", alert_type: "structuring" }),
    );
    expect(res.status).toBe(200);
    expect(seen!.tenant_id).toBe("tenant-a");
  });

  it("missing tenant returns 403 and is audited as deny", async () => {
    const records: AuditRecord[] = [];
    const { app } = createBrainApp(
      baseConfig(generator(), { sink: (r) => records.push(r) }),
    );
    const res = await app.request(
      "/v1/brain/sar-draft",
      body({ alert: { alert_id: "A-1", alert_type: "structuring" } }),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toStrictEqual({ ok: false, error: "missing_tenant" });
    expect(records[0]!.decision).toBe("deny");
    expect(records[0]!.reason).toBe("missing_tenant");
  });

  it("tenant mismatch returns 403 before calling the generator", async () => {
    let called = false;
    const { app } = createBrainApp(
      baseConfig(generator(() => { called = true; })),
    );
    const res = await app.request(
      "/v1/brain/sar-draft",
      body({
        tenant_id: "tenant-a",
        alert: { alert_id: "A-1", tenant_id: "tenant-b", alert_type: "structuring" },
      }),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toStrictEqual({ ok: false, error: "tenant_mismatch" });
    expect(called).toBe(false);
  });

  it("agent errors return 503 with stable audit reason", async () => {
    const records: AuditRecord[] = [];
    const { app } = createBrainApp(
      baseConfig(generator(undefined, new Error("python down")), {
        sink: (r) => records.push(r),
      }),
    );
    const res = await app.request(
      "/v1/brain/sar-draft",
      body({ tenant_id: "tenant-a", alert: { alert_id: "A-1", alert_type: "structuring" } }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toStrictEqual({ ok: false, error: "agent_error" });
    expect(records.at(-1)!.decision).toBe("error");
    expect(records.at(-1)!.reason).toBe("agent_error");
  });

  it("rejects any draft that disables human review", async () => {
    const unsafe = { ...draft(), human_review_required: false } as unknown as SarDraft;
    const { app } = createBrainApp(baseConfig(generator(undefined, unsafe)));
    const res = await app.request(
      "/v1/brain/sar-draft",
      body({ tenant_id: "tenant-a", alert: { alert_id: "A-1", alert_type: "structuring" } }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toStrictEqual({
      ok: false,
      error: "human_review_required_violation",
    });
  });

  it("audit hard-fail returns audit_emit_failed even after generation", async () => {
    const sink: AuditSink = () => { throw new Error("primary"); };
    const fallbackSink: AuditSink = () => { throw new Error("fallback"); };
    const { app } = createBrainApp(
      baseConfig(generator(), { sink, fallbackSink }),
    );
    const res = await app.request(
      "/v1/brain/sar-draft",
      body({ tenant_id: "tenant-a", alert: { alert_id: "A-1", alert_type: "structuring" } }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toStrictEqual({ ok: false, error: "audit_emit_failed" });
  });

  it("auth failure returns 401 before the handler runs", async () => {
    const { app } = createBrainApp(baseConfig(generator()));
    const res = await app.request("/v1/brain/sar-draft", {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(401);
  });
});
