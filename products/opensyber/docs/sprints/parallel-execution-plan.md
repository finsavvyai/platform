# CNSP Parallel Execution Plan

**Last updated:** 2026-03-01

---

## Summary

Sprints 11–22 can run on four parallel tracks, reducing wall-clock time from
**57 days sequential → 35 days parallel** (38% reduction).

```text
Sequential wall-clock:  57 days  (one sprint at a time)
Parallel wall-clock:    35 days  (4 tracks, critical path = Track A)
Wall-clock reduction:   22 days  (38%)
```

The critical path runs through **Track A** (core security spine). All other
tracks either feed Track A or run independently without blocking it.

---

## Tracks

| Track | Responsibility | Critical Path? |
| --- | --- | --- |
| **A** | Core security spine (CSPM → Risk → Graph → AI → Remediation → Exit) | Yes |
| **B** | Identity + SaaS + Multi-cloud (feeds Track A at merge points) | No |
| **C** | Skill SDK + all skill packaging (feeds marketplace) | No |
| **D** | Marketplace + Platform Automation (waits for Track A milestone C) | No |

---

## Day-by-Day Timeline

```text
          Track A              Track B              Track C              Track D
          (Core Spine)         (Identity/SaaS)      (Skill Packaging)    (Marketplace/Platform)
Day  1  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
        │ S11: Cloud CSPM │  │ S12: Vault/JIT  │  │ S11b: Skill SDK │
Day  2  │ (Prowler, 5d)   │  │ (rotation, 4d)  │  │ (3d)            │
Day  3  │                 │  │                 │  └──── SDK DONE ───┤
        │                 │  │                 │  ┌─────────────────┤
Day  4  │                 │  └─── B1 DONE ────┤  │ tokenforge (0.5d│
        │                 │                   │  │ queryflux-mcp   │
Day  5  └──── A1 DONE ───┤                   │  │ (0.5d)          │
        ┌─────────────────┤                   │  │ finsavvyai (1d) │
Day  6  │ S13: Risk Intel │                   │  │ pipewarden (1d) │
        │ (scoring, 3d)   │  ┌─────────────────┤  │ tenantiq (2d)   │
Day  7  │                 │  │ S15: SaaS Posture│  │                 │
        │                 │  │ (TenantIQ, 5d)  │  │                 │
Day  8  └──── A2 DONE ───┤  │                 │  │                 │
        ┌─────────────────┤  │                 │  │                 │
Day  9  │ S14: Attack     │  │                 │  │ mcpoverflow (2d)│
        │ Graph (BFS, 5d) │  │                 │  │ querylens (2d)  │
Day 10  │                 │  │                 │  │ quantumbeam (3d)│
Day 11  │                 │  └──── B2 DONE ───┤  │ automationhub   │
        │                 │                   │  │ (2d)            │
Day 12  │                 │  ┌── B2→A merge ──┤  │ upm (3d)        │
        │                 │  │ SaaS feeds S14  │  │ qestro (4d)     │
Day 13  └──── A3 DONE ───┤  │ (attack graph   │  └── C DONE ───────┤
        ┌─────────────────┤  │  gets SaaS nodes│                   │
Day 14  │ S16: AI Intel   │  │                 │                   │
        │ (LLM/threat,4d) │  │                 │                   │
        │ + finsavvyai    │                   │                   │
Day 15  │ skill plugs in  │  ┌─────────────────┤                   │
        │                 │  │ S18: Multi-Cloud│                   │
Day 16  │                 │  │ (AWS/GCP/Azure  │                   │
        │                 │  │ Prowler extend, │                   │
Day 17  └──── A4 DONE ───┤  │ 5d)             │                   │
        ┌─────────────────┤  │                 │                   │
Day 18  │ S17: Remediation│  │                 │                   │
        │ (playbooks, 4d) │  │                 │                   │
Day 19  │ + automationhub │  └──── B3 DONE ───┤                   │
        │ skill lands here│                                        │
Day 20  │                 │                                        │
Day 21  └──── A5 DONE ───┤     ←─ Milestone C: AI+Remediation ──────
                          │
Day 22  ┌─────────────────┤                        ┌──────────────────┐
        │ S20: Enterprise │                        │ S19: Marketplace │
        │ Exit (SOC2, 5d) │                        │ (skills launch,  │
Day 23  │                 │                        │ 4d)              │
Day 24  │                 │                        │                  │
Day 25  │                 │                        │                  │
Day 26  └──── A6 DONE ───┤                        └──── D1 DONE ────┤
        ┌─────────────────┤                        ┌──────────────────┤
Day 27  │ S22: Platform   │                        │ S21: Connect     │
        │ Data (GraphQL,  │                        │ Automation (SOAR │
Day 28  │ Trust Portal,   │                        │ 4d)              │
        │ Public API, 5d) │                        │                  │
Day 29  │                 │                        └──── D2 DONE ────┤
Day 30  │                 │
Day 31  └──── DONE ───────┘
```

---

## Sprint Dependencies (Verified)

