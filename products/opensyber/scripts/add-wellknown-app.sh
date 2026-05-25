#!/usr/bin/env bash
# Add a client ID to the shared Microsoft publisher-domain proof file at
# apps/web/public/.well-known/microsoft-identity-association.json.
# Idempotent — running twice with the same client ID is a no-op.
#
# Usage: ./scripts/add-wellknown-app.sh <client-id>
set -euo pipefail

CLIENT_ID="${1:-}"
if [[ -z "$CLIENT_ID" ]]; then
  echo "usage: $0 <client-id>" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "fatal: jq required" >&2; exit 1
fi

FILE="apps/web/public/.well-known/microsoft-identity-association.json"
if [[ ! -f "$FILE" ]]; then
  echo "fatal: $FILE not found (run from repo root)" >&2
  exit 1
fi

if jq -e --arg id "$CLIENT_ID" '.associatedApplications[] | select(.applicationId == $id)' "$FILE" > /dev/null; then
  echo "⚠ client ID $CLIENT_ID already present — no change"
  exit 0
fi

tmp=$(mktemp)
jq --arg id "$CLIENT_ID" '.associatedApplications += [{applicationId: $id}]' "$FILE" > "$tmp"
mv "$tmp" "$FILE"

echo "✓ added $CLIENT_ID to $FILE"
echo "  run: git add $FILE && git commit && git push   # then re-verify in Entra portal"
