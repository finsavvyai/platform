> **HISTORICAL:** This sprint doc reflects technology choices at time of writing. Auth migrated from Clerk to Auth.js (March 2026). Compute migrated from Fly.io to Hetzner Cloud. Pricing tiers updated. See `CLAUDE.md` for current stack.

# Sprint 12: Credential Lifecycle Management + JIT Access (2 weeks)

## Goal
Close the final CyberArk gap: automated credential rotation with configurable
policies, and just-in-time privilege elevation with approval gates and automatic
expiry. Extends the existing vault service with zero breaking changes.

## Dependencies
- Sprint 11 complete (cloud accounts — JIT needs cloud context)
- Existing `vault.ts` route + `vault.ts` service (extends, does not replace)

## Competitive Target
- **CyberArk:** Credential Vault, Just-in-Time Access, Session Management
- **Closes the last remaining CyberArk feature gap**

---

## ⚡ MVP PATH (4 days) — Close the CyberArk gap immediately

### MVP.1 — Rotation Policies Schema (Day 1)
```sql
CREATE TABLE vault_rotation_policies (
  id TEXT PRIMARY KEY,
  orgId TEXT NOT NULL,
  instanceId TEXT NOT NULL REFERENCES instances(id),
  secretKey TEXT NOT NULL,
  rotationIntervalDays INTEGER NOT NULL DEFAULT 90,
  notifyDaysBeforeExpiry INTEGER NOT NULL DEFAULT 7,
  autoRotate INTEGER DEFAULT 0,     -- 1 = automatic, 0 = notify only
  lastRotatedAt TEXT,
  nextRotationAt TEXT NOT NULL,
  isActive INTEGER DEFAULT 1,
  createdAt TEXT NOT NULL
);

CREATE TABLE vault_rotation_history (
  id TEXT PRIMARY KEY,
  policyId TEXT NOT NULL REFERENCES vault_rotation_policies(id),
  instanceId TEXT NOT NULL,
  secretKey TEXT NOT NULL,
  rotatedAt TEXT NOT NULL,
  rotatedBy TEXT NOT NULL,          -- userId or 'system'
  previousValueHash TEXT NOT NULL,  -- SHA-256 of old value (for audit, not recovery)
  trigger TEXT NOT NULL             -- 'manual' | 'scheduled' | 'policy'
);

CREATE TABLE jit_access_requests (
  id TEXT PRIMARY KEY,
  orgId TEXT NOT NULL,
  requestorId TEXT NOT NULL,
  targetRole TEXT NOT NULL,
  justification TEXT NOT NULL,
  durationMinutes INTEGER NOT NULL DEFAULT 60,
  status TEXT DEFAULT 'pending',    -- 'pending' | 'approved' | 'rejected' | 'expired'
  approvedBy TEXT,
  approvedAt TEXT,
  expiresAt TEXT,
  revokedAt TEXT,
  createdAt TEXT NOT NULL
);
```
- [ ] Create D1 migration `0012_credential_lifecycle.sql`
- [ ] Update Drizzle schema in `packages/db/src/schema/security.ts`

### MVP.2 — Rotation Service (Day 1–2)
- [ ] Create `apps/api/src/services/vault-rotation.ts` (< 200 lines):
  ```typescript
  export interface VaultRotationService {
    createPolicy(opts): Promise<RotationPolicy>
    triggerRotation(policyId, triggeredBy): Promise<RotationHistory>
    checkExpiringSecrets(orgId): Promise<ExpiringSecret[]>
    computeNextRotation(intervalDays): string
  }
  ```
  - On rotation: new value generated (random 32-byte hex), stored encrypted
  - Old value hash stored in history
  - Audit log entry written
- [ ] Extend `vault.ts` routes:
  - `GET    /api/instances/:id/secrets/:key/policy` — get rotation policy
  - `POST   /api/instances/:id/secrets/:key/policy` — create/update policy
  - `POST   /api/instances/:id/secrets/:key/rotate` — manual rotate now
  - `GET    /api/instances/:id/secrets/:key/history` — rotation history
