> **HISTORICAL:** This sprint doc reflects technology choices at time of writing. Auth migrated from Clerk to Auth.js (March 2026). Compute migrated from Fly.io to Hetzner Cloud. Pricing tiers updated. See `CLAUDE.md` for current stack.

# Sprint 1: Agent Runtime MVP (2 weeks)

## Goal
A user can click "Deploy Agent" in the dashboard and get a real running container
with the OpenSyber agent inside it, reporting health back to the API.

## Why This Sprint First
Nothing else matters without compute. The entire product promise is
"deploy a secured agent" — this sprint makes that real.

## Tech Choice: Fly.io Machines API
- No Kubernetes complexity. Single API call creates a container.
- Per-second billing. Free tier: 3 shared-cpu VMs.
- Built-in WireGuard networking. Private IPs.
- GPU support later if needed for AI workloads.
- REST API: `POST /v1/apps/{app}/machines` — instant boot.

## Tasks

### 1.1 Compute Provider Account & Base Image (Adapted: Hetzner Cloud)
- [x] Create Hetzner Cloud account, generate API token
- [x] Store `HETZNER_API_TOKEN` as Cloudflare Worker secret
- [x] Create `apps/agent/Dockerfile`:
  - Base: `node:22-slim`
  - Install: openssh-server, fail2ban, auditd, rkhunter, iptables
  - Copy compiled agent (`dist/`)
  - Entrypoint: starts agent + sshd
- [ ] Build & push image to registry
- [ ] Test: deploy manually to verify image works
- [x] Write tests for Dockerfile build process

### 1.2 Provisioning Service (API) — Adapted to Hetzner
- [x] Create `apps/api/src/services/hetzner.ts` (< 200 lines):
  - `createServer(instanceId, region, plan, apiToken)` → Hetzner Cloud API
  - `deleteServer(hetznerServerId, apiToken)` → destroy server
  - `restartServer(hetznerServerId, apiToken)` → reboot
  - `getServerStatus(hetznerServerId, apiToken)` → running/stopped/error
- [x] Create `apps/api/src/services/hetzner.test.ts`:
  - Mock Hetzner API responses
  - Test create/delete/restart/status flows
  - Test error handling
- [x] Add `hetznerServerId` column to `instances` table (in schema)
- [x] Add `region` column to `instances` table (in schema)

### 1.3 Deploy Instance Endpoint
- [x] Update `POST /api/instances` in `routes/instances.ts`:
  - Validate plan limits (free = 1 instance)
  - Generate gateway token, encrypt, store in D1 + KV
  - Call `hetznerService.createServer()` with region + plan
  - Store `hetznerServerId` in instances row
  - Set status to `provisioning` → `ready` on success, `error` on failure
  - Send "agent deployed" email via Resend
- [x] Update `DELETE /api/instances/:id`:
  - Call `hetznerService.deleteServer()` before cleaning up KV
- [x] Update `POST /api/instances/:id/restart`:
  - Call `hetznerService.restartServer()`
- [x] Write integration tests for all three endpoints

### 1.4 Health Check Loop
- [x] Verify agent's `HealthMonitor` works with containers
- [x] Update `POST /webhooks/agent/health` to store health data in KV
- [x] Add machine status polling: API cron checks Hetzner every 5 min
  - If machine stopped unexpectedly → set status to `error`
  - If machine healthy → set status to `running`
- [x] Write tests for health check cron logic — 9 tests

### 1.5 Deploy Button (Frontend)
- [x] Create `components/dashboard/DeployInstanceButton.tsx`:
  - Fields: name (text), region (select: eu-central/us-east/us-west/ap-southeast)
  - POST to `/api/proxy/instances`
  - Loading state with deploying indicator
  - Success: reload to show new instance
- [x] Update `apps/web/src/app/dashboard/page.tsx`:
  - Deploy button integrated into dashboard
  - Shows instance list with status
- [x] Write component tests for DeployInstanceButton

### 1.6 Instance Lifecycle UI
- [x] Create `components/dashboard/InstanceStatusBadge.tsx`:
  - Colors: running=green, provisioning=yellow, stopped=gray, error=red
- [x] Create `components/dashboard/RestartButton.tsx`
- [x] Create `components/dashboard/DeleteInstanceButton.tsx`
- [x] Wire into dashboard main page and settings page
- [x] Write component tests for InstanceStatusBadge

## Region Mapping
| Display Name | Fly.io Code | Location |
|---|---|---|
| Europe (Amsterdam) | ams | Netherlands |
| US East (Virginia) | iad | Virginia |
| US West (San Jose) | sjc | California |
| Asia (Singapore) | sin | Singapore |

## Definition of Done
- [x] User clicks "Deploy Agent" → real container starts on Fly.io
- [x] Dashboard shows live instance status (running/stopped/error)
- [x] Health metrics flow from container → API → dashboard
- [x] Delete instance destroys the Fly.io container
- [x] Restart instance works end-to-end
- [x] All new code has tests (>80% coverage)
- [x] `pnpm build` passes, `pnpm test` passes
- [x] Deployed to production (API + web)

## Estimated Effort
| Task | Days |
|---|---|
| 1.1 Dockerfile + Fly.io setup | 2 |
| 1.2 Compute service | 2 |
| 1.3 Deploy endpoint | 2 |
| 1.4 Health check loop | 1 |
| 1.5 Deploy button UI | 1 |
| 1.6 Instance lifecycle UI | 1 |
| Testing + integration | 1 |
| **Total** | **10 days** |
