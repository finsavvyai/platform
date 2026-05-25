# OpenSyber Competitive Execution Board (90 Days)

> Goal: Beat direct competitors (Modal, Lasso, Protect AI, Clerk/Auth0) by compounding product proof + positioning + distribution faster than they can respond.
>
> Window: 90 days (6 two-week sprints)
>
> Source inputs: `SUMMARY.md`, `NEXT-ACTIONS.md`, and existing codebase map under `.planning/codebase/`.

---

## Team Owner Map

- **PM (Owner):** scope, sequencing, decisions, sprint sign-off
- **Eng Lead:** implementation quality, technical sequencing, architecture risks
- **Product Engineer:** dashboard, integrations, SDKs, platform UI
- **Security Engineer:** Sigstore/SBOM, attestation integrity, trust claims
- **DevRel/Docs:** tutorials, comparisons, launch narrative, example repos
- **Growth/Marketing:** homepage, distribution, onboarding funnel, campaigns
- **Data/Analytics:** instrumentation, KPI dashboards, experiment readouts

If one person wears multiple hats, keep the role labels as accountability lanes.

---

## North-Star Metrics (Tracked Weekly)

- **Activation:** signup -> first secured agent in <= 60s
- **Retention:** weekly active projects using runtime telemetry
- **Adoption:** adapter installs (`modal-adapter`, `fly-adapter`, `tokenforge mcp`)
- **Trust Conversion:** % users who view attestation/SBOM and continue to deploy
- **Revenue Leading:** free-to-paid conversion (OpenSyber + TokenForge)

Baseline these in Sprint 1, then evaluate deltas sprint-by-sprint.

---

## Sprint Board

## Cross-Cut Track: AI Agent Discovery Suite

**Positioning:** "You cannot secure what you cannot see."

**Objective:** Build a discovery-first wedge that inventories agent usage across repos/workspaces, then converts that inventory into secured OpenSyber runtime adoption.

**Owner:** Product Engineer + Eng Lead + Data/Analytics

**MVP Scope (first release)**
- Agent inventory across connected repos/workspaces:
  - agent frameworks and SDKs
  - MCP servers/tools
  - automation scripts and scheduled jobs
- Risk scoring model per discovered agent:
  - credentials exposure risk
  - network/shell capability risk
  - ownership and stale-activity risk
- Discovery dashboard:
  - total discovered agents
  - unsecured vs secured split
  - owner mapping and last-seen activity
- One-click conversion flow:
  - "Protect with OpenSyber" action from each discovered record

**MVP KPIs**
- >= 80% discovery precision on seeded test repos
- >= 60% of discovered agents mapped to an owner/team
- >= 25% of unsecured discovered agents moved to secured state within 14 days

**Sprint Placement**
- Sprint 3: schema, scanner primitives, inventory UI skeleton
- Sprint 4: owner mapping + risk model + "Protect with OpenSyber" action
- Sprint 5: GA hardening, docs, and discovery-led GTM launch

---

## Sprint 1 (Weeks 1-2): Message + Proof Foundation

**Theme:** Clarify category claim and expose proof in product.

**Owner:** PM + Growth + Product Engineer

**Deliverables**
- Launch homepage/message update around three pillars:
  - Runtime
  - Security
  - Marketplace
- Publish competitor comparison page set:
  - OpenSyber vs Modal
  - OpenSyber vs Lasso
  - OpenSyber vs Protect AI
- Define telemetry instrumentation events for:
  - attestation page view
  - first secured deploy
  - marketplace trust interactions

**KPI Targets**
- +20% homepage -> signup conversion vs baseline
- +15% signup -> first deploy activation
- 100% of critical funnel events instrumented and visible in analytics

**Exit Criteria**
- Messaging live in production
- Comparison pages indexed
- Dashboard events validated end-to-end

---

## Sprint 2 (Weeks 3-4): Security Trust Moat

**Theme:** Beat Lasso-style “audit only” story with verifiable chain of trust.

**Owner:** Security Engineer + Eng Lead

**Deliverables**
- Ship Sigstore signing for marketplace skills
- Generate and expose SBOM for each marketplace skill artifact
- Add trust badges/UI states in marketplace:
  - Signed
  - SBOM available
  - Verification timestamp
- Create failure path UX for unsigned/unverified artifacts

**KPI Targets**
- 100% newly published skills signed
- 100% marketplace entries expose SBOM metadata
- >= 30% of marketplace sessions interact with trust indicators

**Exit Criteria**
- CI fails on unsigned skill publish
- Verification checks are test-covered
- Trust UI visible across desktop + mobile views

---

## Sprint 3 (Weeks 5-6): Runtime Attestation as Product Surface

**Theme:** Show what competitors cannot show in one place.

**Owner:** Product Engineer + Security Engineer

**Deliverables**
- Launch runtime attestation feed page in dashboard
- Add event stream for osquery/seccomp telemetry and policy violations
- Ship “no-delete mode” flag in marketplace schema + UI (from threat mitigation)
- Add lightweight downloadable evidence summary for enterprise conversations
- AI Agent Discovery Suite foundations:
  - inventory schema + seed data pipeline
  - first-pass scanner for MCP/agent signatures
  - dashboard section showing discovered vs protected agents

