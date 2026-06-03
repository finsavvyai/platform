import { z } from "zod";
import type { SarAlertInput } from "./types.js";

type SarDraftRequestErrorCode =
  | "missing_tenant"
  | "missing_alert"
  | "missing_alert_id"
  | "missing_alert_type"
  | "tenant_mismatch";

export type ParsedSarDraftRequest =
  | { readonly ok: true; readonly alert: SarAlertInput }
  | {
      readonly ok: false;
      readonly code: SarDraftRequestErrorCode;
      readonly status: 400 | 403;
      readonly tenantId: string;
      readonly alertId: string;
    };

const bodySchema = z.record(z.unknown());
const alertSchema = z.object({
  alert_id: z.string().trim().optional(),
  tenant_id: z.string().trim().optional(),
  alert_type: z.string().trim().optional(),
  transaction_ids: z.array(z.string().trim()).optional(),
  parties: z.array(z.string().trim()).optional(),
  timestamps: z.array(z.string().trim()).optional(),
  jurisdiction: z.string().trim().optional(),
  amount: z.number().finite().optional(),
  currency: z.string().trim().optional(),
  raw: z.record(z.unknown()).optional(),
}).passthrough();

const nonEmpty = (values: readonly string[] | undefined): readonly string[] =>
  values?.filter((v) => v.length > 0) ?? [];

const fail = (
  code: SarDraftRequestErrorCode,
  status: 400 | 403,
  tenantId = "unknown",
  alertId = "unknown",
): ParsedSarDraftRequest => ({ ok: false, code, status, tenantId, alertId });

export const parseSarDraftRequest = (
  body: unknown,
): ParsedSarDraftRequest => {
  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) return fail("missing_alert", 400);

  const bodyData = parsedBody.data;
  const rawAlert = bodyData.alert ?? bodyData;
  const parsedAlert = alertSchema.safeParse(rawAlert);
  if (!parsedAlert.success) return fail("missing_alert", 400);

  const alert = parsedAlert.data;
  const topTenant = typeof bodyData.tenant_id === "string"
    ? bodyData.tenant_id.trim()
    : "";
  const alertTenant = alert.tenant_id ?? "";
  const tenantId = topTenant || alertTenant;
  const alertId = alert.alert_id || "unknown";

  if (tenantId.length === 0) {
    return fail("missing_tenant", 403, "unknown", alertId);
  }
  if (topTenant.length > 0 && alertTenant.length > 0 && topTenant !== alertTenant) {
    return fail("tenant_mismatch", 403, tenantId, alertId);
  }
  if (alertId === "unknown") {
    return fail("missing_alert_id", 400, tenantId, alertId);
  }
  if (!alert.alert_type || alert.alert_type.length === 0) {
    return fail("missing_alert_type", 400, tenantId, alertId);
  }

  return {
    ok: true,
    alert: {
      alert_id: alertId,
      tenant_id: tenantId,
      alert_type: alert.alert_type,
      transaction_ids: nonEmpty(alert.transaction_ids),
      parties: nonEmpty(alert.parties),
      timestamps: nonEmpty(alert.timestamps),
      jurisdiction: alert.jurisdiction || "US",
      ...(alert.amount !== undefined ? { amount: alert.amount } : {}),
      ...(alert.currency && alert.currency.length > 0
        ? { currency: alert.currency }
        : {}),
      ...(alert.raw !== undefined ? { raw: alert.raw } : {}),
    },
  };
};
