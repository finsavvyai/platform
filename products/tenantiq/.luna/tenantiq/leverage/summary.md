<!-- cspell:words tenantiq scubagear monkey365 cli-microsoft365 workers-sdk pnp climicrosoft365 entraid -->

# Cross-Repo Leverage Summary — tenantiq

Generated 2026-04-27. All metrics fetched live via `gh api` (no memory).

## Repo matrix

| Repo | Stars | Lang | License | Last push | Direct competitor? | TS-portable? | Top adoption |
|---|---:|---|---|---|:---:|:---:|---|
| [cisagov/ScubaGear](ScubaGear/reference.md) | 2 546 | PowerShell | CC0-1.0 | 2026-04-27 | yes (CIS scanner) | partial | YAML config-as-code, MITRE/NIST mapping |
| [Microsoft365DSC](Microsoft365DSC/reference.md) | 2 266 | PowerShell | MIT | 2026-04-24 | yes (drift) | no (PS-only) | Resource-per-workload schema |
| [silverhack/monkey365](monkey365/reference.md) | 1 271 | PowerShell | Apache-2.0 | 2026-04-15 | yes (CIS coverage) | no (PS-only) | Close 40–60 control gap, national-cloud, multi-CIS-version |
| [pnp/cli-microsoft365](cli-microsoft365/reference.md) | 1 288 | TypeScript | MIT | 2026-04-24 | no (CLI tool) | **yes** | Federated-identity SSO pattern |
| [cloudflare/workers-sdk](workers-sdk/reference.md) | 4 016 | TypeScript | Apache-2.0 | 2026-04-27 | no (infra) | **yes** | vitest-pool-workers (fix CLAUDE.md mismatch) |

## High-leverage takeaways

1. **Closest in TS + license**: cli-microsoft365 (MIT) and workers-sdk (Apache-2.0). Both directly portable to tenantiq's TS+Workers stack.
2. **Biggest functionality gaps in tenantiq**:
   - Per-tenant config-as-code (ScubaGear) — open.
   - Drift detection (M365DSC) — open per CLAUDE.md.
   - National-cloud awareness (Monkey365) — open.
   - Federated SSO (cli-microsoft365 pattern) — open per CLAUDE.md.
   - Workers-runtime tests (workers-sdk) — open + documentation bluff in CLAUDE.md.
3. **Skip**:
   - OPA/Rego from ScubaGear (Workers-runtime risk).
   - DSC push/enforce from M365DSC (out of charter).
   - cli-microsoft365 per-workload commands (out of charter).
   - workers-sdk C3/templates (post-bootstrap).

## Effort budget (rough)

| Adoption | Source | Effort |
|---|---|---|
| Federated SSO pattern | cli-microsoft365 | ~1.5 weeks |
| YAML config-as-code | ScubaGear | ~3–5 days |
| MITRE/NIST mapping | ScubaGear | ~2 days |
| Snapshot schema + drift | M365DSC | ~5–7 days |
| 40–60 missing CIS controls | Monkey365 | ~3–5 days |
| National-cloud parameter | Monkey365 | ~2 days |
| Multi-CIS-version | Monkey365 | ~3 days |
| vitest-pool-workers | workers-sdk | ~2–3 days |
| **Total (rough)** |  | **~5–7 weeks of focused work** |

## Honesty notes

- All star counts and licenses are live from `gh api`, not memory.
- Effort estimates are explicitly hedged — they assume no hidden integration cost (Cloudflare Workers compatibility, missing Graph permissions, etc.).
- I have NOT cloned any of these repos to count exact files / inspect source. All claims trace to the README plus public API metadata.
