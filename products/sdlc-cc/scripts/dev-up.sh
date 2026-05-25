#!/usr/bin/env bash
# dev-up.sh — interactive bring-up of the sdlc.cc gateway on localhost.
#
# Walks through the steps from the README:
#   1. Verify docker + the portfolio layout the Dockerfile expects
#   2. Capture or prompt for ANTHROPIC_API_KEY (and persist to .env)
#   3. Generate SDLC_ADMIN_BEARER if absent
#   4. docker compose up --build (in background)
#   5. Wait for /health to return 200
#   6. Issue a tenant API key via keytool, capture plaintext
#   7. Sanity test: POST a PAN-bearing prompt; assert it gets scrubbed
#   8. Print a summary the user can paste into another terminal
#
# Idempotent: re-running won't tear down the stack; existing keys
# stay valid because they're hash-stored.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDLC_CC="$(cd "$SCRIPT_DIR/.." && pwd)"
PORTFOLIO="$(cd "$SDLC_CC/.." && pwd)"
COMPOSE="$SDLC_CC/deploy/docker-compose.yml"
ENV_FILE="$SDLC_CC/.env.dev"

# ─── colors / output helpers ─────────────────────────────────────────
if [[ -t 1 ]]; then
  C_BOLD=$'\e[1m'; C_DIM=$'\e[2m'; C_RED=$'\e[31m'; C_GRN=$'\e[32m'
  C_YEL=$'\e[33m'; C_BLU=$'\e[34m'; C_RST=$'\e[0m'
else
  C_BOLD=; C_DIM=; C_RED=; C_GRN=; C_YEL=; C_BLU=; C_RST=
fi

step()  { printf "\n${C_BOLD}${C_BLU}▸ %s${C_RST}\n" "$*"; }
ok()    { printf "${C_GRN}  ✓${C_RST} %s\n" "$*"; }
warn()  { printf "${C_YEL}  ⚠${C_RST} %s\n" "$*"; }
fail()  { printf "${C_RED}  ✗${C_RST} %s\n" "$*" >&2; exit 1; }
hint()  { printf "${C_DIM}    %s${C_RST}\n" "$*"; }

# ─── 1. preflight ────────────────────────────────────────────────────
step "Preflight checks"

command -v docker >/dev/null || fail "docker not found in PATH"
docker info >/dev/null 2>&1 || fail "docker daemon not running — start Docker Desktop"
ok "docker daemon reachable"

[[ -f "$COMPOSE" ]] || fail "docker-compose.yml missing at $COMPOSE"
[[ -d "$PORTFOLIO/sdlc-core" ]] || fail "sdlc-core sibling missing at $PORTFOLIO/sdlc-core (Dockerfile needs it)"
ok "portfolio layout looks right (sdlc-cc + sdlc-core under $PORTFOLIO)"

# ─── 2. credentials ──────────────────────────────────────────────────
step "Credentials"

# Load existing .env.dev if present so re-runs don't re-prompt
if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE"; set +a
  ok "loaded $ENV_FILE"
fi

if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  printf "  ${C_BOLD}ANTHROPIC_API_KEY${C_RST} not set. Paste your key (sk-ant-...): "
  read -rs ANTHROPIC_API_KEY
  printf "\n"
  [[ "$ANTHROPIC_API_KEY" =~ ^sk-ant- ]] || fail "key must start with sk-ant-"
fi

if [[ -z "${SDLC_ADMIN_BEARER:-}" ]]; then
  SDLC_ADMIN_BEARER="$(openssl rand -hex 16)"
  ok "generated SDLC_ADMIN_BEARER (32 hex chars)"
fi

# Persist for subsequent runs
umask 077
cat >"$ENV_FILE" <<EOF
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
SDLC_ADMIN_BEARER=$SDLC_ADMIN_BEARER
EOF
ok "wrote $ENV_FILE (chmod 600)"

export ANTHROPIC_API_KEY SDLC_ADMIN_BEARER

# ─── 3. bring up the stack ───────────────────────────────────────────
step "Bringing up Postgres + migrations + gateway (docker compose)"

