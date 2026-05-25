#!/usr/bin/env bash
# fly-bootstrap.sh — one-shot Fly.io bootstrap for sdlc.cc.
#
# Idempotent: re-runs skip work that's already done. Safe to invoke
# any time; useful as the README's "deploy from scratch" command.
#
# Prereqs:
#   - flyctl auth login (interactive, opens browser, one-time)
#   - .env.dev present (script reuses ANTHROPIC_API_KEY + SDLC_ADMIN_BEARER)
#   - ghcr image already published (workflow on every main)
#   - The ghcr package "sdlc-cc" must be public OR Fly machine has
#     credentials. For the private case set GHCR_USER + GHCR_TOKEN
#     env before running.

set -euo pipefail

APP="${APP:-sdlc-cc}"
DB_APP="${DB_APP:-sdlc-cc-db}"
REGION="${REGION:-iad}"
HOSTNAME="${HOSTNAME:-api.sdlc.cc}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDLC_CC="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SDLC_CC/.env.dev"
FLY_TOML="$SDLC_CC/deploy/fly.toml"

if [[ -t 1 ]]; then
  C_BOLD=$'\e[1m'; C_GRN=$'\e[32m'; C_YEL=$'\e[33m'; C_RED=$'\e[31m'; C_RST=$'\e[0m'
else C_BOLD=; C_GRN=; C_YEL=; C_RED=; C_RST=; fi
ok()   { printf "${C_GRN}  ✓${C_RST} %s\n" "$*"; }
warn() { printf "${C_YEL}  ⚠${C_RST} %s\n" "$*"; }
fail() { printf "${C_RED}  ✗${C_RST} %s\n" "$*" >&2; exit 1; }
step() { printf "\n${C_BOLD}▸ %s${C_RST}\n" "$*"; }

command -v flyctl >/dev/null || fail "flyctl not found — brew install flyctl"
flyctl auth whoami >/dev/null 2>&1 || fail "not logged in — run: flyctl auth login"
[[ -f "$ENV_FILE" ]] || fail "no $ENV_FILE — run scripts/dev-up.sh first to mint the secrets"
set -a; source "$ENV_FILE"; set +a

# ─── 1. app ────────────────────────────────────────────────────────
step "App"
if flyctl apps list 2>/dev/null | grep -q "^$APP\b"; then
  ok "app '$APP' exists"
else
  flyctl apps create "$APP" --org personal
  ok "created app '$APP'"
fi

# ─── 2. postgres ───────────────────────────────────────────────────
step "Postgres"
if flyctl apps list 2>/dev/null | grep -q "^$DB_APP\b"; then
  ok "Postgres app '$DB_APP' exists"
else
  flyctl postgres create --name "$DB_APP" --region "$REGION" \
    --initial-cluster-size 1 --vm-size shared-cpu-1x --volume-size 3
  ok "created Postgres '$DB_APP'"
fi

# Attach is idempotent at the app level; if DATABASE_URL is already set
# we skip to avoid a double-attach error.
if flyctl secrets list --app "$APP" 2>/dev/null | grep -q "^DATABASE_URL"; then
  ok "DATABASE_URL already set on $APP"
else
  flyctl postgres attach "$DB_APP" --app "$APP"
  ok "attached Postgres → DATABASE_URL"
fi

# ─── 3. secrets ────────────────────────────────────────────────────
step "Secrets"
SECRETS=()
[[ -n "${ANTHROPIC_API_KEY:-}"   ]] && SECRETS+=("ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY")
[[ -n "${SDLC_ADMIN_BEARER:-}"   ]] && SECRETS+=("SDLC_ADMIN_BEARER=$SDLC_ADMIN_BEARER")
if (( ${#SECRETS[@]} > 0 )); then
  flyctl secrets set --app "$APP" "${SECRETS[@]}" >/dev/null
  ok "secrets set: ${#SECRETS[@]} keys"
else
  warn "no secrets to set (already configured?)"
fi

# ─── 4. deploy ─────────────────────────────────────────────────────
step "Deploy"
flyctl deploy --app "$APP" --config "$FLY_TOML" --remote-only
ok "deployed"

# ─── 5. cert + dns hint ────────────────────────────────────────────
step "TLS for $HOSTNAME"
if flyctl certs list --app "$APP" 2>/dev/null | grep -q "$HOSTNAME"; then
  ok "cert for $HOSTNAME already requested"
else
  flyctl certs add "$HOSTNAME" --app "$APP" || warn "cert add failed (DNS not pointing yet?)"
fi

cat <<EOF

  ${C_BOLD}DNS to add in Cloudflare:${C_RST}
    Type  CNAME
    Name  ${HOSTNAME%%.*}
    Target $APP.fly.dev
    Proxy  on (orange cloud)

  Then verify: flyctl certs check $HOSTNAME --app $APP
  And use: ANTHROPIC_BASE_URL=https://$HOSTNAME claude

EOF
