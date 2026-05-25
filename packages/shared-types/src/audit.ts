/**
 * Audit-event contract.
 *
 * Matches the shape mandated by `/tmp/finsavvyai-swarm-conventions.md`
 * (audit-log convention) and extended by `products/amliq/CLAUDE.md`
 * (AMLIQ-specific fields: engine_versions, scores).
 */

import type { ActorId, AuditId, EngineVersion } from "./ids.js";
import type { Decision, EngineName, Score } from "./aml.js";

/** ISO-8601 timestamp string. */
export type IsoTimestamp = string;

export type AuditEventKind =
  | "aml.score"
  | "aml.investigate.open"
  | "aml.case.update"
  | "auth.login"
  | "auth.logout"
  | "admin.action";

export interface AuditEventBase {
  readonly id: AuditId;
  readonly ts: IsoTimestamp;
  readonly actorId: ActorId;
  readonly event: AuditEventKind;
  /** Stable resource identifier — case id, subject hash, etc. No PII. */
  readonly resource: string;
  readonly decision: Decision | "n/a";
  /** Stable reason code. No PII, no tokens, no full emails. */
  readonly reason: string;
}

export interface AmlScoreAuditEvent extends AuditEventBase {
  readonly event: "aml.score";
  readonly engineVersions: Readonly<Record<EngineName, EngineVersion>>;
  readonly scores: Readonly<Record<EngineName | "blended", Score>>;
}

export type AuditEvent = AuditEventBase | AmlScoreAuditEvent;

export const isAmlScoreAuditEvent = (
  event: AuditEvent,
): event is AmlScoreAuditEvent => event.event === "aml.score";
