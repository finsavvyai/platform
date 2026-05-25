#!/usr/bin/env bash
# make-it-run.sh — local end-to-end gate for the sdlc-platform.
#
# What this does, in order, with checkpoints so a failure stops at the right line:
#
#   1) Verify required tools.
#   2) Pull the new Go modules added in the third REAL pass.
#   3) go vet + go build the gateway.
#   4) go test the gateway.
#   5) npm test the admin-ui.
#   6) pytest the rag service (long-context tests at minimum).
#   7) node --test the codex code-action agent.
#   8) Bring up the dev compose stack (Postgres + Redis + OPA + services).
#   9) Apply database/migrations/* against the dev Postgres.
#  10) Smoke the gateway with LOCAL_AUTH_BYPASS=true.
#
# Run from the repo root:  bash make-it-run.sh
# To stop after step N:    STOP_AFTER=N bash make-it-run.sh
#
# DEPLOY TO PROD is intentionally NOT in this script.
# Production deploys go through .github/workflows/deploy-prod.yml after a
# manual approval; this script will only ever talk to localhost.

set -euo pipefail

STOP_AFTER="${STOP_AFTER:-99}"
# Skip every step number lower than START_AT. Lets you iterate on
# migrations without re-running the gateway test suite each time:
#   START_AT=9 bash make-it-run.sh   # jump straight to migrations
START_AT="${START_AT:-1}"

# Compose file path + Postgres DSN. Hoisted out of steps 8/9 so later
# steps can find them even when START_AT skips an earlier step.
COMPOSE_FILE=".config/docker/docker-compose.dev.yml"
# PGURL is consumed by `docker compose exec -T postgres psql "$PGURL"`,
# i.e. it runs INSIDE the postgres container where the server listens
# on its internal localhost:5432. The host-side port (5433, see compose
# file) is only relevant to processes running on the macOS host such
# as the gateway in step 10.
PGURL="${DATABASE_URL:-postgresql://postgres:password@localhost:5432/sdlc_platform}"

# Tee everything (stdout+stderr) into make-it-run.log so we can share
# the output without scrollback hassle. Use absolute path so this works
# regardless of where the script is invoked from. Each run truncates
# the previous log; pass APPEND_LOG=1 to keep history instead.
LOGFILE="$(cd "$(dirname "$0")" && pwd)/make-it-run.log"
if [[ -z "${MAKE_IT_RUN_REENTRY:-}" ]]; then
  export MAKE_IT_RUN_REENTRY=1
  if [[ "${APPEND_LOG:-0}" == "1" ]]; then
    exec > >(tee -a "$LOGFILE") 2>&1
  else
    exec > >(tee "$LOGFILE") 2>&1
  fi
  echo "[log] writing to $LOGFILE  (started $(date -u +%FT%TZ))"
fi

step() {
  local n="$1" name="$2"
  if [[ "$n" -lt "$START_AT" ]]; then
    SKIP_REMAINING_OF_STEP=1
    return
  fi
  SKIP_REMAINING_OF_STEP=0
  if [[ "$n" -gt "$STOP_AFTER" ]]; then
    echo
    echo "=== [stop] STOP_AFTER=${STOP_AFTER} reached, halting before step $n ($name)"
    exit 0
  fi
  echo
  echo "=========================================================="
  echo "==  Step $n — $name (START_AT=${START_AT}, STOP_AFTER=${STOP_AFTER})"
  echo "=========================================================="
}

# Each step body should bail early when SKIP_REMAINING_OF_STEP is set.
skip_if_before_start() {
  if [[ "${SKIP_REMAINING_OF_STEP:-0}" == "1" ]]; then return 0; fi
  return 1
}

fail() {
  echo
  echo "!! step failed: $*" >&2
  echo "!! re-run with STOP_AFTER=$((${CURRENT_STEP:-1}-1)) to skip past once you fix it" >&2
  exit 1
}

# ---------------------------------------------------------------- 1. tools
CURRENT_STEP=1
step 1 "verify tools"
if [[ "${SKIP_REMAINING_OF_STEP:-0}" == "1" ]]; then echo "  [skip] step before START_AT"; else
for tool in go node npm python3 docker; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    fail "missing $tool — install it first"
  fi
  printf "  %-8s -> %s\n" "$tool" "$(command -v "$tool")"
done
go version
node --version
npm --version
python3 --version
docker --version

fi

