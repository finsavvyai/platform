# Phase 2: Frontend Completions — Research

**Researched:** 2026-04-22
**Domain:** SvelteKit 2.15 + Svelte 5 frontend wiring against existing Cloudflare Workers/Hono APIs
**Confidence:** HIGH — all API routes, type contracts, and existing UI code were read directly from the codebase

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COP-01 | MSP admin can trigger a Copilot Readiness Assessment for any connected tenant | `POST /api/copilot-readiness/assess` exists and is registered. Frontend page at `/security/copilot` already calls it. Skill gate `requireSkill('copilot')` is enforced server-side. |
| COP-02 | Assessment displays overall readiness score (0–100%) with category breakdown | `ReadinessResult` type has `overallScore` + `categories` (7 keys). `ReadinessOverview`, `CategoryCard` components exist. Page already renders them when `hasData`. |
| COP-03 | Assessment identifies users with oversharing risk | **Gap**: `readiness-checks.ts` has no dedicated oversharing check. `checkCollaboration` counts public groups (proxy signal) but does not expose a user-level oversharing list. A new dedicated API endpoint or an augmented `/latest` response field is needed. |
| COP-04 | Assessment shows sensitivity label coverage gap (unlabeled content count) | **Gap**: `checkDataProtection` checks label *count* (pass if ≥3 published) but does not return unlabeled content count. The Graph endpoint `/informationProtection/policy/labels` gives published labels only; actual unlabeled content count requires `/reports/getSharePointActivityUserDetail` or a Purview API. Need a supplementary data field exposed from the API. |
| COP-05 | Assessment lists Copilot-licensed users vs total licensed users | **Gap**: `checkLicensing` returns a pass/fail check with a string detail ("Copilot licenses available (N seats)") — it does NOT return structured `{ copilotLicensed: N, totalLicensed: N }`. The frontend page has no component to display this comparison. Needs a new `/api/copilot-readiness/license-summary` endpoint OR augmenting the `/latest` response. |
| COP-06 | Assessment result can be exported as PDF for customer delivery | `GET /api/copilot-readiness/export` returns HTML report. `GET /api/copilot-readiness/:id/pdf` returns cached HTML from R2. Frontend page calls both and opens result in new tab with "use browser Print to save as PDF" instruction. This is functional — no native PDF generation on Workers. **Complete as-is.** |
| SNAP-01 | Dashboard shows a drift summary widget (event count + severity) | **Gap**: `GET /api/config-drifts/summary` returns `{ total, critical, warning, info, unacknowledged }`. `DriftSummary` component exists. But `DashboardContent.svelte` (the home dashboard) has NO drift widget — it only shows MetricCards for secure score, users, license cost, and open alerts. Need to add a drift summary widget to `DashboardContent`. |
| SNAP-02 | Config Snapshots page shows visual diff between any two snapshots | `GET /api/config-snapshots/:id/diff/:otherId` exists and returns `{ diffs: CategoryDiff[], totalChanges }`. `SnapshotDiff` component exists. `/backups/config/+page.svelte` has inline diff flow. `/backups/config/compare/+page.svelte` has dedicated compare page with two-select UI. **Both exist and are wired.** Confirm SnapshotDiff renders the added/removed/changed entries visually. |
| SNAP-03 | Drift alerts appear in Alerts feed with link to snapshot diff | **Gap**: `drift-detector.ts` inserts into `alerts` table with `alert_type = 'config_drift'` and `metadata = { categoryId, changes[] }` — but metadata does NOT include `snapshot_id` or `baseline_id`. The Alerts page (`/alerts/+page.svelte`) uses the shared `Alert` type which has no `metadata` field exposed. No "view diff" link is rendered. Need: (1) add `snapshotId`/`baselineId` to drift alert metadata, (2) surface metadata in Alert type or alerts API response, (3) render a "View diff" link in `AlertCard` for `config_drift` alerts. |
| STOR-01 | Storage Analytics page shows per-user OneDrive usage (GB used, % of quota) | `GET /api/storage-analytics/onedrive` returns `OneDriveUser[]` with `usedGB`, `allocatedGB`, `utilizationPct`. `/governance/storage/+page.svelte` has a tab-based UI with `ConsumersTable` rendering per-user rows. **Functionally complete.** |
| STOR-02 | Top 20 storage consumers with sort/filter | `ConsumersTable.svelte` renders sorted list by `usedGB`, `utilizationPct`, or `name`. But it shows ALL consumers — no slice to top 20. Success criterion says "top 20". Need to cap display at 20 or add pagination. |
| STOR-03 | Page shows SharePoint site storage usage summary | `GET /api/storage-analytics/sharepoint` returns `SharePointSite[]`. `ConsumersTable` renders it in the SharePoint tab. **Functionally complete.** |
| STOR-04 | Page flags users over 90% quota with recommended action | **Gap**: `ConsumersTable` colors the bar red at >85% but does NOT show a dedicated "over quota" flag or recommended action inline. `StorageRecommendations` shows generic recommendations. Need: a visible per-row warning badge when `utilizationPct >= 90` and an inline recommended action (e.g. "Increase quota or archive files"). |
</phase_requirements>