- [ ] Write tests for rotation service and new routes

### MVP.3 — JIT Access (Day 2–3)
- [ ] Create `apps/api/src/routes/jit-access.ts`:
  - `POST /api/jit/request` — request elevated role
  - `GET  /api/jit/requests` — list pending requests (approvers see all)
  - `POST /api/jit/requests/:id/approve` — approve request
  - `POST /api/jit/requests/:id/reject` — reject request
  - `POST /api/jit/requests/:id/revoke` — revoke active access early
- [ ] Create `apps/api/src/services/jit-access.ts` (< 200 lines):
  - On approve: create time-limited role override stored in KV
  - On check: RBAC middleware reads KV override, applies if not expired
  - On expiry: cron cleans up expired KV entries, writes audit log
- [ ] Extend RBAC middleware to honor JIT overrides from KV
- [ ] Notifications: email + Slack when JIT requested, approved, expiring
- [ ] Write tests

### MVP.4 — UI (Day 3–4)
- [ ] Create `components/dashboard/security/RotationPolicyModal.tsx`:
  - Interval select (30/60/90/180 days)
  - Auto-rotate toggle
  - Notify-before select
  - Save + "Rotate Now" button
- [ ] Add rotation badge to vault secrets list: "Expires in X days" / "Overdue"
- [ ] Create `app/dashboard/security/jit/page.tsx`:
  - Pending approval requests (admin/owner)
  - My active JIT sessions
  - Request JIT access form
- [ ] Add JIT to security sidebar
- [ ] Write component tests

---

## 🔵 FULL PATH (8 days) — Full CyberArk parity

Everything in MVP plus:

### FULL.1 — Dynamic Secret Generation
- [ ] Database credentials: generate temporary DB user + password on demand
  - MySQL/Postgres/MongoDB adapters
  - Auto-revoke on JIT expiry
- [ ] Cloud API keys: generate short-lived AWS STS tokens from stored role ARN
- [ ] API keys: generate/revoke per-request tokens for external services

### FULL.2 — Secret Leakage Detection
- [ ] Scan agent stdout/stderr for secret patterns (regex + Shannon entropy)
- [ ] Alert + auto-rotate on detected leakage
- [ ] Integration: GitHub secret scanning webhook → trigger rotation

### FULL.3 — Approval Workflows
- [ ] Multi-level approval (require N of M approvers)
- [ ] Approval timeout: auto-reject after X hours
- [ ] Delegation: out-of-office approval routing
- [ ] Slack interactive buttons for approve/reject in-channel

### FULL.4 — Session Recording
- [ ] Record terminal sessions during JIT access windows
- [ ] Store session recording in R2 (reuse existing R2 integration)
- [ ] Playback UI for auditors
- [ ] Auto-terminate session on anomalous commands (configurable blocklist)

### FULL.5 — Compliance Mapping
- [ ] Map rotation policies to CyberArk CDA controls
- [ ] SOC2 CC6.1: credential lifecycle evidence
- [ ] Include rotation history in compliance export (Sprint 9 PDF)

---

## Definition of Done
- [ ] Rotation policy can be created per secret
- [ ] Manual rotation works with audit trail
- [ ] Scheduled rotation triggers via cron
- [ ] Expiring secrets surface in security dashboard
- [ ] JIT access request → approve → elevated role → auto-expire
- [ ] Notifications sent at each JIT state change
- [ ] All new routes have tests (>80% coverage)
- [ ] Zero regression on existing vault routes

## Estimated Effort
| Task | MVP Days | Full Days |
|---|---|---|
| Schema + migration | 0.5 | 0.5 |
| Rotation service + routes | 1.5 | 2 |
| JIT access service + routes | 1 | 2 |
| UI (rotation + JIT pages) | 1 | 2 |
| Dynamic secrets + session recording | — | 1.5 |
| **Total** | **4** | **8** |
