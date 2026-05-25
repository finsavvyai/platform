# @amliq/brain-corpus

Compliance corpus ingest pipeline for **AMLIQ Brain**.

This package is the *producer* of `ComplianceDoc` records. It does not
own embeddings, pgvector, or retrieval — those live in
[`oss/finsavvy-rag`](../../../../oss/finsavvy-rag/).

Full design: [`DESIGN.md`](./DESIGN.md).

## Scope (v1)

- FinCEN Advisories (RSS) — primary regulatory delta stream for US AML.
- FFIEC BSA/AML Handbook (PDF) — skeleton only; PDF extraction is a
  follow-up ticket (TODO in `src/fetchers/ffiec-pdf.ts`).

US-only per locked decision #2 of `decisive_plan_90day.md`. EU + UK
land M7+.

## Cross-agent contract

`ComplianceDoc` shape is frozen by Brain Week 2 conventions §3. Do not
add fields without coordinating with `RAG-OSS-PREP`:

```ts
interface ComplianceDoc {
  source:       string; // "fincen-rss" | "ffiec-pdf"
  jurisdiction: string; // ISO 3166-1 alpha-2 ("US")
  doc_id:       string;
  title:        string;
  published_at: string; // ISO-8601 from source
  sha256:       string; // hex digest of body
  body:         string; // plain text
}
```

## Usage

```ts
import {
  runPipeline,
  fincenRss,
  ffiecPdf,
  type Indexer,
  type AuditEmitter,
} from "@amliq/brain-corpus";

const sources = [
  {
    cfg: {
      source: "fincen-rss",
      jurisdiction: "US",
      url: process.env.FINCEN_RSS_URL!,
    },
    fetcher: fincenRss,
  },
  {
    cfg: {
      source: "ffiec-pdf",
      jurisdiction: "US",
      url: process.env.FFIEC_BASE_URL!, // comma-separated handbook URLs
    },
    fetcher: ffiecPdf,
  },
];

const indexer: Indexer = /* injected by brain wiring, backed by oss/finsavvy-rag */;
const audit: AuditEmitter = /* injected, backed by AUDIT-TAMPER */;

const result = await runPipeline(sources, { indexer, audit });
// → { fetched, deduped, indexed, audited, errors }
```

## Required env vars

| Var | Purpose | Default |
|---|---|---|
| `FINCEN_RSS_URL` | FinCEN advisories RSS endpoint | none — required by caller |
| `FFIEC_BASE_URL` | Comma-separated list of FFIEC handbook PDF URLs | none — required by caller |

The package itself reads no env vars. Configuration is injected via
`SourceConfig`. The variable names above are the convention the brain
wiring layer should use.

## Audit-log emit

Every successfully indexed doc emits one audit record:

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

`reason` is PII-free per AMLIQ rules.

## Tests

```bash
pnpm install           # local install — package is NOT in pnpm-workspace.yaml
pnpm test              # vitest
pnpm test:coverage     # with coverage report
```

Coverage gates (see `vitest.config.ts`):

- Overall: lines ≥ 90, branches ≥ 85, functions ≥ 90.
- **100 %** line + branch on `src/dedupe.ts` and `src/pipeline.ts`
  (data-integrity critical paths per DESIGN.md §10).

No network calls in tests. No real PDF parsing. All fixtures are
synthetic and inline.

## Engineering rules in force

- 200-line cap per file (portfolio rule).
- TS strict. No `any`.
- ESM only, Node 20+.
- Web `fetch` (no axios/got).
- No `@finsavvyai/*` imports — `Indexer` and `AuditEmitter` are injected
  interfaces (round-2 rule for `products/*`).

## Out of scope (deliberate)

- pgvector indexing (lives in `oss/finsavvy-rag/`).
- Tamper-evident hash chaining (lives in `packages/telemetry/src/audit-tamper/`).
- EU/UK source ingestion (M7+).
- Sanctions list ingestion (lives in `products/amliq/api/`).
- Retry/backoff implementation — design is documented in DESIGN.md §8;
  implementation is a next-pass ticket once Brain wiring exists.