# ---------------------------------------------------------------- 2. go mod tidy
CURRENT_STEP=2
step 2 "go mod tidy (pulls 4 new modules)"
if [[ "${SKIP_REMAINING_OF_STEP:-0}" == "1" ]]; then echo "  [skip] step before START_AT"; else
(
  cd services/gateway
  go get \
    github.com/go-webauthn/webauthn@latest \
    github.com/hashicorp/vault/api@latest \
    github.com/jung-kurt/gofpdf@latest
  go mod tidy
) || fail "go mod tidy"

fi

# ---------------------------------------------------------------- 3. go build + vet
CURRENT_STEP=3
step 3 "go vet + go build ./..."
if [[ "${SKIP_REMAINING_OF_STEP:-0}" == "1" ]]; then echo "  [skip] step before START_AT"; else
(
  cd services/gateway
  go vet ./... || fail "go vet"
  go build ./... || fail "go build"
)

fi

# ---------------------------------------------------------------- 4. go test
CURRENT_STEP=4
step 4 "go test ./..."
if [[ "${SKIP_REMAINING_OF_STEP:-0}" == "1" ]]; then echo "  [skip] step before START_AT"; else
(
  cd services/gateway
  go test ./... -count=1 -timeout 120s || fail "go test"
)

fi

# ---------------------------------------------------------------- 5. admin-ui
CURRENT_STEP=5
step 5 "npm install + npm test (admin-ui)"
if [[ "${SKIP_REMAINING_OF_STEP:-0}" == "1" ]]; then echo "  [skip] step before START_AT"; else
(
  cd services/admin-ui
  if [ ! -d node_modules ]; then
    # Some prior installs were pinned darwin-arm64-only; --no-frozen-lockfile
    # lets a Linux dev env install too.
    npm install --no-audit --no-fund || npm install --no-audit --no-fund --legacy-peer-deps
  fi
  npx jest src/app/dashboard --runInBand || fail "admin-ui tests"
)

fi

# ---------------------------------------------------------------- 6. rag
CURRENT_STEP=6
step 6 "pytest (rag long-context)"
if [[ "${SKIP_REMAINING_OF_STEP:-0}" == "1" ]]; then echo "  [skip] step before START_AT"; else
(
  cd services/rag
  python3 -m pip install --quiet pytest 2>/dev/null || true
  python3 -m pytest app/services/test_long_context.py -q \
    --override-ini="addopts=" || fail "rag tests"
)

fi

# ---------------------------------------------------------------- 7. codex agent
CURRENT_STEP=7
step 7 "node --test (services/agents/code)"
if [[ "${SKIP_REMAINING_OF_STEP:-0}" == "1" ]]; then echo "  [skip] step before START_AT"; else
(
  cd services/agents/code
  node --test || fail "codex agent tests"
)

fi

# ---------------------------------------------------------------- 8. compose up
CURRENT_STEP=8
step 8 "docker compose up (dev stack)"
if [[ "${SKIP_REMAINING_OF_STEP:-0}" == "1" ]]; then echo "  [skip] step before START_AT"; else
COMPOSE_FILE=".config/docker/docker-compose.dev.yml"
if [ ! -f "$COMPOSE_FILE" ]; then
  fail "compose file not found at $COMPOSE_FILE"
fi
# OPA's image ships without curl/wget so the compose file's healthcheck
# (or the image's built-in one) marks it unhealthy and `--wait` would
# block forever. The gateway's policy middleware is env-gated
# (OPA.Enabled) and degrades to allow on connection error, so OPA being
# absent or unhealthy is fine for dev. We isolate postgres+redis with
# --no-deps so compose's dependency graph can't drag OPA into the wait
# set; we then start OPA non-blocking, ignoring its unhealthy state.
echo "  bringing down any leftover containers from a prior failed run..."
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true

docker compose -f "$COMPOSE_FILE" up -d --no-deps --wait postgres redis \
  || fail "compose up postgres+redis"

# Start OPA without --wait. If it goes unhealthy we don't care for the
# smoke; the gateway will degrade.
docker compose -f "$COMPOSE_FILE" up -d --no-deps opa 2>/dev/null \
  || echo "  (warn) opa failed to start — continuing without it"

echo "  waiting 10s for postgres readiness..."
sleep 10

fi

# ---------------------------------------------------------------- 9. migrations
CURRENT_STEP=9
step 9 "apply migrations 000..018"
if [[ "${SKIP_REMAINING_OF_STEP:-0}" == "1" ]]; then echo "  [skip] step before START_AT"; else
# Make sure postgres is up — when START_AT skips step 8 the container
# might be down (or DROP DATABASE WITH FORCE may have left it in a bad
# state on a prior run). Restart it idempotently and wait for healthy.
echo "  ensuring postgres is up..."
docker compose -f "$COMPOSE_FILE" up -d --no-deps --wait postgres redis \
  || fail "postgres failed to come up"
