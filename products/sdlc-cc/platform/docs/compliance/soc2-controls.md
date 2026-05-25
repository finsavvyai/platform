# SOC 2 Type II — Control Matrix

**Scope:** SDLC Platform (gateway, rag, llm-gateway, admin-ui, landing)
**Framework:** AICPA Trust Services Criteria 2017 (updated 2022)
**Target attestation:** Q2 2026 (6-month observation window opens 2026-01-01)
**Auditor:** TBD — RFP out Q1 2026.

## CC1 — Control Environment

| ID | Control | Implementation | Evidence |
|----|---------|----------------|----------|
| CC1.1 | Integrity & ethical values | Code of conduct, security training annually | HR portal, training logs |
| CC1.2 | Board independence | Advisory board charter | /docs/governance/board.md |
| CC1.3 | Management oversight | Weekly eng leadership sync | Meeting notes in Notion |
| CC1.4 | Competence commitment | Role-based JD + calibration | Ashby, 1:1s |
| CC1.5 | Accountability | OKRs tracked per eng | Lattice |

## CC2 — Communication & Information

| ID | Control | Implementation | Evidence |
|----|---------|----------------|----------|
| CC2.1 | Information quality | Runbooks, ADRs | /docs/adr, /docs/runbooks |
| CC2.2 | Internal comms | #sdlc-incidents Slack | Slack logs |
| CC2.3 | External comms | status.sdlc.cc, security.txt | Public pages |

## CC3 — Risk Assessment

| ID | Control | Implementation | Evidence |
|----|---------|----------------|----------|
| CC3.1 | Risk identification | Quarterly threat model review | /docs/threat-models |
| CC3.2 | Risk analysis | CVSS scoring on SAST findings | Semgrep + PipeWarden reports |
| CC3.3 | Fraud risk | Rate limits, anomaly detection | Gateway logs, /services/abuse |
| CC3.4 | Change impact | PR review required, CI gates | GitHub branch protection |

## CC4 — Monitoring

| ID | Control | Implementation | Evidence |
|----|---------|----------------|----------|
| CC4.1 | Ongoing evaluation | Prometheus, Grafana alerts | Dashboards |
| CC4.2 | Deficiency reporting | Incident retros within 72h | /docs/incidents |

## CC5 — Control Activities

| ID | Control | Implementation | Evidence |
|----|---------|----------------|----------|
| CC5.1 | Control selection | Based on OWASP Top 10 + CIS | This doc |
| CC5.2 | Technology controls | RLS, OPA, DLP, rate-limit | Code + tests |
| CC5.3 | Policy deployment | Terraform + Helm | /deployments |

## CC6 — Logical & Physical Access

| ID | Control | Implementation | Evidence |
|----|---------|----------------|----------|
| CC6.1 | Logical access restriction | JWT + RLS, tenant isolation | Gateway auth middleware, migrations |
| CC6.2 | User registration | Clerk + JIT provisioning | /services/gateway/auth |
| CC6.3 | Access review | Quarterly entitlement review | Access-review export |
| CC6.4 | Physical access | Cloud only; no on-prem office data | Cloudflare + AWS attestations |
| CC6.5 | Credential rotation | 90-day secrets rotation | Rotation cron, secret-scan workflow |
| CC6.6 | Encrypted in transit | TLS 1.2+, HSTS | Cloudflare config |
| CC6.7 | Encrypted at rest | KMS-managed keys, pg encryption | RDS config, R2 encryption |
| CC6.8 | Malware prevention | Image scanning (Trivy), DLP | PipeWarden + DLP service |

## CC7 — System Operations

| ID | Control | Implementation | Evidence |
|----|---------|----------------|----------|
| CC7.1 | Detection of events | OpenTelemetry + Loki | /services/observability |
| CC7.2 | Monitoring of events | Prometheus alerts → PagerDuty | Alert rules |
| CC7.3 | Evaluation of events | Sev triage matrix | /docs/runbooks/incident.md |
| CC7.4 | Incident response | Runbook S1-S5 + DR playbook | /docs/runbooks/disaster-recovery.md |
| CC7.5 | Recovery | Backups, RTO/RPO per tier | DR playbook |

## CC8 — Change Management

| ID | Control | Implementation | Evidence |
|----|---------|----------------|----------|
| CC8.1 | Change authorization | PR review, CODEOWNERS | GitHub settings |
| CC8.2 | Change testing | CI: unit/integration/E2E/security | /.github/workflows |
| CC8.3 | Change deployment | Blue/green, canary, auto-rollback | deploy-gateway.yml |

## CC9 — Risk Mitigation

| ID | Control | Implementation | Evidence |
|----|---------|----------------|----------|
| CC9.1 | Vendor management | DPA signed per vendor | /docs/vendors |
| CC9.2 | Business continuity | DR playbook, fire-drills quarterly | /docs/runbooks |

## Evidence collection

Run `.ops/scripts/soc2-evidence-collect.sh <YYYY-MM>` to produce:

- `evidence/YYYY-MM/access-logs.tar.zst` — gateway + admin access logs
- `evidence/YYYY-MM/change-mgmt.json` — all merged PRs with reviewers
- `evidence/YYYY-MM/scans/` — SAST + dep audit + secret scan results
- `evidence/YYYY-MM/incidents.json` — PagerDuty P0/P1 incidents
- `evidence/YYYY-MM/access-reviews.csv` — user access entitlement snapshot
- `evidence/YYYY-MM/backups-verified.json` — nightly backup verification log

Evidence is stored in the `sdlc-compliance` R2 bucket with object-lock.

## Gap status

| Control | Status | Blocker |
|---------|--------|---------|
| CC6.3 access review | Partial | Quarterly cadence not automated |
| CC9.1 vendor DPAs | Partial | 3 vendors pending countersignature |
| CC7.4 IR runbook | Done | — |
| CC6.5 key rotation | Partial | JWT signing key rotation not automated |
| All others | Done | — |

Target: all-green by 2026-07-01 to start the 6-month observation window.
