import type { ActorId, AuditSink, EdgeAuditEvent } from "./types.js";

/**
 * Audit log emitter for the edge layer. Shape matches the swarm convention:
 *   { ts, actor_id, event, resource, decision, reason }
 *
 * `reason` MUST NOT contain PII or full tokens. Caller is responsible for
 * hashing/redacting before passing in.
 */
export function emitAudit(
  sink: AuditSink | undefined,
  e: {
    actorId: ActorId | "anonymous";
    event: string;
    resource: string;
    decision: "allow" | "deny";
    reason: string;
  },
  now: () => number = Date.now,
): void {
  if (!sink) return;
  const event: EdgeAuditEvent = {
    ts: now(),
    actorId: e.actorId,
    event: e.event,
    resource: e.resource,
    decision: e.decision,
    reason: redact(e.reason),
  };
  sink(event);
}

/**
 * Redact obvious secrets from a reason string. Conservative; the real defense
 * is at the call site (don't pass tokens here in the first place).
 */
export function redact(reason: string): string {
  let out = reason;
  // Bearer token leakage.
  out = out.replace(/Bearer\s+[A-Za-z0-9._-]+/giu, "Bearer [redacted]");
  // JWT-shaped strings (3 dot-separated base64url segments).
  out = out.replace(
    /\b[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/gu,
    "[redacted-jwt]",
  );
  return out;
}
