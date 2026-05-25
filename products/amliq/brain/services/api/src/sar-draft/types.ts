import type { Citation } from "../search/types.js";

export interface SarAlertInput {
  readonly alert_id: string;
  readonly tenant_id: string;
  readonly alert_type: string;
  readonly transaction_ids: readonly string[];
  readonly parties: readonly string[];
  readonly timestamps: readonly string[];
  readonly jurisdiction: string;
  readonly amount?: number;
  readonly currency?: string;
  readonly raw?: Readonly<Record<string, unknown>>;
}

export interface SarDraft {
  readonly alert_id: string;
  readonly template_id: string;
  readonly filled_text: string;
  readonly citations: readonly Citation[];
  readonly confidence: number;
  readonly human_review_required: true;
  readonly audit_event_id?: string;
}

export interface SarDraftGenerator {
  draft(alert: SarAlertInput): Promise<SarDraft> | SarDraft;
}

export type SarDraftGeneratorErrorCode =
  | "bad_response"
  | "network_error"
  | "timeout"
  | "upstream_error";

export class SarDraftGeneratorError extends Error {
  readonly code: SarDraftGeneratorErrorCode;
  readonly status?: number;

  constructor(
    code: SarDraftGeneratorErrorCode,
    message: string,
    status?: number,
  ) {
    super(message);
    this.name = "SarDraftGeneratorError";
    this.code = code;
    if (status !== undefined) this.status = status;
  }
}

export interface SarDraftResponse {
  readonly ok: true;
  readonly draft: SarDraft;
}

export type SarDraftErrorCode =
  | "missing_tenant"
  | "missing_alert"
  | "missing_alert_id"
  | "missing_alert_type"
  | "tenant_mismatch"
  | "agent_error"
  | "human_review_required_violation"
  | "audit_emit_failed";
