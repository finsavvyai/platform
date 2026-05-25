#!/usr/bin/env bash
# onboard.sh
#
# Single-entry onboarding orchestrator. Probes the local checkout and
# the configured GitHub repo (if any), reports which boost gates are
# unconfigured, and offers to run the relevant onboarding helper for
# each missing one. Idempotent — safe to re-run.
#
# Usage:
#   scripts/onboard.sh           # interactive
#   scripts/onboard.sh --dry-run # report state, do not run anything
#   scripts/onboard.sh --auto    # run every safe step (skips Tailscale)
#
# Helpers it dispatches to:
#   scripts/onboard/setup-audit-secrets.sh   — flakestress dogfood
#   scripts/onboard/update-llamafile-pins.sh — air-gap variant
#   scripts/onboard/mint-tailscale-key.sh    — Enterprise mesh

set -euo pipefail

DRY_RUN=0
AUTO=0
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --auto)    AUTO=1;    shift ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "unknown flag: $1" >&2; exit 64 ;;
  esac
done

HERE="$(cd "$(dirname "$0")" && pwd)"
PINS="scripts/airgap/llamafile-pins.txt"

bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
ok()    { printf '  \033[32m✓\033[0m %s\n' "$*"; }
miss()  { printf '  \033[33m●\033[0m %s\n' "$*"; }
note()  { printf '    %s\n' "$*"; }

bold "PipeWarden onboarding probe"
echo

# --- Gate 1: GitHub repo audit secrets ---
gate_audit() {
  if ! command -v gh >/dev/null 2>&1 || ! gh api user >/dev/null 2>&1; then
    miss "audit secrets — gh CLI not available or unauthenticated; can't probe"
    return 1
  fi
  local repo
  repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null || echo "")"
  if [ -z "$repo" ]; then
    miss "audit secrets — current dir is not a github-mapped repo"
    return 1
  fi
  local has_secret has_var
  has_secret="$(gh secret list --repo "$repo" --json name --jq '.[] | select(.name=="PIPEWARDEN_INTERNAL_AUDIT_TOKEN") | .name' 2>/dev/null || true)"
  has_var="$(gh variable list --repo "$repo" --json name --jq '.[] | select(.name=="PIPEWARDEN_AUDIT_URL") | .name' 2>/dev/null || true)"
  if [ -n "$has_secret" ] && [ -n "$has_var" ]; then
    ok "audit secrets ($repo): token + URL set"
    return 0
  fi
  miss "audit secrets ($repo): missing $( [ -z "$has_secret" ] && echo TOKEN ) $( [ -z "$has_var" ] && echo URL )"
  note "→ scripts/onboard/setup-audit-secrets.sh"
  return 1
}

# --- Gate 2: llamafile pins for the air-gap variant ---
gate_pins() {
  if [ ! -f "$PINS" ] || ! grep -E -q '^[a-z0-9]+\s' "$PINS" 2>/dev/null; then
    miss "llamafile pins: $PINS is empty (air-gap goreleaser variant won't build)"
    note "→ scripts/onboard/update-llamafile-pins.sh"
    return 1
  fi
  local n
  n="$(grep -c -E '^[a-z0-9]+\s' "$PINS" 2>/dev/null || echo 0)"
  ok "llamafile pins: $n entr$( [ "$n" = "1" ] && echo y || echo ies )"
  return 0
}

# --- Gate 3: Tailscale auth-key (cannot probe; advisory only) ---
gate_tsnet() {
  miss "Tailscale: auth-key minting is a per-deployment manual step"
  note "→ scripts/onboard/mint-tailscale-key.sh (needs TS_OAUTH_CLIENT_SECRET)"
  return 1
}

audit_state=0; gate_audit || audit_state=1
echo
pins_state=0;  gate_pins  || pins_state=1
echo
gate_tsnet
echo

if [ "$DRY_RUN" -eq 1 ]; then
  bold "Dry run — exiting without changes."
  exit 0
fi

run_step() {
  local label="$1"; local cmd="$2"
  if [ "$AUTO" -eq 1 ]; then
    bold "[auto] $label"
    eval "$cmd"
    return
  fi
  read -r -p "Run $label now? [y/N] " ans
  case "$ans" in
    y|Y|yes|YES) eval "$cmd" ;;
    *) note "skipped." ;;
  esac
}

if [ "$audit_state" -ne 0 ]; then
  run_step "audit secrets installer" "$HERE/onboard/setup-audit-secrets.sh"
fi
if [ "$pins_state" -ne 0 ]; then
  run_step "llamafile pins refresh"  "$HERE/onboard/update-llamafile-pins.sh"
fi
# Tailscale step is intentionally not auto — it leaks a secret to stdout.
if [ "$AUTO" -eq 0 ]; then
  echo
  note "Tailscale: run scripts/onboard/mint-tailscale-key.sh manually after"
  note "          exporting TS_OAUTH_CLIENT_SECRET. The minted key is shown"
  note "          once and never persisted."
fi

echo
bold "Onboarding pass done."
