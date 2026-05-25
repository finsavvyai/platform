# Phase 3 — HIPAA-Ready + EKM + Data Residency (Days 56-75)

Goal: an operational and architectural posture that lets sdlc.cc sign a
BAA, support customer-managed keys (EKM), and host data in customer-chosen
regions.

This phase requires legal review for the BAA template and signing
authority — book the lawyer at Day 56.

---

### Day 56 — BAA + HIPAA architecture review

**Goal:** documented architecture that meets HIPAA technical safeguards (45 CFR 164.312); legal review scheduled.

**Files:** `docs/compliance/hipaa-architecture.md`, `docs/compliance/baa-template.md` (engaged with legal counsel).

**Steps:** map every PHI flow (ingest, store, query, export, delete). Identify each technical safeguard: access control, audit, integrity, transmission. Schedule legal review for the BAA template.

**Tests:** none — documentation deliverable.

**Done when:** architecture doc reviewed by infra + security + legal.

**Prompt:**
> Produce a HIPAA architecture review for sdlc-platform at `docs/compliance/hipaa-architecture.md`. Map every PHI flow (ingest, store, query, export, delete). For each 45 CFR 164.312 technical safeguard, document the implementation, gaps, and remediation owner. Engage legal counsel to draft a BAA template. Stop and surface any flows that cannot be made HIPAA-compliant without re-architecture.

---

### Day 57 — Customer-managed keys / EKM (Enterprise Key Management) — design

**Goal:** design BYOK encryption: customer brings a KMS key (AWS KMS, Azure Key Vault, GCP KMS, HashiCorp Vault) that wraps every per-tenant data key.

**Files:** `docs/security/ekm-design.md`, `services/gateway/internal/infrastructure/crypto/ekm/` scaffolding.

**Steps:** envelope encryption: customer KMS key wraps a tenant-scoped DEK; rotation cadence per customer policy; key revocation makes data unreadable within minutes.

**Tests:** design review only.

**Done when:** design covers AWS KMS, Azure Key Vault, GCP KMS, Vault Transit; rotation + revocation paths documented.

**Prompt:**
> Design Enterprise Key Management (EKM) for sdlc-platform. Customer brings a KMS key (AWS KMS, Azure Key Vault, GCP KMS, or Vault Transit) that wraps every per-tenant data encryption key. Envelope encryption pattern. Rotation cadence per customer. Revocation makes data unreadable within minutes. Document at `docs/security/ekm-design.md`. Stop if any flow requires plaintext access to PHI outside the BAA boundary.

---

### Day 58 — EKM implementation (AWS KMS first)

**Goal:** working AWS KMS BYOK for tenant data encryption.

**Files:** `services/gateway/internal/infrastructure/crypto/ekm/{aws_kms.go,envelope.go}`.

**Steps:** integrate AWS SDK; per-tenant DEK generated, encrypted with the customer's KMS key, stored encrypted; runtime decrypt-on-use with caching (5min). Disabling the customer key blocks all decrypt within 5 min.

**Tests:** tenant create issues a wrapped DEK; revoking access to the KMS key fails decrypt within 5 min; fallback path documented.

**Done when:** an AWS KMS-backed tenant can write/read data only as long as the customer KMS key is reachable.

**Prompt:**
> Implement EKM with AWS KMS for sdlc-platform. Per-tenant DEK wrapped by the customer's AWS KMS key; envelope encryption pattern from the Day 57 design. Decrypt-on-use cache with 5-min TTL. Tests must confirm: (a) tenant create issues a wrapped DEK, (b) revoking the customer KMS key fails decrypt within 5 min, (c) re-granting access restores reads.

---

### Day 59 — EKM: Azure Key Vault + GCP KMS + Vault Transit

**Goal:** parity with AWS KMS for the other three KMS backends.

**Files:** `services/gateway/internal/infrastructure/crypto/ekm/{azure_kv.go,gcp_kms.go,vault_transit.go}`.

**Done when:** all four backends pass the Day 58 test suite.

**Prompt:**
> Add Azure Key Vault, GCP KMS, and Vault Transit backends to sdlc-platform EKM, mirroring the AWS KMS implementation. All four backends must pass the same test suite from Day 58 (DEK wrap, revocation propagation, re-grant restore).

---

### Day 60 — Field-level encryption for PHI columns

**Goal:** known-PHI columns are encrypted with the tenant DEK, not just at-rest.

**Files:** migration `014_field_level_encryption.sql`, `services/gateway/internal/infrastructure/crypto/field_encryption.go`.

**Steps:** identify PHI columns (medical record numbers, diagnosis text, prescription, insurance, etc). Add `_enc` suffix columns; remove plaintext after migration. Search-needed columns get a separate hashed-search index.

**Tests:** PHI written and read correctly; database snapshot reveals only ciphertext.

**Done when:** dumping the DB does not expose plaintext PHI.

