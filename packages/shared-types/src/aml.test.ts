import { describe, expect, it } from "vitest";
import { isDecision, isScore } from "./aml.js";
import type {
  AmlDecision,
  DecisionRequest,
  EvidenceItem,
  Subject,
  Transaction,
} from "./aml.js";

describe("isDecision", () => {
  it.each(["clear", "review", "block"] as const)("accepts %s", (v) => {
    expect(isDecision(v)).toBe(true);
  });

  it.each(["", "approve", "deny", null, undefined, 0, 1, {}, []])(
    "rejects %p",
    (v) => {
      expect(isDecision(v)).toBe(false);
    },
  );
});

describe("isScore", () => {
  it.each([0, 0.5, 1])("accepts %p", (v) => {
    expect(isScore(v)).toBe(true);
  });

  it.each([-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY, "0.5", null])(
    "rejects %p",
    (v) => {
      expect(isScore(v)).toBe(false);
    },
  );
});

describe("AMLIQ decision contracts", () => {
  const subject: Subject = {
    subjectHash: "sha256:abc123",
    country: "US",
    riskBand: "medium",
    metadata: { segment: "retail" },
  };

  const transaction: Transaction = {
    id: "txn_001",
    amount: 12500, // $125.00 in minor units
    currency: "USD",
    timestamp: "2026-05-26T12:00:00Z",
    channel: "wire",
    counterpartyHash: "sha256:def456",
  };

  it("constructs a valid DecisionRequest", () => {
    const req: DecisionRequest = {
      subject,
      transaction,
      tenantId: "tenant_a",
      requestedAt: "2026-05-26T12:00:00.500Z",
    };
    expect(req.subject.subjectHash).toBe("sha256:abc123");
    expect(req.transaction.amount).toBe(12500);
    expect(req.tenantId).toBe("tenant_a");
  });

  it("constructs a valid AmlDecision with evidence", () => {
    const evidence: EvidenceItem = {
      engine: "quantumbeam",
      ruleId: "qb.sanctions.v3",
      score: 0.82,
      weight: 1,
      reason: "sanctions_match",
    };
    const decision: AmlDecision = {
      decision: "block",
      score: 0.82,
      threshold: { clear: 0.3, review: 0.7 },
      evidence: [evidence],
      decisionId: "dec_001",
      auditId: "aud_001",
      decidedAt: "2026-05-26T12:00:00.750Z",
    };
    expect(decision.decision).toBe("block");
    expect(decision.evidence).toHaveLength(1);
    expect(decision.threshold.clear).toBeLessThan(decision.threshold.review);
  });

  it("narrows on the `decision` discriminator", () => {
    const decision: AmlDecision = {
      decision: "clear",
      score: 0.1,
      threshold: { clear: 0.3, review: 0.7 },
      evidence: [],
      decisionId: "dec_002",
      auditId: "aud_002",
      decidedAt: "2026-05-26T12:00:01.000Z",
    };

    let label: string;
    if (decision.decision === "clear") {
      // Inside this branch the literal is narrowed to "clear".
      const narrowed: "clear" = decision.decision;
      label = narrowed;
    } else if (decision.decision === "review") {
      label = "review";
    } else {
      label = "block";
    }
    expect(label).toBe("clear");
  });

  it("rejects an unknown decision literal at compile time", () => {
    // @ts-expect-error — "approve" is not a member of Decision.
    const bad: AmlDecision = {
      decision: "approve",
      score: 0.5,
      threshold: { clear: 0.3, review: 0.7 },
      evidence: [],
      decisionId: "dec_003",
      auditId: "aud_003",
      decidedAt: "2026-05-26T12:00:02.000Z",
    };
    // Runtime sanity: the value is still readable as a string.
    expect(typeof bad.decision).toBe("string");
  });
});
