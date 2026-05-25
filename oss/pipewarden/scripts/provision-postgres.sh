#!/usr/bin/env bash
# provision-postgres.sh — verify a Postgres URL is reachable, run the
# PipeWarden DDL once, and confirm the resulting schema. Intended to be
# run by an operator before flipping production traffic.
#
# Usage:
#   PIPEWARDEN_DATABASE_URL='postgres://user:pw@host/db?sslmode=require' \
#     ./scripts/provision-postgres.sh
#
# Exits non-zero on the first failure so it is safe to use in CI.

set -euo pipefail

if [[ -z "${PIPEWARDEN_DATABASE_URL:-}" ]]; then
  echo "error: PIPEWARDEN_DATABASE_URL is not set" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "error: psql not installed (brew install libpq && brew link --force libpq)" >&2
  exit 1
fi

echo "==> probing connection"
psql "$PIPEWARDEN_DATABASE_URL" -At -c 'SELECT version();' >/dev/null
echo "    ok"

echo "==> verifying TLS is required"
sslmode=$(psql "$PIPEWARDEN_DATABASE_URL" -At -c 'SHOW ssl;')
if [[ "$sslmode" != "on" ]]; then
  echo "warn: server reports ssl=$sslmode — refuse to run unless URL has sslmode=require"
  case "$PIPEWARDEN_DATABASE_URL" in
    *"sslmode=require"*|*"sslmode=verify-full"*|*"sslmode=verify-ca"*) ;;
    *) echo "error: URL must include sslmode=require for production" >&2; exit 1 ;;
  esac
fi

echo "==> applying schema via cmd/migrate"
PIPEWARDEN_DATABASE_URL="$PIPEWARDEN_DATABASE_URL" \
PIPEWARDEN_DATABASE_DRIVER=postgres \
  go run ./cmd/migrate

echo "==> confirming required tables exist"
expected=(analysis_history api_keys audit_log auth_tokens connections \
          custom_policies notifications oauth_states passkey_challenges \
          passkey_credentials recovery_codes scan_schedules secret_lifecycle \
          security_findings semgrep_rules subscriptions users \
          waitlist_signups webhook_configs webhook_templates)
missing=()
for t in "${expected[@]}"; do
  exists=$(psql "$PIPEWARDEN_DATABASE_URL" -At -c \
    "SELECT 1 FROM information_schema.tables WHERE table_name='$t' LIMIT 1;")
  if [[ "$exists" != "1" ]]; then
    missing+=("$t")
  fi
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "error: missing tables after DDL: ${missing[*]}" >&2
  exit 1
fi
echo "    all ${#expected[@]} tables present"

echo "==> spot-check pool params"
psql "$PIPEWARDEN_DATABASE_URL" -At -c \
  "SELECT setting FROM pg_settings WHERE name IN ('max_connections','idle_in_transaction_session_timeout');"

echo "==> done. Postgres ready for PipeWarden."