**Prompt:**
> Add field-level encryption to sdlc-platform PHI columns. Migration 014 adds `_enc` columns for medical record numbers, diagnosis, prescription, insurance fields. Encrypt with the tenant DEK from EKM. Searchable columns get a hashed-search index. Tests confirm DB snapshot reveals only ciphertext.

---

### Day 61 — De-identification pipeline (HIPAA Safe Harbor)

**Goal:** automated de-identification per HIPAA Safe Harbor 18 identifiers; opt-in per-tenant flow.

**Files:** `services/dlp/safe_harbor.py`.

**Steps:** detect + redact each of the 18 identifiers in PHI columns and inbound prompts. Track expert determination override path.

**Tests:** synthetic PHI is redacted to spec; expert determination override documented.

**Done when:** a tenant in `hipaa_safe_harbor=true` mode produces de-identified outputs by default.

**Prompt:**
> Build a HIPAA Safe Harbor de-identification pipeline in sdlc-platform DLP. Detect + redact the 18 identifiers (names, dates, SSN, medical record numbers, etc.). Per-tenant flag `hipaa_safe_harbor=true`. Document the expert determination alternative. Tests use synthetic PHI fixtures and confirm correct redaction.

---

### Day 62 — Breach detection + automatic notification scaffold

**Goal:** anomaly detection on access patterns; on suspected breach, freeze affected accounts and alert customer.

**Files:** `services/gateway/internal/infrastructure/breach_detection/`.

**Steps:** baseline access patterns per user (location, time, frequency, data volume). Z-score anomaly detection. On suspected breach: freeze account, notify customer security contact, generate incident report. HIPAA breach notification rule (60-day customer notice) timer started.

**Tests:** synthetic anomalous access triggers freeze + alert; baseline computation respects tenant isolation.

**Done when:** a user pulling 1000 records in a minute (vs baseline 10) is auto-frozen and admin alerted.

**Prompt:**
> Add breach detection to sdlc-platform. Baseline per-user access patterns (location, time, frequency, data volume). Z-score anomaly detection. On suspected breach: freeze account, notify customer security contact, start the HIPAA 60-day notice timer. Tests confirm a 100x volume spike triggers freeze + alert.

---

### Day 63 — Right-to-be-forgotten (GDPR + HIPAA purge)

**Goal:** customer can request purge of all data for a specific user; sdlc.cc removes it within the legal window (30 days for GDPR, defined in BAA for HIPAA).

**Files:** `services/gateway/internal/domain/erasure/`.

**Steps:** purge orchestrator finds and deletes records across all stores (Postgres, pgvector, Redis cache, S3, audit logs after legal hold). Append a purge certificate to the audit log.

**Tests:** purge of fixture user removes from every store; audit certificate generated.

**Done when:** a purge request results in zero PII for that user across the platform.

**Prompt:**
> Implement right-to-be-forgotten in sdlc-platform. Purge orchestrator at `internal/domain/erasure/` removes a user from Postgres, pgvector, Redis cache, S3, and audit logs (after legal hold expires). Generate a purge certificate appended to audit log. Tests confirm zero residual PII.

---

### Day 64 — Data residency: multi-region deployment design

**Goal:** customers choose a region (US-East, US-West, EU-Central, EU-West, UK, Canada, Australia, Singapore, Japan, Brazil); their data never leaves that region.

**Files:** `docs/architecture/data-residency.md`, `deployments/terraform/regions/`.

**Steps:** per-region: gateway, RAG, document-processor, postgres, redis, S3 bucket. Cross-region traffic explicitly prohibited at the network ACL layer. Customer routing layer at the edge.

**Tests:** none in this design pass.

**Done when:** design approved by infra + legal.

**Prompt:**
> Design multi-region data residency for sdlc-platform. Per-region full stack (gateway, RAG, document-processor, Postgres, Redis, S3). Cross-region traffic prohibited at the network ACL layer. Edge router uses the tenant's region claim to dispatch. Document at `docs/architecture/data-residency.md`. Cover at least US-East, US-West, EU-Central, EU-West, UK, Canada, AU, SG, JP, BR.

---

### Day 65 — Data residency: implement first non-US region (EU-Central)

**Goal:** working EU-Central deployment with end-to-end test.

**Files:** Terraform modules, deployment scripts.

**Steps:** stand up EU-Central stack; route an EU-tagged tenant; verify data never crosses the Atlantic via VPC flow logs.

**Tests:** flow logs show no inter-region traffic for EU-tenant; latency from EU client <200ms p95.

**Done when:** EU-tagged tenant fully isolated; flow log audit attached as evidence.

**Prompt:**
> Stand up the EU-Central region for sdlc-platform per the Day 64 design. Terraform deploys the full stack. Route an EU-tagged tenant. Audit VPC flow logs show no Atlantic crossing. Latency from EU client <200ms p95. Attach flow log audit as compliance evidence.

---

### Day 66 — Data residency: scale to 10 regions

