import { describe, expect, it } from "vitest";
import { parseSarDraftRequest } from "./request-schema.js";

describe("SAR draft request schema", () => {
  it("parses nested alerts and trims string fields", () => {
    const parsed = parseSarDraftRequest({
      tenant_id: " tenant-a ",
      alert: {
        alert_id: " A-1 ",
        alert_type: " structuring ",
        parties: [" Alice ", "", "Bob"],
        transaction_ids: [" tx-1 "],
        timestamps: [" 2026-05-26T00:00:00Z "],
        amount: 42,
        currency: " USD ",
        raw: { source: "case" },
      },
    });

    expect(parsed).toMatchObject({
      ok: true,
      alert: {
        alert_id: "A-1",
        tenant_id: "tenant-a",
        alert_type: "structuring",
        parties: ["Alice", "Bob"],
        transaction_ids: ["tx-1"],
        jurisdiction: "US",
        amount: 42,
        currency: "USD",
      },
    });
  });

  it("preserves stable validation error codes", () => {
    expect(parseSarDraftRequest(null)).toStrictEqual({
      ok: false,
      code: "missing_alert",
      status: 400,
      tenantId: "unknown",
      alertId: "unknown",
    });
    expect(parseSarDraftRequest({
      tenant_id: "a",
      alert: { tenant_id: "b", alert_id: "A-1", alert_type: "x" },
    })).toMatchObject({ ok: false, code: "tenant_mismatch" });
    expect(parseSarDraftRequest({
      tenant_id: "a",
      alert: { alert_id: "A-1" },
    })).toMatchObject({ ok: false, code: "missing_alert_type" });
  });
});
