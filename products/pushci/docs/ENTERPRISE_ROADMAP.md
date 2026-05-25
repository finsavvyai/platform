# PushCI Enterprise Roadmap — Norlys Showcase Edition

> **Target customer:** Norlys (Danish energy + telco, ex-Telia infrastructure)
> **Showcase workload:** 10 Java Maven repositories across Gerrit, Jenkins, AWS CodePipeline
> **Goal:** Boutique enterprise CI/CD platform — secure, easy to manage, multi-CI-bridge
> **Positioning:** "The control plane that sits on top of your existing Gerrit/Jenkins/AWS — no rip-and-replace"

---

## 1. Strategic Framing

Norlys is migrating off Telia's legacy infrastructure. They have a heterogeneous
CI/CD estate (Gerrit code review, Jenkins builds, AWS CodePipeline deploys) and
a large Java/Maven footprint. Pitching PushCI as a **replacement** for all of
this is a non-starter — rip-and-replace is too risky for regulated energy infra.

Instead, PushCI becomes the **unified control plane**:

| Layer | They keep | PushCI adds |
|-------|-----------|-------------|
| Code review | Gerrit | Unified PR view, AI review, gamification |
| Build execution | Jenkins / AWS CodeBuild | Run status aggregation, failure analytics, AI auto-fix |
| Deployment | AWS CodePipeline | Change-management workflows, approval gates, audit trail |
| Secrets | HashiCorp Vault / AWS Secrets Manager | Policy layer, rotation audit |
| Observability | Splunk / CloudWatch | DORA metrics, bottleneck detection |
| Governance | ServiceNow / Jira | Automated compliance reports, SOC 2 evidence |

**Revenue model for the Norlys engagement:**
- Setup fee: €50–150k (migration + customization)
- Annual contract: €200–500k (per-seat or per-build-minute)
- Boutique services: €1.5k/day for custom integrations, SLA support
- Success fee: % of CI/CD cost savings vs. previous setup

---

## 2. Enterprise Feature Pillars

### P0 — Must-have for Norlys pilot (weeks 1–3)

1. **Gerrit integration** — poll changes, verify/code-review labels, patch-set builds
2. **Jenkins bridge** — import Jenkinsfiles, replay builds, mirror status
3. **AWS CodePipeline bridge** — trigger and observe pipelines, stage status
4. **Maven-first pipeline engine** — `pom.xml` parsing, settings.xml injection, private Nexus/Artifactory auth
5. **SAML 2.0 SSO + SCIM provisioning** — Azure AD / Okta compatible
6. **Enterprise audit retention** — 7-year immutable log, SOC 2 evidence export
7. **Self-hosted / air-gapped deployment mode** — Docker Compose + Helm chart
8. **Data residency controls** — EU-only routing, per-tenant region pinning

### P1 — Pilot-to-production (weeks 4–6)

9. **HashiCorp Vault integration** — dynamic secrets, lease tracking
10. **SonarQube integration** — quality gate as a blocking check
11. **JFrog Xray / OWASP dependency scanning** — CVE gate
12. **ServiceNow change management** — auto-open CHG tickets for prod deploys
13. **DORA metrics dashboard** — deploy frequency, lead time, MTTR, change fail rate
14. **Cost allocation by cost center** — chargeback reports per team
15. **Immutable pipeline policies** — signed `.pushci.yml`, policy-as-code (OPA)

### P2 — Competitive moat (weeks 7–10)

16. **Migration wizard** — Jenkinsfile → `.pushci.yml`, Gerrit project import
17. **AI failure triage** — group related failures, suggest root cause
18. **Pipeline insights** — flaky test detection, slowest stages, cache hit rate
19. **Multi-tenancy** — organizations, business units, isolated data boundaries
20. **FIDO2 / WebAuthn 2FA** — passwordless admin login
21. **Incident response webhooks** — PagerDuty/Opsgenie for build failures

---

## 3. Open Source Leverage Matrix

We don't rebuild what already exists at enterprise quality.
We integrate, package, and add the control plane.

| Capability | Open source base | Role in PushCI |
|-----------|------------------|----------------|
| SAML SSO | **node-saml** / **saml2-js** | Identity federation |
| OIDC | **openid-client** | Azure AD / Okta / Keycloak auth |
| Policy as code | **Open Policy Agent (OPA)** | `.pushci.yml` gate |
| Secrets | **HashiCorp Vault** API | Dynamic credentials for Maven/Gradle |
| Observability | **OpenTelemetry** SDK | Trace pipeline runs |
| Metrics | **Prometheus** exporter | DORA + runner pool health |
| Logs | **Loki** / **Vector** | Long-term log retention |
| Runners | **Nomad** / **K3s** | Self-hosted runner orchestration |
| Container scanning | **Trivy** / **Grype** | CVE gate in pipelines |
| SBOM | **Syft** / **cyclonedx-maven** | Supply-chain transparency |
| License check | **Licensee** / **ScanCode** | Enterprise compliance |
| Dep scanning | **OWASP Dependency-Check** | Java CVE gate |
| Code quality | **SonarQube** Community | Quality gate integration |
| Jenkins import | **Jenkinsfile parser** (Groovy CST) | Migration wizard |
| Gerrit protocol | **Gerrit REST API** (first-party) | Change polling, verify labels |
| AWS integration | **@aws-sdk/client-codepipeline** | Stage triggers + status |
| Dashboard charts | **Apache ECharts** | DORA dashboards |
| Mermaid DAG | **mermaid-js** | Pipeline visualization |
| Helm packaging | **Helm 3** | Air-gapped deploy |
| Compliance | **Cloud Custodian** | AWS drift detection |

