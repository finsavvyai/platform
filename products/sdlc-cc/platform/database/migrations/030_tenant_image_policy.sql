-- Migration 030 — per-tenant image-input policy.
-- Claude Team C2 closeout: HIPAA tenants and any other org without
-- OCR-aware DLP coverage need a way to refuse image inputs entirely.
-- The Anthropic API accepts base64 images inside content blocks
-- (`{"type": "image", ...}`) and our text-regex detector cannot
-- read them, so an opt-in block is the only honest option.
--
-- Values:
--   allow — default, current behavior; images travel to upstream
--   block — gateway 422s with Anthropic-shape error before forwarding
--   warn  — image passes through but emits a 'dlp.image.warn' audit row

BEGIN;

ALTER TABLE tenant_dlp_policy
    ADD COLUMN IF NOT EXISTS image_policy TEXT NOT NULL DEFAULT 'allow';

ALTER TABLE tenant_dlp_policy
    DROP CONSTRAINT IF EXISTS tenant_dlp_policy_image_policy_check;
ALTER TABLE tenant_dlp_policy
    ADD CONSTRAINT tenant_dlp_policy_image_policy_check
    CHECK (image_policy IN ('allow', 'block', 'warn'));

COMMIT;
