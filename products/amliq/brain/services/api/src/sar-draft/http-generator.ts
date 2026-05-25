import type { Citation } from "../search/types.js";
import type { SarAlertInput, SarDraft, SarDraftGenerator } from "./types.js";
import { SarDraftGeneratorError } from "./types.js";

export interface HttpSarDraftGeneratorOptions {
  readonly endpoint: string;
  readonly httpFetch?: typeof fetch;
  readonly headers?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isString = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0;

const isNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

const citation = (v: unknown): Citation | null => {
  if (!isRecord(v)) return null;
  if (!isString(v.doc_id) || !isString(v.source)) return null;
  if (!isNumber(v.span_start) || !isNumber(v.span_end)) return null;
  if (v.span_start < 0 || v.span_end < 0) return null;
  return {
    doc_id: v.doc_id,
    span_start: Math.floor(v.span_start),
    span_end: Math.floor(v.span_end),
    source: v.source,
  };
};

const parseDraft = (body: unknown): SarDraft => {
  const maybeDraft = isRecord(body) && isRecord(body.draft) ? body.draft : body;
  if (!isRecord(maybeDraft)) {
    throw new SarDraftGeneratorError("bad_response", "missing draft object");
  }
  const citationsRaw = Array.isArray(maybeDraft.citations)
    ? maybeDraft.citations
    : [];
  const citations = citationsRaw.map(citation);
  if (citations.some((c) => c === null)) {
    throw new SarDraftGeneratorError("bad_response", "bad citation shape");
  }
  if (
    !isString(maybeDraft.alert_id) ||
    !isString(maybeDraft.template_id) ||
    !isString(maybeDraft.filled_text) ||
    !isNumber(maybeDraft.confidence)
  ) {
    throw new SarDraftGeneratorError("bad_response", "bad draft shape");
  }
  if (maybeDraft.human_review_required !== true) {
    throw new SarDraftGeneratorError("bad_response", "human review disabled");
  }
  return {
    alert_id: maybeDraft.alert_id,
    template_id: maybeDraft.template_id,
    filled_text: maybeDraft.filled_text,
    citations: citations as Citation[],
    confidence: maybeDraft.confidence,
    human_review_required: true,
    ...(isString(maybeDraft.audit_event_id)
      ? { audit_event_id: maybeDraft.audit_event_id }
      : {}),
  };
};

const parseJson = async (res: Response): Promise<unknown> => {
  try {
    return await res.json();
  } catch {
    throw new SarDraftGeneratorError("bad_response", "invalid json", res.status);
  }
};

export class HttpSarDraftGenerator implements SarDraftGenerator {
  private readonly opts: HttpSarDraftGeneratorOptions;

  constructor(opts: HttpSarDraftGeneratorOptions) {
    this.opts = opts;
  }

  async draft(alert: SarAlertInput): Promise<SarDraft> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    try {
      const res = await (this.opts.httpFetch ?? fetch)(this.opts.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(this.opts.headers ?? {}),
        },
        body: JSON.stringify({ alert }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new SarDraftGeneratorError(
          "upstream_error",
          `sar draft runtime http ${res.status}`,
          res.status,
        );
      }
      return parseDraft(await parseJson(res));
    } catch (err) {
      if (err instanceof SarDraftGeneratorError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new SarDraftGeneratorError("timeout", "sar draft runtime timeout");
      }
      throw new SarDraftGeneratorError("network_error", "sar draft runtime failed");
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const createHttpSarDraftGenerator = (
  opts: HttpSarDraftGeneratorOptions,
): SarDraftGenerator => new HttpSarDraftGenerator(opts);
