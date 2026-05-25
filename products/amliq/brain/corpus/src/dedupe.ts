/**
 * Dedupe — pure function over sha256 only.
 *
 * Title or published_at drift does NOT create a new record. Body
 * sha256 is the single source of truth (see DESIGN.md §7).
 *
 * Critical-path coverage: 100 % line + branch (gates data integrity).
 */

import type { ComplianceDoc } from "./types.js";

/**
 * Return only docs whose sha256 is not in `existing`. Order is
 * preserved. Duplicates within `docs` (same sha256 appearing twice in
 * the same batch) are also collapsed — first occurrence wins.
 *
 * @param docs candidate documents from one or more fetchers
 * @param existing sha256s already known to the indexer
 * @returns new documents only
 */
export function dedupe(
  docs: readonly ComplianceDoc[],
  existing: ReadonlySet<string>,
): readonly ComplianceDoc[] {
  if (docs.length === 0) {
    return [];
  }
  const seenInBatch = new Set<string>();
  const out: ComplianceDoc[] = [];
  for (const doc of docs) {
    if (existing.has(doc.sha256)) {
      continue;
    }
    if (seenInBatch.has(doc.sha256)) {
      continue;
    }
    seenInBatch.add(doc.sha256);
    out.push(doc);
  }
  return out;
}
