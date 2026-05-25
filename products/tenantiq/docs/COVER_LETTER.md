# Cover letter — TenantIQ M365 Certification submission

Reviewer,

This bundle accompanies TenantIQ's submission for **Microsoft 365 Certification (Level 1)**. Every claim here is traceable to a file in the bundle.

**Submission metadata**

- Date: 2026-04-30
- Git commit: `2943764366aca8f3d9595cd2f128b3e611ba5a13`
- Build tag: `v1.0-31-g2943764`
- API package: `@tenantiq/api@0.0.1`
- Web package: `@tenantiq/web@0.0.1`

**How to read this bundle**

1. Start with `docs/MS_CERTIFICATION.md` — control matrix with status per control.
2. `docs/PARTNER_CENTER_SUBMISSION.md` mirrors the answers we placed into Partner Center, with file-level citations.
3. Architecture: `docs/ARCHITECTURE_DIAGRAM.md` (auto-generated from `wrangler.toml` + code) plus the data-flow diagram in `docs/DATA_FLOW.md` and STRIDE in `docs/THREAT_MODEL.md`.
4. Security operations: `docs/SDLC.md`, `docs/INCIDENT_RESPONSE.md`, `docs/DR_RUNBOOK.md`, `docs/BUSINESS_CONTINUITY.md`.
5. Data handling: `docs/DATA_CLASSIFICATION.md`, `docs/DATA_RETENTION.md`, `docs/DATA_DELETION.md`.
6. CI evidence: `.github/workflows/security.yml` + last 90 days in `ci-security-history.json`. Live verification: `playwright-smoke-latest.json`.
7. Sub-processors + DPA: `docs/SUB_PROCESSORS.md` + `docs/DPA.md`.
8. Vulnerability disclosure: `docs/VULNERABILITY_DISCLOSURE.md` + public `/.well-known/security.txt`.

**Known gaps disclosed**

- External penetration test: scheduled. Report will be supplied as an addendum within 30 days of vendor delivery.
- SOC 2 Type II: not yet held; Type I drafted. Not required for L1; included for visibility.
- Status page on a separate provider: backlog item; comms fallback documented in `docs/INCIDENT_RESPONSE.md`.

**Verification**

- Every file is sha256-summed in `sha256sums.txt`.
- A daily GitHub Action (`.github/workflows/cert-status.yml`) re-runs the live smoke suite against `https://app.tenantiq.app` and `https://api.tenantiq.app` and fails on regression.

**Contact**

- Security responder: `security@tenantiq.app`
- Privacy / DPA: `privacy@tenantiq.app`
- Submission owner: see Partner Center primary contact.

We're available for follow-up questions at `security@tenantiq.app`.

— TenantIQ team
