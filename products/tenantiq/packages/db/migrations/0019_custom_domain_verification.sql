-- T3.5: per-org custom-domain verification challenges.
-- After PUT /api/branding sets customDomain, the org receives a TXT record
-- challenge they must publish; POST /api/branding/custom-domain/verify
-- checks the TXT and marks the domain verified.

ALTER TABLE org_branding ADD COLUMN custom_domain_verification_token TEXT;
ALTER TABLE org_branding ADD COLUMN custom_domain_verified_at TEXT;
ALTER TABLE org_branding ADD COLUMN custom_domain_status TEXT DEFAULT 'unverified';

CREATE INDEX IF NOT EXISTS idx_org_branding_custom_domain ON org_branding (custom_domain);
