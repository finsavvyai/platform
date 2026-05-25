#!/usr/bin/env bash
# Fail CI if deploy paths are broken or obvious secrets are committed.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail() { echo "ERROR: $*" >&2; exit 1; }

BACKEND="$ROOT/queryflux-backend"

# Render / Go entrypoint
RENDER="$BACKEND/render.yaml"
if [[ -f "$RENDER" ]] && grep -q 'main_simple.go' "$RENDER"; then
  fail "queryflux-backend/render.yaml still references missing main_simple.go"
fi

MAIN_GO="$BACKEND/cmd/api/main.go"
[[ -f "$MAIN_GO" ]] || fail "missing $MAIN_GO"

# Docker compose prometheus mount
COMPOSE="$ROOT/docker-compose.yml"
if [[ -f "$COMPOSE" ]]; then
  PROM_MOUNT=$(grep -E 'backend/monitoring/prometheus/prometheus.yml' "$COMPOSE" || true)
  if [[ -n "$PROM_MOUNT" ]]; then
    fail "docker-compose still mounts missing backend/monitoring/prometheus/prometheus.yml — use backend/configs/prometheus.docker.yml"
  fi
fi

# Obvious secret patterns in tracked files (exclude examples and this script)
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git grep -n "sk-[a-zA-Z0-9]{20,}" -- ':!*.md' ':!scripts/ci-verify-paths-and-secrets.sh' 2>/dev/null; then
    fail "possible OpenAI API key pattern in tracked files"
  fi
fi

echo "OK: path and basic secret checks passed"
