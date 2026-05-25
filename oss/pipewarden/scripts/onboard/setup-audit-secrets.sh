#!/usr/bin/env bash
# setup-audit-secrets.sh
#
# Provisions the GitHub repo secret + variable that the
# weekly-flakestress workflow needs to POST flake_spike events to
# pipewarden's /api/v1/audit/internal endpoint.
#
# Behavior:
#   - PIPEWARDEN_INTERNAL_AUDIT_TOKEN: 32-byte hex HMAC secret. Minted
#     locally with openssl rand if absent. Never echoed to stdout
#     (only the SHA256 of the value is logged for human verification).
#   - PIPEWARDEN_AUDIT_URL: GitHub Actions variable holding the
#     externally-reachable base URL of the pipewarden deployment
#     (e.g. https://pw.example.com). Prompted for if not provided.
#
# Idempotent: re-running with existing secrets does not regenerate
# them unless --force is passed.
#
# Usage:
#   scripts/onboard/setup-audit-secrets.sh [--repo OWNER/REPO] [--url URL] [--force]

set -euo pipefail

REPO=""
URL=""
FORCE=0

while [ $# -gt 0 ]; do
  case "$1" in
    --repo)  REPO="$2"; shift 2 ;;
    --url)   URL="$2";  shift 2 ;;
    --force) FORCE=1;   shift ;;
    *) echo "unknown flag: $1" >&2; exit 64 ;;
  esac
done

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI required (https://cli.github.com)" >&2
  exit 127
fi
if ! gh api user >/dev/null 2>&1; then
  echo "gh is not authenticated. Run 'gh auth login' first." >&2
  exit 1
fi
if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl required for token generation" >&2
  exit 127
fi

if [ -z "$REPO" ]; then
  REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
fi
echo "[onboard-audit] target repo: $REPO" >&2

# --- secret: PIPEWARDEN_INTERNAL_AUDIT_TOKEN ---
existing_secret="$(gh secret list --repo "$REPO" --json name --jq '.[] | select(.name=="PIPEWARDEN_INTERNAL_AUDIT_TOKEN") | .name' 2>/dev/null || true)"
if [ -n "$existing_secret" ] && [ "$FORCE" -eq 0 ]; then
  echo "[onboard-audit] secret PIPEWARDEN_INTERNAL_AUDIT_TOKEN already set; pass --force to rotate" >&2
else
  token="$(openssl rand -hex 32)"
  printf '%s' "$token" | gh secret set PIPEWARDEN_INTERNAL_AUDIT_TOKEN --repo "$REPO" --body -
  fingerprint="$(printf '%s' "$token" | openssl dgst -sha256 -hex | awk '{print $NF}')"
  echo "[onboard-audit] secret PIPEWARDEN_INTERNAL_AUDIT_TOKEN provisioned" >&2
  echo "[onboard-audit] sha256(token)=$fingerprint  # match this against pipewarden server log on first event" >&2
  echo
  echo "Set the same token on the pipewarden server (env PIPEWARDEN_INTERNAL_AUDIT_TOKEN):"
  printf '%s\n' "$token"
fi

# --- variable: PIPEWARDEN_AUDIT_URL ---
existing_var="$(gh variable list --repo "$REPO" --json name --jq '.[] | select(.name=="PIPEWARDEN_AUDIT_URL") | .name' 2>/dev/null || true)"
if [ -z "$URL" ] && [ -z "$existing_var" ]; then
  read -r -p "[onboard-audit] PIPEWARDEN_AUDIT_URL (e.g. https://pw.example.com): " URL
fi
if [ -n "$URL" ]; then
  case "$URL" in
    https://*) ;;
    *) echo "[onboard-audit] AUDIT_URL must be HTTPS (got: $URL)" >&2; exit 1 ;;
  esac
  gh variable set PIPEWARDEN_AUDIT_URL --repo "$REPO" --body "$URL"
  echo "[onboard-audit] variable PIPEWARDEN_AUDIT_URL = $URL" >&2
elif [ -n "$existing_var" ]; then
  echo "[onboard-audit] variable PIPEWARDEN_AUDIT_URL already set" >&2
fi

echo "[onboard-audit] done." >&2
