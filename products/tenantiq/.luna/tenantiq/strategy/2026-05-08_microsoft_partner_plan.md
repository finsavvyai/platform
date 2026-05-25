# Microsoft Partner / App Approval — Plan

**Date:** 2026-05-08
**Owner:** Shahar Solomon
**Goal:** TenantIQ is an officially-listed Microsoft partner with an AppSource transactable SaaS offer, a Microsoft 365 Certified app badge, and Solutions Partner designation in Modern Work or Security within 6 months.

## Why this matters

Three distinct payoffs, in increasing order of effort + value:

1. **Verified Publisher** — blue badge in M365 admin-consent screen. Customers see "Microsoft has verified this publisher" instead of "Unverified." Conversion lift on tenant-connect flow. ~1 week, ~$0.
2. **AppSource transactable offer** — TenantIQ shows up when MSPs search "M365 management" in admin.microsoft.com/marketplace. Microsoft handles billing (CSP-friendly, customers can use committed-spend). 2–4 weeks, ~$0.
3. **Microsoft 365 Certified** — passes third-party security/compliance review. Required for some enterprise procurements. Drives co-sell eligibility. 3–6 months, ~$3–7k assessor cost.

Plus: **Solutions Partner — Modern Work / Security** designation (quarterly metric tracking, drives partner-tier discounts and Microsoft seller co-sell eligibility).

## What's already shipped (verified in source 2026-05-08)

| Asset | Status | Where |
|---|---|---|
| Multi-tenant Entra ID app + OAuth flow | Live | `/api/auth/microsoft/login` |
| Microsoft Graph integration | Live | `packages/graph/src/` |
| 31+ CIS controls wired to real Graph data | Live | `apps/api/src/lib/cis/` |
| AppSource plan ID → tier mapping | Code-ready | `apps/api/src/lib/marketplace-config.ts` (3 plans) |
| Marketplace webhook handler | Code-ready, **needs JWT verify** | `apps/api/src/routes/marketplace.ts:33` |
| GDAP partner-info table + UI | UI-only, **API stubbed** | `apps/web/src/routes/gdap/+page.svelte` + `apps/api/src/routes/gdap.ts:162` |
| Privacy policy mentions AppSource | Live | `apps/web/src/routes/privacy/+page.svelte:54` |
| Sub-processors doc + cert-drift check | Live | `scripts/check-cert-drift.ts` |
| 33-table account-deletion cascade (M365 Cert C7) | Live + contract test | `apps/api/src/lib/account-deletion.ts` |
| ISO 27001:2022 Annex A engine (25 evaluable controls) | Live | `apps/api/src/lib/iso27001/` |
| Audit logger | Live | `apps/api/src/lib/audit-logger.ts` |
| JTI deny-list + iss/aud JWT enforcement | Live | `apps/api/src/routes/auth-session.ts` |
| Daily smoke against prod | Live | `.github/workflows/cert-status.yml` |

The certification ground game is in much better shape than it looks — most of the M365 Cert questionnaire is already answerable from existing artifacts.

## What's missing (gates to close)

1. **Microsoft Partner Center account** — not yet created. Requires a verified company D-U-N-S number (free from Dun & Bradstreet, takes 5–30 days).
2. **Domain verification record** — DNS TXT on tenantiq.app to prove publisher identity.
3. **Marketplace webhook JWT verification** — current handler accepts any non-empty token (`marketplace.ts:33`). Must verify the token issued by Microsoft's marketplace token endpoint.
4. **Landing page redirect URL** — required for AppSource transactable offer; the page customers land on after they buy in marketplace. Should auto-create their TenantIQ org. Not yet implemented.
5. **Partner Center API integration for GDAP** — `apps/api/src/routes/gdap.ts:162` is a TODO stub. Real delegation creation needs Partner Center `granularAdminRelationships` Graph endpoints.
6. **SOC 2 Type 1 attestation** — required for Microsoft 365 Certification. Not started. ~$15–25k for Type 1, 3–6 months.
7. **Penetration test report** — required for Microsoft 365 Certification. Estimate ~$5–15k for a one-time external test; Cobalt or Bishop Fox are the typical vendors.

## Phase plan

### Phase 1 — Publisher Verification (Week 1, $0)

Goal: blue "verified publisher" badge in admin-consent screen.

