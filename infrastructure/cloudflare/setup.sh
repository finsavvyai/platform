#!/usr/bin/env bash
# Idempotent Cloudflare provisioning for @finsavvyai/ai-gateway.
#
# Creates per-env: 2 KV namespaces, 1 D1 database, 1 R2 bucket.
# Safe to re-run — already-created resources are detected and skipped.
#
# Required env: CF_ACCOUNT_ID, CF_API_TOKEN, ENV (staging|production).
# Run from the repo root.

set -euo pipefail

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "[setup] missing required env var: $name" >&2
    exit 2
  fi
}

require_env CF_ACCOUNT_ID
require_env CF_API_TOKEN
require_env ENV

case "$ENV" in
  staging|production) ;;
  *)
    echo "[setup] ENV must be 'staging' or 'production' (got: $ENV)" >&2
    exit 2
    ;;
esac

if ! command -v wrangler >/dev/null 2>&1; then
  echo "[setup] wrangler not on PATH. Install via 'pnpm install' or 'npm i -g wrangler'." >&2
  exit 2
fi

export CLOUDFLARE_ACCOUNT_ID="$CF_ACCOUNT_ID"
export CLOUDFLARE_API_TOKEN="$CF_API_TOKEN"

KV_RATE_LIMIT="finsavvy-rate-limit-$ENV"
KV_RESPONSE_CACHE="finsavvy-response-cache-$ENV"
D1_NAME="finsavvy-ai-gateway-$ENV"
R2_NAME="finsavvy-audit-$ENV"

log() { printf '[setup] %s\n' "$*"; }

# ---------- KV ----------
create_kv() {
  local name="$1"
  log "ensure KV namespace: $name"
  local existing
  existing=$(wrangler kv:namespace list 2>/dev/null \
    | jq -r --arg n "$name" '.[] | select(.title == $n) | .id' || true)
  if [[ -n "$existing" ]]; then
    log "  exists: $existing"
    echo "$existing"
    return 0
  fi
  local created
  created=$(wrangler kv:namespace create "$name" 2>&1 \
    | grep -E 'id = ' | sed -E 's/.*id = "([^"]+)".*/\1/')
  if [[ -z "$created" ]]; then
    log "  FAILED to create $name"
    return 1
  fi
  log "  created: $created"
  echo "$created"
}

RL_ID=$(create_kv "$KV_RATE_LIMIT")
RC_ID=$(create_kv "$KV_RESPONSE_CACHE")

# ---------- D1 ----------
log "ensure D1 database: $D1_NAME"
D1_EXISTS=$(wrangler d1 list --json 2>/dev/null \
  | jq -r --arg n "$D1_NAME" '.[] | select(.name == $n) | .uuid' || true)
if [[ -n "$D1_EXISTS" ]]; then
  log "  exists: $D1_EXISTS"
  D1_ID="$D1_EXISTS"
else
  CREATE_OUT=$(wrangler d1 create "$D1_NAME" 2>&1)
  D1_ID=$(echo "$CREATE_OUT" | grep -E 'database_id = ' | sed -E 's/.*database_id = "([^"]+)".*/\1/')
  log "  created: $D1_ID"
fi

# ---------- R2 ----------
log "ensure R2 bucket: $R2_NAME"
if wrangler r2 bucket list 2>/dev/null | grep -qE "^${R2_NAME}\b"; then
  log "  exists"
else
  wrangler r2 bucket create "$R2_NAME" >/dev/null
  log "  created"
fi

# ---------- Summary ----------
cat <<EOF

==============================================================
Cloudflare provisioning complete for env=$ENV

Paste these IDs into packages/ai-gateway/wrangler.toml under [env.$ENV]:

  RATE_LIMIT_KV     id = "$RL_ID"
  RESPONSE_CACHE_KV id = "$RC_ID"
  GATEWAY_DB        database_id = "$D1_ID"
  AUDIT_LOG_BUCKET  bucket_name = "$R2_NAME"

Next steps:
  1. Update wrangler.toml with the IDs above.
  2. Set secrets:
       wrangler secret put JWT_PUBLIC_KEY              --env $ENV
       wrangler secret put STRIPE_WEBHOOK_SECRET       --env $ENV
       wrangler secret put LEMONSQUEEZY_WEBHOOK_SECRET --env $ENV
       wrangler secret put FINSAVVY_AUDIT_DD_API_KEY   --env $ENV
  3. Deploy:
       pnpm --filter @finsavvyai/ai-gateway run deploy:$( [[ "$ENV" == "production" ]] && echo prod || echo staging )
==============================================================
EOF
