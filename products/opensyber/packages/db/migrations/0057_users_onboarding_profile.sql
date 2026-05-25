-- Slice 8 — Adaptive onboarding persona persistence.
-- JSON-encoded OnboardingProfile (see @opensyber/shared types/onboarding-profile.ts).
-- NULL = no persona detected yet (treated as `unknown` by callers).
-- Parsed via isOnboardingProfile() type guard before use.

ALTER TABLE users ADD COLUMN onboarding_profile TEXT;
