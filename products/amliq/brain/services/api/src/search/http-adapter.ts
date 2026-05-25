import type {
  ComplianceDoc,
  ComplianceSource,
  Jurisdiction,
} from "../../../retrieval/src/types.js";
import {
  SearchAdapterError,
  type SearchAdapter,
  type SearchAdapterHit,
  type SearchAdapterQuery,
  type SearchAdapterResult,
} from "./types.js";

export interface HttpSearchAdapterOptions {
  readonly endpoint: string;
  readonly httpFetch?: typeof fetch;
  readonly headers?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const ZERO_SHA = "0".repeat(64);
const SOURCES = new Set<ComplianceSource>([
  "fincen_rss",
  "ffiec_pdf",
  "ofac",
  "ecb",
  "fca",
  "internal",
]);
const JURISDICTIONS = new Set<Jurisdiction>([
  "US",
  "UK",
  "EU",
  "IL",
  "CA",
  "AU",
  "OTHER",
]);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const asString = (v: unknown, fallback = ""): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const asScore = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

const metaRecord = (v: unknown): Record<string, unknown> => {
  if (isRecord(v)) return v;
  if (typeof v !== "string" || v.length === 0) return {};
  try {
    const parsed = JSON.parse(v) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const sourceOf = (v: unknown): ComplianceSource => {
  const s = asString(v);
  return SOURCES.has(s as ComplianceSource) ? (s as ComplianceSource) : "internal";
};

const jurisdictionOf = (v: unknown): Jurisdiction => {
  const j = asString(v);
  return JURISDICTIONS.has(j as Jurisdiction) ? (j as Jurisdiction) : "OTHER";
};

const toDoc = (row: Record<string, unknown>): ComplianceDoc => {
  const meta = metaRecord(row.meta);
  const body = asString(row.content, asString(meta.body));
  return {
    source: sourceOf(meta.source),
    jurisdiction: jurisdictionOf(meta.jurisdiction),
    doc_id: asString(row.doc_id, asString(meta.doc_id)),
    title: asString(meta.title, asString(row.doc_id, "untitled")),
    published_at: asString(meta.published_at),
    sha256: asString(meta.sha256, ZERO_SHA),
    body,
  };
};

const toHit = (row: unknown): SearchAdapterHit => {
  if (!isRecord(row)) {
    throw new SearchAdapterError("bad_response", "bad search row");
  }
  const doc = toDoc(row);
  if (doc.doc_id.length === 0) {
    throw new SearchAdapterError("bad_response", "missing doc_id");
  }
  return {
    doc,
    snippet: asString(row.snippet, asString(row.content, doc.body).slice(0, 500)),
    score: asScore(row.score),
  };
};

const rowsFrom = (body: unknown): readonly unknown[] => {
  if (!isRecord(body)) {
    throw new SearchAdapterError("bad_response", "missing response object");
  }
  const rows = body.results ?? body.hits;
  if (!Array.isArray(rows)) {
    throw new SearchAdapterError("bad_response", "missing results");
  }
  return rows;
};

const parseJson = async (res: Response): Promise<unknown> => {
  try {
    return await res.json();
  } catch {
    throw new SearchAdapterError("bad_response", "invalid json", res.status);
  }
};

export class HttpSearchAdapter implements SearchAdapter {
  private readonly opts: HttpSearchAdapterOptions;

  constructor(opts: HttpSearchAdapterOptions) {
    this.opts = opts;
  }

  async query(q: SearchAdapterQuery): Promise<SearchAdapterResult> {
    const started = Date.now();
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
        body: JSON.stringify({
          query: q.text,
          k: q.topK,
          tenant_id: q.tenantId,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new SearchAdapterError(
          "upstream_error",
          `search runtime http ${res.status}`,
          res.status,
        );
      }
      const body = await parseJson(res);
      return {
        hits: rowsFrom(body).map(toHit),
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      if (err instanceof SearchAdapterError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new SearchAdapterError("timeout", "search runtime timeout");
      }
      throw new SearchAdapterError("network_error", "search runtime failed");
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const createHttpSearchAdapter = (
  opts: HttpSearchAdapterOptions,
): SearchAdapter => new HttpSearchAdapter(opts);
