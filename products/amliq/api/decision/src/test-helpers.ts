/**
 * Shared test helpers. NOT shipped (excluded from coverage).
 * Kept in `src/` so vitest TS resolution stays simple; treated as test code.
 */
/* c8 ignore start */
import { vi } from "vitest";
import { createDecisionService } from "./decision-service.js";
import { createApp, type CreateAppDeps } from "./server.js";
import type {
  AuditEmitter,
  DecisionRequest,
  EngineClient,
  EngineName,
} from "./types.js";

export const okClient = (engine: EngineName, score = 30): EngineClient => ({
  engine,
  score: vi.fn(async () => ({
    engine,
    risk_score: score,
    explanations: [`${engine}.rule`],
    latency_ms: 5,
  })),
});

export const errorClient = (engine: EngineName): EngineClient => ({
  engine,
  score: vi.fn(async () => ({
    engine,
    risk_score: 0,
    explanations: [`engine.${engine}.timeout`],
    latency_ms: 200,
    error: "timeout",
  })),
});

export const validBody: DecisionRequest = {
  subject: { subject_id: "s", subject_hash: "h" },
  transaction: {
    transaction_id: "t",
    amount_minor: 1000,
    currency: "USD",
    channel: "card",
  },
  tenant_id: "tenantA",
};

export const claims = (
  overrides: Partial<{
    tenant_id: string;
    roles: readonly string[];
    sub: string;
  }> = {},
) => ({
  sub: "user_1",
  tenant_id: "tenantA",
  roles: ["aml:decision:write"],
  ...overrides,
});

export interface BuildAppOpts {
  audit?: AuditEmitter;
  verifyJwt?: CreateAppDeps["verifyJwt"];
  qb?: EngineClient;
  ml?: EngineClient;
  engineHealth?: CreateAppDeps["engineHealth"];
}

export const buildApp = (opts: BuildAppOpts = {}) => {
  const audit: AuditEmitter = opts.audit ?? { emit: async () => {} };
  const service = createDecisionService({
    engineClients: {
      quantumbeam: opts.qb ?? okClient("quantumbeam"),
      "ml-fraud": opts.ml ?? okClient("ml-fraud"),
    },
    audit,
    actorIdFor: () => "user_1",
    newDecisionId: () => "dec_test",
  });
  return createApp({
    service,
    verifyJwt: opts.verifyJwt ?? (async () => claims()),
    version: "test",
    engineHealth:
      opts.engineHealth ??
      (async () => ({
        "engine.quantumbeam": "ok",
        "engine.ml_fraud": "ok",
      })),
  });
};

export const post = async (
  app: ReturnType<typeof createApp>,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> =>
  app.request("/v1/aml/decision", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
/* c8 ignore stop */
