# HashiCorp Vault Adapter — Design

**Status:** Design (S3.5). Implementation tracked as S3.6.
**Owner:** PushCI core. **Pilot consumer:** Norlys A/S, 10 Maven repos.
**Last updated:** 2026-05-02.

## Why

Norlys (and other regulated EU shops) hold Maven repository credentials,
artifact-store tokens, and signing keys in HashiCorp Vault. Today PushCI
reads secrets from a local AES-256-GCM `secrets.enc` file
(`internal/secrets/store.go`) — fine for OSS users, blocking for buyers
whose security review demands "no static long-lived credentials on a
runner host."

Goal: pull secrets at build-start from Vault, never persist them on
disk, leases auto-expire when the run ends.

## Non-goals

- Replacing the existing `Store` for OSS users. Vault is opt-in per
  tenant; offline/local runs keep the AES file.
- Writing secrets to Vault. PushCI is read-only — operators put
  secrets in via Norlys' own CI pipelines.
- Solving secret rotation. Vault leases handle that. PushCI just
  re-reads on each run.

## Auth method choice — AppRole

Three real options were considered:

| Method | Pros | Cons | Verdict |
|---|---|---|---|
| **AppRole** | Stable role-id per runner, secret-id rotates, no k8s dependency, works on bare VMs and Docker Compose | Two-step auth (role-id + secret-id), secret-id distribution needs care | **chosen** |
| JWT/OIDC | No shared secret on disk if signed by GitHub OIDC | Requires GitHub-side OIDC flow; Norlys runs Gerrit, not GitHub | rejected |
| K8s SA | Cleanest if running in k8s | Norlys runner pool is Docker Compose on EC2, not k8s | rejected |

**AppRole flow per run:**

1. Runner boots with `role-id` baked into config (low-sensitivity).
2. On run start, runner calls Norlys' `secret-id` issuer (a tiny
   internal endpoint they already own — issues short-TTL secret-ids
   tied to a specific runner host).
3. PushCI exchanges `role-id + secret-id` for a Vault token with
   policy `pushci-pilot`.
4. Token's lease lives for the run duration plus a 5-minute grace.

`role-id` is per-runner, not per-tenant. A leaked `role-id` alone is
useless without a fresh `secret-id`.

## Secret path schema

Norlys-side layout (their convention, not PushCI's to dictate):

```
secret/data/pushci/pilot/maven/<repo>/<env>
secret/data/pushci/pilot/artifact-store/<repo>
secret/data/pushci/pilot/signing/maven-gpg
```

PushCI reads via env reference in `pushci.yml`:

```yaml
env:
  MAVEN_USER:  vault://secret/data/pushci/pilot/maven/billing-svc/prod#username
  MAVEN_TOKEN: vault://secret/data/pushci/pilot/maven/billing-svc/prod#token
```

The `vault://` scheme is parsed in `internal/runner/env.go` (new
parser, see S3.6). `#field` is the JSON key inside the Vault KV-v2
data envelope. No `vault://` prefix → existing `Store.Get` behavior,
unchanged.

## Leasing model

- Token TTL: `min(run-budget * 1.1, 30m)`. Default run budget is
  20 min, so 22 min token. Capped at 30 min so a stuck run can't
  hold creds for hours.
- Token is renewable. Renewal happens automatically every TTL/2
  if the run is still active.
- On run end (success, failure, or signal), PushCI calls
  `auth/token/revoke-self`. Idempotent — Vault returns 204 even if
  the token already expired.
- Cached secrets in process memory are zeroed on revoke.

## Failure modes

| Mode | Behavior |
|---|---|
| Vault unreachable | Run fails fast (don't fall through to local `Store` — that would be a security regression for tenants who opted into Vault). Error: `vault: GET /v1/sys/health: dial tcp ...`. |
| Auth fails (bad role-id/secret-id) | Run fails. Operator clears secret-id cache, re-issues. |
| Path not found | Run fails for that key. Other keys still resolve. Surface missing path in pre-flight. |
| Lease expired mid-run | Auto-renew loop catches it. If renewal itself 403s (revoked), run aborts current stage with explicit error. |
| Token revoke at end fails | Logged at WARN, not fatal. Lease will expire on its own. |

All errors include the Vault `request_id` header for cross-correlation
with Norlys' Vault audit log.

## Go interface

```go
package secrets

// Resolver fetches a secret value by reference. The local AES store
// implements this; the Vault adapter does too. Runtime picks one
// per tenant.
type Resolver interface {
    Resolve(ctx context.Context, ref string) (string, error)
    Close() error // revoke leases, zero memory
}
```

`internal/secrets/vault.go` (new, ≤100 LOC) implements `Resolver`.
`internal/secrets/store.go` keeps its current `Get`/`Set` API and
gets a thin `(*Store).Resolve` shim that ignores `vault://` and
returns plain keys from the encrypted file.

## Files (planned)

- `internal/secrets/vault.go` — AppRole login, KV-v2 read, lease
  renewal goroutine, revoke-self.
- `internal/secrets/vault_test.go` — integration test against the
  Vault dev server (`vault server -dev`). Skipped if `VAULT_ADDR`
  unset.
- `internal/runner/env.go` — `vault://...#field` parser. Added
  ahead of stage env injection.
- `cmd/pushci/cmd_secrets_vault.go` — `pushci secrets vault login`
  diag command (verifies role-id/secret-id round-trip, prints
  policy, exits). For pilot operators.

All files honor the 100-line Go cap (CI-enforced).

## Pilot deployment plan

1. Norlys side: create policy `pushci-pilot` granting
   `read` on `secret/data/pushci/pilot/*`, attach to AppRole
   `pushci-runner`, register each runner host's `role-id`.
2. PushCI side: ship S3.6 implementation, gate behind tenant flag
   `vault_enabled` in `tenants` D1 table. OFF for everyone except
   `Norlys-A-S`.
3. Smoke test against Vault dev server in CI (no live Norlys
   creds in PushCI infrastructure ever).
4. Pilot smoke test: one of the 10 Maven repos consumes
   `vault://secret/data/pushci/pilot/maven/<repo>/dev#token`
   for its `mvn deploy` stage. Verify run succeeds, token revoked
   in Norlys' Vault audit log, secret never lands in any log line.

## Out of scope (Year 2)

- Vault Agent sidecar — adds a daemon, not worth the surface area
  while we have ≤20 runners.
- Transit engine for at-rest encryption — local AES is enough.
- Dynamic database creds — Norlys' Maven creds are static bot
  accounts; not a fit for dynamic-secret backends.