---

## Summary

Phase 2 is almost entirely a frontend wiring phase. All four backend API feature areas are complete and registered:

- **Copilot Readiness**: Full 7-category assessment engine at `POST /api/copilot-readiness/assess`, KV-cached latest result, history endpoint, HTML export. The `/security/copilot` page already renders score, categories, recommendations, history, and PDF export. Three requirements (COP-03, COP-04, COP-05) need small API augmentations to surface oversharing risk, sensitivity label gap counts, and structured license comparison data.

- **Config Snapshots and Drift**: Snapshot capture, list, diff API and all UI components (`SnapshotDiff`, `DriftSummary`, `DriftAlert`, `SnapshotCard`) exist. The `/backups/config` and `/backups/config/compare` pages are wired. Two gaps remain: (1) the dashboard home has no drift widget (SNAP-01), and (2) drift alerts in the Alerts feed lack a `snapshot_id` in their metadata, so no "view diff" link can be rendered (SNAP-03).

- **Storage Analytics**: Full scan API, per-user OneDrive, SharePoint sites, recommendations, and unused licenses endpoints exist. The `/governance/storage` page has a tabbed UI with `ConsumersTable`, `StorageOverview`, `StorageRecommendations`, and `UnusedLicenses`. Two requirements need attention: top-20 cap (STOR-02) and per-row 90%-quota warning with action text (STOR-04).

**Primary recommendation:** Fix the three API data gaps (COP-03/04/05 supplementary fields, SNAP-03 metadata `snapshotId`/`baselineId`), add the dashboard drift widget (SNAP-01), then complete the two storage UI gaps (STOR-02 top-20, STOR-04 quota badge). All other requirements are wired and working.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SvelteKit | 2.15 | Frontend routing and SSR | Project standard |
| Svelte 5 | 5.x | UI components with runes | Project standard — `$state`, `$derived`, `$effect` only |
| Hono | latest | API routing on Workers | Project standard |
| Cloudflare Workers | N/A | API runtime | Project standard |
| Cloudflare D1 | N/A | SQLite persistence | Project standard |
| Cloudflare KV | N/A | Cache layer | Project standard |
| Cloudflare R2 | N/A | Report storage | Project standard (PDF/HTML export) |
| Vitest | latest | Unit testing | Project standard — `src/**/*.test.ts` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tenantiq/shared` | workspace | Shared types (Alert, DashboardMetrics) | Cross-package type contracts |
| `$api/client` | internal | HTTP wrapper with auth headers | All frontend API calls |
| `$stores/toast` | internal | Toast notification system | User feedback on async actions |
| `$stores/tenant` | internal | Current tenant context | Tenant-scoped data loading |

### No PDF Generation Library Needed
The project uses an HTML-to-print pattern for "PDF" export: `generateReadinessReportHtml()` produces a styled HTML document, stored in R2 and served to the browser. The user prints to PDF via browser. This is intentional and avoids Puppeteer/jsPDF edge runtime incompatibility on Workers.

---

## Architecture Patterns

### Recommended Project Structure — No New Directories Needed
All required routes and component directories already exist:
```
apps/web/src/routes/
├── security/copilot/+page.svelte      # COP-01..06 — EXISTS, needs COP-03/04/05 panels
├── backups/config/+page.svelte        # SNAP-02, SNAP-03 — EXISTS, functionally complete
├── backups/config/compare/+page.svelte # SNAP-02 — EXISTS, wired
├── governance/storage/+page.svelte    # STOR-01..04 — EXISTS, needs STOR-02/04 fixes
└── +page.svelte                       # SNAP-01 — DashboardContent needs drift widget

