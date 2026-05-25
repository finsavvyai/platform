> **HISTORICAL:** This sprint doc reflects technology choices at time of writing. Auth migrated from Clerk to Auth.js (March 2026). Compute migrated from Fly.io to Hetzner Cloud. Pricing tiers updated. See `CLAUDE.md` for current stack.

# Sprint 4: Security Hardening & Credential Vault (2 weeks)

## Goal
The platform is actually secure — not just monitoring security, but
enforcing it. Users can store secrets safely and inject them into agents.

## Dependencies
- Sprint 1-3 complete (running agents with real data)

## Tasks

### 4.1 Credential Vault
- [x] Create `apps/api/src/services/vault.ts`:
  - `storeSecret(userId, instanceId, key, value)` → encrypt with AES-GCM
  - `listSecrets(userId, instanceId)` → list keys (NOT values)
  - `deleteSecret(userId, instanceId, key)` → remove
  - `getDecryptedSecrets(instanceId)` → return decrypted for agent
  - Store encrypted in D1 `credentials` table
- [x] Create D1 migration `0005_credentials_vault.sql`:
  - id, userId, instanceId, key, encryptedValue, createdAt
- [x] Write tests for vault service (encrypt/decrypt round-trip) — 13 tests

#### Vault API Endpoints
- [x] Create `apps/api/src/routes/vault.ts`:
  - `GET /api/instances/:id/secrets` — list keys (no values)
  - `POST /api/instances/:id/secrets` — store a secret
  - `DELETE /api/instances/:id/secrets/:key` — delete
  - `GET /api/agent/instances/:id/secrets` — agent-only, returns decrypted
- [x] Create proxy routes:
  - `apps/web/src/app/api/proxy/instances/[id]/secrets/route.ts` (GET, POST)
  - `apps/web/src/app/api/proxy/instances/[id]/secrets/[key]/route.ts` (DELETE)
- [x] Write tests for all vault endpoints — 17 tests (vault.test.ts + vault-delete.test.ts)

#### Vault UI
- [x] Create `components/dashboard/security/SecretsList.tsx`:
  - List secret keys with masked values (********)
  - Delete button per secret with empty state
- [x] Create `components/dashboard/security/AddSecretForm.tsx`:
  - Key input (auto-uppercase, env var format) + Value input (type=password)
- [x] Add secrets section to instance settings page
- [x] Write component tests — 20 tests (SecretsList + AddSecretForm)

### 4.2 Network Isolation
- [x] Update `apps/agent/Dockerfile` + `entrypoint.sh`:
  - iptables already installed in Dockerfile
  - Default: block all outbound except loopback, DNS, HTTPS (entrypoint.sh)
  - Agent Firewall module applies fine-grained rules after boot
- [x] Create `apps/agent/src/security/firewall.ts`:
  - `applyNetworkPolicy(policy)` → iptables rules
  - `allowDomains(domains)` → resolve + allow IPs
  - `blockAll()` → drop all outbound
  - `getActiveRules()` → list current iptables rules
- [x] Agent fetches policies on boot: `GET /api/agent/.../policies`
- [x] Apply `network_allowlist` and `network_blocklist` policies
- [x] Write tests for firewall rule generation

### 4.3 File Integrity Enforcement
- [x] Update `apps/agent/src/monitors/filesystem.ts`:
  - Generate SHA256 baseline on first boot
  - Report baseline to API: `POST .../file-baselines`
  - Continuous monitoring: alert on unauthorized changes
  - Apply `file_path_rules` policy (read-only paths)
- [x] Critical paths to monitor:
  - `/etc/passwd`, `/etc/shadow`, `/etc/ssh/sshd_config`
  - Agent binary and config files
  - Skill directories (detect tampering)
- [x] Write tests for baseline generation and diff detection

### 4.4 Shell Command Auditing
- [x] Create `apps/agent/src/security/shell-audit.ts`:
  - Hook into auditd for command execution tracking
  - Parse audit log entries → security events
  - Apply `shell_command_rules` policy (block dangerous commands)
  - Report all shell executions to API
- [x] Configure auditd rules in Dockerfile:
  - Watch: /bin, /usr/bin, /sbin for execve
  - Log: all sudo and su commands
- [x] Write tests for audit log parsing

### 4.5 Rate Limiting
- [x] Create `apps/api/src/middleware/rate-limit.ts`:
  - Use Cloudflare KV for sliding window counters
  - Public endpoints: 60 req/min per IP
  - Authenticated: 300 req/min per user
  - Agent webhooks: 600 req/min per instance
- [x] Apply to all route groups in `index.ts`
- [x] Write tests for rate limit logic — 23 tests

### 4.6 Security Score (Real Calculation)
- [x] Implemented in `apps/api/src/routes/security.ts`:
  - Calculates from REAL data (not mock):
    - Credential Security (20%): credential access events, IP allowlist
    - Skill Safety (15%): unverified/blocked skill penalties
    - Network Security (20%): unauthorized network events, network policies
    - Update Status (10%): agent version, health check recency
    - Config Hardening (15%): policies, baselines, alert rules
    - Vulnerability Management (10%): open CVEs by severity
    - Incident Readiness (10%): alert rules, open incidents/alerts
- [x] Cron job: `recordScoreSnapshots` runs hourly via wrangler cron
- [x] Write tests for score calculation with various scenarios — 22 tests

## Definition of Done
- [x] Users can store/retrieve/delete secrets in the vault
- [x] Secrets are encrypted at rest (AES-GCM)
- [x] Agents can fetch decrypted secrets securely
- [x] Network policies enforced via iptables in containers
- [x] File integrity monitoring with real baselines
- [x] Shell commands audited and logged
- [x] Rate limiting active on all endpoints
- [x] Security score calculated from real data
- [x] All new code has tests (>80% coverage)
- [x] `pnpm build` and `pnpm test` pass

## Estimated Effort
| Task | Days |
|---|---|
| 4.1 Credential vault (API + UI) | 3 |
| 4.2 Network isolation | 2 |
| 4.3 File integrity | 1 |
| 4.4 Shell auditing | 1 |
| 4.5 Rate limiting | 1 |
| 4.6 Security score | 1 |
| Testing + integration | 1 |
| **Total** | **10 days** |
