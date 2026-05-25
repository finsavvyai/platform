/**
 * Test helpers — used only by `*.test.ts` files. Not part of the public
 * surface. Underscore prefix keeps this out of the published `index.ts`.
 */

import { vi } from "vitest";
import type { PipelineSource } from "./pipeline.js";
import type {
  AuditEmitter,
  ComplianceDoc,
  FetchResult,
  Indexer,
  SourceConfig,
} from "./types.js";

export function makeDoc(source: string, sha: string, id = sha): ComplianceDoc {
  return {
    source,
    jurisdiction: "US",
    doc_id: id,
    title: `Title-${id}`,
    published_at: "2026-05-20T00:00:00.000Z",
    sha256: sha,
    body: `body-${sha}`,
  };
}

export function makeSource(cfg: SourceConfig, result: FetchResult): PipelineSource {
  return { cfg, fetcher: vi.fn(async () => result) };
}

export type MockIndexer = Indexer & {
  index: ReturnType<typeof vi.fn>;
  knownShas: ReturnType<typeof vi.fn>;
};

export function makeIndexer(known: ReadonlySet<string> = new Set()): MockIndexer {
  return {
    index: vi.fn(async () => undefined),
    knownShas: vi.fn(async () => known),
  };
}

export type MockAudit = AuditEmitter & { emit: ReturnType<typeof vi.fn> };

export function makeAudit(): MockAudit {
  return { emit: vi.fn(async () => undefined) };
}

export const FIXED_NOW = (): string => "2026-05-25T00:00:00.000Z";