apps/web/src/lib/components/
├── copilot/          # ReadinessOverview, CategoryCard, RecommendationList, ReadinessHistory — all EXIST
├── snapshots/        # SnapshotDiff, DriftSummary, DriftAlert, SnapshotCard — all EXIST
├── storage/          # ConsumersTable, StorageOverview, StorageRecommendations, UnusedLicenses — all EXIST
└── dashboard/        # QuickActions, RiskyUsersList, LicenseUtilization — need DriftWidget added

apps/api/src/routes/
├── copilot-readiness.ts      # EXISTS — needs /license-summary endpoint
├── copilot-readiness-pdf.ts  # EXISTS — complete
├── config-snapshots.ts       # EXISTS — complete
├── config-drifts.ts          # EXISTS — complete
└── storage-analytics.ts      # EXISTS — complete
```

### Pattern 1: Svelte 5 Runes Page Pattern
Every page in this codebase uses this exact structure — the planner must NOT use old Svelte 4 syntax:
```typescript
// Source: apps/web/src/routes/security/copilot/+page.svelte
let result = $state<Result | null>(null);
let loading = $state(true);

$effect(() => {
  if ($tenant.currentTenantId) untrack(() => loadData());
});

async function loadData() {
  loading = true;
  try {
    const res = await api.get<ResultType>('/endpoint');
    result = res;
  } finally { loading = false; }
}
```

### Pattern 2: Tenant-Aware API Client
All API calls use `api.get`/`api.post` from `$api/client`. The `x-tenant-id` header is set by the client automatically from tenant store. Do NOT construct fetch calls directly:
```typescript
// Source: apps/web/src/lib/api/client.ts pattern — used throughout codebase
const res = await api.get<ResponseType>('/copilot-readiness/latest');
const res = await api.post<ResponseType>('/copilot-readiness/assess');
```

### Pattern 3: Loading Skeleton Before Data
Every page shows skeleton placeholders during load — no blank flash:
```svelte
{#if loading}
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
    {#each Array(4) as _}<div class="h-28 skeleton rounded-2xl"></div>{/each}
  </div>
{:else if !data}
  <!-- empty state -->
{:else}
  <!-- content -->
{/if}
```

### Pattern 4: DashboardContent Widget Addition (SNAP-01)
The dashboard home (`+page.svelte`) delegates all content to `DashboardContent.svelte`. New widgets are added to `DashboardContent.svelte` as additional grid rows. The component receives `metrics: DashboardMetrics` — but `DashboardMetrics` does NOT currently include drift summary. Options:
- **Option A (recommended)**: `DashboardContent` fetches drift summary independently via `api.get('/config-drifts/summary')` — keeps `DashboardMetrics` contract stable
- **Option B**: Extend `DashboardMetrics` in shared types — requires coordinated API + frontend change

Option A is lower risk and keeps the DashboardContent self-contained for this new widget.

### Anti-Patterns to Avoid
- **Old Svelte directives**: Never use `$:`, `bind:value` with reactive state chains, `export let`. Use `$state`, `$derived`, `$props()`.
- **Direct fetch calls**: Always use `api.get`/`api.post` — not `fetch('/api/...')` — the client injects auth headers.
- **File size over 200 lines**: The 200-line limit is enforced. All existing pages are under this limit; new components must stay under 200 lines.
- **Inline type re-declaration when shared type exists**: Import from `@tenantiq/shared` — don't redeclare `Alert`, `DashboardMetrics` etc. locally.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation on Workers | Puppeteer, jsPDF, wkhtmltopdf | HTML report + browser print pattern | Workers have CPU/memory limits; existing pattern works and is already in production |
| Diff rendering | Custom diff UI from scratch | `SnapshotDiff` component (already exists) | Already handles added/removed/changed with color coding |
| Storage bar charts | Custom canvas/SVG | `ConsumersTable` + `QuotaBar` (already exist) | Already renders utilization bars with color thresholds |
| Toast notifications | Custom notification system | `toasts.success()` / `toasts.error()` from `$stores/toast` | Project-wide standard |
| Loading skeletons | Custom shimmer | `skeleton` CSS class (global, already in `app.css`) | Consistent design system |
| Score ring visualization | Custom SVG | `ScoreRing` component (already exists, used in ReadinessOverview) | Already handles percentage display |

---

## Common Pitfalls

### Pitfall 1: COP-03/04 — Oversharing and Label Gap Are Not in Current API Response
**What goes wrong:** Developer reads `ReadinessResult` type, sees `categories.dataProtection.checks[]`, and tries to parse the string `detail` field to extract counts. The `detail` field is a human-readable string like "5 labels published" — not a structured number.
**Why it happens:** The assessment engine was built for display, not for metric extraction.
**How to avoid:** Add a new supplementary endpoint `GET /api/copilot-readiness/insights` (or extend `/latest`) to return structured fields: `{ overshareRiskUsers: number, sensitivityLabelGap: number }`. These can be computed from Graph data already fetched during assessment.
**Warning signs:** Any code that does `parseInt(check.detail)` or regex-parses a check detail string.

### Pitfall 2: SNAP-03 — Drift Alerts Have No Snapshot Link in Metadata
**What goes wrong:** Developer reads `DriftRow` from `config_drifts` table (which has `snapshot_id`) and assumes the `alerts` table row also has this. It does not — `drift-detector.ts` stores `metadata = { categoryId, changes[] }` with no `snapshot_id` or `baseline_id`.
**Why it happens:** The alert metadata was defined for display context, not navigation.
**How to avoid:** Before building the frontend "View diff" link, first patch `drift-detector.ts` to include `snapshotId` and `baselineId` in the alert metadata JSON. Then surface `metadata` in the alerts API response (currently `alerts` table has a `metadata` column but the `Alert` shared type omits it).
**Warning signs:** Trying to build a diff link URL without having the snapshot IDs in the alert object.

### Pitfall 3: SNAP-01 — DashboardMetrics Type Does Not Include Drift Data
**What goes wrong:** Developer tries to add drift widget by passing drift data through `DashboardMetrics`, requiring changes to shared types, the tenants dashboard API, and the frontend simultaneously.
**How to avoid:** Use Option A — `DashboardContent.svelte` fetches `GET /api/config-drifts/summary` independently on mount. This is the pattern used by `RiskyUsersList` and `LicenseUtilization` (both are lazy-loaded inside `DashboardContent` independently).
**Warning signs:** Any change to `DashboardMetrics` interface in `packages/shared/src/types.ts`.

### Pitfall 4: STOR-02 — ConsumersTable Shows All Items, Not Top 20
**What goes wrong:** Developer assumes the requirement "top 20 consumers" means top-20 in the API response. The API returns all users. The `ConsumersTable` component renders `sorted` which is a derived from ALL consumers.
**How to avoid:** Slice before passing to `ConsumersTable` in the page: `consumers={odConsumers.slice(0, 20)}` — or add a `maxItems` prop to `ConsumersTable` with a default of 20. The latter is more reusable.
**Warning signs:** Storage page showing more than 20 rows in the OneDrive tab.

### Pitfall 5: Alert Type Missing `metadata` Field
**What goes wrong:** The `Alert` interface in `packages/shared/src/types.ts` (lines 62–78) has no `metadata` field. Even though `alerts` D1 table has a `metadata` column, the API strips it when serializing to the shared type. Frontend can't access `snapshotId` for drift link.
**How to avoid:** Either (a) add optional `metadata?: Record<string, unknown>` to `Alert` type, or (b) create a separate `DriftAlert` extended type for the alerts page. Option (a) is simpler and consistent with how `metadata` is used elsewhere (e.g. `RemediationLog` has `beforeState`/`afterState`).

### Pitfall 6: 200-Line File Limit
**What goes wrong:** Adding COP-03/04/05 panels to the existing copilot page (`+page.svelte` is 157 lines) risks exceeding 200 lines.
**How to avoid:** Extract new panels as separate components: `OversharingPanel.svelte`, `LicenseSummaryPanel.svelte`. Import them into the page. Keep each file under 200 lines.

---

## Code Examples

### API Response Shapes (verified from source)

#### Copilot Readiness — `/api/copilot-readiness/latest`
```typescript
// Source: apps/api/src/lib/copilot/readiness-types.ts
interface ReadinessResult {
  overallScore: number;                              // 0–100
  categories: Record<CategoryKey, CategoryResult>;   // 7 keys
  recommendations: Recommendation[];
  assessedAt: string;
}
type CategoryKey = 'licensing' | 'identityAccess' | 'dataProtection'
  | 'compliance' | 'security' | 'collaboration' | 'dataQuality';
```

#### Config Drifts Summary — `/api/config-drifts/summary`
```typescript
// Source: apps/api/src/routes/config-drifts.ts
interface DriftSummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
  unacknowledged: number;
}
```

#### Snapshot Diff — `/api/config-snapshots/:id/diff/:otherId`
```typescript
// Source: apps/api/src/lib/snapshots/diff.ts
interface DiffEntry {
  path: string;
  type: 'added' | 'removed' | 'changed';
  oldValue?: unknown;
  newValue?: unknown;
}
interface CategoryDiff {
  categoryId: string;
  name: string;
  changes: DiffEntry[];
  changeCount: number;
}
// Response: { diffs: CategoryDiff[], totalChanges: number }
```

#### Storage Analytics — `/api/storage-analytics` (GET, cached overview)
```typescript
// Source: apps/api/src/lib/storage/storage-types.ts
interface StorageScanResult {
  oneDriveUsers: OneDriveUser[];   // usedGB, allocatedGB, utilizationPct per user
  sharePointSites: SharePointSite[];
  overview: StorageOverview;
  recommendations: StorageRecommendation[];
  unusedLicenses: UnusedLicense[];
}
```

#### Drift Alert Metadata (current — missing snapshotId)
```typescript
// Source: apps/api/src/lib/snapshots/drift-detector.ts line 70
// Current (INCOMPLETE for SNAP-03):
metadata = JSON.stringify({ categoryId: cat.categoryId, changes: cat.changes.slice(0, 5) })

// Required fix for SNAP-03:
metadata = JSON.stringify({
  categoryId: cat.categoryId,
  snapshotId: newManifest.id,          // ADD THIS
  baselineId: previousSnapshotId,       // ADD THIS
  changes: cat.changes.slice(0, 5),
})
```

### DashboardContent Drift Widget Addition Pattern
```svelte
<!-- Source pattern: apps/web/src/lib/components/DashboardContent.svelte -->
<!-- Add after Row 2 (QuickActions), before Row 3 (Alerts + Risky Users) -->
<!-- DriftSummaryWidget is a new lightweight component wrapping the existing DriftSummary -->
{#await driftSummaryP then summary}
  {#if summary && summary.total > 0}
    <DriftSummaryWidget {summary} href="/backups/config" />
  {/if}
{/await}
```

---

## Existing Components Inventory (what to reuse vs create)

### Already Exist — Reuse
| Component | Path | Used For |
|-----------|------|---------|
| `ReadinessOverview` | `copilot/ReadinessOverview.svelte` | COP-02 overall score ring |
| `CategoryCard` | `copilot/CategoryCard.svelte` | COP-02 per-category breakdown |
| `RecommendationList` | `copilot/RecommendationList.svelte` | COP-02 recommendations |
| `ReadinessHistory` | `copilot/ReadinessHistory.svelte` | assessment history |
| `SnapshotDiff` | `snapshots/SnapshotDiff.svelte` | SNAP-02 visual diff |
| `DriftSummary` | `snapshots/DriftSummary.svelte` | SNAP-01 drift widget (needs to be pulled into dashboard) |
| `DriftAlert` | `snapshots/DriftAlert.svelte` | SNAP-03 drift alert display |
| `ConsumersTable` | `storage/ConsumersTable.svelte` | STOR-01/02/03 with sort/filter |
| `StorageOverview` | `storage/StorageOverview.svelte` | STOR-01/03 overview metrics |
| `StorageRecommendations` | `storage/StorageRecommendations.svelte` | STOR-04 recommendations |
| `UnusedLicenses` | `storage/UnusedLicenses.svelte` | unused license display |
| `QuotaBar` | `storage/QuotaBar.svelte` | utilization bar |
| `ScoreRing` | `ScoreRing.svelte` | score visualization |
| `ExportMenu` | `ui/ExportMenu.svelte` | JSON/PDF export dropdown |

### Must Create — Net New
| Component | Purpose | Req |
|-----------|---------|-----|
| `copilot/OversharingPanel.svelte` | Display oversharing risk user list from new API field | COP-03 |
| `copilot/LicenseSummaryPanel.svelte` | Copilot-licensed vs total licensed breakdown | COP-05 |
| `dashboard/DriftSummaryWidget.svelte` | Compact drift event count + severity for dashboard home | SNAP-01 |

### Must Modify — Existing Files
| File | Change | Req |
|------|--------|-----|
| `apps/api/src/lib/snapshots/drift-detector.ts` | Add `snapshotId`/`baselineId` to alert metadata JSON | SNAP-03 |
| `packages/shared/src/types.ts` | Add optional `metadata?: Record<string, unknown>` to `Alert` | SNAP-03 |
| `apps/api/src/routes/alerts.ts` (or tenants alerts) | Include `metadata` column in alerts SELECT query | SNAP-03 |
| `apps/web/src/lib/components/AlertCard.svelte` | Render "View diff" link when `alert.metadata?.snapshotId` exists | SNAP-03 |
| `apps/web/src/lib/components/DashboardContent.svelte` | Add `DriftSummaryWidget` row | SNAP-01 |
| `apps/web/src/routes/governance/storage/+page.svelte` | Cap `ConsumersTable` at top 20, add 90%-quota flag per row | STOR-02, STOR-04 |
| `apps/api/src/routes/copilot-readiness.ts` | Add `/license-summary` endpoint returning `{ copilotLicensed, totalLicensed, overshareRiskCount, labelGapCount }` | COP-03, COP-04, COP-05 |
| `apps/web/src/routes/security/copilot/+page.svelte` | Wire new panels for COP-03/04/05 (extract to new components) | COP-03, COP-04, COP-05 |

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| Svelte 4 reactive statements (`$:`) | Svelte 5 runes (`$state`, `$derived`, `$effect`) | All new components MUST use runes — no exceptions |
| Global fetch with manual auth headers | `api.get`/`api.post` from `$api/client` | Client injects `Authorization` + `x-tenant-id` automatically |
| PDF via Puppeteer/headless Chrome | HTML report + browser print | Works within Workers CPU limits |

---

## Open Questions

1. **COP-03 Oversharing Data Source**
   - What we know: `checkCollaboration` counts public groups as an oversharing proxy; no per-user sharing report exists
   - What's unclear: Whether `/reports/getSharePointActivityUserDetail` is accessible with current Graph permissions, or whether the oversharing requirement can be satisfied with the existing public-group count
   - Recommendation: For v1, surface the public groups count as "oversharing risk signal" from the existing `checkCollaboration` check. Add a note that per-user oversharing report is a v2 feature (matches `OVER-01` in v2 requirements). This avoids a new Graph permission requirement.

2. **COP-04 Sensitivity Label Gap — Unlabeled Content Count**
   - What we know: Graph `/informationProtection/policy/labels` gives published labels. Actual unlabeled file count requires Microsoft Purview Activity Explorer or compliance APIs requiring additional Graph permissions not currently in scope.
   - What's unclear: Whether the current app credentials have `InformationProtection.Read.All` at the data level (not just policy level)
   - Recommendation: For v1, surface "N sensitivity labels published" as the label coverage signal. Show a static recommended action: "Review unlabeled content in Microsoft Purview." Avoids blocking Phase 2 on a permissions investigation.

3. **SNAP-03 Alert Schema Change — Impact on Existing Alerts**
   - What we know: Adding `snapshotId`/`baselineId` to `metadata` in `drift-detector.ts` only affects future drift alerts
   - What's unclear: Whether any existing integration tests mock the alert insert in a way that would break
   - Recommendation: The change is additive (existing `categoryId` and `changes` fields remain). Check `drift-detector.test.ts` for any assertions on `metadata` shape before patching.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (node env for API, jsdom for web) |
| Config file | `apps/api/vitest.config.ts`, `apps/web/vitest.config.ts` |
| Quick run command | `cd apps/api && npx vitest run --reporter=dot` |
| Full suite command | `npm run test` (root, runs both workspaces) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COP-01 | `POST /assess` triggers readiness engine, returns `{ result, assessmentId }` | unit (API route) | `cd apps/api && npx vitest run src/routes/copilot-readiness.test.ts` | ✅ |
| COP-02 | Score 0–100, 7 categories returned | unit (readiness-engine) | `cd apps/api && npx vitest run src/lib/copilot/readiness-engine.test.ts` | ✅ |
| COP-03 | Oversharing signal present in `/license-summary` response | unit (new endpoint) | `cd apps/api && npx vitest run src/routes/copilot-readiness.test.ts` | ❌ Wave 0 |
| COP-04 | Label gap field present in `/license-summary` response | unit (new endpoint) | `cd apps/api && npx vitest run src/routes/copilot-readiness.test.ts` | ❌ Wave 0 |
| COP-05 | `{ copilotLicensed, totalLicensed }` returned from `/license-summary` | unit (new endpoint) | `cd apps/api && npx vitest run src/routes/copilot-readiness.test.ts` | ❌ Wave 0 |
| COP-06 | Export returns HTML content-type, R2 cached | unit (pdf route) | `cd apps/api && npx vitest run src/routes/copilot-readiness.test.ts` | ✅ |
| SNAP-01 | Drift summary widget renders on dashboard with count + severity | unit (component) | `cd apps/web && npx vitest run src/lib/components/dashboard/DriftSummaryWidget.test.ts` | ❌ Wave 0 |
| SNAP-02 | Diff response has `diffs[]` with `type: 'added'\|'removed'\|'changed'` | unit (diff lib) | `cd apps/api && npx vitest run src/lib/snapshots/diff.test.ts` | ✅ |
| SNAP-03 | Drift alert metadata includes `snapshotId` and `baselineId` | unit (drift-detector) | `cd apps/api && npx vitest run src/lib/snapshots/drift-detector.test.ts` | ✅ (needs assertion update) |
| STOR-01 | `/storage-analytics/onedrive` returns `usedGB`, `utilizationPct` per user | unit (API route) | `cd apps/api && npx vitest run src/routes/storage-analytics.test.ts` | ✅ |
| STOR-02 | ConsumersTable renders max 20 rows | unit (component) | `cd apps/web && npx vitest run src/lib/components/storage/ConsumersTable.test.ts` | ❌ Wave 0 |
| STOR-03 | `/storage-analytics/sharepoint` returns site list | unit (API route) | `cd apps/api && npx vitest run src/routes/storage-analytics.test.ts` | ✅ |
| STOR-04 | Row with `utilizationPct >= 90` shows quota warning badge | unit (component) | `cd apps/web && npx vitest run src/lib/components/storage/ConsumersTable.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/api && npx vitest run --reporter=dot` (API only, fast)
- **Per wave merge:** `npm run test` (all workspaces)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/api/src/routes/copilot-readiness.test.ts` — add test stubs for `/license-summary` endpoint (COP-03, COP-04, COP-05)
- [ ] `apps/api/src/lib/snapshots/drift-detector.test.ts` — update `metadata` assertion to expect `snapshotId`/`baselineId` fields (SNAP-03)
- [ ] `apps/web/src/lib/components/dashboard/DriftSummaryWidget.test.ts` — new component test (SNAP-01)
- [ ] `apps/web/src/lib/components/storage/ConsumersTable.test.ts` — new component test covering top-20 cap and 90%-quota badge (STOR-02, STOR-04)

---

## Sources

### Primary (HIGH confidence)
- `apps/api/src/routes/copilot-readiness.ts` — all endpoint signatures, response shapes
- `apps/api/src/routes/copilot-readiness-pdf.ts` — PDF export mechanism (R2 + HTML)
- `apps/api/src/routes/config-snapshots.ts` — snapshot CRUD and diff endpoint
- `apps/api/src/routes/config-drifts.ts` — drift list, summary, acknowledge endpoints
- `apps/api/src/routes/storage-analytics.ts` — storage scan and all sub-endpoints
- `apps/api/src/lib/copilot/readiness-types.ts` — `ReadinessResult`, `CategoryKey`, `Recommendation` types
- `apps/api/src/lib/copilot/readiness-checks.ts` — what each check returns (string details, not structured counts)
- `apps/api/src/lib/snapshots/snapshot-types.ts` — `DriftRow`, `SnapshotRow`, severity mapping
- `apps/api/src/lib/snapshots/diff.ts` — `CategoryDiff`, `DiffEntry` types
- `apps/api/src/lib/snapshots/drift-detector.ts` — alert insert with metadata shape (confirmed no snapshotId)
- `apps/api/src/lib/storage/storage-types.ts` — `StorageScanResult`, `OneDriveUser`, `SharePointSite`
- `apps/web/src/routes/security/copilot/+page.svelte` — full copilot page implementation
- `apps/web/src/routes/backups/config/+page.svelte` — snapshot page with diff flow
- `apps/web/src/routes/backups/config/compare/+page.svelte` — dedicated compare page
- `apps/web/src/routes/governance/storage/+page.svelte` — storage analytics page
- `apps/web/src/routes/+page.svelte` — dashboard home (no drift widget)
- `apps/web/src/lib/components/DashboardContent.svelte` — dashboard layout (confirmed no drift section)
- `apps/web/src/lib/components/storage/ConsumersTable.svelte` — sort/filter but no top-20 cap or quota badge
- `packages/shared/src/types.ts` — `Alert` (no metadata field), `DashboardMetrics` (no drift fields)
- `apps/api/src/app/routes-security.ts`, `routes-governance.ts`, `routes-analytics.ts` — route mounting confirmed

### Secondary (MEDIUM confidence)
- STATE.md note: "Storage Analytics UI can be built optimistically in Phase 2 but is not shippable until Phase 3 scanner fix lands" — confirms the UI/API split strategy

---

## Metadata

**Confidence breakdown:**
- API endpoints and response shapes: HIGH — read directly from source files
- Existing component inventory: HIGH — directory listed and key files read
- Gap analysis (what's missing): HIGH — cross-referenced requirements against actual code
- COP-03/04 Graph API data availability: MEDIUM — depends on tenant Graph permissions not verified in test tenant

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (stable codebase, no external API dependencies changing)
