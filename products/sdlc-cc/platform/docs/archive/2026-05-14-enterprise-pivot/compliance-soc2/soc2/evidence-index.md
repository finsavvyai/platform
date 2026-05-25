# Evidence Index

Auditor-readable companion to `controls.yaml`. One section per control.

## CC6.1 — Logical access

| Layer | Where |
|-------|-------|
| Authentication | `services/gateway/internal/infrastructure/middleware/auth.go` (JWT) + `services/gateway/internal/infrastructure/sso/oidc.go` (OIDC) + `services/gateway/internal/infrastructure/sso/saml.go` (SAML, S3.2) |
| MFA step-up | `services/gateway/internal/interfaces/http/middleware/mfa.go` (challenge) + `services/gateway/internal/interfaces/http/handlers/auth_mfa.go` (verify) |
| Authorization | `services/gateway/internal/app/middleware/rbac.go` + `database/migrations/010_rbac.sql` |
| Tenant isolation | RLS policies in `database/migrations/002` + `007` + `019` |
| Evidence | `audit_logs` table — actions: `auth.success`, `auth.failure`, `policy.deny` |

## CC6.6 — Boundary protection

| Layer | Where |
|-------|-------|
| Public ingress | Cloudflare WAF (`services/proxy-worker`) |
| Private ingress | AWS PrivateLink module (`deployments/terraform/modules/privatelink/`) |
| Service-to-service | mTLS rotation via Hashicorp Vault (`services/gateway/internal/infrastructure/mtls/`) |

## CC6.7 — Data in transit

TLS 1.3 with HSTS + CSP enforced by `services/gateway/internal/infrastructure/middleware/security.go`. CI gate: `.github/workflows/encryption-check.yml` parses `deployments/encryption-manifest.json` against runtime config.

## CC6.8 — Data at rest

Envelope encryption per `services/gateway/internal/infrastructure/crypto/envelope.go`:

- Per-row AES-256 DEK with per-row nonce (AES-GCM)
- DEK wrapped against customer KMS via `KMSClient.Wrap` (AWS / GCP / Azure adapters)
- Tenant-scoped KEK ARN in `tenants.kms_key_arn` (migration 020)
- Revoke-the-grant test: `envelope_test.go::TestRevokedKEKReturnsErrRevoked`

## CC7.2 — System monitoring

DLP middleware scans inbound + outbound on every request. Detections produce `dlp.inbound` / `dlp.outbound` audit rows (`services/gateway/internal/infrastructure/middleware/dlp_middleware.go`). Per-tenant policy in `tenant_dlp_policy` (migration 019) lets customers opt into `mask` / `redact` / `block` semantics.

## CC7.3 — Tamper-evident audit trail

`audit_logs` rows are HMAC-SHA256 signed where `signature(N) = HMAC(key, canonical(N) || signature(N-1))`. The signer is `services/gateway/internal/infrastructure/audit/signer.go`. Migration `009_audit_log_immutable.sql` denies UPDATE/DELETE at the database role level. Verification CLI walks the chain and reports the first break.

## CC8.1 — Change management

Every code change merges through a PR with:

- branch protection requiring 1 review + green CI
- 20+ workflows in `.github/workflows/` (lint, test, security scans)
- `encryption-check.yml`, `sdk-contract.yml`, `staticcheck` gates

90-day PR list extracted via `gh pr list ... --search 'merged:>=...'`.

## A1.2 — Availability

Health endpoints in `services/gateway/internal/infrastructure/health/`. Status page export (external) supplies SLA evidence; the engineering side commits to publishing per-incident postmortems within 5 business days.

## PI1.1 — Processing integrity

Document pipeline (services/document-processor/) has integration tests verifying ingestion → OCR → embedding → vector store correctness. CI requires >= 90% pass rate; flake budget tracked in `services/document-processor/tests/queue/`.

## P3.2 — Privacy

Per-tenant DLP policy in `tenant_dlp_policy` (migration 019). Every PII detection produces an audit row regardless of policy outcome — even `allow` writes the detection. This gives the auditor a complete picture of PII flow per tenant.
