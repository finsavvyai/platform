# AMLIQ v2 — Sprint Remediation Plan

> **Created**: April 3, 2026
> **Based on**: Line-by-line codebase audit (see `AUDIT.md`)
> **Scope**: 14 sprints (S-35 through S-48), 7 months
> **Goal**: Close all 14 identified gaps, achieve World-Check competitive parity

---

## Sprint Overview

| Sprint | Name | Weeks | Priority | Gaps Closed | Depends On | Status |
|--------|------|-------|----------|-------------|------------|--------|
| **S-35** | Wire Embedding Layer | 1-2 | CRITICAL | G1 | — | Complete |
| **S-36** | Graph Matching v1 | 3-4 | CRITICAL | G2 | — (parallel with S-35) | Complete |
| **S-37** | PEP Data & Screening | 5-6 | CRITICAL | G3 | S-36 | Complete |
| **S-38** | Adverse Media Pipeline | 7-8 | CRITICAL | G4 | S-35 | Complete |
| **S-39** | Expanded Sanctions Lists | 9-10 | CRITICAL | G5 | — | Complete |
| **S-40** | Continuous Monitoring | 11-12 | HIGH | G8 | S-39 | Complete |
| **S-41** | Billing Hardening | 13-14 | HIGH | G6, G7, G12 | — | Complete |
| **S-42** | Case Management v2 | 15-16 | HIGH | G10 | — | Complete |
| **S-43** | Enforcement Actions DB | 17-18 | HIGH | G9 | S-39 | Complete |
| **S-44** | SDK Packages | 19-20 | MEDIUM | G14 | S-41 | Complete |
| **S-45** | SAR/STR Report Templates | 21-22 | MEDIUM | G11 | S-42 | Complete |
| **S-46** | Payment Rail Integration | 23-24 | MEDIUM | — (new) | S-35, S-39 | Complete |
| **S-47** | SOC 2 Prep & Hardening | 25-26 | MEDIUM | G13 | — | Complete |
| **S-48** | Launch Readiness & QA | 27-28 | CRITICAL | All | All | In Progress |

---

## Parallelization

Sprints that can run in parallel (if you have multiple developers):

- **S-35 + S-36**: Embedding + Graph (independent layers)
- **S-37 + S-38**: PEP + Adverse Media (independent data pipelines)
- **S-41 + S-42**: Billing + Case Management (independent systems)
- **S-43 + S-44**: Enforcement + SDK (independent)
- **S-45 + S-46**: Reports + Payments (independent)

With 2 developers, you could compress 7 months → ~4 months.

---

## Milestones

| Month | Sprints | Milestone | What Changes |
|-------|---------|-----------|--------------|
| 1 | S-35, S-36 | **6-Layer Engine** | Embedding + Graph layers live. Docs become truthful. |
| 2 | S-37, S-38 | **PEP + Media** | PEP screening operational. Adverse media pipeline live. |
| 3 | S-39, S-40 | **Coverage + Monitoring** | 30+ sanctions lists. Continuous monitoring. **CREDIBLE WC ALTERNATIVE.** |
| 4 | S-41, S-42 | **Enterprise Ready** | Billing production-ready. Case management v2. |
| 5 | S-43, S-44 | **Enforcement + SDK** | Enforcement DB live. SDK packages published. **ON-PREM POSSIBLE.** |
| 6 | S-45, S-46 | **Compliance Suite** | SAR/STR templates. Payment rail screening. |
| 7 | S-47, S-48 | **LAUNCH** | SOC 2 prep. Full QA. Beta customers. **PRODUCTION LAUNCH.** |

---

## Gap → Sprint Mapping

| Gap ID | Description | Sprint | Effort |
|--------|-------------|--------|--------|
| G1 | Embedding layer not wired | S-35 | Small |
| G2 | Graph layer is no-op stub | S-36 | Medium |
| G3 | No PEP database | S-37 | Large |
| G4 | No adverse media pipeline | S-38 | Large |
| G5 | Only 8 sanctions lists | S-39 | Medium |
| G6 | Billing seats stubbed | S-41 | Small |
| G7 | Billing 503 without LS | S-41 | Small |
| G8 | No continuous monitoring | S-40 | Medium |
| G9 | No enforcement actions | S-43 | Medium |
| G10 | Case management too basic | S-42 | Medium |
| G11 | No SAR/STR templates | S-45 | Medium |
| G12 | Order webhook empty | S-41 | Small |
| G13 | No SOC 2 / ISO 27001 | S-47 | Large (process) |
| G14 | SDK packages missing | S-44 | Medium |

---

## How to Use These Sprint Docs

Each sprint file (`sprint-35.md` through `sprint-48.md`) contains:

1. **Objective** — one-sentence goal
2. **Background** — what exists today and why it's insufficient
3. **Tasks** — numbered, with specific files to create/modify, line estimates, and test requirements
4. **Acceptance Criteria** — checkboxes for what "done" means
5. **Files Created/Modified** — exact file paths

To execute a sprint with an AI coding agent:
```
Read .luna/aegis/sprints/sprint-35.md
Then execute each task in order.
Run tests after each task.
Check all acceptance criteria before marking done.
```

---

## File Index

```
.luna/aegis/sprints/
├── SPRINT_PLAN.md          ← This file (master index)
├── sprint-35.md            ← Wire Embedding Layer
├── sprint-36.md            ← Graph Matching v1
├── sprint-37.md            ← PEP Data & Screening
├── sprint-38.md            ← Adverse Media Pipeline
├── sprint-39.md            ← Expanded Sanctions Lists
├── sprint-40.md            ← Continuous Monitoring
├── sprint-41.md            ← Billing Hardening
├── sprint-42.md            ← Case Management v2
├── sprint-43.md            ← Enforcement Actions DB
├── sprint-44.md            ← SDK Packages
├── sprint-45.md            ← SAR/STR Report Templates
├── sprint-46.md            ← Payment Rail Integration
├── sprint-47.md            ← SOC 2 Prep & Hardening
├── sprint-48.md            ← Launch Readiness & QA

../AUDIT.md                 ← Full codebase audit results
```