# Build context is the portfolio dir per the Dockerfile.
( cd "$PORTFOLIO" && docker compose -f "$COMPOSE" up --build -d ) \
  || fail "docker compose up failed"

ok "containers started — waiting for /health"

# ─── 4. wait for readiness ───────────────────────────────────────────
deadline=$((SECONDS + 90))
until curl -sSf http://localhost:8080/health >/dev/null 2>&1; do
  if (( SECONDS > deadline )); then
    docker compose -f "$COMPOSE" logs api | tail -40
    fail "/health didn't return 200 within 90s — see logs above"
  fi
  sleep 2
  printf "${C_DIM}.${C_RST}"
done
printf "\n"
ok "gateway healthy at http://localhost:8080"

# ─── 5. issue (or reuse) a tenant key ────────────────────────────────
step "Issue a tenant API key"

KEY_FILE="$SDLC_CC/.dev-key"
if [[ -f "$KEY_FILE" ]]; then
  SDLC_KEY="$(cat "$KEY_FILE")"
  ok "reusing key from $KEY_FILE (delete to mint a new one)"
else
  printf "  Issuing key for tnt_personal...\n"
  KEY_OUT="$(docker compose -f "$COMPOSE" exec -T api \
    ./keytool issue --tenant tnt_personal --label dev-laptop)"
  SDLC_KEY="$(printf "%s" "$KEY_OUT" | awk '/plaintext:/ {print $2}')"
  [[ -n "$SDLC_KEY" ]] || { printf "%s\n" "$KEY_OUT"; fail "couldn't parse plaintext from keytool output"; }
  printf "%s" "$SDLC_KEY" >"$KEY_FILE"
  chmod 600 "$KEY_FILE"
  ok "issued + cached at $KEY_FILE"
fi
hint "key prefix: ${SDLC_KEY:0:14}…"

# ─── 6. DLP smoke test ───────────────────────────────────────────────
step "DLP smoke test (PAN should not appear in response)"

RESP="$(curl -sS -X POST http://localhost:8080/v1/messages \
  -H "Authorization: Bearer $SDLC_KEY" \
  -H "Content-Type: application/json" \
  --data '{"model":"claude-haiku-4-5","max_tokens":80,
           "messages":[{"role":"user","content":"My card 4111-1111-1111-1111. Did you see it scrubbed?"}]}')"

if printf "%s" "$RESP" | grep -q "4111-1111-1111-1111"; then
  printf "%s\n" "$RESP"
  fail "PAN leaked in response — DLP not active"
fi
ok "DLP scrubbed the PAN ✓"

# ─── 7. metrics + audit visibility ───────────────────────────────────
step "Observability check"

REQ_OK="$(curl -sS http://localhost:8080/metrics | awk '/^sdlc_requests_total_ok / {print $2}')"
ok "requests_total_ok = ${REQ_OK:-0}"

AUDIT_TOTAL="$(curl -sS -H "Authorization: Bearer $SDLC_ADMIN_BEARER" \
  http://localhost:8080/v1/audit/usage | grep -oE '"total_requests":[0-9]+' | head -1)"
ok "audit ${AUDIT_TOTAL:-(unreachable)}"

# ─── 8. summary ──────────────────────────────────────────────────────
step "Done"

cat <<EOF

  ${C_BOLD}Use it from Claude Code (in another terminal):${C_RST}

    export ANTHROPIC_BASE_URL=http://localhost:8080
    export ANTHROPIC_API_KEY=$SDLC_KEY
    claude

  ${C_BOLD}Useful URLs:${C_RST}
    Health    http://localhost:8080/health
    Metrics   http://localhost:8080/metrics
    Audit     curl -H "Authorization: Bearer \$SDLC_ADMIN_BEARER" http://localhost:8080/v1/audit/usage

  ${C_BOLD}Stop:${C_RST}    docker compose -f $COMPOSE down
  ${C_BOLD}Logs:${C_RST}    docker compose -f $COMPOSE logs -f api
  ${C_BOLD}Reset:${C_RST}   docker compose -f $COMPOSE down -v && rm -f $KEY_FILE

EOF
