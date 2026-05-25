-- Migration 033: tenant-level opt-in for finance + healthcare DLP presets.
-- Version: 1.0.0
-- Description: Adds two boolean columns to tenant_dlp_policy so a
--              tenant can enable the finance-vertical pattern bundle
--              (services/gateway/internal/infrastructure/middleware/
--              dlp_finance.go) and the healthcare-vertical pattern
--              bundle (dlp_healthcare.go) independently of the
--              existing legal-preset opt-in.
-- Dependencies:
--   - 019_tenant_dlp_policy.sql (creates tenant_dlp_policy)
--   - 032_dlp_legal_preset.sql (mirror of this migration's shape)
--   - dlp_finance.go + dlp_healthcare.go pattern files (in tree)
--   - PgxPolicyLookup.FinancePreset + .HealthcarePreset methods
--     (in tree at dlp_policy_lookup_presets.go)
-- Rollback: ALTER TABLE tenant_dlp_policy
--             DROP COLUMN finance_preset, DROP COLUMN healthcare_preset.
--
-- Behaviour:
--   - When finance_preset = true, the dlp_middleware concatenates
--     FinancePatterns() (israeli_id, iban, bic, aba_routing) onto
--     the pattern set in addition to any custom_patterns the
--     tenant already configured.
--   - When healthcare_preset = true, the dlp_middleware
--     concatenates HealthcarePatterns() (phi_marker, npi, dea,
--     icd10) onto the pattern set.
--   - The action column still controls allow/mask/redact/block/
--     tokenize; the presets are heuristic and SHOULD default to
--     mask to avoid false-positive blocks on legitimate flows.
--   - Missing column + missing rows both resolve to FALSE in the
--     Go reader, so each preset stays opt-in even if the migration
--     is applied out of order.

BEGIN;

ALTER TABLE tenant_dlp_policy
    ADD COLUMN IF NOT EXISTS finance_preset BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS healthcare_preset BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN tenant_dlp_policy.finance_preset IS
    'Opt-in flag for the finance-vertical DLP preset. When TRUE, the '
    'gateway appends FinancePatterns() (israeli_id, iban, bic, '
    'aba_routing) to the per-request pattern set. See dlp_finance.go '
    'for citations and HIPAA / 45 CFR 160.103 disclaimers. Heuristic, '
    'not a compliance-evidence engine.';

COMMENT ON COLUMN tenant_dlp_policy.healthcare_preset IS
    'Opt-in flag for the healthcare-vertical DLP preset. When TRUE, '
    'the gateway appends HealthcarePatterns() (phi_marker, npi, dea, '
    'icd10) to the per-request pattern set. See dlp_healthcare.go for '
    'citations. Heuristic, not a HIPAA-evidence engine; year-2 SOC 2 '
    '+ HIPAA audit is the formal attestation path.';

CREATE INDEX IF NOT EXISTS idx_tenant_dlp_policy_finance_preset
    ON tenant_dlp_policy (finance_preset)
    WHERE finance_preset = TRUE;

CREATE INDEX IF NOT EXISTS idx_tenant_dlp_policy_healthcare_preset
    ON tenant_dlp_policy (healthcare_preset)
    WHERE healthcare_preset = TRUE;

COMMIT;
