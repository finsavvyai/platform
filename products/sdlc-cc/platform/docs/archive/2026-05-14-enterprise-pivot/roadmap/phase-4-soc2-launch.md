# Phase 4 — SOC2 Type II + GA Launch (Days 76-90)

Goal: pass SOC2 Type II audit, run a load test that confirms the
documented capacity targets, execute the launch playbook, declare GA.

---

### Day 76 — SOC2 Type II audit kickoff

**Goal:** auditor engaged, scope agreed, evidence collection automation
running.

**Steps:** select auditor (e.g., Drata-partnered firm, A-LIGN, Schellman). Scope: Security, Availability, Confidentiality, Privacy trust principles. 6-month observation window kickoff.

**Done when:** auditor engaged; observation window started.

**Prompt:**
> Kick off the SOC2 Type II audit for sdlc-platform. Select an auditor (A-LIGN, Schellman, or equivalent). Scope: Security, Availability, Confidentiality, Privacy. Start the 6-month observation window. Wire Drata or Vanta for continuous evidence collection. Document the engagement in `docs/compliance/soc2-engagement.md`.

---

### Day 77 — SOC2 evidence automation

**Goal:** every control has automated evidence collection.

**Files:** `services/gateway/internal/infrastructure/compliance/evidence/`.

**Steps:** integrate with Drata or build internal collectors that pull access reviews, change management, vulnerability scans, training records, and back-up tests on a schedule.

**Tests:** evidence collected daily for at least 5 controls.

**Done when:** Drata/Vanta dashboard shows passing evidence for all in-scope controls.

**Prompt:**
> Wire automated SOC2 evidence collection for sdlc-platform. Integrate with Drata or Vanta. Pull access reviews, change management, vulnerability scans, training records, and back-up tests on schedule. Confirm passing evidence on all in-scope controls in the Drata/Vanta dashboard.

---

### Day 78 — Access review (quarterly cadence start)

**Goal:** every access grant reviewed quarterly; orphaned grants revoked.

**Files:** `services/gateway/internal/infrastructure/access_review/`.

**Steps:** quarterly job lists every grant, owner approves or revokes via UI, signed approval logged. SOC2 control evidence.

**Tests:** review cycle round-trips; orphaned grants surface; approval logged.

**Done when:** the first quarterly review is complete and audited.

**Prompt:**
> Implement quarterly access reviews for sdlc-platform. Job lists every grant; owner approves or revokes via admin UI; signed approval is logged. Tests cover the round-trip and orphan detection. Run the first cycle and capture as SOC2 evidence.

---

### Day 79 — Change management formalization

**Goal:** every production change goes through a tracked review with approval.

**Files:** `.github/CODEOWNERS`, `.github/PULL_REQUEST_TEMPLATE.md`.

**Steps:** CODEOWNERS requires a security review for any change to security/, auth/, billing/. PR template has impact + rollback + testing sections.

**Tests:** PRs without approvals cannot merge; CODEOWNERS enforced via GitHub branch protection.

**Done when:** branch protection enforces; first audited month shows 100% PR approval rate.

**Prompt:**
> Formalize change management for sdlc-platform. CODEOWNERS requires security-team review for changes to security/, auth/, billing/. PR template enforces impact + rollback + testing sections. Branch protection blocks merge without required approvals. SOC2 evidence: monthly report of PRs vs approvals.

---

### Day 80 — Incident response runbook + tabletop exercise

**Goal:** documented IR runbook + a quarterly tabletop exercise.

**Files:** `docs/runbooks/incident-response.md`, `docs/runbooks/tabletop-q1-2027.md`.

**Steps:** runbook covers detection, classification (sev 1-4), communication, eradication, recovery, post-mortem. Tabletop exercise rehearses a fake breach.

**Tests:** tabletop completed; gaps documented and assigned.

**Done when:** runbook tested via tabletop; gaps assigned to owners.

**Prompt:**
> Write an incident response runbook for sdlc-platform at `docs/runbooks/incident-response.md`. Cover detection, classification (sev 1-4), communication, eradication, recovery, post-mortem. Run a quarterly tabletop exercise; document gaps in `docs/runbooks/tabletop-q1-2027.md`.

---

### Day 81 — Vendor risk management process

**Goal:** every sub-processor has a current risk assessment and contractual security review.

**Files:** `docs/compliance/vendor-risk/`.

**Steps:** template risk assessment per vendor; annual review cadence; contractual security clauses tracked.

**Done when:** every current sub-processor has a fresh risk assessment.

**Prompt:**
> Implement vendor risk management for sdlc-platform. Risk assessment template per sub-processor; annual review cadence; contractual security clauses tracked in `docs/compliance/vendor-risk/`. Stand up a current assessment for every sub-processor. Wire a recurring quarterly review reminder.

---

### Day 82 — Load test at documented capacity (1M docs, 10K users)

**Goal:** load test confirms platform handles 1M documents indexed + 10K concurrent users at documented SLOs.

**Files:** `tests/load/scale.js`, `docs/performance/scale-test.md`.

**Steps:** ingest 1M synthetic documents; ramp 10K concurrent users for 1 hour; capture p50/p95/p99 latencies and error rate.

**Tests:** the load test itself; SLO assertions: p95 query <2s, p95 upload <30s, error rate <0.1%.

**Done when:** all SLO assertions pass; results published.

**Prompt:**
> Run the full-scale load test for sdlc-platform: 1M documents indexed + 10K concurrent users for 1 hour. Capture latency p50/p95/p99 and error rate. SLOs: p95 query <2s, p95 upload <30s, error rate <0.1%. Publish results in `docs/performance/scale-test.md`. If any SLO misses, file a remediation issue and stop.

---

### Day 83 — Capacity headroom plan

