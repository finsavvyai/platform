import { describe, expect, it, vi } from "vitest";
import { runPipeline, type PipelineSource } from "./pipeline.js";
import type { AuditEmitter, AuditRecord, ComplianceDoc, Indexer } from "./types.js";
import {
  FIXED_NOW,
  makeAudit,
  makeDoc,
  makeIndexer,
  makeSource,
} from "./_test-helpers.js";

describe("runPipeline", () => {
  it("fans out across 3 sources, dedupes, indexes deltas, audits each", async () => {
    const sources: PipelineSource[] = [
      makeSource(
        { source: "fincen-rss", jurisdiction: "US", url: "u1" },
        { docs: [makeDoc("fincen-rss", "sha-A"), makeDoc("fincen-rss", "sha-B")], errors: [] },
      ),
      makeSource(
        { source: "ffiec-pdf", jurisdiction: "US", url: "u2" },
        { docs: [makeDoc("ffiec-pdf", "sha-C")], errors: [] },
      ),
      makeSource(
        { source: "other", jurisdiction: "US", url: "u3" },
        { docs: [makeDoc("other", "sha-A")], errors: [] }, // dup vs source 1
      ),
    ];
    const indexer = makeIndexer(new Set(["sha-B"])); // B already known
    const audit = makeAudit();

    const result = await runPipeline(sources, { indexer, audit, now: FIXED_NOW });

    expect(result.fetched).toBe(4);
    expect(result.deduped).toBe(2);
    expect(result.indexed).toBe(2);
    expect(result.audited).toBe(2);
    expect(result.errors).toEqual([]);

    expect(indexer.index).toHaveBeenCalledOnce();
    const indexed = indexer.index.mock.calls[0][0] as ComplianceDoc[];
    expect(indexed.map((d) => d.sha256)).toEqual(["sha-A", "sha-C"]);

    expect(audit.emit).toHaveBeenCalledTimes(2);
    const first = audit.emit.mock.calls[0][0] as AuditRecord;
    expect(first).toMatchObject({
      ts: "2026-05-25T00:00:00.000Z",
      actor_id: "corpus-pipeline",
      event: "brain.corpus.ingest",
      resource: "fincen-rss:sha-A",
      decision: "indexed",
      reason: "new_document",
    });
    expect(first.meta.sha256).toBe("sha-A");
    expect(first.meta.jurisdiction).toBe("US");
    expect(first.meta.title_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("propagates fetcher errors but still indexes the good docs", async () => {
    const sources: PipelineSource[] = [
      makeSource(
        { source: "fincen-rss", jurisdiction: "US", url: "u1" },
        {
          docs: [makeDoc("fincen-rss", "sha-A")],
          errors: [
            { source: "fincen-rss", stage: "parse", code: "missing_field", message: "x" },
          ],
        },
      ),
    ];
    const indexer = makeIndexer();
    const audit = makeAudit();

    const result = await runPipeline(sources, { indexer, audit, now: FIXED_NOW });
    expect(result.indexed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ code: "missing_field" });
  });

  it("short-circuits indexing + auditing when no fresh docs survive dedupe", async () => {
    const sources: PipelineSource[] = [
      makeSource(
        { source: "fincen-rss", jurisdiction: "US", url: "u1" },
        { docs: [makeDoc("fincen-rss", "sha-A")], errors: [] },
      ),
    ];
    const indexer = makeIndexer(new Set(["sha-A"]));
    const audit = makeAudit();

    const result = await runPipeline(sources, { indexer, audit, now: FIXED_NOW });

    expect(result.fetched).toBe(1);
    expect(result.deduped).toBe(0);
    expect(result.indexed).toBe(0);
    expect(result.audited).toBe(0);
    expect(indexer.index).not.toHaveBeenCalled();
    expect(audit.emit).not.toHaveBeenCalled();
  });

  it("records audit_emit_failed but does not throw, and audited < indexed", async () => {
    const sources: PipelineSource[] = [
      makeSource(
        { source: "fincen-rss", jurisdiction: "US", url: "u1" },
        {
          docs: [makeDoc("fincen-rss", "sha-A"), makeDoc("fincen-rss", "sha-B")],
          errors: [],
        },
      ),
    ];
    const indexer = makeIndexer();
    const audit: AuditEmitter = {
      emit: vi
        .fn()
        .mockImplementationOnce(async () => undefined)
        .mockImplementationOnce(async () => {
          throw new Error("sink down");
        }),
    };

    const result = await runPipeline(sources, { indexer, audit, now: FIXED_NOW });
    expect(result.indexed).toBe(2);
    expect(result.audited).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      stage: "audit",
      code: "audit_emit_failed",
      message: "sink down",
    });
  });

  it("propagates indexer rejection (data-loss surface, must not be swallowed)", async () => {
    const sources: PipelineSource[] = [
      makeSource(
        { source: "fincen-rss", jurisdiction: "US", url: "u1" },
        { docs: [makeDoc("fincen-rss", "sha-A")], errors: [] },
      ),
    ];
    const indexer: Indexer = {
      knownShas: async () => new Set(),
      index: async () => {
        throw new Error("db down");
      },
    };
    const audit = makeAudit();
    await expect(runPipeline(sources, { indexer, audit, now: FIXED_NOW })).rejects.toThrow(
      "db down",
    );
  });

  it("defaults the clock to wall time when `now` is not provided", async () => {
    const sources: PipelineSource[] = [
      makeSource(
        { source: "fincen-rss", jurisdiction: "US", url: "u1" },
        { docs: [makeDoc("fincen-rss", "sha-A")], errors: [] },
      ),
    ];
    const indexer = makeIndexer();
    const audit = makeAudit();
    await runPipeline(sources, { indexer, audit });
    const rec = audit.emit.mock.calls[0][0] as AuditRecord;
    expect(rec.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("handles non-Error throw from audit sink as 'unknown' message", async () => {
    const sources: PipelineSource[] = [
      makeSource(
        { source: "fincen-rss", jurisdiction: "US", url: "u1" },
        { docs: [makeDoc("fincen-rss", "sha-A")], errors: [] },
      ),
    ];
    const indexer = makeIndexer();
    const audit: AuditEmitter = {
      emit: vi.fn(async () => {
        throw "weird"; // non-Error throw
      }),
    };
    const result = await runPipeline(sources, { indexer, audit, now: FIXED_NOW });
    expect(result.audited).toBe(0);
    expect(result.errors[0]).toMatchObject({
      stage: "audit",
      code: "audit_emit_failed",
      message: "unknown",
    });
  });
});
