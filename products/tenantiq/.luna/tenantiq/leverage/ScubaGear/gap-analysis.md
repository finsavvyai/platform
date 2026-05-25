<!-- cspell:words tenantiq scubagear scubaconfig opa rego -->

# Gap Analysis — ScubaGear vs tenantiq

## What ScubaGear has that tenantiq doesn't

| ScubaGear feature (cited from README) | tenantiq state | Gap | Notes |
|---|---|---|---|
| Rego/OPA-based policy engine | tenantiq evaluates controls in TS via `apps/api/src/lib/cis/scanner-evaluator.ts` (109 LOC) | open (deliberate?) | Adopting OPA on Workers is non-trivial; OPA is Go and requires WASM compile. Verify before claiming feasibility. |
| YAML config-as-code (per-tenant policy customization with `exclusions`/`annotations`/`omissions`) | None found. `apps/api/src/lib/cis/control-definitions.ts` is hard-coded across all tenants | **open** | High-value for MSPs serving regulated industries. |
| BOD 25-01 alignment (US federal directive) | Not stated in tenantiq codebase | open | Niche; only matters for federal MSPs. |
| HTML/JSON/CSV exports of compliance results | tenantiq has `apps/web/src/routes/reports/` with `executive-report.ts`, `savings-report.ts`, PDF builder | partial | tenantiq covers exec reports + savings; CIS/CSV bulk export not confirmed. |
| `Start-ScubaConfigApp` GUI for editing YAML | N/A (web UI handles this differently in tenantiq via `/security/cis`) | covered by tenantiq | Different UX, same intent. |
| MITRE ATT&CK + NIST 800-53 mapping per control | Not seen in `controls-*.ts` files | open | Adds enterprise compliance value (SOC 2 evidence). |
| Multi-product baselines (Power BI, Power Platform) | tenantiq sidebar lists `/security/copilot` + `/security/email` etc. but Power BI/Power Platform not in CLAUDE.md page map | partial | Page map shows 27 sidebar links, none for Power BI specifically. |

## What tenantiq has that ScubaGear doesn't

- AI-native analysis (Anthropic Claude, DeepSeek, gateway dispatch) — `apps/api/src/lib/ai-*.ts`
- Auto-remediation (commit 2999bd5: `0015_remediation_log.sql`)
- Multi-tenant MSP architecture (per CLAUDE.md)
- Cost optimization + license waste detection (`apps/api/src/routes/cost-optimization/`)
- Real-time dashboards + alerts queue (`apps/api/src/queues/alert-handler.ts`)

## Verdict

ScubaGear is the **policy-engine + per-tenant config-as-code** reference. The Rego adoption is risky on Workers; the YAML-config pattern is portable in days, not weeks.