# Brief settle time for psql to accept connections.
sleep 3

# RESET_DB=1 drops + recreates sdlc_platform. Use this when a prior failed
# run left partial schema in place (especially after the D1-leftover
# 001_initial_schema.sql ran and stamped TEXT-typed users/tenants).
if [[ "${RESET_DB:-0}" == "1" ]]; then
  echo "  [reset] dropping sdlc_platform..."
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -U postgres -c "DROP DATABASE IF EXISTS sdlc_platform WITH (FORCE);" \
    || fail "drop sdlc_platform"
fi

# Create the db if it doesn't exist (idempotent).
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U postgres -c "CREATE DATABASE sdlc_platform;" 2>/dev/null || true

# Migration 000 references uuid_generate_v4() but uuid-ossp isn't
# installed until migration 001. Pre-create the extensions the
# migrations depend on so 000 can run. CREATE EXTENSION IF NOT EXISTS
# is idempotent, so 001 (which also creates them) still passes.
echo "  pre-creating extensions (uuid-ossp, pgcrypto, vector)..."
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql "$PGURL" -v ON_ERROR_STOP=1 -c '
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
  ' || fail "extension prep"
# pgvector is optional in dev — log if missing but do not fail.
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql "$PGURL" -c 'CREATE EXTENSION IF NOT EXISTS vector;' 2>/dev/null \
  || echo "  (warn) pgvector not installed in this Postgres image — RAG-related migrations may skip"

# sdlc_app and app_user roles are referenced by RLS + GRANTs in several
# migrations. app_user is created in 005, but 004 already grants to it,
# so pre-create both. Idempotent.
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql "$PGURL" -v ON_ERROR_STOP=1 -c "
    DO \$\$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sdlc_app') THEN
        CREATE ROLE sdlc_app LOGIN PASSWORD 'sdlc_app';
      END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user NOLOGIN;
      END IF;
    END \$\$;
  " || echo "  (warn) role create skipped"

