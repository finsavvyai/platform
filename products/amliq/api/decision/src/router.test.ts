import { describe, expect, it } from "vitest";
import {
  HIGH_RISK_MCCS,
  LARGE_TXN_THRESHOLD_MINOR,
  route,
} from "./router.js";
import type { DecisionRequest } from "./types.js";

const baseSubject = {
  subject_id: "S1",
  subject_hash: "h_s1",
} as const;

const baseTxn = {
  transaction_id: "T1",
  amount_minor: 5000_00, // $5,000
  currency: "USD" as const,
  channel: "card" as const,
};

const req = (overrides: Partial<DecisionRequest> = {}): DecisionRequest => ({
  subject: baseSubject,
  transaction: baseTxn,
  tenant_id: "tenant_A",
  ...overrides,
});

describe("router.route", () => {
  it("small txn → quantumbeam only", () => {
    expect(route(req())).toEqual(["quantumbeam"]);
  });

  it("txn at threshold (boundary) → quantumbeam only (not > threshold)", () => {
    const r = req({
      transaction: { ...baseTxn, amount_minor: LARGE_TXN_THRESHOLD_MINOR },
    });
    expect(route(r)).toEqual(["quantumbeam"]);
  });

  it("txn over $10k → both engines, QB first", () => {
    const r = req({
      transaction: { ...baseTxn, amount_minor: LARGE_TXN_THRESHOLD_MINOR + 1 },
    });
    expect(route(r)).toEqual(["quantumbeam", "ml-fraud"]);
  });

  it.each([...HIGH_RISK_MCCS])(
    "high-risk MCC %s → both engines",
    (mcc) => {
      const r = req({ transaction: { ...baseTxn, mcc } });
      expect(route(r)).toEqual(["quantumbeam", "ml-fraud"]);
    },
  );

  it("non-listed MCC → quantumbeam only", () => {
    const r = req({ transaction: { ...baseTxn, mcc: "5411" } });
    expect(route(r)).toEqual(["quantumbeam"]);
  });

  it("cross-border txn → both engines", () => {
    const r = req({ transaction: { ...baseTxn, cross_border: true } });
    expect(route(r)).toEqual(["quantumbeam", "ml-fraud"]);
  });

  it("cross-border=false → quantumbeam only", () => {
    const r = req({ transaction: { ...baseTxn, cross_border: false } });
    expect(route(r)).toEqual(["quantumbeam"]);
  });

  it("prior SAR history (context.prior_sar=true) → both engines", () => {
    const r = req({ context: { prior_sar: true } });
    expect(route(r)).toEqual(["quantumbeam", "ml-fraud"]);
  });

  it("context.prior_sar=false → quantumbeam only", () => {
    const r = req({ context: { prior_sar: false } });
    expect(route(r)).toEqual(["quantumbeam"]);
  });

  it("no context object → quantumbeam only", () => {
    const r = req({});
    expect(route(r)).toEqual(["quantumbeam"]);
  });

  it("multiple triggers (large + cross-border + SAR) → both, no duplicates", () => {
    const r = req({
      transaction: {
        ...baseTxn,
        amount_minor: 50_000_00,
        cross_border: true,
      },
      context: { prior_sar: true },
    });
    expect(route(r)).toEqual(["quantumbeam", "ml-fraud"]);
  });
});