**Goal:** documented scaling triggers and runbook for 10x growth.

**Files:** `docs/runbooks/capacity-planning.md`.

**Steps:** identify bottlenecks from Day 82 (likely Postgres connections, pgvector recall throughput, Redis memory). Document horizontal scale paths.

**Done when:** runbook reviewed by infra; auto-scale triggers wired.

**Prompt:**
> Produce a capacity planning runbook for sdlc-platform at `docs/runbooks/capacity-planning.md` based on the Day 82 load test results. Document bottlenecks, scaling triggers, and the runbook for 10x growth. Wire auto-scale alarms in Prometheus.

---

### Day 84 — Status page + SLA commitment

**Goal:** public status page (statuspage.io or self-hosted) with SLA commitments per tier.

**Files:** `docs/sla.md`, status page configuration.

**Steps:** SLA: 99.9% uptime for Team, 99.95% for Enterprise. Public status page with automated incident postings.

**Done when:** status page live; SLA published; first incident auto-posted via test.

**Prompt:**
> Stand up the sdlc-platform status page (statuspage.io or self-hosted Cachet). Wire automated incident posting from Prometheus alerts. Publish SLA: 99.9% Team, 99.95% Enterprise at `docs/sla.md`. Test by triggering a synthetic incident.

---

### Day 85 — Customer onboarding documentation

**Goal:** a customer can self-onboard from signup to first successful query.

**Files:** `docs/customer-onboarding/`, `landing-page/onboarding/`.

**Steps:** signup → SSO config → first connector → first query. Each step has UI + docs. Track time-to-first-query metric.

**Done when:** test customer self-onboards in <30 minutes.

**Prompt:**
> Build self-serve customer onboarding for sdlc-platform. Signup → SSO config → first connector → first query. Each step has UI + docs. Track time-to-first-query. Test with an external customer and target <30 min.

---

### Day 86 — Pricing page + checkout flow

**Goal:** customers can sign up and purchase a plan from the landing page.

**Files:** `landing-page/pricing/`, integration with Stripe billing.

**Steps:** Team / Enterprise tiers; Stripe checkout for Team; sales contact form for Enterprise. Plan changes reflected in real-time on the gateway.

**Tests:** Stripe checkout round-trip; plan upgrade enables features within 60s.

**Done when:** purchase + plan-change works end-to-end.

**Prompt:**
> Build the sdlc-platform pricing page and checkout flow on the landing page. Team tier self-serve via Stripe; Enterprise tier triggers a sales contact form. Plan changes propagate to the gateway in <60s. Tests cover the Stripe round-trip and plan-change feature toggling.

---

### Day 87 — Marketing launch assets

**Goal:** launch blog post, demo video, comparison-vs-competitors page, AI-agent discoverability files (llms.txt, ai-plugin.json).

**Files:** `landing-page/blog/`, `landing-page/static/llms.txt`, `landing-page/static/ai-plugin.json`.

**Steps:** blog post explains the differentiator (compliance-first multi-provider AI gateway); demo video; AI-agent files for discoverability.

**Done when:** all assets published; landing-page Lighthouse score ≥95.

**Prompt:**
> Produce the sdlc-platform launch marketing assets. Blog post at `landing-page/blog/launch.mdx` with the compliance-first multi-provider AI gateway angle. Demo video. Comparison vs Claude Enterprise, ChatGPT Enterprise, and LangChain. Generate `llms.txt` and `ai-plugin.json` for AI agent discoverability. Landing-page Lighthouse must hit ≥95.

---

### Day 88 — Final security + compliance review

**Goal:** internal security + legal review signs off; SOC2 auditor confirms readiness.

**Steps:** internal review checklist; SOC2 auditor confirms observation window and evidence are sufficient for Type II report.

**Done when:** signed sign-off in `docs/compliance/launch-signoff.md`.

**Prompt:**
> Run the final security + compliance review for sdlc-platform. Walk through the internal checklist + the SOC2 auditor's observation evidence. Capture sign-offs in `docs/compliance/launch-signoff.md`. Stop and surface any blocker — do NOT launch with unresolved findings.

---

### Day 89 — Launch dry run on staging

**Goal:** rehearse the launch on staging.

**Steps:** run the launch playbook end-to-end against staging; capture timing; identify gaps.

**Done when:** staging dry-run completed; gaps closed.

**Prompt:**
> Execute the sdlc-platform launch playbook end-to-end against staging. Capture timing and gaps. Resolve every gap before the production launch.

---

### Day 90 — Production launch

**Goal:** sdlc.cc is GA. Tag `v1.0.0`. Announce.

**Steps:**
1. Pre-launch: confirm CI green, status page green, on-call rota staffed.
2. Launch: enable production sign-up; flip the marketing site live.
3. Post-launch: announce on blog, Twitter/X, Hacker News, LinkedIn, Product Hunt.
4. T+1h: smoke test all flows in production.
5. T+24h: incident retrospective if anything fired.

**Done when:** v1.0.0 tag on main; first paying customer onboarded.

**Prompt:**
> Launch sdlc-platform v1.0.0. Pre-launch: confirm CI green, status page green, on-call rota staffed. Flip production sign-up live. Announce on blog, X, HN, LinkedIn, PH. T+1h smoke test all flows. T+24h post-mortem if anything fired. Tag `v1.0.0` on main when the first paying customer's first query succeeds in production.

---

End of Phase 4. Tag: `v1.0.0`. Estimated readiness: 100% (GA).

## Post-launch cadence

- Weekly on-call rotation.
- Monthly security scan + dependency update sweep.
- Quarterly access review + tabletop exercise.
- Annual pen test + SOC2 renewal.
- Continuous: customer feedback → backlog → next release.