1. Apply for D-U-N-S (free, 5–30 days). Use form at `microsoft.com/en-us/wdsi/filesubmission`.
2. Create Microsoft Partner Center account at `partner.microsoft.com/en-us/dashboard/account/v3/enrollment/welcome`.
3. Fill enrollment: legal entity name (FinSavvy AI Ltd), MPN ID assigned automatically.
4. Add `tenantiq.app` as a domain. Verify via DNS TXT.
5. In Azure portal → App registrations → TenantIQ app → Branding & properties → set Publisher domain + verify.
6. Submit publisher verification. Microsoft response in 5–7 business days.

**Acceptance:** customer admin-consent screen shows verified-publisher badge.

### Phase 2 — AppSource Transactable SaaS Offer (Week 2–5, $0)

Goal: TenantIQ listed on `appsource.microsoft.com` and `admin.microsoft.com/marketplace` with one-click buy + auto-provision.

1. In Partner Center → Marketplace offers → New offer → Software as a Service.
2. Offer setup:
   - Offer alias: `tenantiq`
   - Setup details: Yes to "transact in marketplace"
   - Test drive: skip (optional)
3. Properties:
   - Categories: Security, Productivity
   - Industries: IT-services, MSP
4. Offer listing:
   - Name, search keywords, summary, description, screenshots (use `/compare` and `/ciso-demo` shots), 1080×1080 logo, video link to /scan/microsoft.com walkthrough
5. Plan setup — three plans match `marketplace-config.ts`:
   - tenantiq-core ($79/tenant/month, recurring monthly)
   - tenantiq-professional ($79/tenant/month bundle, recurring monthly)
   - tenantiq-enterprise ($149/tenant/month, recurring monthly)
6. Technical configuration:
   - **Landing page URL**: `https://app.tenantiq.app/marketplace/landing` ← *needs to be built*. Per Microsoft contract, this page must exchange the marketplace token for subscription details and provision the org.
   - **Connection webhook**: `https://api.tenantiq.app/api/marketplace/webhook` ← already exists at `apps/api/src/routes/marketplace.ts`
   - **Microsoft Entra tenant ID + AAD app ID** for marketplace API auth.
7. Cross-listing: enable for cloud solution providers (CSP).
8. Preview audience: list 3–5 test tenant IDs for sandbox testing.
9. Test the buy flow end-to-end in preview (Microsoft provides a sandbox marketplace).
10. Submit for certification. Microsoft response 5–10 business days; iterate on review feedback.

**Acceptance:** anyone with an M365 admin account can find TenantIQ in admin marketplace, click Buy, and land on a working `/marketplace/landing` that creates their org.

**Code work needed for Phase 2:**
- [ ] `apps/web/src/routes/marketplace/landing/+page.svelte` — receive `?token=` from Microsoft, POST to `/api/marketplace/resolve`, show plan + connect-Azure CTA
- [ ] `apps/api/src/routes/marketplace.ts` — add `/resolve` endpoint that exchanges marketplace token for subscription details via `https://marketplaceapi.microsoft.com/api/saas/subscriptions/resolve`
- [ ] Tighten `validateWebhookToken` in `marketplace.ts:33` — verify Microsoft-issued JWT instead of accepting non-empty strings (currently a stub)
- [ ] Add screenshots + video to `marketplace/listing-assets/`

### Phase 3 — Microsoft 365 Publisher Attestation (Week 6–8, $0)

Goal: pass the self-service security & compliance questionnaire — earns "Publisher Attestation" tier.

1. In Partner Center → Cloud Partner Program → M365 App Compliance → Attestation.
2. Fill 60+ question questionnaire across:
   - Data handling (where stored, how encrypted, retention)
   - Identity & access management (MFA, JIT, RBAC)
   - Application security (SDLC, code review, dependency scanning)
   - Operational security (logging, incident response, BCP)
   - Compliance frameworks claimed (SOC 2, ISO 27001, GDPR)
3. Most answers map to existing artifacts:
   - JTI deny-list + iss/aud → "session revocation supported"
   - Audit logger → "tamper-evident logging"
   - Account-deletion cascade → "GDPR Art. 17 satisfied with verification"
   - Cert-drift CI check → "sub-processor changes tracked"
   - ISO 27001 engine → "compliance baseline maintained"
4. Microsoft response: 2–4 weeks.

**Acceptance:** TenantIQ listed at `learn.microsoft.com/en-us/microsoft-365-app-certification` with Attestation badge.

### Phase 4 — SOC 2 Type 1 + Pen Test (Week 8–24, $20–40k total)

Goal: external audit attestations required for full M365 Certification.

