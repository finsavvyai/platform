/**
 * FFIEC PDF fetcher — SKELETON.
 *
 * TODO(corpus-pipeline, next pass):
 *   - Choose PDF parsing library (candidates: `pdf-parse`, `pdfjs-dist`).
 *   - Decide chunking strategy (whole-handbook vs section-per-doc).
 *   - Confirm FFIEC URL list source (hard-coded list vs catalogue fetch).
 *
 * Until that decision is made this fetcher returns a deterministic
 * `not_implemented` error so callers know it's wired but inert. It does
 * NOT throw — Brain Week 2 convention requires fetchers to surface
 * structured errors rather than crash the pipeline.
 */

import type {
  FetchResult,
  Fetcher,
  IngestError,
  SourceConfig,
} from "../types.js";

/**
 * Comma-separated list of handbook URLs (env-driven). Kept as a single
 * env-var entry so test fixtures can override without code changes.
 */
export function parseHandbookList(raw: string | undefined): readonly string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export const ffiecPdf: Fetcher = async (cfg: SourceConfig): Promise<FetchResult> => {
  const urls = parseHandbookList(cfg.url);
  const errors: IngestError[] = [
    {
      source: cfg.source,
      stage: "parse",
      code: "not_implemented",
      message: `PDF extraction not implemented yet (would process ${urls.length} URL(s))`,
    },
  ];
  return { docs: [], errors };
};
