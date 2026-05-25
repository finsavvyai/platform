# PipeWarden Onboarding

Three operator gates land alongside the boost work shipped on
`prod-readiness`. Each one was a manual step in the original
boost-integration notes; they are now scripts under `scripts/onboard/`,
orchestrated by `scripts/onboard.sh`.

## TL;DR

```bash
# Probe what's missing without changing anything:
scripts/onboard.sh --dry-run

# Interactive — confirm each step:
scripts/onboard.sh

# Headless — runs every safe step (skips the Tailscale one):
scripts/onboard.sh --auto
```

Re-running is safe; every helper is idempotent.

## Gate 1 — flakestress audit dogfood

**What it does:** weekly-flakestress.yml POSTs a `flake_spike` event
to `/api/v1/audit/internal` on failure so flakes show up in
PipeWarden's own audit feed.

**What's automated:** `scripts/onboard/setup-audit-secrets.sh`
- Mints a 32-byte hex HMAC token via `openssl rand`.
- Stores it as the GitHub Actions repo secret
  `PIPEWARDEN_INTERNAL_AUDIT_TOKEN`.
- Sets `PIPEWARDEN_AUDIT_URL` (Actions variable) to your deployed
  pipewarden URL.
- Logs the SHA256 fingerprint of the token (never the token itself)
  so you can match it against the server log on first event.

**What you still do:** copy the token printed by the script onto the
pipewarden server as `PIPEWARDEN_INTERNAL_AUDIT_TOKEN` env. No way
around this — both ends need the same secret.

**Re-rotate:** pass `--force` to regenerate.

## Gate 2 — llamafile pins for the air-gap variant

**What it does:** `make airgap-stage` reads
`scripts/airgap/llamafile-pins.txt`, downloads each pinned binary,
and fails the build if any SHA256 doesn't match.

**What's automated:** `scripts/onboard/update-llamafile-pins.sh`
- Queries `Mozilla-Ocho/llamafile` GitHub Releases.
- Picks the linux-x86_64 / linux-arm64 assets (or falls back to the
  multi-arch Cosmopolitan binary).
- Hashes each (streaming to /dev/null, no disk balloon) and writes a
  TSV row per arch into the pins file.
- Records the source URL + tag in a header comment for review.

**What you still do:** review the resulting pins file before
committing, the same way you would for any third-party binary.

## Gate 3 — Tailscale auth-key for Enterprise mesh

**What it does:** `internal/mesh/mesh_tsnet.go` joins the customer
tailnet with the value of `TAILSCALE_AUTHKEY`. The key is ephemeral
and tagged `tag:pipewarden`.

**What's automated:** `scripts/onboard/mint-tailscale-key.sh`
- Exchanges `TS_OAUTH_CLIENT_SECRET` for a short-lived API token.
- Calls `POST /api/v2/tailnet/{tailnet}/keys` with
  `tag:pipewarden`, `ephemeral=true`, `preauthorized=true`.
- Prints the resulting `tskey-auth-...` exactly once to stdout.

**What you still do:**
1. Mint an OAuth client with scope `auth_keys:write` at
   <https://login.tailscale.com/admin/settings/oauth>.
2. Export the secret as `TS_OAUTH_CLIENT_SECRET` before running.
3. Paste the printed key into `TAILSCALE_AUTHKEY` on the pipewarden
   host. Do not write it to a file.

The orchestrator deliberately does not run this step in `--auto`
mode because it produces a secret on stdout.

## Caveat (no bluff)

Every script needs operator credentials it cannot fabricate:
- `gh auth login` already done.
- A reachable HTTPS URL for the pipewarden deployment.
- A Tailscale OAuth client secret when minting tailnet keys.

The scripts skip cleanly when those are missing and print exactly
what to provide. They do not silently fail-open, and they do not
embed any secret in the repo.