```text
S11 (CSPM) ──────────────────────────────┐
S11b (SDK) ─────────────────────┐        │
S12 (Vault) ─────────────────┐  │        │
                              │  │        │
                              ↓  ↓        │
                           S13 (Risk)  S15 (SaaS)
                              │           │
                              └─────┬─────┘
                                    ↓
                                 S14 (Graph)
                                    │
                              ┌─────┘
                              │
                           S16 (AI Intel)    S18 (Multi-Cloud)
                              │              (needs S11 + S14)
                              ↓
                           S17 (Remediation)
                              │
                    ┌─────────┼─────────┐
                    ↓         ↓         ↓
                 S19 (Mktpl) S20 (Exit) S21 (Connect)
                    │         │         │
                    └────┬────┘         │
                         ↓             ↓
                      S22 (Data Platform — after S20 + S21)
```

---

## Skill Landing Plan

Skills from Track C land in their target sprints just-in-time:

| Skill | Packaging Done | Lands In | Value |
| --- | --- | --- | --- |
| `tokenforge-session-security` | Day 4 | Sprint 11b | Reference skill for SDK |
| `queryflux-mcp` | Day 4 | Sprint 16 | Free DB MCP tools |
| `finsavvyai-llm-gateway` | Day 5 | Sprint 16 | Free LLM provider gateway |
| `tenantiq-m365-security` | Day 7 | Sprint 15 | Free M365 posture scanner |
| `pipewarden-cicd-security` | Day 6 | Sprint 20 | Free CI/CD security gate |
| `mcpoverflow-connector-gen` | Day 10 | Sprint 19 | Skill factory meta-skill |
| `querylens-nl-sql` | Day 10 | Sprint 16 | NL→SQL for security queries |
| `quantumbeam-fraud-detection` | Day 12 | Sprint 13 | Fraud signal for risk scoring |
| `automationhub-soar` | Day 12 | Sprint 21 | Free SOAR DAG engine |
| `upm-dependency-audit` | Day 13 | Sprint 11 | npm/PyPI CVE scanning |
| `qestro-security-testing` | Day 13 | Sprint 21 | Security test generator |

---

## Milestone Map (Parallel Schedule)

| Milestone | Sprint | Parallel Day | Capability Unlocked |
| --- | --- | --- | --- |
| **A** — CSPM MVP | S13 | Day 8 | Cloud scanning + risk scoring live |
| **B** — Attack + SaaS | S15 | Day 11 | Attack graph + M365 posture |
| **C** — AI + Remediation | S17 | Day 21 | AI triage + autonomous remediation |
| **D** — Platform | S20 | Day 26 | Multi-cloud + marketplace + SOC2 |
| **E** — Data Platform | S22 | Day 31 | GraphQL API + Trust Portal |

---

## Sequential vs Parallel Comparison

### Sequential (1 developer, 1 sprint at a time)

```text
S11(5) → S11b(3) → S12(4) → S13(3) → S14(5) → S15(5) → S16(4) → S17(4) →
S18(5) → S19(4) → S20(5) → S21(4) → S22(5) = 57 days
```

### Parallel (2-3 developers across tracks)

```text
Track A drives the critical path: S11→S13→S14→S16→S17→S20→S22
         5  +  3  + 5  + 4  + 4  +  5  + 5  = 31 days on critical path
Plus overhead for handoff/merge: +4 days
Wall-clock total: ~35 days
```

### Staffing Model

```text
Developer 1: Track A (core spine — most complex, drives all milestones)
Developer 2: Track B (identity + SaaS + multi-cloud — domain-specific)
Developer 3: Track C (skill packaging — lower complexity, high parallelism)
Developer 1: Track D (marketplace + automation — after Milestone C)
```

Minimum team size: **2 developers** (D1 handles A+D, D2 handles B+C).
Optimal team size: **3 developers** (max parallelism, all tracks concurrent).

---

## Skill Packaging Critical Gates

The following skills MUST be ready before their target sprint starts.
If packaging slips, the sprint should proceed without the skill (hand-build fallback).

| Skill | Must Be Ready By | Fallback |
| --- | --- | --- |
| `tokenforge-session-security` | Day 3 (before S11b) | Skip — ship as Sprint 12 add-on |
| `finsavvyai-llm-gateway` | Day 13 (before S16) | Hand-build Anthropic integration (2d) |
| `tenantiq-m365-security` | Day 11 (before S15) | Hand-build M365 connector (5d) |
| `automationhub-soar` | Day 21 (before S21) | Hand-build DAG engine (4d) |
| `pipewarden-cicd-security` | Day 21 (before S20) | Hand-build GitHub Action gate (2d) |

---

## Risk Flags

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Track B (S15) slips past Day 13 | Attack graph (S14) starts without SaaS nodes | Ship S14 with cloud-only nodes; SaaS nodes added via hot-patch |
| Track C skills miss gate | Sprint loses time savings, must hand-build | Skills have fallback estimates; always ship sprint on time |
| S18 (Multi-Cloud) scope creep | Delays S20 | S18 is Track D, not on critical path — can slip 1 sprint without impact |
| AutomationHub test gap (18%→80%) | Skill delayed if tests take longer | Write tests during Day 11-12 packaging; ship with 80% coverage minimum |
