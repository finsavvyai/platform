/**
 * Corpus ingest pipeline orchestrator.
 *
 * Pure composition: fetch all sources → dedupe → index → audit per doc.
 * No singletons. All collaborators are injected — this file does not
 * import any `@finsavvyai/*` package (round-2 rule for products/*).
 *
 * Critical-path coverage: 100 % line + branch.
 */

import { createHash } from "node:crypto";
import { dedupe } from "./dedupe.js";
import type {
  AuditEmitter,
  AuditRecord,
  ComplianceDoc,
  Fetcher,
  IngestError,
  IngestResult,
  Indexer,
  SourceConfig,
} from "./types.js";

export interface PipelineSource {
  readonly cfg: SourceConfig;
  readonly fetcher: Fetcher;
}

export interface PipelineDeps {
  readonly indexer: Indexer;
  readonly audit: AuditEmitter;
  /** Override clock for tests. Defaults to `() => new Date().toISOString()`. */
  readonly now?: () => string;
}

const ACTOR = "corpus-pipeline";
const EVENT = "brain.corpus.ingest";

function hashTitle(title: string): string {
  return createHash("sha256").update(title, "utf8").digest("hex");
}

function buildRecord(doc: ComplianceDoc, ts: string): AuditRecord {
  return {
    ts,
    actor_id: ACTOR,
    event: EVENT,
    resource: `${doc.source}:${doc.doc_id}`,
    decision: "indexed",
    reason: "new_document",
    meta: {
      sha256: doc.sha256,
      jurisdiction: doc.jurisdiction,
      published_at: doc.published_at,
      title_hash: hashTitle(doc.title),
    },
  };
}

async function runFetchers(
  sources: readonly PipelineSource[],
): Promise<{ docs: ComplianceDoc[]; errors: IngestError[] }> {
  const docs: ComplianceDoc[] = [];
  const errors: IngestError[] = [];
  for (const s of sources) {
    const r = await s.fetcher(s.cfg);
    docs.push(...r.docs);
    errors.push(...r.errors);
  }
  return { docs, errors };
}

async function emitAudits(
  docs: readonly ComplianceDoc[],
  audit: AuditEmitter,
  now: () => string,
  errors: IngestError[],
): Promise<number> {
  let audited = 0;
  for (const doc of docs) {
    try {
      await audit.emit(buildRecord(doc, now()));
      audited += 1;
    } catch (err) {
      errors.push({
        source: doc.source,
        stage: "audit",
        code: "audit_emit_failed",
        message: err instanceof Error ? err.message : "unknown",
      });
    }
  }
  return audited;
}

/**
 * Run the pipeline once. Returns an `IngestResult` with counts and
 * accumulated errors. Never throws on per-source or per-doc errors;
 * only throws if the injected indexer itself rejects (data loss risk).
 */
export async function runPipeline(
  sources: readonly PipelineSource[],
  deps: PipelineDeps,
): Promise<IngestResult> {
  const now = deps.now ?? ((): string => new Date().toISOString());
  const { docs: fetched, errors } = await runFetchers(sources);

  const known = await deps.indexer.knownShas();
  const fresh = dedupe(fetched, known);

  if (fresh.length === 0) {
    return {
      fetched: fetched.length,
      deduped: 0,
      indexed: 0,
      audited: 0,
      errors,
    };
  }

  await deps.indexer.index(fresh);
  const audited = await emitAudits(fresh, deps.audit, now, errors);

  return {
    fetched: fetched.length,
    deduped: fresh.length,
    indexed: fresh.length,
    audited,
    errors,
  };
}
