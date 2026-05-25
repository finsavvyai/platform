-- Covers the `SELECT list_id, MAX(updated_at) FROM entities GROUP BY list_id`
-- and similar per-list aggregate queries used by:
--   - cmd/enrichment-report
--   - Tier 4 coverage audits in docs/verification-queries.md
--   - internal admin dashboards
--
-- Without this index, those queries do a seq scan over 2.88M+ rows;
-- twice on 2026-04-17/18 they crashed the prod Postgres instance (see
-- docs/enrichment-gap-audit.md section B8). A composite btree index
-- on (list_id, updated_at DESC) collapses the plan to a per-group
-- index-only scan.
--
-- CREATE INDEX (not CONCURRENTLY) holds a ShareLock on entities for the
-- duration of the build \u2014 ~30-60s on the current row count. Acceptable
-- as a one-off and chosen over CONCURRENTLY because the migrator runs
-- each file in a single Exec and CONCURRENTLY cannot mix with other
-- statements. IF NOT EXISTS makes it idempotent.

CREATE INDEX IF NOT EXISTS idx_entities_list_updated
    ON entities(list_id, updated_at DESC);
