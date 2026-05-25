> **HISTORICAL:** This sprint doc reflects technology choices at time of writing. Auth migrated from Clerk to Auth.js (March 2026). Compute migrated from Fly.io to Hetzner Cloud. Pricing tiers updated. See `CLAUDE.md` for current stack.

# Sprint 3: Dashboard CRUD & Real Data (2 weeks)

## Goal
Every dashboard page shows real data and every API endpoint is accessible
from the UI. Users can create, edit, and delete security resources.

## Dependencies
- Sprint 1 (running containers)
- Sprint 2 (real data flowing)

## Context
We have 36+ API endpoints but the dashboard is read-only. This sprint
adds the 17 client components needed to make every CRUD operation work.

## Tasks

### Phase A — Row-Level Actions (Days 1-2)

#### 3.1 Alert Actions
- [x] Create `components/dashboard/security/AlertActionButtons.tsx`:
  - "Acknowledge" + "Resolve" buttons per alert row
  - PATCH `/api/proxy/security/instances/{id}/alerts/{alertId}`
- [x] Update alerts page: add "Actions" column
- [x] Write tests for AlertActionButtons

#### 3.2 Vulnerability Status
- [x] Create `components/dashboard/security/VulnerabilityStatusSelect.tsx`:
  - Dropdown: open, in_progress, fixed, ignored, false_positive
  - PATCH `.../vulnerabilities/{vulnId}`
- [x] Update vulnerabilities page: replace static badge
- [x] Write tests for VulnerabilityStatusSelect

#### 3.3 Alert Rule Toggle/Delete
- [x] Create `components/dashboard/security/AlertRuleActions.tsx`:
  - Toggle active: PATCH with `{ isActive: !isActive }`
  - Delete: DELETE with confirm dialog
- [x] Update alert-rules page: add "Actions" column
- [x] Write tests for AlertRuleActions

### Phase B — Create Modals (Days 3-6)

#### 3.4 Create Alert Rule
- [x] Create `components/dashboard/security/CreateAlertRuleModal.tsx`:
  - Fields: name, eventType, severityFilter, threshold, window, cooldown
  - POST `.../alert-rules`
- [x] Update alert-rules page: "New Rule" button + modal
- [x] Write tests for CreateAlertRuleModal

#### 3.5 Create Policy
- [x] Create `components/dashboard/security/CreatePolicyModal.tsx`:
  - Fields: policyType (6 types), name, rules (JSON), isActive
  - POST `.../policies`
- [x] Create `components/dashboard/security/PolicyActions.tsx`:
  - Toggle active + Delete per policy card
- [x] Update policies page: "New Policy" button + actions
- [x] Write tests for both components

#### 3.6 Generate Compliance Report
- [x] Create `components/dashboard/security/GenerateComplianceReport.tsx`:
  - Framework select (SOC 2 / ISO 27001 / CIS) + "Generate"
  - POST `.../compliance-reports`
- [x] Update compliance page: add in header + empty state
- [x] Write tests for GenerateComplianceReport

#### 3.7 Incident CRUD
- [x] Create `components/dashboard/security/CreateIncidentModal.tsx`:
  - Fields: title, description, severity
  - POST `.../incidents`
- [x] Create `components/dashboard/security/IncidentStatusSelect.tsx`:
  - Lifecycle: open → investigating → contained → resolved → closed
- [x] Create `components/dashboard/security/AddIncidentComment.tsx`:
  - Textarea + "Add Comment" → POST `.../incidents/{id}/events`
- [x] Update incidents list: "Report Incident" button + modal
- [x] Update incident detail: status select + comment form
- [x] Write tests for all three components

### Phase C — Settings Pages (Days 7-8)

#### 3.8 Notification Channels
- [x] Create `app/dashboard/settings/notifications/page.tsx`:
  - Server component: GET `.../notification-channels`
- [x] Create `components/dashboard/security/CreateNotificationChannelForm.tsx`:
  - channelType: email/webhook/slack with conditional fields
- [x] Create `components/dashboard/security/DeleteNotificationChannelButton.tsx`
- [x] Add "Notifications" nav item in dashboard sidebar
- [x] Write tests for all notification components

#### 3.9 Instance Management
- [x] Create `components/dashboard/RenameInstanceButton.tsx`:
  - Inline edit: pencil icon → input + Save/Cancel
  - PATCH `/api/proxy/instances/{id}` body `{ name }`
- [x] Update settings page with rename functionality
- [x] Write tests for RenameInstanceButton

### Phase D — Data Visualizations (Days 9-10)

#### 3.10 Threat Map
- [x] Create `components/dashboard/security/ThreatMapViz.tsx`:
  - Bubble grid: country codes sized by event count
  - Colored by severity (red/amber/green)
- [x] Add to threats page above existing table
- [x] Write tests for ThreatMapViz

#### 3.11 Security Score Chart
- [x] Create `components/dashboard/security/ScoreHistoryChart.tsx`:
  - SVG line chart with 7d/30d/90d tabs
  - Color by score range (red < 40, amber < 70, green >= 70)
  - Graceful empty state
- [x] Add to security main page below category breakdown
- [x] Write tests for ScoreHistoryChart

## Component Pattern (All Modals)
```tsx
// Dark overlay + centered panel
<div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
  <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 w-full max-w-md">
    {/* Form content */}
  </div>
</div>
```

## Definition of Done
- [x] Every API endpoint has a corresponding UI action
- [x] Users can create alert rules, policies, incidents
- [x] Users can acknowledge/resolve alerts
- [x] Users can change vulnerability status
- [x] Notification channels CRUD works
- [x] Threat map and score chart render
- [x] All new components have tests (>80% coverage)
- [x] `pnpm build` passes, `pnpm test` passes

## Estimated Effort
| Phase | Days |
|---|---|
| A. Row-level actions | 2 |
| B. Create modals | 4 |
| C. Settings pages | 2 |
| D. Visualizations | 2 |
| **Total** | **10 days** |
