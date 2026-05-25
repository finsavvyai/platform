# Portfolio Migration Inventory

Snapshot of `/Users/shaharsolomon/dev/projects/portfolio/` (top level only, 139 entries) classified per addendum section 3.

Buckets: **CORE** | **OSS** | **PLATFORM** | **INFRA** | **ARCHIVE** | **DOC** (loose docs/reports — snapshot to `_archive/portfolio-docs/`) | **TOOLING** (loose scripts — keep under `infrastructure/sprint-tooling/`)

| Entry | Bucket | New path | Note |
|---|---|---|---|
| `_AGENTS_TEMPLATE.md` | DOC | `_archive/portfolio-docs/_AGENTS_TEMPLATE.md` | Agent template, snapshot. |
| `_audits/` | INFRA | `infrastructure/sprint-tooling/audits/` | Sprint-loop machinery. |
| `_briefs/` | INFRA | `infrastructure/sprint-tooling/briefs/` | Sprint-loop machinery. |
| `_drafts/` | INFRA | `infrastructure/sprint-tooling/drafts/` | Sprint-loop machinery. |
| `_harness/` | INFRA | `infrastructure/sprint-tooling/harness/` | Sprint-loop machinery. |
| `_merge_logs/` | INFRA | `infrastructure/sprint-tooling/merge-logs/` | Sprint-loop machinery. |
| `_profile_export/` | INFRA | `infrastructure/sprint-tooling/profile-export/` | Sprint-loop machinery. |
| `_reports/` | INFRA | `infrastructure/sprint-tooling/reports/` | Sprint-loop machinery. |
| `_reviews/` | INFRA | `infrastructure/sprint-tooling/reviews/` | Sprint-loop machinery. |
| `a2a-framework/` | OSS | `oss/a2a-framework/` | Keep if active; TODO: confirm last-commit date before migration. |
| `aegis/` | CORE | `products/amliq/` | AMLIQ backend, rename. |
| `aegis.agent1/` | ARCHIVE | `_archive/worktrees/aegis.agent1/` | Worktree variant, snapshot+delete. |
| `aegis.agent2/` | ARCHIVE | `_archive/worktrees/aegis.agent2/` | Worktree variant, snapshot+delete. |
| `AMLIQ_PUNCH_LIST_May2026.html` | DOC | `_archive/portfolio-docs/AMLIQ_PUNCH_LIST_May2026.html` | AMLIQ planning doc. |
| `AMLIQ_PUNCH_LIST_May2026.md` | DOC | `_archive/portfolio-docs/AMLIQ_PUNCH_LIST_May2026.md` | AMLIQ planning doc. |
| `amliq-frontend/` | CORE | `products/amliq/web/` | Merge into AMLIQ product. |
| `apply_merge_schedule.py` | TOOLING | `infrastructure/sprint-tooling/scripts/apply_merge_schedule.py` | Merge automation script. |
| `autoboot/` | INFRA | `infrastructure/sprint-tooling/autoboot/` | Sprint harness; FastPM product framing retired. |
| `automationhub/` | OSS | `oss/automationhub/` | Workflow primitives, base for LunaOS. |
| `automationhub-upm/` | OSS | `oss/automationhub/upm/` | TODO: confirm if Unity Package Manager variant or unrelated; merge if same project. |
| `clawpipe/` | OSS | `oss/clawpipe/` | LunaOS runtime support. |
| `clawpipe-booster-benchmark/` | OSS | `oss/clawpipe/benchmark/` | Merge into clawpipe. |
| `clawpipe-server/` | OSS | `oss/clawpipe/server/` | Merge into clawpipe. |
| `clawpipe.agent1/` | ARCHIVE | `_archive/worktrees/clawpipe.agent1/` | Worktree variant. |
| `clawpipe.agent2/` | ARCHIVE | `_archive/worktrees/clawpipe.agent2/` | Worktree variant. |
| `code-safety-suite/` | OSS | `oss/pipewarden/rules/code-safety-suite/` | Folds into PipeWarden rules. |
| `codebridge/` | ARCHIVE | `_archive/codebridge/` | Unclear scope. |
| `coderail-dev/` | INFRA | `infrastructure/sprint-tooling/coderail-dev/` | TODO: check rule-engine overlap with PipeWarden before final placement. |
| `coderailflow/` | INFRA | `infrastructure/sprint-tooling/coderailflow/` | TODO: evaluate — could become LunaOS module or fold into automationhub. |
| `DELIVERABLES.txt` | DOC | `_archive/portfolio-docs/DELIVERABLES.txt` | Loose sprint doc. |
| `DELIVERY_SUMMARY.txt` | DOC | `_archive/portfolio-docs/DELIVERY_SUMMARY.txt` | Loose sprint doc. |
| `devwrapped/` | ARCHIVE | `_archive/devwrapped/` | Off-thesis (dev stats app). |
| `FINAL_TEST_REPORT.html` | DOC | `_archive/portfolio-docs/FINAL_TEST_REPORT.html` | Report snapshot. |
| `finsavvyai_ecosystem_consolidation_plan.md` | DOC | `_archive/portfolio-docs/finsavvyai_ecosystem_consolidation_plan.md` | Earlier plan; superseded by addendum. |
| `fintech-suite/` | DISSOLVE | see addendum section 1 | Components migrate to AMLIQ + platform; deleted Week 8. |
| `flujo/` | ARCHIVE | `_archive/flujo/` | TODO: fold into LunaOS if active; otherwise archive. |
| `github-repos.txt` | DOC | `_archive/portfolio-docs/github-repos.txt` | Repo list snapshot. |
| `global-remit/` | ARCHIVE | `_archive/global-remit/` | Remittance fintech, off-thesis. |
| `go/` | INFRA | `infrastructure/sprint-tooling/go/` | Utility folder. |
| `GR_Companies_Registrar_Extract_2026-05-21.pdf` | DOC | `_archive/portfolio-docs/GR_Companies_Registrar_Extract_2026-05-21.pdf` | Loose PDF. |
| `harness.sh` | TOOLING | `infrastructure/sprint-tooling/scripts/harness.sh` | Sprint harness script. |
| `hashmal/` | ARCHIVE | `_archive/hashmal/` | Low signal, unclear scope. |
| `homebrew-pipewarden/` | OSS | `oss/homebrew-pipewarden/` | PipeWarden distribution tap. |
| `immortal-fc/` | ARCHIVE | `_archive/immortal-fc/` | Empty README. |
| `IMPLEMENTATION_SUMMARY.md` | DOC | `_archive/portfolio-docs/IMPLEMENTATION_SUMMARY.md` | Loose sprint doc. |
| `init.sh` | TOOLING | `infrastructure/sprint-tooling/scripts/init.sh` | Init script. |
| `INTEGRATION_COMPLETE.md` | DOC | `_archive/portfolio-docs/INTEGRATION_COMPLETE.md` | Loose sprint doc. |
| `INTEGRATION_INDEX.md` | DOC | `_archive/portfolio-docs/INTEGRATION_INDEX.md` | Loose sprint doc. |
| `INTEGRATION_QUICK_REFERENCE.md` | DOC | `_archive/portfolio-docs/INTEGRATION_QUICK_REFERENCE.md` | Loose sprint doc. |
| `jiraz-timeline/` | INFRA | `infrastructure/sprint-tooling/jiraz-timeline/` | Internal Jira tooling. |
| `Licensing_Cost_Comparison_May2026.pdf` | DOC | `_archive/portfolio-docs/Licensing_Cost_Comparison_May2026.pdf` | Loose PDF. |
| `logs/` | INFRA | `infrastructure/sprint-tooling/logs/` | Sprint log archive. |
| `looma-sh/` | ARCHIVE | `_archive/looma-sh/` | V2V messaging, off-thesis. |
| `luna-os/` | CORE | `products/lunaos/` | Orchestration. |
| `luna-os.agent1/` | ARCHIVE | `_archive/worktrees/luna-os.agent1/` | Worktree variant. |
| `luna-os.agent2/` | ARCHIVE | `_archive/worktrees/luna-os.agent2/` | Worktree variant. |
| `lunaforge/` | CORE | `products/lunaos/legacy/` | LunaOS predecessor; harvest useful code. |
| `MASTER_SHIP_PLAN.html` | DOC | `_archive/portfolio-docs/MASTER_SHIP_PLAN.html` | Planning doc. |
| `mcpoverflow/` | OSS | `oss/mcp-tooling/` | Plan's MCP tooling OSS line. |
| `MERGE_AGENT_BRIEF_PHASE2.md` | DOC | `_archive/portfolio-docs/MERGE_AGENT_BRIEF_PHASE2.md` | Sprint brief. |
| `MERGE_AGENT_BRIEF_PHASE34.md` | DOC | `_archive/portfolio-docs/MERGE_AGENT_BRIEF_PHASE34.md` | Sprint brief. |
| `MERGE_AGENT_BRIEF.md` | DOC | `_archive/portfolio-docs/MERGE_AGENT_BRIEF.md` | Sprint brief. |
| `merge_all_worktrees.sh` | TOOLING | `infrastructure/sprint-tooling/scripts/merge_all_worktrees.sh` | Sprint script. |
| `merge_finsavvyai.py` | TOOLING | `infrastructure/sprint-tooling/scripts/merge_finsavvyai.py` | Sprint script. |
| `MERGE_PLAN.md` | DOC | `_archive/portfolio-docs/MERGE_PLAN.md` | Planning doc. |
| `moneh-hacham/` | ARCHIVE | `_archive/moneh-hacham/` | Smart meter, off-thesis. |
| `monitor_parallel_day.sh` | TOOLING | `infrastructure/sprint-tooling/scripts/monitor_parallel_day.sh` | Sprint script. |
| `notebooklm-py/` | ARCHIVE | `_archive/notebooklm-py/` | Research toy. |
| `NPMPlus_Readiness_GTM_Investor_May2026.html` | DOC | `_archive/portfolio-docs/NPMPlus_Readiness_GTM_Investor_May2026.html` | Investor doc. |
| `opensource/` | INFRA | `infrastructure/vendored/opensource/` | Vendored third-party code. |
| `opensyber/` | CORE | `products/opensyber/` | Runtime AI security. |
| `opensyber.agent1/` | ARCHIVE | `_archive/worktrees/opensyber.agent1/` | Worktree variant. |
| `OSS_Leverage_Strategy_May2026.md` | DOC | `_archive/portfolio-docs/OSS_Leverage_Strategy_May2026.md` | Strategy doc. |
| `packages/` | OSS | `oss/design-system/` | F8 UI shared design system. |
| `Parallel_AI_Orchestration_May2026.html` | DOC | `_archive/portfolio-docs/Parallel_AI_Orchestration_May2026.html` | Strategy doc. |
| `parity_harness.py` | TOOLING | `infrastructure/sprint-tooling/scripts/parity_harness.py` | Sprint script. |
| `parity-workflow.yml` | TOOLING | `infrastructure/sprint-tooling/parity-workflow.yml` | CI workflow snippet. |
| `pipewarden/` | OSS | `oss/pipewarden/` | Primary OSS asset. |
| `pipewarden-real-archive-20260412/` | ARCHIVE | `_archive/pipewarden-pre-rewrite/` | Pre-rewrite snapshot. |
| `pipewarden.agent1/` | ARCHIVE | `_archive/worktrees/pipewarden.agent1/` | Worktree variant. |
| `pipewarden.agent2/` | ARCHIVE | `_archive/worktrees/pipewarden.agent2/` | Worktree variant. |
| `pixel-pets/` | ARCHIVE | `_archive/pixel-pets/` | Off-thesis. |
| `Portfolio_GTM_Investor_Playbook_May2026.html` | DOC | `_archive/portfolio-docs/Portfolio_GTM_Investor_Playbook_May2026.html` | Investor doc. |
| `Portfolio_Master_View_May2026.html` | DOC | `_archive/portfolio-docs/Portfolio_Master_View_May2026.html` | Portfolio dashboard. |
| `Portfolio_Review_March2026.html` | DOC | `_archive/portfolio-docs/Portfolio_Review_March2026.html` | Review snapshot. |
| `Portfolio_Status_Verdict_May2026.html` | DOC | `_archive/portfolio-docs/Portfolio_Status_Verdict_May2026.html` | Status snapshot. |
| `Portfolio_Triage_May2026.html` | DOC | `_archive/portfolio-docs/Portfolio_Triage_May2026.html` | Triage report. |
| `portfolio-tracker.html` | DOC | `_archive/portfolio-docs/portfolio-tracker.html` | Tracker UI. |
| `push-ci.dev/` | CORE | `products/pushci/website/` | Merge into PushCI website. |
| `push-ci.dev.agent2/` | ARCHIVE | `_archive/worktrees/push-ci.dev.agent2/` | Worktree variant. |
| `pushci/` | CORE | `products/pushci/` | Primary wedge product. |
| `python/` | INFRA | `infrastructure/sprint-tooling/python/` | Utility folder. |
| `QA_WAVE1_MASTER_REPORT.md` | DOC | `_archive/portfolio-docs/QA_WAVE1_MASTER_REPORT.md` | QA report. |
| `qestro/` | CORE | `products/qestro/` | Runtime QA product. |
| `QUALITY_STANDARDS.md` | DOC | `_archive/portfolio-docs/QUALITY_STANDARDS.md` | Reference superseded by `/Users/shaharsolomon/dev/projects/CLAUDE.md`. |
| `queryflux/` | ARCHIVE | `_archive/queryflux/` | TODO: fold one of querflux/queryflux-git/querylens into a product; archive duplicates. |
| `queryflux-git/` | ARCHIVE | `_archive/queryflux-git/` | TODO: duplicate of `queryflux`? Confirm before delete. |
| `querylens/` | ARCHIVE | `_archive/querylens/` | TODO: same as above. |
| `Readiness_Report_and_Marketing_Plans_May2026.html` | DOC | `_archive/portfolio-docs/Readiness_Report_and_Marketing_Plans_May2026.html` | Marketing doc. |
| `Regulatory_Brief_EU_May2026.md` | DOC | `_archive/portfolio-docs/Regulatory_Brief_EU_May2026.md` | Regulatory brief. |
| `Regulatory_Brief_Israel_May2026.md` | DOC | `_archive/portfolio-docs/Regulatory_Brief_Israel_May2026.md` | Regulatory brief. |
| `run_parallel_day.sh` | TOOLING | `infrastructure/sprint-tooling/scripts/run_parallel_day.sh` | Sprint script. |
| `run_pr_auditor.sh` | TOOLING | `infrastructure/sprint-tooling/scripts/run_pr_auditor.sh` | Sprint script. |
| `run_reviewers.sh` | TOOLING | `infrastructure/sprint-tooling/scripts/run_reviewers.sh` | Sprint script. |
| `scan_tmp.sh` | TOOLING | `infrastructure/sprint-tooling/scripts/scan_tmp.sh` | Sprint script. |
| `scangenie/` | ARCHIVE | `_archive/scangenie/` | Off-thesis. |
| `schedule.sh` | TOOLING | `infrastructure/sprint-tooling/scripts/schedule.sh` | Sprint script. |
| `sdlc-cc/` | CORE | `products/sdlc-cc/` | Governance product (primary). |
| `sdlc-core/` | CORE | `products/sdlc-cc/core/` | Merge into SDLC.cc. |
| `sdlc-platform/` | CORE | `products/sdlc-cc/platform/` | Merge into SDLC.cc. |
| `Shachar-Solomon-Resume-2026.docx` | DOC | `_archive/portfolio-docs/Shachar-Solomon-Resume-2026.docx` | Personal doc; consider removing from repo entirely. |
| `Shachar-Solomon-Resume-2026.pdf` | DOC | `_archive/portfolio-docs/Shachar-Solomon-Resume-2026.pdf` | Personal doc; same as above. |
| `smartreply-ai/` | ARCHIVE | `_archive/smartreply-ai/` | Domain parked. |
| `sprint_config.before_merge.json` | TOOLING | `infrastructure/sprint-tooling/config/sprint_config.before_merge.json` | Sprint config. |
| `sprint_config.json` | TOOLING | `infrastructure/sprint-tooling/config/sprint_config.json` | Sprint config. |
| `sprint_daemon.py` | TOOLING | `infrastructure/sprint-tooling/scripts/sprint_daemon.py` | Sprint daemon. |
| `Sprint_Plan_11_Commercials_May2026.html` | DOC | `_archive/portfolio-docs/Sprint_Plan_11_Commercials_May2026.html` | Sprint plan. |
| `SPRINT_README.md` | DOC | `_archive/portfolio-docs/SPRINT_README.md` | Sprint readme. |
| `sprint-city/` | INFRA | `infrastructure/sprint-tooling/sprint-city/` | Internal sprint planner. |
| `sprint-planner.html` | DOC | `_archive/portfolio-docs/sprint-planner.html` | UI snapshot. |
| `sprint-status.json` | TOOLING | `infrastructure/sprint-tooling/state/sprint-status.json` | Live state file. |
| `SPRINT.md` | DOC | `_archive/portfolio-docs/SPRINT.md` | Loose sprint doc. |
| `sprint.py` | TOOLING | `infrastructure/sprint-tooling/scripts/sprint.py` | Sprint script. |
| `SprintCity.command` | TOOLING | `infrastructure/sprint-tooling/scripts/SprintCity.command` | Mac launcher. |
| `sprints/` | INFRA | `infrastructure/sprint-tooling/sprints/` | Sprint artifacts. |
| `state.json` | TOOLING | `infrastructure/sprint-tooling/state/state.json` | Live state file. |
| `subsforge/` | ARCHIVE | `_archive/subsforge/` | Domain parked. |
| `tail_session.sh` | TOOLING | `infrastructure/sprint-tooling/scripts/tail_session.sh` | Sprint script. |
| `tenantiq/` | CORE | `products/tenantiq/` | M365 governance. |
| `tenantiq.agent1/` | ARCHIVE | `_archive/worktrees/tenantiq.agent1/` | Worktree variant. |
| `tenantiq.agent2/` | ARCHIVE | `_archive/worktrees/tenantiq.agent2/` | Worktree variant. |
| `tenantiq.frontend/` | CORE | `products/tenantiq/web/` | Merge into TenantIQ. |
| `test-webapp-insturctions/` | DOC | `_archive/portfolio-docs/test-webapp-insturctions/` | Loose instructions (sic). |
| `tokenforge/` | OSS | `oss/tokenforge/` | Telemetry SDK OSS. |
| `vibepulse/` | ARCHIVE | `_archive/vibepulse/` | Chrome extension games, off-thesis. |
| `viralsplit/` | ARCHIVE | `_archive/viralsplit/` | Domain parked. |
| `WAVE_5_SUMMARY.md` | DOC | `_archive/portfolio-docs/WAVE_5_SUMMARY.md` | Sprint summary. |
| `windsu-credit-manager/` | ARCHIVE | `_archive/windsu-credit-manager/` | TODO: check overlap with PushCI; fold or archive. |
| `yallabye/` | ARCHIVE | `_archive/yallabye/` | Israeli travel app, off-thesis. |

---

**Counts (Round-2 inventory):** CORE 13 · OSS 12 · PLATFORM 0 (folded via fintech-suite section 1) · INFRA 16 · TOOLING 22 · DOC 39 · ARCHIVE 36 · DISSOLVE 1 (fintech-suite) = 139.

TODOs flagged inline above: a2a-framework activity check, automationhub-upm merge confirmation, coderailflow/coderail-dev placement, flujo fold-or-archive, queryflux/queryflux-git/querylens dedupe, windsu-credit-manager PushCI overlap, Shachar-Solomon resumes removal.
