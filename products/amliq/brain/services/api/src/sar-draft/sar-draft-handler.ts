import type { Context, Handler } from "hono";
import type { BrainAuditEmitter } from "../audit.js";
import { getBrainAuth } from "../auth.js";
import { parseSarDraftRequest } from "./request-schema.js";
import type {
  SarDraft,
  SarDraftErrorCode,
  SarDraftGenerator,
  SarDraftResponse,
} from "./types.js";

export interface SarDraftHandlerOptions {
  readonly generator: SarDraftGenerator;
  readonly audit: BrainAuditEmitter;
}

const readBody = async (c: Context): Promise<unknown> => {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
};

const denyJson = (
  c: Context,
  code: SarDraftErrorCode,
  status: 400 | 403 | 503,
): Response => c.json({ ok: false, error: code }, status);

const auditOrFail = async (
  audit: BrainAuditEmitter,
  actorId: string,
  tenantId: string,
  alertId: string,
  decision: "allow" | "deny" | "error",
  reason: string,
  draft?: SarDraft,
): Promise<boolean> => {
  const r = await audit.emit({
    actorId,
    event: "brain.sar_draft.generate",
    resource: `brain:sar-draft:${tenantId}:${alertId}`,
    decision,
    reason,
    meta: {
      ...(draft ? { template_id: draft.template_id, confidence: draft.confidence } : {}),
      human_review_required: draft?.human_review_required === true,
    },
  });
  return r.delivered || r.fallbackUsed;
};

export const buildSarDraftHandler = (opts: SarDraftHandlerOptions): Handler =>
  async (c: Context): Promise<Response> => {
    const { claims } = getBrainAuth(c);
    const parsed = parseSarDraftRequest(await readBody(c));
    if (!parsed.ok) {
      const audited = await auditOrFail(
        opts.audit,
        claims.sub,
        parsed.tenantId,
        parsed.alertId,
        "deny",
        parsed.code,
      );
      if (!audited) return denyJson(c, "audit_emit_failed", 503);
      return denyJson(c, parsed.code, parsed.status);
    }

    let draft: SarDraft;
    try {
      draft = await opts.generator.draft(parsed.alert);
    } catch {
      const audited = await auditOrFail(
        opts.audit,
        claims.sub,
        parsed.alert.tenant_id,
        parsed.alert.alert_id,
        "error",
        "agent_error",
      );
      if (!audited) return denyJson(c, "audit_emit_failed", 503);
      return denyJson(c, "agent_error", 503);
    }

    if (draft.human_review_required !== true) {
      const audited = await auditOrFail(
        opts.audit,
        claims.sub,
        parsed.alert.tenant_id,
        parsed.alert.alert_id,
        "error",
        "human_review_required_violation",
        draft,
      );
      if (!audited) return denyJson(c, "audit_emit_failed", 503);
      return denyJson(c, "human_review_required_violation", 503);
    }

    const audited = await auditOrFail(
      opts.audit,
      claims.sub,
      parsed.alert.tenant_id,
      parsed.alert.alert_id,
      "allow",
      "generated",
      draft,
    );
    if (!audited) return denyJson(c, "audit_emit_failed", 503);

    const resp: SarDraftResponse = { ok: true, draft };
    return c.json(resp, 200);
  };
