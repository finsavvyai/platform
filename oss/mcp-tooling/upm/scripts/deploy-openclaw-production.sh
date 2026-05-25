#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"
API_URL="${UPM_API_URL:-http://localhost:8040}"

REQUIRED_VARS=(
  POSTGRES_USER
  POSTGRES_PASSWORD
  SECRET_KEY
)

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is required"
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Error: docker compose (v2) is required"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE was not found. Create it from .env.example first."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a

for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "Error: required variable '$var' is not set in $ENV_FILE"
    exit 1
  fi
done

export OPENCLAW_ENABLED="${OPENCLAW_ENABLED:-true}"
export OPENCLAW_SCAN_CODE_DEFAULT="${OPENCLAW_SCAN_CODE_DEFAULT:-true}"
export OPENCLAW_POLICY_ENFORCEMENT_DEFAULT="${OPENCLAW_POLICY_ENFORCEMENT_DEFAULT:-true}"
export OPENCLAW_MAX_SCAN_DEPTH="${OPENCLAW_MAX_SCAN_DEPTH:-5}"

wait_for_health() {
  local service="$1"
  local retries="${2:-40}"
  local delay="${3:-3}"

  for ((i = 1; i <= retries; i++)); do
    status="$(docker compose -f "$COMPOSE_FILE" ps --format json "$service" | tr -d '\n' | sed -n 's/.*"Health":"\([^"]*\)".*/\1/p')"
    if [[ "$status" == "healthy" ]]; then
      echo "Service '$service' is healthy"
      return 0
    fi

    if [[ "$status" == "" ]]; then
      status="starting"
    fi

    echo "Waiting for '$service' health (attempt $i/$retries, status=$status)"
    sleep "$delay"
  done

  echo "Error: service '$service' did not become healthy in time"
  return 1
}

echo "Deploying core dependencies"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres redis

wait_for_health postgres
wait_for_health redis

echo "Deploying OpenClaw-enabled API services"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d api celery-worker

wait_for_health api

echo "Running post-deploy API checks"
health_status="$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health")"
if [[ "$health_status" != "200" ]]; then
  echo "Error: health check failed with HTTP $health_status"
  exit 1
fi

openclaw_status="$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/v1/openclaw/policies")"
if [[ "$openclaw_status" != "200" && "$openclaw_status" != "401" ]]; then
  echo "Error: OpenClaw endpoint check failed with HTTP $openclaw_status"
  exit 1
fi

echo "Production deployment completed"
echo "API health endpoint: $API_URL/health"
echo "OpenClaw endpoint: $API_URL/api/v1/openclaw/policies (HTTP $openclaw_status)"
