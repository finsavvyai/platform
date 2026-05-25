<!-- cspell:words tenantiq scubagear scuba opa rego -->

# Integration Plan — ScubaGear → tenantiq

## Targets

- Add **per-tenant YAML config-as-code** for CIS scanner (highest-value, lowest risk).
- Add **MITRE ATT&CK + NIST 800-53 mapping** to existing controls (compliance evidence value).
- *Skip* OPA/Rego adoption — verify Workers feasibility first; not worth the runtime risk in a v1.

## Step 1 — YAML config-as-code

Concrete files to add/modify:

- New: `packages/shared/src/cis/scuba-config.schema.ts`
  - Zod schema mirroring ScubaGear's `exclusions` / `annotations` / `omissions` keys.
  - Reference: ScubaGear sample at `PowerShell/ScubaGear/Sample-Config-Files/full_config.yaml`.
- New table: `cis_tenant_overrides` (migration `0018_cis_tenant_overrides.sql`).
  - Columns: `org_id`, `tenant_id`, `control_id`, `action` (`exclude`|`annotate`|`omit`), `reason`, `expires_at`.
- Modify: `apps/api/src/lib/cis/scanner.ts` (currently 59 LOC) — load overrides before iterating controls; skip/annotate per row.
- Modify: `apps/api/src/lib/cis/scanner-evaluator.ts:1` — accept override context.
- Modify UI: `apps/web/src/routes/security/cis/+page.svelte` — add per-row "Accept risk" action that POSTs to a new `/api/cis/overrides` route.
- New route: `apps/api/src/routes/cis-overrides.ts` (CRUD).

Rough effort: **~3–5 days** (hedged; depends on UI polish).

## Step 2 — MITRE ATT&CK + NIST 800-53 mapping

- Modify: `apps/api/src/lib/cis/control-definitions.ts` (or each `controls-*.ts`) — add optional `frameworks?: { nist?: string[]; attack?: string[]; }` to `CisControl` type.
- Source the mappings from ScubaGear's `docs/misc/mappings.md` (CC0-1.0 — free to copy with attribution).
- Surface mappings on the existing CIS UI: `apps/web/src/routes/security/cis/+page.svelte`.

Rough effort: **~2 days** of mostly data entry + a small UI badge.

## Step 3 — HTML/CSV export parity

- tenantiq already has PDF + executive report (`apps/web/src/routes/reports/executive-report.ts`). Add a **CIS-specific HTML report** + CSV download in `apps/web/src/routes/reports/builder/` (path verified to live there).
- Pattern: mirror ScubaGear's HTML format (samples linked from their README) — branded for tenantiq.

Rough effort: **~3 days**.

## Step 4 (deferred) — OPA/Rego

- Build a spike on a side branch only. Compile OPA to WASM, test on Workers runtime cold-start latency.
- Decision gate: cold-start adds <50 ms or this is a no-go.
- Do not promise customers until spike completes.

## Risks / unknowns

- I have not verified ScubaGear's mappings doc license header — must check the file before copy-paste.
- I have not measured tenantiq's existing CIS scan output format vs ScubaGear's — assume divergence.