1. Engage Vanta or Drata for SOC 2 Type 1 readiness — they auto-collect evidence from Cloudflare, GitHub, etc. ($300–600/month + $15–25k auditor fee).
2. Trust Service Criteria scope: Security (mandatory), Availability, Confidentiality (recommended). Skip Processing Integrity + Privacy on Type 1.
3. 90-day evidence window for Type 2 starts after Type 1 issues. Plan Type 2 for Q4 2026.
4. External pen test — Cobalt Core ($5–15k for one-time engagement). Test scope: api.tenantiq.app, app.tenantiq.app, OAuth flow, MCP endpoint.
5. Remediate findings. Add tests. Re-test critical/high.

**Acceptance:** SOC 2 Type 1 report + pen test report in hand.

### Phase 5 — Microsoft 365 Certification (Week 24–28, $3–7k)

Goal: full M365 Certified badge — passes third-party security review.

1. Engage Microsoft-approved assessor (Bureau Veritas, Schellman, or LRQA).
2. Submit evidence package:
   - SOC 2 Type 1 report (Phase 4)
   - Pen test report (Phase 4)
   - Architecture diagram (`scripts/gen-architecture-diagram.ts` already exists)
   - Sub-processors list (already maintained)
   - Data flow diagram (need to create)
   - Threat model (need to write — STRIDE on Graph API surface)
3. Assessor reviews 4–6 weeks. May request remediation.
4. Microsoft awards Certification.

**Acceptance:** TenantIQ shows M365 Certified gold badge in admin marketplace + AppSource. Procurement teams stop asking "are you certified?" — they can verify themselves.

### Phase 6 — Solutions Partner Designation (concurrent with Phase 4–5)

Goal: Solutions Partner — Modern Work and/or Security designation.

1. In Partner Center → Membership → Solutions Partner.
2. Choose designation:
   - **Modern Work** — fits TenantIQ broadly (M365 management)
   - **Security** — fits CIS benchmark + threat detection focus
3. Build Partner Capability Score (must reach 70 of 100):
   - Performance (30 pts): net new customers, monthly active users — needs paid customers
   - Skilling (40 pts): certified individuals on team — pass MS-101, SC-200, AZ-500 exams
   - Customer Success (30 pts): deployments, intermediate/advanced workloads usage
4. Submit. Renews quarterly.

**Acceptance:** "Solutions Partner — Modern Work" or "Solutions Partner — Security" badge live on partner.microsoft.com profile + LinkedIn + sales materials.

### Phase 7 — GDAP Partner Center API integration (Week 4–6, code only)

Currently `apps/api/src/routes/gdap.ts:162` has a TODO stub. Wire the real Partner Center API.

1. Use Microsoft Graph endpoints under `/tenantRelationships/delegatedAdminRelationships`.
2. Required Graph permissions: `DelegatedAdminRelationship.ReadWrite.All`.
3. Implement:
   - `POST /api/gdap/relationships` → creates a real delegated admin relationship invitation
   - `GET /api/gdap/relationships` → lists relationships from Partner Center
   - `POST /api/gdap/relationships/:id/access-assignments` → assigns security groups + roles
4. UI at `/gdap` already exists; just point at real API.

**Acceptance:** MSP can invite a customer to GDAP, customer accepts via Partner Center, TenantIQ creates the access assignment with scoped roles, all from inside TenantIQ.

### Phase 8 — Co-sell ready (after Phase 5 + 6)

Goal: Microsoft seller-incentive eligible. Microsoft AEs get paid to sell TenantIQ.

1. Solutions Partner designation (Phase 6) + AppSource transactable (Phase 2) = baseline eligibility.
2. Build IP co-sell materials:
   - Solution overview deck (1-pager + 10-slider)
   - Customer-success stories (need 3 reference accounts)
   - Pricing sheet
   - Co-sell playbook (how Microsoft sellers can win deals with TenantIQ)
3. Submit through Partner Center → Co-sell.
4. Microsoft response 4–8 weeks.

**Acceptance:** TenantIQ in Microsoft seller catalog (`co-sell.microsoft.com`). MS account managers can deal-register us.

## Timeline summary

