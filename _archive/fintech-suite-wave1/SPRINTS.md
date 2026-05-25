# FinTech Suite — Sprint Plan

> **Read first:** `portfolio/QUALITY_STANDARDS.md`
> **Wave:** 1 · **Readiness:** 88% · **Stack:** Go 1.24 (quantumbeam), Node.js, Python, React, Cloudflare Workers
> **Timeline:** 5 days · **Ship by:** Week 3

---

## Pre-Sprint: Migrate to @finsavvyai Shared Libraries

### Agent A: Extract Go auth into go-auth module [PARALLEL]

**Prompt:**
FinTech Suite has auth spread across multiple Go services using JWT/OAuth2/OIDC. Create new module `github.com/finsavvyai/go-auth` (or extract to `/internal/auth/` subdomain). Move: JWT signing/validation from all services to `go-auth.NewTokenManager(secret, ttl)`, OAuth2 provider logic to `go-auth.NewOAuth2Provider(clientID, clientSecret)`, LDAP connector to `go-auth.NewLDAPConnector(config)`. Refactor existing services to inject TokenManager via constructor. Write unit tests (95%+ coverage) for token lifecycle, OAuth2 flow, LDAP binding. Acceptance: `go test ./... -cover` shows ≥95%, auth extracted, existing services use interface-driven auth provider.

### Agent B: Verify Stripe webhook handling matches @finsavvyai/pay pattern [PARALLEL]

**Prompt:**
FinTech Suite uses Stripe with custom webhook verification. Review `/internal/payment/webhook.go` (or equivalent). Compare signature verification against `@finsavvyai/pay` npm reference implementation. If custom: replace with `github.com/finsavvyai/go-pay` (Go module) pattern — call `go-pay.VerifyStripeSignature(req.Header.Get("Stripe-Signature"), body, secret)`. Handle webhook events: payment_intent.succeeded, customer.subscription.updated. Update webhook handler to use `go-pay.HandleStripeEvent()`. Test with Stripe test vectors. Acceptance: Webhook signatures validate, payment state updates correctly, `go test` passes with ≥95% coverage.

### Agent C: Multi-region failover docs + K8s config [PARALLEL]

**Prompt:**
FinTech Suite targets Kubernetes multi-region. Create `/docs/FAILOVER.md` documenting: (1) Active-passive setup: primary region (us-east-1), hot-standby (us-west-2, eu-west-1). (2) Database replication strategy (PostgreSQL logical replication). (3) Redis failover (Sentinel or Cluster). Create `/k8s/values.yaml` with region labels, node affinity rules, PDB (Pod Disruption Budget) for HA. Create `/k8s/ingress-multi-region.yaml` with Cloudflare geo-routing rules. Test failover: simulate primary region outage, verify traffic routes to secondary region, DB replicates correctly. Acceptance: Failover docs complete, K8s manifests validate (`kubectl apply --dry-run=client`), failover tested.

---

## Sprint Tasks

### Agent D: White-label polish + QA [SEQUENTIAL]

**Prompt:**
FinTech Suite supports white-label deployments (custom domain, brand colors, logo). Audit white-label configuration: (1) CSS/Tailwind customization (primary color, fonts) via environment variables or config file. (2) Logo upload via API: `/api/config/logo` stores in S3/R2. (3) Email templates use custom domain + branding. (4) Dashboard shows custom company name. (5) Follow Apple HIG: SF Pro fonts, 8pt grid, system color palette supports dark mode, ARIA labels on all controls, keyboard nav works. Test 5 personas: guest sees white-label landing page with custom logo, free-tier user sees branded dashboard, pro admin can upload custom logo/colors, expired user sees rebrand email. Run full security scan: `gosec ./...` + `staticcheck` zero findings. Acceptance: White-label UI renders correctly for all personas, security clean, no hardcoded brand colors.

---

## Quality Verification

### Agent QA: Full Quality Gate [SEQUENTIAL — after all above]

**Prompt:**
Verify FinTech Suite passes all gates: (1) `go test ./... -cover` shows ≥95% in cover.out, line-by-line coverage reported. (2) Max 200 lines: `find . -name '*.go' | xargs awk 'END{if(NR>200) print FILENAME": "NR" lines"}'`. (3) SOLID: interfaces defined for all providers (TokenManager, PaymentProvider, DBConnector), dependency injection via constructors. (4) Security: `gosec ./...` + `staticcheck` zero findings, no secrets in code (env vars only), rate limiting on all public endpoints. (5) Apple HIG: SF Pro fonts, 8pt grid, system colors (light/dark), ARIA labels, focus states 2px outline, keyboard navigation Tab/Enter/Space. (6) Browser personas: guest, free, pro, admin, expired — all pass. Acceptance: All checks pass.

---

## Quality Gate Checklist

□ 95%+ test coverage (`go test ./... -cover`)
□ ≤200 lines per source file
□ SOLID principles (interfaces, DI, repository pattern)
□ Security scan clean (`gosec ./...` + `staticcheck` zero findings)
□ No secrets in code (env vars only)
□ Input validation (Go validator tags on all structs)
□ Apple HIG (SF Pro, 8pt grid, system colors, dark mode, ARIA, keyboard nav)
□ Auth extracted to go-auth module
□ Stripe webhook handling validates correctly
□ Multi-region failover docs + K8s manifests ready
□ Browser test personas: guest, free, pro, admin, expired — all pass