**Goal:** roll out the remaining 8 regions on the Day 65 pattern.

**Files:** Terraform per region.

**Steps:** apply Terraform; smoke test each; document onboarding.

**Done when:** all 10 regions operational with passing smoke tests.

**Prompt:**
> Roll out the remaining 8 sdlc-platform regions (US-West, UK, Canada, AU, SG, JP, BR, plus the Day 65 EU-Central) using the validated Terraform pattern. Smoke test each. Document customer onboarding for region selection.

---

### Day 67 — Audit log immutability via worm storage

**Goal:** audit logs are exportable to WORM (S3 Object Lock or equivalent), so even an attacker with full DB access cannot tamper.

**Files:** `services/gateway/internal/infrastructure/audit/worm_export.go`.

**Steps:** hourly export to S3 with Object Lock (governance mode, 7-year retention by default). Hash chain links exports.

**Tests:** export round-trip; tampering detected via hash chain mismatch.

**Done when:** audit logs exported hourly to S3 Object Lock; tamper detection verifiable.

**Prompt:**
> Add WORM-backed audit log export to sdlc-platform. Hourly export to S3 Object Lock (governance mode, 7-year default retention). Hash chain across exports. Tests confirm export round-trip and tamper detection on hash mismatch.

---

### Day 68 — Vendor security review readiness pack

**Goal:** a self-serve packet customers can hand to their security team.

**Files:** `docs/security/customer-pack/`.

**Steps:** include SOC2 Type II report (placeholder until Day 76), pen test summary, encryption-at-rest evidence, BAA template, data flow diagrams, sub-processor list, incident response runbook, recent audit reports.

**Done when:** a customer security team can complete a vendor review with the packet alone.

**Prompt:**
> Build a vendor security review readiness pack for sdlc-platform under `docs/security/customer-pack/`. Include the SOC2 report (placeholder for now), pen test summary, encryption evidence, BAA template, data flow diagrams, sub-processor list, IR runbook, and recent audit reports. Test the packet by walking through a fake customer review.

---

### Day 69 — Sub-processor disclosure + change notification

**Goal:** customers see and can be notified of any sub-processor change.

**Files:** `services/gateway/internal/infrastructure/subprocessors/`, public page on landing.

**Steps:** sub-processor list in DB + public page; change requires admin approval; customers subscribed get 30-day advance notice via email.

**Tests:** changing the list triggers notification; un-approved changes are not published.

**Done when:** sub-processor list is accurate, public, and change-notified.

**Prompt:**
> Add sub-processor disclosure + change notification to sdlc-platform. Sub-processor list in DB; public page on the landing site; change requires admin approval; customers receive 30-day advance notice. Tests confirm approval gate and notification path.

---

### Day 70 — Pen test (external) — pre-engagement

**Goal:** external pen test contracted, scope agreed, kickoff scheduled.

**Steps:** select vendor (e.g., Bishop Fox, Trail of Bits, NCC); scope includes web app, API, infra, AI prompt-injection. Provide test environment; sign NDA.

**Done when:** test scheduled within 2 weeks.

**Prompt:**
> Coordinate the external penetration test for sdlc-platform. Select a vendor with AI/prompt-injection expertise (Bishop Fox, Trail of Bits, NCC, or equivalent). Scope: web app, API, infra, AI prompt-injection. Stand up a test environment. Sign NDAs. Schedule kickoff within 2 weeks.

---

### Day 71-73 — Pen test execution window

Pen test runs externally. Internal team triages findings live, fixes
Critical/High immediately. Days 71-73 are reserved for hot-fix work.

**Prompt:** (used reactively as findings arrive)
> A penetration test finding has been delivered to sdlc-platform with severity X. Reproduce the issue locally, write a failing test, ship a fix, confirm the fix in the test environment, and update `docs/security/pentest-findings.md`. Follow the standard atomic-commit workflow.

---

### Day 74 — Pen test fix-up + re-test

**Goal:** all Critical and High findings remediated and re-tested.

**Steps:** ship fixes; vendor re-tests; clean report.

**Done when:** clean re-test report.

**Prompt:**
> Drive the sdlc-platform pen test re-test to a clean report. Track each finding to a specific commit + test. Vendor re-runs validation; confirm Critical/High are zero. Update `docs/security/pentest-findings.md` with final status.

---

### Day 75 — Phase 3 sign-off

**Goal:** confirm HIPAA-readiness deliverables; tag `phase-3-complete`.

**Done when:** every Day 56-74 criterion green; tag exists.

**Prompt:**
> Review every Phase 3 deliverable in `docs/roadmap/phase-3-hipaa-ready.md`. Update `docs/PRODUCTION-READINESS.md`. Tag `phase-3-complete` only when all 19 days' criteria are met. List gaps and stop if any miss.

---

End of Phase 3. Tag: `phase-3-complete`. Estimated readiness: 92%.