**License posture:** Only Apache 2.0, MIT, BSD-3, MPL-2.0. No GPL/AGPL in the
shipped product. Enterprise customers (banks, energy, telco) cannot accept
copyleft exposure.

---

## 4. Parallel Build Plan

Eight delivery streams run in parallel. Each stream has an isolated file set to
avoid merge conflicts. Streams are sized so a single agent can finish end-to-end.

### Stream A — Gerrit Integration (API)
- `api/src/gerrit.ts` — Change polling, patch-set hooks
- `api/src/gerrit-labels.ts` — Verify / Code-Review label writes
- `api/src/gerrit-webhook.ts` — Hook into webhook dispatcher
- **Deliverable:** A Gerrit project can trigger a PushCI run and
  receive Verified+1/-1 back on the change.

### Stream B — Jenkins Bridge (API + CLI)
- `api/src/jenkins.ts` — Remote API client, crumbs, CSRF
- `api/src/jenkins-import.ts` — Jenkinsfile → `.pushci.yml` converter
- `cmd/pushci/cmd_import_jenkins.go` — CLI command
- **Deliverable:** `pushci import jenkins <url>` pulls a job and
  writes a `.pushci.yml` draft.

### Stream C — AWS CodePipeline Bridge (API)
- `api/src/aws-codepipeline.ts` — STS assume-role, stage polling
- `api/src/aws-iam-policy.json` — Minimal IAM permissions doc
- **Deliverable:** PushCI can trigger a CodePipeline and show
  stage-by-stage status in the dashboard.

### Stream D — Maven-first Engine (API + CLI)
- `api/src/maven.ts` — `pom.xml` parsing, effective-pom, multi-module
- `api/src/maven-settings.ts` — Generate `settings.xml` with Vault secrets
- `internal/detect/java_maven.go` — Richer Java/Maven detection
- `cmd/pushci/cmd_init_java.go` — Java-optimized init
- **Deliverable:** `pushci init` on a multi-module Maven project
  produces a working pipeline with dep caching.

### Stream E — SAML + SCIM (API + Dashboard)
- `api/src/saml.ts` — SAML 2.0 AuthnRequest + Response validation
- `api/src/scim.ts` — SCIM 2.0 user/group provisioning
- `web/dashboard/src/pages/SsoSetupPage.tsx` — IdP config UI
- **Deliverable:** Azure AD admin can add PushCI as SAML app
  and provision users via SCIM.

### Stream F — Compliance & Audit (API + Docs)
- `api/src/compliance.ts` — Evidence export, retention policy
- `api/src/audit-immutable.ts` — Append-only audit with hash chain
- `docs/compliance/SOC2_CONTROLS.md` — Control matrix
- `docs/compliance/GDPR_DPA.md` — Data processing addendum
- **Deliverable:** One-click "Generate SOC 2 evidence pack" button.

### Stream G — Policy-as-Code + OPA (API)
- `api/src/policy-opa.ts` — Embedded OPA WASM policy eval
- `policies/require-tests.rego` — Example policy
- `policies/require-code-review.rego` — Example policy
- **Deliverable:** Admin can block runs that violate org policy.

### Stream H — Enterprise Landing Page + Pilot Flow (Web)
- `web/landing/src/pages/EnterprisePage.tsx` — Hero, logos, compliance badges
- `web/landing/src/pages/NorlysPilotPage.tsx` — Private pilot landing
- `web/dashboard/src/pages/MigrationWizard.tsx` — Step-by-step importer
- **Deliverable:** Shareable URL to present to Norlys procurement.

---

## 5. Security Posture for Enterprise

### Identity
- **Enforced SSO** — once enabled, local logins rejected for org members
- **SCIM provisioning** — auto-deprovision on HR termination
- **Session policy** — configurable TTL, re-auth for sensitive actions
- **FIDO2 / WebAuthn** — passwordless for admin roles

### Data
- **Encryption at rest** — AES-256-GCM per-tenant keys via AWS KMS / Vault
- **Encryption in transit** — TLS 1.3 minimum, HSTS, certificate pinning
- **Field-level encryption** — tokens, webhooks, SSH keys
- **Data residency** — `region: eu` flag pins all data to EU-West
- **Retention policy** — per-tenant, 7-year default for audit, 90-day for logs
- **Right to erasure** — GDPR Article 17 automated flow

### Network
- **IP allowlist** — admin API restricted to corp VPN CIDR
- **Private ingress** — optional VPC peering / Private Link for AWS
- **Outbound allowlist** — restrict runner egress to approved hosts
- **mTLS runners** — client certs required for runner → API