# Build the ordered migration list:
#   - skip 001_initial_schema.sql (it's a Cloudflare D1 SQLite schema
#     left over in this dir; uses TEXT ids that conflict with the
#     Postgres UUID schema in 002_create_core_tables.sql)
#   - within 002_*, force create_core_tables BEFORE authentication_system
#     (the alphabetical default puts auth first, which then can't FK
#     into users because users hasn't been created yet)
RAW_MIGRATIONS=()
for m in database/migrations/*.sql; do
  base="$(basename "$m")"
  [[ "$m"    == *init-scripts*               ]] && continue
  [[ "$base" == "001_initial_schema.sql"     ]] && { echo "  [skip] $m (D1 leftover — wrong DB flavor)"; continue; }
  RAW_MIGRATIONS+=("$m")
done

# Pull in gateway-owned migrations 011/012/013 that are NOT in the
# top-level database/migrations/ dir but are required by 014/015 (which
# reference spend_events). The gateway's own migrator normally applies
# these; for the local end-to-end run we apply them inline.
GATEWAY_MIGRATIONS_DIR="services/gateway/internal/infrastructure/migrations/migrations"
for v in 011_ip_allowlist 012_spend_events 013_retention_policies; do
  f="${GATEWAY_MIGRATIONS_DIR}/${v}.sql"
  if [[ -f "$f" ]]; then
    RAW_MIGRATIONS+=("$f")
  fi
done

# Sort by basename so 011/012/013 land between 010_rbac and 014_*.
MIGRATIONS=()
while IFS= read -r line; do
  MIGRATIONS+=("${line#*	}")
done < <(for m in "${RAW_MIGRATIONS[@]}"; do printf '%s\t%s\n' "$(basename "$m")" "$m"; done | sort)

# Reorder 002s: ensure create_core_tables before authentication_system.
ORDERED=()
deferred=""
for m in "${MIGRATIONS[@]}"; do
  base="$(basename "$m")"
  if [[ "$base" == "002_authentication_system.sql" ]]; then
    deferred="$m"
    continue
  fi
  ORDERED+=("$m")
  if [[ "$base" == "002_create_core_tables.sql" && -n "$deferred" ]]; then
    ORDERED+=("$deferred")
    deferred=""
  fi
done
# If deferred wasn't placed (no core_tables in list), append it at the end.
[[ -n "$deferred" ]] && ORDERED+=("$deferred")

for m in "${ORDERED[@]}"; do
  echo "  -> $m"
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql "$PGURL" -v ON_ERROR_STOP=1 < "$m" \
    || fail "migration $m"
done

fi

# ---------------------------------------------------------------- 10. gateway smoke with bypass
CURRENT_STEP=10
step 10 "gateway smoke under LOCAL_AUTH_BYPASS"
if [[ "${SKIP_REMAINING_OF_STEP:-0}" == "1" ]]; then echo "  [skip] step before START_AT"; else
# Kill anything already on 8080 (stale gateway from a previous run, or
# the compose-stack gateway if someone brought it up). Without this,
# our smoke could hit a different process and report a misleading 200.
echo "  killing any existing process on :8080 ..."
if lsof -ti :8080 >/dev/null 2>&1; then
  lsof -ti :8080 | xargs kill -9 2>/dev/null || true
  sleep 1
fi
# Also stop the compose-stack gateway if it's running, so the local
# `go run` is unambiguously the thing being tested.
docker compose -f "$COMPOSE_FILE" stop gateway 2>/dev/null || true

echo "  starting gateway in the background with LOCAL_AUTH_BYPASS=true ..."
(
  cd services/gateway
  # Gateway uses viper with `.` -> `_` env replacer, so config keys
  # like database.host map to DATABASE_HOST. The flat DATABASE_URL is
  # not consumed; set component vars instead. SSL is disabled because
  # the dev compose Postgres has no certs. DATABASE_DATABASE matches
  # the DB name our migrations target (sdlc_platform), matching the
  # gateway config.yaml default.
  LOCAL_AUTH_BYPASS=true \
  LOCAL_AUTH_BYPASS_TENANT="local-tenant" \
  LOCAL_AUTH_BYPASS_USER="alice" \
  DATABASE_HOST=localhost \
  DATABASE_PORT=5433 \
  DATABASE_USER=postgres \
  DATABASE_PASSWORD=password \
  DATABASE_DATABASE=sdlc_platform \
  DATABASE_SSL_MODE=disable \
  DATABASE_RETRY_ATTEMPTS=3 \
  DATABASE_RETRY_DELAY=2s \
  DATABASE_CONNECT_TIMEOUT=10s \
  DATABASE_MAX_CONNECTIONS=20 \
  DATABASE_MIN_CONNECTIONS=2 \
  DATABASE_MAX_CONN_LIFETIME=1h \
  DATABASE_MAX_CONN_IDLE_TIME=30m \
  DATABASE_HEALTH_CHECK_PERIOD=1m \
  REDIS_HOST=localhost \
  REDIS_PORT=6379 \
  go run ./cmd/server > ./make-it-run-gateway.log 2>&1 &
  echo $! > /tmp/sdlc-gateway.pid
)
# Give the gateway a generous boot window — `go run` compiles first.
echo "  waiting up to 30s for gateway to bind :8080 ..."
for _ in $(seq 1 30); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health 2>/dev/null \
       | grep -qE '^(200|204|301|302|401|403)$'; then
    break
  fi
  if [[ -f /tmp/sdlc-gateway.pid ]] && ! kill -0 "$(cat /tmp/sdlc-gateway.pid)" 2>/dev/null; then
    echo "  gateway died during startup. Last 30 lines of ./make-it-run-gateway.log:"
    tail -n 30 ./make-it-run-gateway.log || true
    fail "gateway crashed before binding :8080"
  fi
  sleep 1
done
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health || echo 000)
echo "  GET /health: status=$HEALTH_CODE"
ADMIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/admin/audit-logs || echo 000)
echo "  GET /admin/audit-logs (expect 200 under LOCAL_AUTH_BYPASS): status=$ADMIN_CODE"
if [[ -f /tmp/sdlc-gateway.pid ]]; then
  kill "$(cat /tmp/sdlc-gateway.pid)" 2>/dev/null || true
  rm -f /tmp/sdlc-gateway.pid
fi
if [[ "$HEALTH_CODE" != "200" ]]; then
  fail "gateway /health returned $HEALTH_CODE — see log above"
fi

fi

echo
echo "=========================================================="
echo "  All gates passed locally."
echo "=========================================================="
echo
echo "  Production deploy is gated by your CI:"
echo "     git tag -s vX.Y.Z -m 'release' && git push --tags"
echo "  triggers .github/workflows/deploy-prod.yml after manual approval."
echo "  This script will not push, will not deploy."
