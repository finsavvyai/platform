# PushCI Security Model

## Threat Model Overview

PushCI executes arbitrary user code on shared infrastructure.
Every design decision assumes runners are hostile environments.

## Threat: Malicious Code in Repository

**Risk**: User commits code that attacks the runner or other tenants.
**Mitigations**:
- Each job runs in an isolated Docker container (default) or microVM
- Network access restricted to allow-listed domains
- Filesystem is ephemeral; destroyed after job completes
- Resource limits enforced: CPU, memory, disk, execution time
- No privileged containers unless explicitly enabled by org admin

## Threat: Compromised Runner

**Risk**: Attacker gains control of a self-hosted runner.
**Mitigations**:
- Runner tokens rotate every 24h, auto-refreshed via heartbeat
- Job payloads signed with HMAC-SHA256; runner verifies before execution
- Runners cannot access jobs from other organizations
- Server validates runner identity on every API call
- Anomaly detection flags runners with unusual behavior patterns

## Threat: Stolen Tokens

**Risk**: Runner token or user API key is leaked.
**Mitigations**:
- Runner tokens: 24h TTL, scoped to single org, revocable instantly
- User API keys: scoped by permission (read/write/admin)
- All tokens stored hashed (bcrypt) server-side
- Token usage logged; alerts on access from new IPs
- Compromised token revocation propagates within 30 seconds

## Threat: Secret Exfiltration

**Risk**: Attacker extracts secrets via logs, env, or network.
**Mitigations**:
- Secrets masked in all log output (pattern matching + known values)
- Secrets injected as env vars, never written to disk
- In-memory only; scrubbed after job completion
- Encrypted in transit (TLS) and at rest (AES-256-GCM)
- Pull request workflows from forks never receive secrets

## Threat: Webhook Spoofing

**Risk**: Attacker sends fake webhooks to trigger malicious builds.
**Mitigations**:
- All webhooks verified via HMAC-SHA256 signature
- Replay protection via timestamp validation (5min window)
- Source IP validation for known Git providers
- Webhook secrets rotated on demand via dashboard

## Threat: Privilege Escalation

**Risk**: User gains access beyond their role.
**Mitigations**:
- Project-scoped RBAC with roles: viewer, developer, release-manager, deploy-approver, maintainer, admin, auditor
- All API endpoints enforce role checks at middleware level
- Org-scoped queries enforced at database level (row-level security)
- Production deploys require explicit approval and separation of duties
- Audit log captures every permission change

## Threat: Supply Chain Attack

**Risk**: Tampered artifacts or dependencies injected into pipeline.
**Mitigations**:
- Artifact signing with ed25519 keys; provenance metadata attached
- Build reproducibility: pinned dependencies, locked base images
- Artifact checksums verified on upload and download
- SBOM generation available as built-in step

## Audit and Compliance

All actions are logged with: user ID, timestamp, source IP, action, resource.
Audit logs retained for 1 year. Exportable as JSON for compliance review.

| Event | Logged Fields |
|-------|--------------|
| Login | user, IP, method, success/failure |
| Job execution | job_id, repo, sha, runner, duration, status |
| Secret access | job_id, secret_name (not value), timestamp |
| Permission change | actor, target_user, old_role, new_role |
| Runner registration | runner_id, name, org, IP |
