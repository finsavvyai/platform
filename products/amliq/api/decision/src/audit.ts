/**
 * AMLIQ Investigate audit emit — dedicated, 100%-covered module.
 *
 * Per `products/amliq/CLAUDE.md` §"Audit log requirements" the decision API
 * MUST emit exactly one audit record per scoring decision, and emit failure
 * MUST block the response. This module owns the audit-emit boundary so the
 * shape, the PII-free guarantees, and the failure mode each have a single,
 * dedicated test surface — separate from the engine/aggregator orchestration
 * in `decision-service.ts`.
 *
 * Surface:
 *   `emitDecisionAudit({ decision, request, emitter }) → Promise<{ audit_event_id }>`
 *
 * Contract:
 *   - actorId, tenantId come from caller-supplied `actorId` + the request's
 *     `tenant_id` (never hard-coded; never derived from PII).
 *   - resource = `<subjectHash>:<transactionId>` — both already PII-hashed at
 *     the request boundary (Subject.subject_hash is the hash, not the name).
 *   - decision is mapped from `recommended_action`:
 *       block → "deny"; flag → "allow"; allow → "allow".
 *   - reason is a stable code: `max_score=<int>`. Never free-form PII.
 *   - meta carries decision_id, request_id, recommended_action, partial,
 *     confidence, and the array of EngineResults. Engine results are already
 *     PII-free (engines see only `subject_hash`, never plaintext name).
 *   - Missing emitter throws `AuditEmitFailure` immediately (DI bug → fail-
 *     closed; we do NOT serve a decision without an audit channel).
 *   - emitter.emit() rejection wraps the cause in `AuditEmitFailure` so the
 *     HTTP layer can translate to 503.
 */

import type {
  AmlDecision,
  AuditEmitter,
  AuditInput,
  DecisionRequest,
  RecommendedAction,
} from "./types.js";

export class AuditEmitFailure extends Error {
  constructor(public readonly cause: unknown) {
    super("audit emit failed");
    this.name = "AuditEmitFailure";
  }
}

export const AMLIQ_DECISION_EVENT = "amliq.decision";

export interface EmitDecisionAuditArgs {
  readonly decision: AmlDecision;
  readonly request: DecisionRequest;
  readonly actorId: string;
  readonly emitter: AuditEmitter | undefined;
  /** Override the event name (default `amliq.decision`). */
  readonly event?: string;
  /** Returns the audit-event id to surface back to the caller. */
  readonly newAuditEventId?: () => string;
}

export interface EmitDecisionAuditResult {
  readonly audit_event_id: string;
}

export const resourceFor = (request: DecisionRequest): string =>
  `${request.subject.subject_hash}:${request.transaction.transaction_id}`;

export const auditDecisionFor = (
  action: RecommendedAction,
): AuditInput["decision"] => {
  if (action === "block") return "deny";
  // flag and allow both pass the gate, just with review hint
  return "allow";
};

export const buildAuditInput = (
  args: Pick<EmitDecisionAuditArgs, "decision" | "request" | "actorId"> & {
    readonly event: string;
  },
): AuditInput => {
  const { decision, request, actorId, event } = args;
  return {
    actorId,
    tenantId: request.tenant_id,
    event,
    resource: resourceFor(request),
    decision: auditDecisionFor(decision.recommended_action),
    reason: `max_score=${decision.max_risk_score}`,
    meta: {
      decision_id: decision.decision_id,
      request_id: decision.request_id,
      recommended_action: decision.recommended_action,
      partial: decision.partial,
      confidence: decision.confidence,
      engine_results: decision.engine_results,
    },
  };
};

export const emitDecisionAudit = async (
  args: EmitDecisionAuditArgs,
): Promise<EmitDecisionAuditResult> => {
  if (!args.emitter) {
    throw new AuditEmitFailure(new Error("audit emitter not configured"));
  }
  const event = args.event ?? AMLIQ_DECISION_EVENT;
  const input = buildAuditInput({
    decision: args.decision,
    request: args.request,
    actorId: args.actorId,
    event,
  });
  try {
    await args.emitter.emit(input);
  } catch (err) {
    throw new AuditEmitFailure(err);
  }
  const id = args.newAuditEventId
    ? args.newAuditEventId()
    : `aud_${args.decision.decision_id}`;
  return { audit_event_id: id };
};
