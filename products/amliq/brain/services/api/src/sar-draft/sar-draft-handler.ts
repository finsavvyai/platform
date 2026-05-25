import type { Context, Handler } from "hono";
import type { BrainAuditEmitter } from "../audit.js";
import { getBrainAuth } from "../auth.js";
import type {
  SarAlertInput,
  SarDraft,
  SarDraftErrorCode,
  SarDraftGenerator,
  SarDraftResponse,
} from "./types.js";

export interface SarDraftHandlerOptions {
  readonly generator: SarDraftGenerator;
  readonly audit: BrainAuditEmitter;
}

interface ParsedAlert {
  readonly ok: true;
  readonly alert: SarAlertInput;
}

interface ParseErr {
  readonly ok: false;
  readonly code: SarDraftErrorCode;
  readonly status: 400 | 403;
  readonly tenantId: string;
  readonly alertId: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const readBody = async (c: Context): Promise<Record<string, unknown> | null> => {
  try {
    const j = await c.req.json();
    return isRecord(j) ? j : null;
  } catch {
    return null;
  }
};

const stringValue = (v: unknown): string =>
  typeof v === "string" ? v.trim() : "";

const stringList = (v: unknown): readonly string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string").map((x) => x.trim())
      .filter((x) => x.length > 0)
    : [];

const parseAlert = (body: Record<string, unknown> | null): ParsedAlert | ParseErr => {
  if (body === null) {
    return { ok: false, code: "missing_alert", status: 400, tenantId: "unknown", alertId: "unknown" };
  }

  const rawAlert = isRecord(body.alert) ? body.alert : body;
  if (!isRecord(rawAlert)) {
    return { ok: false, code: "missing_alert", status: 400, tenantId: "unknown", alertId: "unknown" };
  }

  const topTenant = stringValue(body.tenant_id);
  const alertTenant = stringValue(rawAlert.tenant_id);
  const tenantId = topTenant || alertTenant;
  const alertId = stringValue(rawAlert.alert_id) || "unknown";

  if (tenantId.length === 0) {
    return { ok: false, code: "missing_tenant", status: 403, tenantId: "unknown", alertId };
  }
  if (topTenant.length > 0 && alertTenant.length > 0 && topTenant !== alertTenant) {
    return { ok: false, code: "tenant_mismatch", status: 403, tenantId, alertId };
  }
  if (alertId === "unknown") {
    return { ok: false, code: "missing_alert_id", status: 400, tenantId, alertId };
  }

  const alertType = stringValue(rawAlert.alert_type);
  if (alertType.length === 0) {
    return { ok: false, code: "missing_alert_type", status: 400, tenantId, alertId };
  }

  const amount = rawAlert.amount;
  const raw = rawAlert.raw;
  return {
    ok: true,
    alert: {
      alert_id: alertId,
      tenant_id: tenantId,
      alert_type: alertType,
      transaction_ids: stringList(rawAlert.transaction_ids),
      parties: stringList(rawAlert.parties),
      timestamps: stringList(rawAlert.timestamps),
      jurisdiction: stringValue(rawAlert.jurisdiction) || "US",
      ...(typeof amount === "number" && Number.isFinite(amount) ? { amount } : {}),
      ...(stringValue(rawAlert.currency).length > 0
        ? { currency: stringValue(rawAlert.currency) }
        : {}),
      ...(isRecord(raw) ? { raw } : {}),
    },
  };
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
    const parsed = parseAlert(await readBody(c));
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