| Phase | Weeks | Cost | Outcome |
|---|---|---|---|
| 1. Publisher Verification | 1 | $0 | Blue verified badge in consent screen |
| 2. AppSource transactable | 2–5 | $0 | Searchable + buyable in admin marketplace |
| 3. Publisher Attestation | 6–8 | $0 | Listed at certification directory |
| 4. SOC 2 + pen test | 8–24 | $20–40k | Audit reports for full cert |
| 5. M365 Certification | 24–28 | $3–7k | Gold M365 Certified badge |
| 6. Solutions Partner | 16–28 (concurrent) | $0 (incl. exam fees ~$500) | Modern Work / Security designation |
| 7. GDAP API wire-up | 4–6 (code only, can ship Phase 1 era) | $0 | Real GDAP from inside TenantIQ |
| 8. Co-sell ready | 28–36 | $0 | MS sellers paid to sell TenantIQ |

**Total to "officially Microsoft-approved at every visible level":** ~6 months, ~$25–50k.

## Recommended sequencing

**Block A (immediate, this week):**
- Apply for D-U-N-S (Phase 1.1) — async, longest-pole
- Build `/marketplace/landing` page + tighten webhook JWT (Phase 2 prep)
- Wire GDAP Partner Center API (Phase 7) — pure code work, no Microsoft dependency

**Block B (next 2 weeks):**
- Partner Center enrollment, domain verify (Phase 1)
- Submit AppSource offer for preview certification (Phase 2)

**Block C (month 2):**
- Submit Publisher Attestation (Phase 3) — answers questionnaire
- Engage Vanta + book pen test (Phase 4)
- Begin Solutions Partner skilling exams (Phase 6)

**Block D (month 4–6):**
- Receive SOC 2 Type 1 (Phase 4)
- Engage M365 Cert assessor (Phase 5)
- Submit Solutions Partner application (Phase 6)

**Block E (month 6+):**
- M365 Certification awarded (Phase 5)
- Co-sell ready submission (Phase 8)

## Risks + dependencies

- **D-U-N-S delay** — gate for Partner Center enrollment. Apply first.
- **AppSource cert reviewer feedback** — typical 1–2 rounds. Plan for 6 weeks not 4.
- **SOC 2 evidence collection** — 90 days of clean evidence needed for Type 2 later. Start Vanta now to bank evidence days.
- **Customer wins for Solutions Partner score** — needs paid customers + active monthly usage. Sales pipeline is the hard dependency, not Microsoft.
- **GDPR data residency** — if EU customers, may need EU data residency before Phase 5 cert (currently single-region: Cloudflare global, D1 in US). Decision: stay US-only for v1 cert, add EU residency in a later cert renewal.

## Concrete next 7 days

| Day | Owner | Action | Artifact |
|---|---|---|---|
| Mon 2026-05-11 | Shahar | Apply for D-U-N-S at Dun & Bradstreet | confirmation email |
| Mon 2026-05-11 | Shahar | Create Partner Center account (no D-U-N-S needed for account, only for verification) | partner.microsoft.com profile |
| Tue 2026-05-12 | Claude | Build `apps/web/src/routes/marketplace/landing/+page.svelte` + `apps/api/src/routes/marketplace.ts:/resolve` endpoint | code merged to main |
| Tue 2026-05-12 | Claude | Tighten `validateWebhookToken` to verify Microsoft JWT properly | `marketplace.ts:33` no longer accepts arbitrary tokens |
| Wed 2026-05-13 | Claude | Wire GDAP Partner Center API in `gdap.ts:162` | real delegation creation works |
| Wed 2026-05-13 | Shahar | Add DNS TXT record for tenantiq.app domain verification | DNS propagated |
| Thu 2026-05-14 | Shahar | Add Publisher domain to Azure AD app registration | Microsoft.Authorization "Publisher domain" set |
| Fri 2026-05-15 | Shahar + Claude | Capture marketplace screenshots + record /scan/microsoft.com walkthrough video | 5 PNGs + 1 MP4 |

If D-U-N-S comes back fast (luck), submit Publisher Verification by 2026-05-22. AppSource offer in preview by 2026-06-05. Publisher Attestation by 2026-06-26. SOC 2 + pen test running through Q3 2026. M365 Certified end of Q4 2026.

## What this is NOT

- This is not a competitor/displacement plan — TenantIQ stays on AppSource alongside CoreView et al; the Microsoft programs are inclusive, not exclusive.
- This is not Microsoft funding ($0 for Phases 1, 2, 3, 6, 7; the cost is in audits/pen test in Phases 4, 5).
- Claude for Startups (separate doc, `docs/anthropic/SUBMISSION_PACKET.md`) and the Microsoft programs are independent paths — pursue both, neither blocks the other.
