/**
 * Tests for the AMLIQ Investigate audit-emit module.
 * Target: 100% line + branch coverage (AMLIQ critical path).
 */

import { describe, expect, it, vi } from "vitest";
import {
  AMLIQ_DECISION_EVENT,
  AuditEmitFailure,
  auditDecisionFor,
  buildAuditInput,
  emitDecisionAudit,
  resourceFor,
} from "./audit.js";
import type {
  AmlDecision,
  AuditEmitter,
  AuditInput,
  DecisionRequest,
  EngineResult,
} from "./types.js";

const engineResult: EngineResult = {
  engine: "quantumbeam",
  risk_score: 42,
  explanations: ["rule_X"],
  latency_ms: 5,
};

const baseRequest = (): DecisionRequest => ({
  subject: { subject_id: "s_1", subject_hash: "h_s1" },
  transaction: {
    transaction_id: "t_1",
    amount_minor: 100_00,
    currency: "USD",
    channel: "card",
  },
  tenant_id: "tenantA",
});

const baseDecision = (
  overrides: Partial<AmlDecision> = {},
): AmlDecision => ({
  decision_id: "dec_1",
  request_id: "req_1",
  tenant_id: "tenantA",
  ts: "2026-01-01T00:00:00.000Z",
  max_risk_score: 42,
  engine_results: [engineResult],
  aggregated_explanation: ["rule_X"],
  recommended_action: "flag",
  confidence: 1,
  partial: false,
  ...overrides,
});

describe("audit.resourceFor / auditDecisionFor (pure helpers)", () => {
  it("resourceFor composes <subjectHash>:<transactionId>", () => {
    expect(resourceFor(baseRequest())).toBe("h_s1:t_1");
  });
  it("auditDecisionFor maps block→deny; flag→allow; allow→allow", () => {
    expect(auditDecisionFor("block")).toBe("deny");
    expect(auditDecisionFor("flag")).toBe("allow");
    expect(auditDecisionFor("allow")).toBe("allow");
  });
});

describe("audit.buildAuditInput", () => {
  it("produces PII-free input with engine_results in meta", () => {
    const input = buildAuditInput({
      decision: baseDecision(),
      request: baseRequest(),
      actorId: "actor_x",
      event: AMLIQ_DECISION_EVENT,
    });
    expect(input.actorId).toBe("actor_x");
    expect(input.tenantId).toBe("tenantA");
    expect(input.event).toBe("amliq.decision");
    expect(input.resource).toBe("h_s1:t_1");
    expect(input.decision).toBe("allow"); // flag → allow
    expect(input.reason).toBe("max_score=42");
    expect(input.meta).toMatchObject({
      decision_id: "dec_1",
      request_id: "req_1",
      recommended_action: "flag",
      partial: false,
      confidence: 1,
      engine_results: [engineResult],
    });
  });

  it("never includes plaintext subject_id in reason/resource", () => {
    const request = baseRequest();
    const input = buildAuditInput({
      decision: baseDecision({ recommended_action: "block" }),
      request,
      actorId: "actor",
      event: AMLIQ_DECISION_EVENT,
    });
    expect(input.reason).toMatch(/^max_score=\d+$/);
    expect(input.resource).not.toContain(request.subject.subject_id);
    expect(input.resource).toContain(request.subject.subject_hash);
  });

  it("block decision maps to audit decision='deny'", () => {
    const input = buildAuditInput({
      decision: baseDecision({
        recommended_action: "block",
        max_risk_score: 99,
      }),
      request: baseRequest(),
      actorId: "a",
      event: AMLIQ_DECISION_EVENT,
    });
    expect(input.decision).toBe("deny");
    expect(input.reason).toBe("max_score=99");
  });
});

describe("emitDecisionAudit — happy path", () => {
  it("calls emitter.emit exactly once with the built input and returns an audit_event_id", async () => {
    const calls: AuditInput[] = [];
    const emitter: AuditEmitter = {
      emit: vi.fn(async (input) => {
        calls.push(input);
      }),
    };
    const out = await emitDecisionAudit({
      decision: baseDecision(),
      request: baseRequest(),
      actorId: "actor",
      emitter,
    });
    expect(emitter.emit).toHaveBeenCalledTimes(1);
    expect(calls[0]?.event).toBe(AMLIQ_DECISION_EVENT);
    expect(out.audit_event_id).toBe("aud_dec_1");
  });

  it("uses a custom event name when supplied", async () => {
    const emitter: AuditEmitter = { emit: vi.fn(async () => {}) };
    await emitDecisionAudit({
      decision: baseDecision(),
      request: baseRequest(),
      actorId: "a",
      emitter,
      event: "amliq.decision.replay",
    });
    expect(emitter.emit).toHaveBeenCalledWith(
      expect.objectContaining({ event: "amliq.decision.replay" }),
    );
  });

  it("uses a custom newAuditEventId when supplied", async () => {
    const emitter: AuditEmitter = { emit: async () => {} };
    const out = await emitDecisionAudit({
      decision: baseDecision(),
      request: baseRequest(),
      actorId: "a",
      emitter,
      newAuditEventId: () => "aud_custom_xyz",
    });
    expect(out.audit_event_id).toBe("aud_custom_xyz");
  });
});

describe("emitDecisionAudit — failure modes (release-blocking)", () => {
  it("throws AuditEmitFailure when emitter is undefined (fail-closed)", async () => {
    await expect(
      emitDecisionAudit({
        decision: baseDecision(),
        request: baseRequest(),
        actorId: "a",
        emitter: undefined,
      }),
    ).rejects.toBeInstanceOf(AuditEmitFailure);
  });

  it("wraps emitter rejection in AuditEmitFailure (preserves cause)", async () => {
    const original = new Error("R2 sink unreachable");
    const emitter: AuditEmitter = {
      emit: async () => {
        throw original;
      },
    };
    const promise = emitDecisionAudit({
      decision: baseDecision(),
      request: baseRequest(),
      actorId: "a",
      emitter,
    });
    await expect(promise).rejects.toBeInstanceOf(AuditEmitFailure);
    await promise.catch((err: unknown) => {
      expect((err as AuditEmitFailure).cause).toBe(original);
      expect((err as AuditEmitFailure).name).toBe("AuditEmitFailure");
    });
  });
});
