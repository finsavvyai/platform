-- Migration 032: tenant-level opt-in for the legal-DLP preset.
-- Version: 1.0.0
-- Description: Adds a boolean column to tenant_dlp_policy so a
--              tenant can enable the legal-vertical pattern bundle
--              (services/gateway/internal/infrastructure/middleware/
--              dlp_legal*.go) without touching the existing action
--              enum. Default off so the preset is strictly opt-in.
-- Dependencies:
--   - 019_tenant_dlp_policy.sql (creates tenant_dlp_policy)
--   - dlp_legal_*.go pattern files (already in tree)
--   - PgxPolicyLookup.LegalPreset method (already in tree)
-- Rollback: ALTER TABLE tenant_dlp_policy DROP COLUMN legal_preset.
--
-- Behaviour:
--   - When legal_preset = true, the dlp_middleware concatenates
--     LegalPatterns() onto the pattern set in addition to any
--     custom_patterns the tenant already configured.
--   - The action column still controls allow/mask/redact/block/
--     tokenize; the preset is heuristic and SHOULD default to mask
--     to avoid false-positive blocks on legitimate intake flows.
--   - Missing column (running this migration in a stage where the
--     column doesn't exist yet) and missing rows both resolve to
--     FALSE in the Go reader, so the preset stays opt-in even if
--     the migration is applied out of order.

BEGIN;

ALTER TABLE tenant_dlp_policy
    ADD COLUMN IF NOT EXISTS legal_preset BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN tenant_dlp_policy.legal_preset IS
    'Opt-in flag for the legal-vertical DLP preset. When TRUE, the '
    'gateway appends LegalPatterns() (privilege / work-product / '
    'discovery / identifiers / NDA) to the per-request pattern set. '
    'See docs/dlp/legal-patterns.md and the dlp_legal_*.go files in '
    'services/gateway. The preset is a heuristic, not a privilege '
    'determination — every firm should run its own ethics review.';

CREATE INDEX IF NOT EXISTS idx_tenant_dlp_policy_legal_preset
    ON tenant_dlp_policy (legal_preset)
    WHERE legal_preset = TRUE;

COMMIT;
