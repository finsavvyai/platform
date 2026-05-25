<!-- cspell:words tenantiq M365DSC dsc -->

# Gap Analysis — Microsoft365DSC vs tenantiq

## What M365DSC has that tenantiq doesn't

| M365DSC feature (README) | tenantiq state | Gap |
|---|---|---|
| Configuration **extraction** from a live tenant (config-as-code reverse engineering) | `config_snapshots` table exists in `packages/db/src/schema-d1.ts` but extraction logic not located in this scan | **open** (verify) |
| Continuous **drift detection** | CLAUDE.md "Left → Priorities §3 Config Snapshot & Drift Detection" — flagged as unfinished | **open** |
| **Push** mode: enforce desired state to a tenant via DSC LCM | None — tenantiq is read + recommend, not enforce | **open** (large) |
| Workload coverage: SharePoint, Teams, OneDrive, Intune, Power Platform, Security & Compliance, Entra ID | tenantiq has Entra/Exchange/SharePoint/Teams/Purview routes; **Intune** + **Power Platform** absent from sidebar | open partial |
| MIT-licensed, derivative use OK | n/a | green-light |

## What tenantiq has that M365DSC doesn't

- Multi-tenant MSP UI; M365DSC is per-tenant scripts.
- AI-driven remediation suggestions; M365DSC is pure DSC.
- Cost/license intelligence; M365DSC is config only.
- Web/dashboard UX; M365DSC is PowerShell-only.

## Verdict

M365DSC is the **drift-detection schema + per-workload resource model** reference. tenantiq's `config_snapshots` table should mirror M365DSC's resource-per-workload taxonomy. PowerShell push/enforce is out of scope for a Workers-based platform; copy the *schema*, skip the runtime.
