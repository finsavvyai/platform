/**
 * HTTP RetrievalAdapter — concrete implementation of the `RetrievalAdapter`
 * port (`./types.ts`) backed by the `oss/finsavvy-rag` FastAPI service.
 *
 * Conforms to the port: `query(q: RetrievalQuery): Promise<RetrievalResult>`.
 * Adds `ingest(docs)` so Brain can also push `ComplianceDoc`s into the index
 * (maps to finsavvy-rag `POST /ingest`). `ingest` is additive — every
 * consumer of the bare port keeps working with `query` alone.
 *
 * Wire contract (finsavvy-rag v0.1):
 *   POST /search  { query, k }           -> { results: [{doc_id, content, meta, score}] }
 *   POST /ingest  [{doc_id, content, meta}] -> { ok, count }
 *
 * Brain never imports the rag package directly (round-2 rule); this talks to
 * it over HTTP via an injectable `fetch`. No private keys, no eval, no
 * child_process. 200-line cap.
 */

import type {
  ComplianceDoc,
  ComplianceSource,
  Jurisdiction,
  RetrievalAdapter,
  RetrievalHit,
  RetrievalQuery,
  RetrievalResult,
} from "./types.js";
import {
  RetrievalAdapterError,
  type HttpRetrievalAdapterOptions,
  type IngestSummary,
} from "./http-types.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_TOP_K = 5;
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
  return {
    source: sourceOf(meta.source),
    jurisdiction: jurisdictionOf(meta.jurisdiction),
    doc_id: asString(row.doc_id, asString(meta.doc_id)),
    title: asString(meta.title, asString(row.doc_id, "untitled")),
    published_at: asString(meta.published_at),
    sha256: asString(meta.sha256, ZERO_SHA),
    body: asString(row.content, asString(meta.body)),
  };
};

const toHit = (row: unknown): RetrievalHit => {
  if (!isRecord(row)) {
    throw new RetrievalAdapterError("bad_response", "bad search row");
  }
  const doc = toDoc(row);
  if (doc.doc_id.length === 0) {
    throw new RetrievalAdapterError("bad_response", "missing doc_id");
  }
  const hit: { doc: ComplianceDoc; score: number; chunkIndex?: number } = {
    doc,
    score: asScore(row.score),
  };
  if (typeof row.chunk_index === "number") hit.chunkIndex = row.chunk_index;
  return hit;
};

const rowsFrom = (body: unknown): readonly unknown[] => {
  if (!isRecord(body)) {
    throw new RetrievalAdapterError("bad_response", "missing response object");
  }
  const rows = body.results ?? body.hits;
  if (!Array.isArray(rows)) {
    throw new RetrievalAdapterError("bad_response", "missing results");
  }
  return rows;
};

/** Client-side filter — finsavvy-rag v0.1 does not filter by meta. */
const matchesFilter = (q: RetrievalQuery, hit: RetrievalHit): boolean => {
  if (q.jurisdiction && hit.doc.jurisdiction !== q.jurisdiction) return false;
  if (q.source && hit.doc.source !== q.source) return false;
  return true;
};

export class HttpRetrievalAdapter implements RetrievalAdapter {
  constructor(private readonly opts: HttpRetrievalAdapterOptions) {}

  async query(q: RetrievalQuery): Promise<RetrievalResult> {
    const started = Date.now();
    const body = await this.post(this.url("/search"), {
      query: q.text,
      k: q.topK ?? DEFAULT_TOP_K,
    });
    const hits = rowsFrom(body).map(toHit).filter((h) => matchesFilter(q, h));
    return { query: q, hits, latencyMs: Date.now() - started };
  }

  /** Push docs into the index. Maps `ComplianceDoc` -> finsavvy-rag rows. */
  async ingest(docs: readonly ComplianceDoc[]): Promise<IngestSummary> {
    const items = docs.map((d) => ({
      doc_id: d.doc_id,
      content: d.body,
      meta: {
        source: d.source,
        jurisdiction: d.jurisdiction,
        title: d.title,
        published_at: d.published_at,
        sha256: d.sha256,
      },
    }));
    const body = await this.post(this.url("/ingest"), items);
    if (!isRecord(body) || body.ok !== true) {
      throw new RetrievalAdapterError("bad_response", "ingest not acknowledged");
    }
    const count = typeof body.count === "number" ? body.count : items.length;
    return { ok: true, count };
  }

  private url(path: string): string {
    return `${this.opts.baseUrl.replace(/\/+$/, "")}${path}`;
  }

  private async post(url: string, payload: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    try {
      const res = await (this.opts.httpFetch ?? fetch)(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(this.opts.headers ?? {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new RetrievalAdapterError(
          "upstream_error",
          `rag http ${res.status}`,
          res.status,
        );
      }
      try {
        return await res.json();
      } catch {
        throw new RetrievalAdapterError("bad_response", "invalid json", res.status);
      }
    } catch (err) {
      if (err instanceof RetrievalAdapterError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new RetrievalAdapterError("timeout", "rag timeout");
      }
      throw new RetrievalAdapterError("network_error", "rag request failed");
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const createHttpRetrievalAdapter = (
  opts: HttpRetrievalAdapterOptions,
): HttpRetrievalAdapter => new HttpRetrievalAdapter(opts);
