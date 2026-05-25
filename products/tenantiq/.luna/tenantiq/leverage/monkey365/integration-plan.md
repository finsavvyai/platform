<!-- cspell:words tenantiq monkey365 entra govcloud entraid -->

# Integration Plan — Monkey365 → tenantiq

## Targets

- **Close the CIS-check coverage gap** vs Monkey365's claimed 160+ checks.
- Add **national-cloud parameter** for sovereign-cloud customers.

## tenantiq's current CIS check inventory (verified)

| File | Controls (count of `id: '...'`) |
|---|---|
| `apps/api/src/lib/cis/controls-apps.ts` | 13 |
| `apps/api/src/lib/cis/controls-audit.ts` | 12 |
| `apps/api/src/lib/cis/controls-cicd.ts` | 1 |
| `apps/api/src/lib/cis/controls-data.ts` | 25 |
| `apps/api/src/lib/cis/controls-device.ts` | 13 |
| `apps/api/src/lib/cis/controls-email.ts` | 14 |
| `apps/api/src/lib/cis/controls-identity.ts` | 25 |
| `apps/api/src/lib/cis/control-definitions.ts` | 17 |

Rough total: **~120 controls** (some may overlap with `control-definitions.ts`; not deduplicated in this scan). Lower bound: 103 unique. Upper bound: 120.

Monkey365 claims 160+. **Probable gap: 40–60 controls.**

## Step 1 — Enumerate Monkey365 checks

- Clone the repo locally and grep for the rule files (path not stated in README; need clone).
- Build a side-by-side CSV: `monkey365_check_id`, `tenantiq_equivalent_id`, `gap` (yes/no).
- Estimated reading effort: **~1 day** to enumerate, **~3–5 days** to write evaluators for the missing checks.

## Step 2 — National-cloud parameter

- Modify: `apps/api/src/lib/graph-client.ts:1` (194 LOC).
  - Read env var `MS_GRAPH_CLOUD` (default `Public`; values `Public|China|USGov`).
  - Map to Graph base URLs: `graph.microsoft.com`, `microsoftgraph.chinacloudapi.cn`, `graph.microsoft.us`.
- Add per-org override on `tenants` row (column `cloud_environment`).
- UI: `apps/web/src/routes/settings/+page.svelte` — admin selector.

Rough effort: **~2 days** + manual test against a USGov tenant if available.

## Step 3 — Multi-version CIS Foundations support

- Monkey365 supports v3.0.0 / v4.0.0 / v5.0.0 simultaneously (README). tenantiq currently does not version controls.
- Add `cisVersion: '3.0' | '4.0' | '5.0'` to `CisControl` type in `apps/api/src/lib/cis/control-definitions.ts`.
- Allow per-tenant pinning of CIS version (default `5.0`).

Rough effort: **~3 days** including test fixtures per version.

## Risks / unknowns

- Monkey365 is Apache-2.0; porting check **logic** is fine but check **identifiers** sourced from CIS Benchmark itself are CIS-licensed — verify usage rights before bulk copying control IDs.
- I have not verified that all 160+ checks are unique vs duplicates across CIS versions.
