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
import { route } from "./router.js";
import type {
  AmlDecision,
  AuditEmitter,
  DecisionRequest,
  EngineClient,
  EngineName,
  EngineResult,
} from "./types.js";

export class AuditEmitFailure extends Error {
  constructor(public readonly cause: unknown) {
    super("audit emit failed");
    this.name = "AuditEmitFailure";
  }
}

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

const resourceFor = (request: DecisionRequest): string =>
  `${request.subject.subject_hash}:${request.transaction.transaction_id}`;

const auditDecisionFor = (
  action: "allow" | "flag" | "block",
): "allow" | "deny" | "error" => {
  if (action === "block") return "deny";
  return "allow"; // flag and allow both pass the gate, just with review hint
};

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

    try {
      await deps.audit.emit({
        actorId: deps.actorIdFor(request),
        tenantId: request.tenant_id,
        event: "amliq.decision",
        resource: resourceFor(request),
        decision: auditDecisionFor(agg.recommended_action),
        reason: `max_score=${agg.max_risk_score}`,
        meta: {
          decision_id: decisionId,
          request_id: requestId,
          recommended_action: agg.recommended_action,
          partial: agg.partial,
          confidence: agg.confidence,
          engine_results: engineResults,
        },
      });
    } catch (err) {
      // Release-blocking: caller must convert this to 503.
      throw new AuditEmitFailure(err);
    }

    return decision;
  };

  return { handle };
};

export type DecisionService = ReturnType<typeof createDecisionService>;