### Supply chain
- **Signed releases** — Sigstore / cosign for CLI + container images
- **SBOM** — CycloneDX 1.5 generated per build
- **Dependency pinning** — lockfiles committed, renovatebot auto-update
- **Reproducible builds** — Dockerfile + SOURCE_DATE_EPOCH

### Operations
- **Audit log** — append-only hash chain, tamper-evident
- **Immutable deploys** — OCI image per version, no in-place updates
- **Chaos drills** — quarterly failover tests
- **Incident response** — PagerDuty integration, 24/7 on-call template

---

## 6. Deployment Topologies

### Topology A — Cloud SaaS (default)
- Managed by PushCI on Cloudflare Workers
- EU data residency via Workers regional routing
- Fastest onboarding, lowest ops burden
- **Fit for:** pilots, proof-of-value

### Topology B — Single-tenant managed (recommended for Norlys)
- Dedicated Workers namespace + D1 database
- Custom domain (e.g. `pushci.norlys.dk`)
- VPC peering to Norlys AWS
- **Fit for:** regulated enterprise, pilot-to-prod

### Topology C — Air-gapped self-hosted
- Docker Compose or Helm chart
- No egress to pushci.dev — signed license check via offline token
- K3s or Nomad for runners
- Loki + Prometheus stack included
- **Fit for:** banking, defense, energy critical systems

---

## 7. Pricing for Boutique Enterprise

| Tier | Price | Includes |
|------|-------|----------|
| **Enterprise Cloud** | €25/user/mo + €0.01/build-min | SaaS, SSO, audit, EU residency |
| **Enterprise Dedicated** | €8k/mo base + usage | Single-tenant, custom domain, SLA 99.9% |
| **Enterprise Self-Hosted** | €75k/yr base | Air-gapped, unlimited users, on-prem support |
| **Boutique Services** | €1.5k/day | Custom integrations, migrations, training |
| **Norlys Pilot** | €50k fixed | 90-day pilot with 10 Maven repos, 3 engineers on-site |

---

## 8. Norlys Pilot — 90-day Plan

### Week 1 — Kickoff & Discovery
- [ ] Meet Norlys DevEx team, map current CI estate
- [ ] Inventory the 10 Maven repos (modules, deps, Jenkins jobs)
- [ ] Document Gerrit project topology and labels
- [ ] Get AWS IAM for read-only CodePipeline access
- [ ] Provision pilot tenant on `pushci.norlys.dk`

### Week 2–3 — Integration
- [ ] Wire Gerrit webhook → PushCI
- [ ] Import 3 pilot Jenkins jobs via `pushci import jenkins`
- [ ] Generate `.pushci.yml` from `pom.xml` for all 10 repos
- [ ] Connect HashiCorp Vault for Maven credentials
- [ ] Configure Azure AD SAML SSO

### Week 4–6 — Parallel Run
- [ ] Run PushCI + Jenkins side-by-side on same commits
- [ ] Compare build times, reliability, developer feedback
- [ ] Tune caching, runner sizing
- [ ] Enable AI review on 2 flagship repos

### Week 7–9 — Production Cutover
- [ ] Move primary build to PushCI for 3 lower-risk repos
- [ ] Observe for 2 weeks, no regressions
- [ ] Cut remaining 7 repos over with owner sign-off

### Week 10–12 — Governance & Handover
- [ ] Deliver SOC 2 evidence pack
- [ ] DORA metrics dashboard for leadership
- [ ] Training for DevEx team
- [ ] Contract renewal discussion

**Success criteria:**
- ≥50% reduction in average build time for pilot repos
- ≥90% developer satisfaction (survey)
- Zero P1 incidents during cutover
- SOC 2 evidence exportable with 1 click

---

## 9. Competitive Positioning

| Competitor | Their strength | Our angle |
|------------|----------------|-----------|
| **GitHub Actions** | Ubiquity | No Gerrit, no air-gap, vendor lock-in, paying $0.008/min |
| **GitLab CI** | Unified platform | Heavy, slow, rip-and-replace of Gerrit |
| **Jenkins** | Legacy trust | We bridge, not replace — Jenkins stays |
| **CircleCI** | Fast cloud | No Gerrit, limited EU residency |
| **Harness** | Enterprise feature set | Expensive, complex, no Maven-first |
| **Azure DevOps** | Microsoft shop fit | Clunky Maven support, no Gerrit |
| **AWS CodeBuild/Pipeline** | AWS-native | Norlys already has it — we orchestrate |

**One-liner for Norlys:**
> "PushCI is the only CI/CD platform that respects your existing Gerrit, Jenkins,
> and AWS investment — and gives you a modern AI-powered control plane on top."

---

## 10. Delivery Metrics

Tracked weekly during pilot, exported to Norlys leadership:

- Build time p50/p95/p99
- Build success rate
- Flaky test rate
- MTTR on failed builds
- DORA four keys
- Developer NPS
- CI cost per deploy
- Security findings (critical/high/med/low)
- SLO attainment (99.9% for platform)

---

*Last updated: 2026-04-11 — Roadmap owner: PushCI Engineering*
