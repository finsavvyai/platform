> **HISTORICAL:** This sprint doc reflects technology choices at time of writing. Auth migrated from Clerk to Auth.js (March 2026). Compute migrated from Fly.io to Hetzner Cloud. Pricing tiers updated. See `CLAUDE.md` for current stack.

# Sprint 2: Skill Installation & Real Monitoring (2 weeks)

## Goal
A user can install a skill from the marketplace onto their running agent,
and see real security events and metrics flowing into their dashboard.

## Dependencies
- Sprint 1 complete (running containers with agent)

## Tasks

### 2.1 Skill Package Format
- [x] Define skill package spec in `packages/shared/src/types/skill.ts`:
  - `SkillManifest`: name, slug, version, entrypoint, permissions
  - `SkillPermissions`: network domains, file paths, env vars
  - `SkillPackage`: manifest + base64 package data
- [x] Create 3 real starter skills in `skills/` directory:
  - `github-integration`: watches repos via GitHub API
  - `slack-notifier`: sends alerts to Slack webhook
  - `log-analyzer`: parses container logs for anomalies
- [x] Write validation tests for skill manifest format
- [x] Store skill packages in Cloudflare R2

### 2.2 Skill Installation API
- [x] `POST /api/instances/:id/skills` — install skill (validates, creates skillInstallation row)
- [x] `DELETE /api/instances/:id/skills/:skillId` — uninstall skill (removes row)
- [x] `GET /api/instances/:id/skills` — list installed skills with status
- [x] Tests exist for all skill installation endpoints
- [x] Add R2 package download in install flow
- [x] Send install command to agent via health webhook response

### 2.3 Agent Skill Runner
- [x] Create `apps/agent/src/skills/runner.ts`:
  - Load skill from `~/.syber-engine/skills/{slug}/`
  - Execute in sandboxed Node.js worker_threads
  - Capture errors → security events via API
  - Resource limits via worker_threads resourceLimits
- [x] Create `apps/agent/src/skills/installer.ts`:
  - Install/uninstall skill packages
  - Read manifests, list installed skills
  - Validate manifest before execution
- [x] Create `apps/agent/src/skills/sandbox.ts`:
  - Network: domain allowlist validation
  - Filesystem: path restriction enforcement
  - CPU/memory limits via configurable ResourceLimits
- [x] Write unit tests for runner, installer, sandbox

### 2.4 Real Security Monitoring
- [x] Update `apps/agent/src/monitors/security.ts`:
  - Watch all skill processes for unauthorized network calls
  - Log file access attempts outside allowed paths
  - Detect credential file reads
  - Report `skill_violation` events with detail
- [x] Create `apps/agent/src/monitors/network.ts`:
  - Monitor outbound connections via `/proc/net/tcp`
  - Report domain, port, protocol, bytes for each connection
  - Flag connections not in network allowlist
- [x] Create `apps/agent/src/monitors/filesystem.ts`:
  - Use `fs.watch` + SHA256 baselines for file integrity monitoring
  - Generate baselines on first run
  - Report modified/created/deleted file events
- [x] Write tests for all monitor modules

### 2.5 Real Health Metrics
- [x] Update `HealthMonitor` to report accurate container metrics:
  - CPU: read from `/sys/fs/cgroup/cpu.stat`
  - Memory: read from `/sys/fs/cgroup/memory.current`
  - Disk: `df` on container filesystem
  - Network: read from `/proc/net/dev`
  - Running skills: list active worker_threads
- [x] Update API `POST /webhooks/agent/health` to store all metrics
- [x] Write tests for metric collection

### 2.6 Skill Install UI
- [x] Create `components/marketplace/InstallSkillButton.tsx`:
  - "Install" button on marketplace skill cards
  - Confirms instance selection (if user has multiple)
  - POST to `/api/proxy/instances/:id/skills`
  - Shows installing → installed state
- [x] Create `components/dashboard/UninstallSkillButton.tsx`:
  - Shows skill name, version, status, last active
  - Uninstall button with confirmation
- [x] Update `apps/web/src/app/dashboard/skills/page.tsx`:
  - Show real installed skills from API
  - Add "Browse Marketplace" link
- [x] Write component tests for all new components

## Skill Permission Model
```
{
  "name": "github-integration",
  "version": "1.0.0",
  "permissions": {
    "network": ["api.github.com", "github.com"],
    "filesystem": ["./data/"],
    "env": ["GITHUB_TOKEN"]
  }
}
```

## Definition of Done
- [x] User installs a skill → agent downloads and runs it
- [x] Skill runs in sandboxed worker_thread with permission limits
- [x] Real security events appear in dashboard
- [x] Real network activity logged and displayed
- [x] File integrity monitoring active with baselines
- [x] Health metrics show actual CPU/memory/disk from container
- [x] Skill uninstall works end-to-end
- [x] All new code has tests (>80% coverage)
- [x] `pnpm build` passes, `pnpm test` passes

## Estimated Effort
| Task | Days |
|---|---|
| 2.1 Skill package format | 1 |
| 2.2 Skill installation API | 2 |
| 2.3 Agent skill runner + sandbox | 3 |
| 2.4 Security monitoring | 2 |
| 2.5 Health metrics | 1 |
| 2.6 Skill install UI | 1 |
| **Total** | **10 days** |
