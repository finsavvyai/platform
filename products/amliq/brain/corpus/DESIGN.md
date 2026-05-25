# AMLIQ Brain — Compliance Corpus Ingest Pipeline — Design

Status: design + skeleton. Round 4 / Brain Week 2 / Stream A row 1
(`decisive_plan_90day.md`).

Authority: portfolio CLAUDE.md, `products/amliq/CLAUDE.md`,
`brain-week2-conventions.md`, `swarm-conventions.md`.

## 1. Purpose

Pull regulatory + supervisory documents from authoritative sources (US
first per locked decision #2), normalise them into a single
`ComplianceDoc` shape, deduplicate, and hand the deltas to the
`oss/finsavvy-rag` indexer for embedding + pgvector storage.

The pipeline is the *producer*. It does **not** own embeddings,
pgvector, or retrieval. Those live in `oss/finsavvy-rag/`.

## 2. Sources (v1)

| Source | Kind | Cadence | Notes |
|---|---|---|---|
| FinCEN Advisories | RSS / Atom feed | hourly | Primary regulatory delta stream for US AML |
| FFIEC BSA/AML Handbook | PDF (set of static URLs) | weekly | Foundational supervisory guidance |

Both source URLs come from env vars (`FINCEN_RSS_URL`,
`FFIEC_BASE_URL`); no hard-coded production URLs in source.

Out of scope this pass: EU AMLR, UK FCA, OFAC sanctions lists (latter
lives in `products/amliq/api/` per round-4 CLAUDE.md).

## 3. ComplianceDoc shape (cross-agent contract)

```ts
interface ComplianceDoc {
  source:        string;   // "fincen-rss" | "ffiec-pdf"
  jurisdiction:  string;   // ISO 3166-1 alpha-2; "US" for v1
  doc_id:        string;   // stable source-given id (RSS guid, URL slug)
  title:         string;
  published_at:  string;   // ISO-8601 from source; ingester does not invent one
  sha256:        string;   // hex digest of normalised body
  body:          string;   // plain-text body, fetcher-normalised
}
```

Frozen by Brain Week 2 conventions §3. `RAG-OSS-PREP` indexer accepts
this shape exactly.

## 4. Pipeline architecture

```
[FinCEN RSS fetcher]   ─┐
[FFIEC PDF  fetcher]   ─┤
   ...                   ├─► dedupe(existingSha256Set)
                        ─┘         │
                                   ▼
                          Indexer.index(docs)
                                   │
                                   ▼
                  AuditEmitter.emit(per-doc record)
```

- Fetchers are pure: take a `SourceConfig`, return `ComplianceDoc[]`
  plus a structured error array. They never throw on a single bad
  record; they skip and report.
- Dedupe is a pure function over `sha256` only. Title or
  published_at drift does NOT create a new record — sha256 of body is
  the source of truth.
- Orchestrator (`pipeline.ts`) is the only stateful piece. It accepts
  injected `Indexer` and `AuditEmitter`. No singletons, no module-
  scope side effects.

## 5. Indexing (delegated)

The `Indexer` interface this pipeline depends on:

```ts
interface Indexer { index(docs: ComplianceDoc[]): Promise<void>; }
```

Real implementation lives in `oss/finsavvy-rag/`. This package never
imports finsavvy-rag directly; the brain wiring layer injects it.

## 6. Versioning policy

- `published_at` is the source-truth timestamp; we never override it.
- `ingested_at` is recorded by the audit emitter (audit record carries
  `ts` per round-1 convention). The `ComplianceDoc` itself does NOT
  carry `ingested_at` — that is provenance, not content.
- If the same `doc_id` reappears with a different sha256, the new
  document is treated as a new version. The indexer is responsible for
  keeping prior versions queryable; this pipeline only emits the new
  version. Audit record carries the old sha256 in `meta.previous_sha256`
  when known.

## 7. Deduplication

- `dedupe(docs, existingShaSet)` filters out any doc whose sha256 is
  already known. Pure, deterministic, O(n).
- Caller owns the `existingShaSet` (the indexer typically supplies it).
- 100 % coverage required (gate on data integrity).

## 8. Retry on transient errors

- Fetchers use Web `fetch` (Node 20+). Network errors and 5xx responses
  are retried with exponential backoff: 3 attempts, base 500 ms, cap
  4 s, jitter ±20 %.
- 4xx responses are **not** retried — they indicate a contract change
  and surface as `IngestResult.errors[]` for human triage.
- Per-document parse errors never abort the batch; they accumulate in
  `IngestResult.errors[]` so the pipeline still indexes the good ones.

## 9. Audit-log emit (per ingested doc)

Every doc that *successfully passes dedupe and reaches the indexer*
emits one audit record. Shape follows round-1 + AMLIQ extensions:

```json
{
  "ts":       "<ISO-8601>",
  "actor_id": "corpus-pipeline",
  "event":    "brain.corpus.ingest",
  "resource": "<source>:<doc_id>",
  "decision": "indexed",
  "reason":   "new_document",
  "meta": {
    "sha256":       "<hex>",
    "jurisdiction": "US",
    "published_at": "<ISO-8601>",
    "title_hash":   "<hex>"
  }
}
```

- `reason` is a stable code. No PII (regulatory docs are public, but
  the convention still holds).
- The audit emitter is injected (no in-process import of
  `@finsavvyai/telemetry` from `products/*` per round-2 rule).
- Audit emit failure logs and is surfaced in `IngestResult.errors[]`
  but does NOT block the rest of the batch — the indexer write is the
  irreversible step and has already happened.

## 10. Test strategy

| File | Coverage requirement | Approach |
|---|---|---|
| `dedupe.test.ts` | **100 %** line + branch | Pure-function table tests |
| `pipeline.test.ts` | **100 %** line + branch | Mock fetcher/indexer/audit, verify ordering + counts |
| `fincen-rss.test.ts` | ≥ 95 % line | Mocked `fetch`, synthetic RSS fixture inline |
| `ffiec-pdf.test.ts` | (skeleton only) | PDF parsing TODO — stubbed |

No network. No real PDF parsing. Fixtures are inline strings.

## 11. Out of scope

- pgvector indexing (lives in `oss/finsavvy-rag/`).
- Actual PDF text extraction lib choice (deferred to next pass).
- EU/UK sources (locked decision #2 — M7+).
- Sanctions list ingestion (lives in `products/amliq/api/`).
- Tamper-evident hash chaining of audit (AUDIT-TAMPER owns).
