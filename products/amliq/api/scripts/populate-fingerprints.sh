#!/usr/bin/env bash
# populate-fingerprints.sh — Build/sync search fingerprints for entities.
# Run after loading new sanctions lists or PEP data.
#
# Usage:
#   ./scripts/populate-fingerprints.sh              # incremental (new entities only — fast)
#   ./scripts/populate-fingerprints.sh --full        # full rebuild (all entities — slow)
#   ./scripts/populate-fingerprints.sh <db_url>      # explicit DB URL, incremental
#   ./scripts/populate-fingerprints.sh --full <url>   # explicit DB URL, full rebuild
#
# Examples:
#   DATABASE_URL=postgres://localhost/aegis ./scripts/populate-fingerprints.sh
#   ./scripts/populate-fingerprints.sh "postgres://user:pass@host/amliq"
#   ./scripts/populate-fingerprints.sh --full

set -euo pipefail

MODE="sync"
DB_URL=""

for arg in "$@"; do
  case "$arg" in
    --full) MODE="full" ;;
    *) DB_URL="$arg" ;;
  esac
done

DB_URL="${DB_URL:-${DATABASE_URL:-}}"

if [ -z "$DB_URL" ]; then
  echo "ERROR: No database URL provided."
  echo "Set DATABASE_URL or pass as argument."
  exit 1
fi

echo "=== AMLIQ Fingerprint Populator ==="
echo "Mode: $MODE"
echo "Started: $(date)"
echo ""

if [ "$MODE" = "full" ]; then
  DATABASE_URL="$DB_URL" go run ./cmd/seed -fingerprints
else
  DATABASE_URL="$DB_URL" go run ./cmd/seed -fingerprints-sync
fi

echo ""
echo "=== Done: $(date) ==="
