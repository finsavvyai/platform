import { describe, expect, it, vi } from "vitest";
import {
  AuditEmitFailure,
  createDecisionService,
} from "./decision-service.js";
import type {
  AuditEmitter,
  AuditInput,
  DecisionRequest,
  EngineClient,
  EngineName,
  EngineResult,
} from "./types.js";

const subject = { subject_id: "s1", subject_hash: "h_s1" };
const txnSmall = {
  transaction_id: "t1",
  amount_minor: 1000_00, // $1,000
  currency: "USD" as const,
  channel: "card" as const,
};
const txnLarge = {
  ...txnSmall,
  transaction_id: "t2",
  amount_minor: 50_000_00,
};

const req = (overrides: Partial<DecisionRequest> = {}): DecisionRequest => ({
  subject,
  transaction: txnSmall,
  tenant_id: "tenantA",
  ...overrides,
});

const mockClient = (
  engine: EngineName,
  result: Partial<EngineResult> = {},
): EngineClient => ({
  engine,
  score: vi.fn(async () => ({
    engine,
    risk_score: 30,
    explanations: [`${engine}.rule`],
    latency_ms: 5,
    ...result,
  })),
});

const recordingAudit = (): AuditEmitter & { calls: AuditInput[] } => {
  const calls: AuditInput[] = [];
  return {
    calls,
    emit: async (input) => {
      calls.push(input);
    },
  };
};

describe("decision-service.createDecisionService", () => {
  it("small txn → router selects QB only, aggregator runs, audit emitted once", async () => {
    const qb = mockClient("quantumbeam", { risk_score: 25 });
    const ml = mockClient("ml-fraud", { risk_score: 99 });
    const audit = recordingAudit();
    const svc = createDecisionService({
      engineClients: { quantumbeam: qb, "ml-fraud": ml },
      audit,
      actorIdFor: () => "actor_1",
      newDecisionId: () => "dec_1",
      now: () => new Date("2026-01-01T00:00:00Z"),
    });

    const out = await svc.handle(req());
    expect(qb.score).toHaveBeenCalledTimes(1);
    expect(ml.score).not.toHaveBeenCalled();
    expect(out.engine_results).toHaveLength(1);
    expect(out.max_risk_score).toBe(25);
    expect(out.recommended_action).toBe("allow");
    expect(out.decision_id).toBe("dec_1");
    expect(out.tenant_id).toBe("tenantA");
    expect(out.ts).toBe("2026-01-01T00:00:00.000Z");
    expect(audit.calls).toHaveLength(1);
    expect(audit.calls[0]?.event).toBe("amliq.decision");
    expect(audit.calls[0]?.tenantId).toBe("tenantA");
    expect(audit.calls[0]?.actorId).toBe("actor_1");
    expect(audit.calls[0]?.decision).toBe("allow");
    expect(audit.calls[0]?.reason).toBe("max_score=25");
    expect(audit.calls[0]?.resource).toBe("h_s1:t1");
    expect(audit.calls[0]?.meta?.engine_results).toEqual(out.engine_results);
  });

  it("large txn → both engines run, max-score wins", async () => {
    const qb = mockClient("quantumbeam", { risk_score: 10 });
    const ml = mockClient("ml-fraud", { risk_score: 90 });
    const audit = recordingAudit();
    const svc = createDecisionService({
      engineClients: { quantumbeam: qb, "ml-fraud": ml },
      audit,
      actorIdFor: () => "actor_1",
      newDecisionId: () => "dec_2",
    });
    const out = await svc.handle(req({ transaction: txnLarge }));
    expect(qb.score).toHaveBeenCalledTimes(1);
    expect(ml.score).toHaveBeenCalledTimes(1);
    expect(out.max_risk_score).toBe(90);
    expect(out.recommended_action).toBe("block");
    expect(audit.calls[0]?.decision).toBe("deny"); // block ⇒ deny in audit
  });

  it("audit emit failure throws AuditEmitFailure", async () => {
    const qb = mockClient("quantumbeam", { risk_score: 1 });
    const ml = mockClient("ml-fraud");
    const audit: AuditEmitter = {
      emit: async () => {
        throw new Error("sink down");
      },
    };
    const svc = createDecisionService({
      engineClients: { quantumbeam: qb, "ml-fraud": ml },
      audit,
      actorIdFor: () => "actor",
      newDecisionId: () => "dec",
    });
    await expect(svc.handle(req())).rejects.toBeInstanceOf(AuditEmitFailure);
  });

  it("all engines fail → AmlDecision returned (allow + conf 0), not thrown", async () => {
    const qb: EngineClient = {
      engine: "quantumbeam",
      score: async () => ({
        engine: "quantumbeam",
        risk_score: 0,
        explanations: ["engine.quantumbeam.timeout"],
        latency_ms: 200,
        error: "timeout",
      }),
    };
    const audit = recordingAudit();
    const svc = createDecisionService({
      engineClients: {
        quantumbeam: qb,
        "ml-fraud": qb, // re-used; small txn only routes QB anyway
      },
      audit,
      actorIdFor: () => "actor",
      newDecisionId: () => "dec_x",
    });
    const out = await svc.handle(req());
    expect(out.recommended_action).toBe("allow");
    expect(out.confidence).toBe(0);
    expect(out.engine_results[0]?.error).toBe("timeout");
    expect(audit.calls).toHaveLength(1);
  });

  it("flag (40<=score<85) maps to audit.decision='allow'", async () => {
    const qb = mockClient("quantumbeam", { risk_score: 60 });
    const ml = mockClient("ml-fraud");
    const audit = recordingAudit();
    const svc = createDecisionService({
      engineClients: { quantumbeam: qb, "ml-fraud": ml },
      audit,
      actorIdFor: () => "a",
      newDecisionId: () => "d",
    });
    const out = await svc.handle(req());
    expect(out.recommended_action).toBe("flag");
    expect(audit.calls[0]?.decision).toBe("allow");
  });

  it("unconfigured engine client → stable error result, no throw", async () => {
    const qb = mockClient("quantumbeam", { risk_score: 20 });
    const audit = recordingAudit();
    const svc = createDecisionService({
      // @ts-expect-error intentionally missing ml-fraud client
      engineClients: { quantumbeam: qb },
      audit,
      actorIdFor: () => "a",
      newDecisionId: () => "d",
    });
    const out = await svc.handle(req({ transaction: txnLarge }));
    const ml = out.engine_results.find((r) => r.engine === "ml-fraud");
    expect(ml?.error).toBe("unconfigured");
  });
});
