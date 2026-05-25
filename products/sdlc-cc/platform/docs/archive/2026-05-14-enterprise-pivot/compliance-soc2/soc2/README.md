# SOC 2 Type II — Evidence Drive

BEAT-PLAN S3.4. Initial scaffold; final certification target Q2 2026.

This directory is the source of truth for which controls our auditor
expects, where the evidence lives in the codebase, and which platform
mechanism produces a verifiable record per control.

## What's here

- `controls.yaml` — every Trust Services Criterion we are committed to,
  mapped to the code path + audit table that produces evidence.
- `evidence-index.md` — human-readable companion to controls.yaml. The
  auditor reads this; controls.yaml is what our CI parses.
- `runbook.md` — quarterly evidence-pull procedure (queries to run,
  artifacts to export, retention policy).

## What's intentionally NOT here yet

- Auditor-ready report (waits for Q2 2026 audit window)
- Vendor sub-processor inventory (lives in legal/, not engineering)
- HR/people controls (CC1.1-CC1.4 — owned by the People team)
- The actual log exports (those land in S3 with the retention bucket;
  this directory only documents *where* and *how*)

## Dependencies

Per BEAT-PLAN: meaningful evidence collection depends on
S1.1 (RBAC + audit) ✅, S1.2 (spend events) ✅, S1.3 (audit query) ✅,
S2.1 (DLP audit) ✅, S2.2 (policy deny audit) ✅, S3.1 (CMEK) ✅,
S3.2 (SAML + MFA) ✅, S3.3 (PrivateLink) ✅. Without those, several
controls have nothing to certify. As of this commit those upstream
items are real (modulo per-vendor adapter wiring noted in their
STATUS.md files) so SOC 2 evidence collection has signal to feed.
