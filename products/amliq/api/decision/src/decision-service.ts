/**
 * DecisionService — orchestrator.
 *
 *  router(request) → engines[]
 *  → parallel engine calls (Promise.all)
 *  → aggregator(results) → action + confidence + max score
 *  → audit.emit({ event: "amliq.decision", ... })  ← release-blocking
 *  → return AmlDecision
 *
 * Audit emit failure throws `AuditEmitFailure`. The HTTP layer (server.ts)
 * MUST translate that to 503 — per AMLIQ CLAUDE.md a decision that cannot be
 * audited MUST NOT be served.
 */

import { aggregate } from "./aggregator.js";
import { emitDecisionAudit } from "./audit.js";
import { route } from "./router.js";
import type {
  AmlDecision,
  AuditEmitter,
  DecisionRequest,
  EngineClient,
  EngineName,
  EngineResult,
} from "./types.js";

// Re-export for backwards compatibility — server.ts and consumers import
// AuditEmitFailure from decision-service.js. Single source of truth is
// `./audit.js`.
export { AuditEmitFailure } from "./audit.js";

export interface DecisionServiceDeps {
  readonly engineClients: Readonly<Record<EngineName, EngineClient>>;
  readonly audit: AuditEmitter;
  readonly actorIdFor: (request: DecisionRequest) => string;
  readonly newDecisionId: () => string;
  readonly newRequestId?: (request: DecisionRequest) => string;
  readonly now?: () => Date;
  /** Wall-clock cap for the overall request, in ms. */
  readonly overallTimeoutMs?: number;
}

const DEFAULT_OVERALL_TIMEOUT_MS = 250;

export const createDecisionService = (deps: DecisionServiceDeps) => {
  const now = deps.now ?? (() => new Date());
  const overallTimeoutMs =
    deps.overallTimeoutMs ?? DEFAULT_OVERALL_TIMEOUT_MS;

  const handle = async (request: DecisionRequest): Promise<AmlDecision> => {
    const requestId =
      deps.newRequestId?.(request) ?? `req_${deps.newDecisionId()}`;
    const decisionId = deps.newDecisionId();
    const ts = now().toISOString();

    const enginesSelected = route(request);
    const controller = new AbortController();
    const overallTimer = setTimeout(
      () => controller.abort(),
      overallTimeoutMs,
    );

    let engineResults: readonly EngineResult[];
    try {
      engineResults = await Promise.all(
        enginesSelected.map((name) => {
          const client = deps.engineClients[name];
          // Defensive: an undefined client (DI bug) becomes a stable error
          // result rather than a thrown exception.
          if (!client) {
            return Promise.resolve<EngineResult>({
              engine: name,
              risk_score: 0,
              explanations: [`engine.${name}.unconfigured`],
              latency_ms: 0,
              error: "unconfigured",
            });
          }
          return client.score(request, controller.signal);
        }),
      );
    } finally {
      clearTimeout(overallTimer);
    }

    const agg = aggregate(engineResults);

    const decision: AmlDecision = {
      decision_id: decisionId,
      request_id: requestId,
      tenant_id: request.tenant_id,
      ts,
      max_risk_score: agg.max_risk_score,
      engine_results: engineResults,
      aggregated_explanation: agg.aggregated_explanation,
      recommended_action: agg.recommended_action,
      confidence: agg.confidence,
      partial: agg.partial,
    };

    // Release-blocking: audit-emit failure throws AuditEmitFailure; caller
    // (server.ts) MUST translate that to 503.
    await emitDecisionAudit({
      decision,
      request,
      actorId: deps.actorIdFor(request),
      emitter: deps.audit,
    });

    return decision;
  };

  return { handle };
};

export type DecisionService = ReturnType<typeof createDecisionService>;
// Type re-export used by `Promise<void>` declarations consuming the original
// surface — keep the public API stable.
export type { AuditEmitter };
