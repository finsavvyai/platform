#!/usr/bin/env bash
# mint-tailscale-key.sh
#
# Mints a Tailscale auth-key tagged tag:pipewarden via the Tailscale
# OAuth client secret. The minted key is ephemeral, single-use, and
# expires after 1 hour by default — the operator copies it once into
# the pipewarden server's TAILSCALE_AUTHKEY env and never persists it.
#
# Required:
#   TS_OAUTH_CLIENT_SECRET   — value from https://login.tailscale.com/admin/settings/oauth
#                              (with scope `auth_keys:write`)
#
# Optional:
#   TS_TAILNET               — tailnet name; defaults to `-` (the OAuth
#                              client's tailnet)
#   TS_TAG                   — defaults to tag:pipewarden
#   TS_EXPIRY_SECONDS        — defaults to 3600 (1 hour)
#   TS_REUSABLE=1            — make the key reusable (off by default)
#
# Output:
#   The tskey-auth-... value to stdout. Nothing else. Errors go to
#   stderr. On failure exits non-zero with an HTTP body for diagnosis.

set -euo pipefail

if [ -z "${TS_OAUTH_CLIENT_SECRET:-}" ]; then
  echo "TS_OAUTH_CLIENT_SECRET is required" >&2
  echo "Mint one at: https://login.tailscale.com/admin/settings/oauth" >&2
  echo "Required scope: auth_keys:write" >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "jq required" >&2
  exit 127
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "curl required" >&2
  exit 127
fi

TAILNET="${TS_TAILNET:--}"
TAG="${TS_TAG:-tag:pipewarden}"
EXPIRY_SECONDS="${TS_EXPIRY_SECONDS:-3600}"
REUSABLE="${TS_REUSABLE:-0}"

reusable_bool="false"
[ "$REUSABLE" = "1" ] && reusable_bool="true"

# Step 1 — exchange OAuth client secret for a short-lived API access
# token. Tailscale's OAuth endpoint accepts the client_secret as the
# `client_secret` form parameter with grant_type=client_credentials.
# https://tailscale.com/api/oauth (auth_keys:write scope)
echo "[onboard-tsnet] exchanging OAuth secret for access token..." >&2
token_resp="$(curl -fsS -X POST \
  -d "grant_type=client_credentials" \
  -d "client_secret=${TS_OAUTH_CLIENT_SECRET}" \
  https://api.tailscale.com/api/v2/oauth/token)"
access_token="$(printf '%s' "$token_resp" | jq -r .access_token)"
if [ -z "$access_token" ] || [ "$access_token" = "null" ]; then
  echo "[onboard-tsnet] OAuth token exchange failed:" >&2
  printf '%s\n' "$token_resp" >&2
  exit 1
fi

# Step 2 — create an auth-key with the pipewarden tag. The key is
# ephemeral so a compromised PipeWarden node falls out of the tailnet
# automatically once it stops checking in.
body="$(jq -nc \
  --argjson reusable "$reusable_bool" \
  --argjson expiry "$EXPIRY_SECONDS" \
  --arg tag "$TAG" \
  '{
     capabilities: {
       devices: {
         create: {
           reusable: $reusable,
           ephemeral: true,
           preauthorized: true,
           tags: [ $tag ]
         }
       }
     },
     expirySeconds: $expiry,
     description: "pipewarden onboard mint"
   }')"

echo "[onboard-tsnet] minting key with tag=$TAG expiry=${EXPIRY_SECONDS}s tailnet=${TAILNET}" >&2
key_resp="$(curl -fsS -X POST \
  -H "Authorization: Bearer ${access_token}" \
  -H "Content-Type: application/json" \
  --data "$body" \
  "https://api.tailscale.com/api/v2/tailnet/${TAILNET}/keys")"

key="$(printf '%s' "$key_resp" | jq -r .key)"
if [ -z "$key" ] || [ "$key" = "null" ]; then
  echo "[onboard-tsnet] key creation failed:" >&2
  printf '%s\n' "$key_resp" >&2
  exit 1
fi

echo "[onboard-tsnet] success. Key shown once below; copy it into TAILSCALE_AUTHKEY now." >&2
printf '%s\n' "$key"
