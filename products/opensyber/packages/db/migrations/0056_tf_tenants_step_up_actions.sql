-- Sprint 39 — Per-action step-up policy column on tf_tenants.
-- JSON-encoded array of { path, requireFreshSig?, freshSigMaxAgeSec?, requireWebAuthn? }.
-- Parsed and matched server-side via packages/tokenforge/src/server/step-up-policy.ts.
-- NULL = no per-action policy configured (default verdict applies).

ALTER TABLE tf_tenants ADD COLUMN step_up_actions TEXT;
