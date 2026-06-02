import type {
  AuditEvent,
  AuditEventInput,
  AuditLog,
  AuditQuery,
} from "./types.js";

/**
 * Build a canonical {@link AuditEvent} from caller-supplied fields, filling
 * the generated `id` and `timestamp` and defaulting correlation/metadata.
 * Centralizing construction keeps emitted events uniform across packages.
 */
export const makeAuditEvent = (input: AuditEventInput): AuditEvent => ({
  id: crypto.randomUUID(),
  timestamp: Date.now(),
  actor: input.actor,
  action: input.action,
  resource: input.resource,
  outcome: input.outcome,
  traceId: input.traceId,
  metadata: input.metadata ?? {},
});

/** In-memory reference {@link AuditLog}. Replace with a durable adapter in production. */
export class InMemoryAuditLog implements AuditLog {
  readonly events: AuditEvent[] = [];

  async record(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }

  query(filter: AuditQuery = {}): readonly AuditEvent[] {
    return this.events.filter((e) => {
      if (filter.actor !== undefined && e.actor !== filter.actor) return false;
      if (filter.action !== undefined && e.action !== filter.action) return false;
      if (filter.outcome !== undefined && e.outcome !== filter.outcome) return false;
      if (filter.since !== undefined && e.timestamp < filter.since) return false;
      if (filter.until !== undefined && e.timestamp > filter.until) return false;
      return true;
    });
  }
}
