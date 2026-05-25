<!-- cspell:words tenantiq Microsoft365DSC drift dsc -->

# Integration Plan — Microsoft365DSC → tenantiq

## Targets

- Implement **Config Snapshot & Drift Detection** (CLAUDE.md "Left → Priorities §3").
- Use M365DSC's resource-per-workload mental model for the snapshot schema.
- *Skip* the push/enforce side — out of charter for tenantiq's read-only-recommend model.

## Step 1 — Snapshot schema

- Verify: `packages/db/src/schema-d1.ts` already has `config_snapshots` (verified via `grep -l config_snapshots`). Confirm columns; extend if missing.
- Add per-resource subtables matching M365DSC workload names:
  - `snapshot_entra_policies`, `snapshot_exchange_rules`, `snapshot_sharepoint_settings`, `snapshot_teams_policies`, `snapshot_intune_compliance_policies`.
- Each row keyed by `snapshot_id` + `resource_id` + `payload_json`.
- Migration: `0019_config_snapshot_resources.sql`.

Rough effort: **~2 days** to design + migrate.

## Step 2 — Capture pipeline

- New cron: `apps/api/src/cron/capture-snapshot.ts` (mirrors existing `cron/security-scan.ts` pattern).
- Reuses `apps/api/src/lib/graph-client.ts:1` (194 LOC, already wraps Graph SDK).
- Stores into the new tables. Throttle to 1 run / day per tenant.

Rough effort: **~3–4 days**.

## Step 3 — Drift detection + UI

- New: `apps/api/src/lib/drift/diff.ts` — pairwise diff between two `snapshot_id`s, emits structured drift records.
- New: `cis_drift_records` table or reuse `alerts` table with `kind='drift'`.
- New UI: `/audit/drift` page (sidebar already has `/audit/history`; new page should sit nearby).
- Re-use existing `AlertDetailPanel.svelte` (verified to exist) for drift detail rendering.

Rough effort: **~5 days**.

## Step 4 — Export (config-as-code reverse)

- Add an "Export current config" button on `/governance` (sidebar link verified in CLAUDE.md page map).
- Output: YAML — same schema as the ScubaGear plan's `scuba-config.schema.ts` so a single config language covers both projects.
- Effort: **~2 days** if Step 1 done.

## Risks / unknowns

- Workload coverage: tenantiq does not currently cover Intune (per CLAUDE.md sidebar page map). Adding Intune snapshot requires Intune Graph permissions + new admin consent scopes.
- M365DSC has hundreds of resource definitions; scope here is the top-15 by tenant impact, not the full set.
