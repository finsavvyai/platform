-- Migration 028 — extend tenant_dlp_policy.action enum with 'tokenize'.
-- Claude Team B2: reversible tokenization. The middleware replaces
-- each PII match with a `<TYPE_NNN>` placeholder on inbound and
-- restores the original value in the outbound response, so Claude
-- gets useful context without ever seeing the raw PII.
--
-- Existing rows keep their action; new tenants can opt into
-- 'tokenize' via the admin policy CRUD.

BEGIN;

ALTER TABLE tenant_dlp_policy DROP CONSTRAINT IF EXISTS tenant_dlp_policy_action_check;
ALTER TABLE tenant_dlp_policy
    ADD CONSTRAINT tenant_dlp_policy_action_check
    CHECK (action IN ('allow', 'mask', 'redact', 'block', 'tokenize'));

COMMIT;