**KPI Targets**
- >= 40% of active dashboard users visit attestation feed
- >= 25% of deploying users enable at least one hardening control
- >= 10 design-partner demos use attestation page as core proof point

**Exit Criteria**
- Attestation feed stable under expected load
- Security events are filterable and understandable
- Evidence summary export works for at least one real customer flow
- Discovery pipeline returns stable inventory snapshots on internal test repos

---

## Sprint 4 (Weeks 7-8): Sidecar Distribution (Modal First)

**Theme:** Convert the strongest threat into a distribution channel.

**Owner:** Eng Lead + DevRel

**Deliverables**
- Ship `@opensyber/modal-adapter` MVP:
  - quick-start
  - minimal API wrapper
  - telemetry passthrough into OpenSyber
- Publish “OpenSyber + Modal” support matrix and integration guide
- Launch one reference implementation repo
- AI Agent Discovery Suite conversion layer:
  - owner/team mapping in inventory UI
  - risk scoring for discovered agents
  - one-click "Protect with OpenSyber" from discovery records

**KPI Targets**
- >= 50 weekly npm installs for modal adapter by end of sprint
- >= 10 teams run first successful sidecar integration
- >= 1 public case study or testimonial secured

**Exit Criteria**
- Adapter usable in < 20 minutes from README
- Docs pass independent follow test by a non-author
- Support matrix page live and linked from comparisons
- Discovery records can transition from "unsecured" to "protected" in product UX

---

## Sprint 5 (Weeks 9-10): TokenForge Competitive Wedge

**Theme:** Win the Clerk/Auth0 flank with device-bound auth clarity + DX.

**Owner:** Product Engineer + DevRel + Growth

**Deliverables**
- Ship TokenForge MCP adapter as first-class package/docs
- Publish Next.js 16 “1-click path” tutorial to match Clerk onboarding speed
- Publish pricing page changes:
  - free <10K MAU signal
  - per-bound-device enterprise framing
- Ensure MIT-license + OSS messaging is explicit and consistent
- AI Agent Discovery Suite GA:
  - hardening for scanner false positives
  - docs/playbook: "Run Discovery in 10 minutes"
  - launch narrative: "Discover -> Score -> Protect"

**KPI Targets**
- >= 2x week-over-week TokenForge docs traffic
- >= 30% increase in SDK install-to-first-request completion
- >= 15 qualified inbound leads mention device-bound auth/MCP

**Exit Criteria**
- New onboarding doc can be completed in <= 15 minutes
- MCP adapter examples compile and run
- Pricing messaging consistent across site/docs/repo
- Discovery-led onboarding converts first users from inventory to protected runtime

---

## Sprint 6 (Weeks 11-12): Category Capture + Strategic Commit

**Theme:** Move from feature competition to standard-setting.

**Owner:** PM + Eng Lead + Security Engineer

**Deliverables**
- Draft OpenAgentSec v0.1 spec (public artifact)
- Prepare submission package for Linux Foundation Agentic AI Foundation
- Publish roadmap for open-source runtime boundary:
  - what is open
  - what remains managed/premium
- Launch founder cohort campaign (first 100 program) with strict eligibility

**KPI Targets**
- 1 standards submission completed
- >= 3 design partners commit to pilot on spec direction
- >= 10 paying opportunities sourced from founder cohort

**Exit Criteria**
- Spec reviewed by internal technical and GTM leads
- Open/closed boundary approved with legal and product
- Cohort campaign has measurable acquisition funnel

---

## Risk Register + Mitigations

- **Risk:** Team spreads thin across product + content.
  - **Mitigation:** Hard cap WIP to one core build lane + one growth lane per sprint.
- **Risk:** Claims outpace technical proof.
  - **Mitigation:** No marketing claim without live product artifact or testable demo.
- **Risk:** Sidecar adapters become support burden.
  - **Mitigation:** strict v1 surface area, templated integration paths, issue triage SLA.
- **Risk:** Free-tier expansion hurts margins.
  - **Mitigation:** run as flagged A/B with CAC/LTV guardrails before full rollout.

---

## Weekly Operating Rhythm

- **Monday:** KPI review + sprint risk review (30-45 min)
- **Tuesday-Thursday:** execution blocks (no scope changes except sev-1)
- **Friday:** demo day + competitive update + next sprint prep

---

## Decision Gates (Must Not Skip)

- **Gate A (end Sprint 2):** trust moat shipped? If no, pause adapters and finish.
- **Gate B (end Sprint 4):** sidecar adoption strong enough? If no, improve onboarding before Fly adapter.
- **Gate C (end Sprint 6):** standards/open-source bet validated? If no, continue as product-led moat only.

---

## Immediate Next Command

Turn this into tracked implementation tasks with your GSD flow:

- `/gsd:new-project`
- then `/gsd-plan-phase 1`

Recommended Phase 1 scope from this board:
- Sprint 1 + Sprint 2 deliverables (message + trust moat) as initial milestone.

