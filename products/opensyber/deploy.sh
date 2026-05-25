#!/usr/bin/env bash
set -euo pipefail

# ─── Colors & Symbols ────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

CHECK="${GREEN}✓${RESET}"
CROSS="${RED}✗${RESET}"
ARROW="${CYAN}→${RESET}"
ROCKET="${MAGENTA}🚀${RESET}"
SHIELD="${BLUE}🛡${RESET}"
GEAR="${YELLOW}⚙${RESET}"
PACKAGE="${CYAN}📦${RESET}"
GLOBE="${GREEN}🌐${RESET}"

# ─── Progress Bar ─────────────────────────────────────────────────────────────
progress_bar() {
  local current=$1
  local total=$2
  local label=$3
  local width=40
  local pct=$((current * 100 / total))
  local filled=$((current * width / total))
  local empty=$((width - filled))

  local bar=""
  for ((i = 0; i < filled; i++)); do bar+="█"; done
  for ((i = 0; i < empty; i++)); do bar+="░"; done

  local color="${GREEN}"
  if [ "$pct" -lt 30 ]; then color="${RED}"; elif [ "$pct" -lt 70 ]; then color="${YELLOW}"; fi

  printf "\r  ${DIM}[${RESET}${color}%s${RESET}${DIM}]${RESET} ${WHITE}%3d%%${RESET}  ${DIM}%s${RESET}" "$bar" "$pct" "$label"
}

# ─── Spinner ──────────────────────────────────────────────────────────────────
spinner() {
  local pid=$1
  local label=$2
  local frames=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")
  local i=0

  while kill -0 "$pid" 2>/dev/null; do
    printf "\r  ${CYAN}%s${RESET} ${DIM}%s${RESET}" "${frames[$i]}" "$label"
    i=$(( (i + 1) % ${#frames[@]} ))
    sleep 0.1
  done
  printf "\r"
}

# ─── Logging ──────────────────────────────────────────────────────────────────
log_step()    { echo -e "\n${ARROW} ${BOLD}${WHITE}$1${RESET}"; }
log_success() { echo -e "  ${CHECK} ${GREEN}$1${RESET}"; }
log_error()   { echo -e "  ${CROSS} ${RED}$1${RESET}"; }
log_info()    { echo -e "  ${DIM}$1${RESET}"; }
log_warn()    { echo -e "  ${YELLOW}⚠${RESET} ${YELLOW}$1${RESET}"; }

# ─── Timer ────────────────────────────────────────────────────────────────────
SECONDS=0
format_time() {
  local secs=$1
  if [ "$secs" -ge 60 ]; then
    printf "%dm %ds" $((secs / 60)) $((secs % 60))
  else
    printf "%ds" "$secs"
  fi
}

# ─── Banner ───────────────────────────────────────────────────────────────────
clear
echo ""
echo -e "${BLUE}  ┌──────────────────────────────────────────────────┐${RESET}"
echo -e "${BLUE}  │${RESET}  ${SHIELD}  ${BOLD}${WHITE}OpenSyber Deploy${RESET}                              ${BLUE}│${RESET}"
echo -e "${BLUE}  │${RESET}     ${DIM}AI Agent Runtime Security Platform${RESET}            ${BLUE}│${RESET}"
echo -e "${BLUE}  │${RESET}     ${DIM}$(date '+%Y-%m-%d %H:%M:%S')${RESET}                        ${BLUE}│${RESET}"
echo -e "${BLUE}  └──────────────────────────────────────────────────┘${RESET}"
echo ""

TOTAL_STEPS=8
CURRENT_STEP=0

step() {
  CURRENT_STEP=$((CURRENT_STEP + 1))
  progress_bar "$CURRENT_STEP" "$TOTAL_STEPS" "$1"
  echo ""
}

# ─── Detect project root ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f "pnpm-workspace.yaml" ]; then
  log_error "Not in OpenSyber monorepo root. Run from project root."
  exit 1
fi

# ─── Parse target argument ──────────────────────────────────────────────────
TARGET="${1:-all}"
DEPLOY_API=true
DEPLOY_WEB=true
DEPLOY_TF_API=true
DEPLOY_TF_WEB=true

case "$TARGET" in
  api) DEPLOY_WEB=false; DEPLOY_TF_API=false; DEPLOY_TF_WEB=false ;;
  web) DEPLOY_API=false; DEPLOY_TF_API=false; DEPLOY_TF_WEB=false ;;
  tf-api) DEPLOY_API=false; DEPLOY_WEB=false; DEPLOY_TF_WEB=false ;;
  tf-web) DEPLOY_API=false; DEPLOY_WEB=false; DEPLOY_TF_API=false ;;
  tokenforge) DEPLOY_API=false; DEPLOY_WEB=false ;;
  all) ;; # deploy everything
  *)
    log_error "Unknown target: $TARGET"
    echo -e "  ${DIM}Usage: ./deploy.sh [api|web|tf-api|tf-web|tokenforge|all]${RESET}"
    exit 1
    ;;
esac

log_info "Target: ${BOLD}${TARGET}${RESET}"

# ─── Step 0: Auth gate ───────────────────────────────────────────────────────
# Wrangler needs CLOUDFLARE_API_TOKEN to deploy. PushCI runs this from the
# repo root via a non-interactive shell, so the user's exported env is NOT
# inherited. Auto-source the Keychain helper if present — that's the path
# that works for local pushes without per-push manual `source`.
# Set DEPLOY_REQUIRE_CF_TOKEN=1 to force-fail instead of silent-skip.
__DEPLOY_SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" && -f "$__DEPLOY_SCRIPT_DIR/scripts/_cf-env.sh" ]]; then
  # shellcheck disable=SC1091
  source "$__DEPLOY_SCRIPT_DIR/scripts/_cf-env.sh" 2>/dev/null || true
fi
unset __DEPLOY_SCRIPT_DIR

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  if [[ "${DEPLOY_REQUIRE_CF_TOKEN:-}" = "1" ]]; then
    log_error "CLOUDFLARE_API_TOKEN is unset and DEPLOY_REQUIRE_CF_TOKEN=1"
    exit 1
  fi
  log_warn "CLOUDFLARE_API_TOKEN unset — skipping deploy (set the token in CI/CD or export it locally)"
  exit 0
fi

# ─── Step 1: Preflight checks ────────────────────────────────────────────────
step "Preflight checks"
log_step "Checking prerequisites"

HAS_ERROR=0

if command -v pnpm &>/dev/null; then
  PNPM_VER=$(pnpm --version 2>/dev/null)
  log_success "pnpm ${DIM}v${PNPM_VER}${RESET}"
else
  log_error "pnpm not found — install with: npm i -g pnpm"
  HAS_ERROR=1
fi

if command -v wrangler &>/dev/null; then
  WRANGLER_VER=$(wrangler --version 2>/dev/null | head -1)
  log_success "wrangler ${DIM}${WRANGLER_VER}${RESET}"
else
  log_error "wrangler not found — install with: npm i -g wrangler"
  HAS_ERROR=1
fi

if command -v node &>/dev/null; then
  NODE_VER=$(node --version 2>/dev/null)
  log_success "node ${DIM}${NODE_VER}${RESET}"
else
  log_error "node not found"
  HAS_ERROR=1
fi

if [ "$HAS_ERROR" -eq 1 ]; then
  echo ""
  log_error "Missing prerequisites. Fix the above and try again."
  exit 1
fi

# ─── Step 2: Install dependencies ────────────────────────────────────────────
step "Installing dependencies"
log_step "Running pnpm install"

pnpm install --frozen-lockfile > /tmp/opensyber-install.log 2>&1 &
INSTALL_PID=$!
spinner "$INSTALL_PID" "Installing packages..."
wait "$INSTALL_PID" && INSTALL_OK=true || INSTALL_OK=false

if $INSTALL_OK; then
  DEP_COUNT=$(grep -c "packages are ready" /tmp/opensyber-install.log 2>/dev/null || echo "all")
  log_success "Dependencies installed"
else
  log_warn "Install had warnings (continuing)"
fi

# ─── Step 3: Build shared packages ───────────────────────────────────────────
step "Building shared packages"
log_step "Building ${PACKAGE} packages/db + packages/shared"

BUILD_FAIL=0

(cd packages/db && pnpm run build) > /tmp/opensyber-db-build.log 2>&1 &
DB_PID=$!
spinner "$DB_PID" "Building @opensyber/db..."
wait "$DB_PID" && log_success "@opensyber/db built" || { log_error "@opensyber/db build failed"; BUILD_FAIL=1; }

if [ -d "packages/shared" ] && [ -f "packages/shared/package.json" ]; then
  if grep -q '"build"' packages/shared/package.json 2>/dev/null; then
    (cd packages/shared && pnpm run build) > /tmp/opensyber-shared-build.log 2>&1 &
    SHARED_PID=$!
    spinner "$SHARED_PID" "Building @opensyber/shared..."
    wait "$SHARED_PID" && log_success "@opensyber/shared built" || log_warn "@opensyber/shared build skipped"
  else
    log_info "@opensyber/shared has no build step — skipping"
  fi
fi

if [ -d "packages/tokenforge" ] && [ -f "packages/tokenforge/package.json" ]; then
  if grep -q '"build"' packages/tokenforge/package.json 2>/dev/null; then
    (cd packages/tokenforge && pnpm run build) > /tmp/opensyber-tf-build.log 2>&1 &
    TF_PID=$!
    spinner "$TF_PID" "Building @opensyber/tokenforge..."
    wait "$TF_PID" && log_success "@opensyber/tokenforge built" || log_warn "@opensyber/tokenforge build skipped"
  fi
fi

if [ "$BUILD_FAIL" -eq 1 ]; then
  log_error "Critical package build failed. Check /tmp/opensyber-db-build.log"
  exit 1
fi

# ─── npm publish @opensyber/tokenforge (if version changed) ──────────────────
if [ -d "packages/tokenforge/dist" ] && [ -f "packages/tokenforge/package.json" ]; then
  TF_VERSION=$(node -e "console.log(require('./packages/tokenforge/package.json').version)")
  TF_PUBLISHED=$(npm view @opensyber/tokenforge version 2>/dev/null || echo "0.0.0")
  if [ "$TF_VERSION" != "$TF_PUBLISHED" ] && [ -n "${NPM_TOKEN:-}" ]; then
    log_step "Publishing ${PACKAGE} @opensyber/tokenforge v${TF_VERSION} → npm"
    echo "//registry.npmjs.org/:_authToken=\${NPM_TOKEN}" > packages/tokenforge/.npmrc
    (cd packages/tokenforge && npm publish --access public) > /tmp/opensyber-npm-publish.log 2>&1 &
    NPM_PID=$!
    spinner "$NPM_PID" "Publishing to npm..."
    wait "$NPM_PID" && NPM_OK=true || NPM_OK=false
    rm -f packages/tokenforge/.npmrc
    if $NPM_OK; then
      log_success "@opensyber/tokenforge v${TF_VERSION} published to npm"
    else
      log_warn "npm publish failed (non-blocking) — check /tmp/opensyber-npm-publish.log"
    fi
  elif [ "$TF_VERSION" = "$TF_PUBLISHED" ]; then
    log_info "@opensyber/tokenforge v${TF_VERSION} already on npm — skipping publish"
  elif [ -z "${NPM_TOKEN:-}" ]; then
    log_info "NPM_TOKEN unset — skipping npm publish (add to .env to enable)"
  fi
fi

# ─── Step 4: Deploy API Worker ────────────────────────────────────────────────
step "Deploying API Worker"
API_TIME=0
API_URL=""

if $DEPLOY_API; then
  log_step "Deploying ${GEAR} apps/api → Cloudflare Workers"

  API_START=$SECONDS

  (cd apps/api && wrangler deploy) > /tmp/opensyber-api-deploy.log 2>&1 &
  API_PID=$!
  spinner "$API_PID" "Deploying API worker..."
  wait "$API_PID" && API_OK=true || API_OK=false

  API_TIME=$(( SECONDS - API_START ))

  if $API_OK; then
    API_URL=$(grep -oE 'https://[^ ]+\.workers\.dev' /tmp/opensyber-api-deploy.log | head -1 || echo "")
    log_success "API Worker deployed ${DIM}($(format_time $API_TIME))${RESET}"
    if [ -n "$API_URL" ]; then
      echo -e "     ${GLOBE} ${CYAN}${API_URL}${RESET}"
    fi
  else
    log_error "API deploy failed! Check logs:"
    log_info "cat /tmp/opensyber-api-deploy.log"
    echo ""
    tail -5 /tmp/opensyber-api-deploy.log | while read -r line; do
      echo -e "     ${DIM}${line}${RESET}"
    done
    exit 1
  fi
else
  log_info "Skipping API deploy (target: ${TARGET})"
fi

# ─── Step 5: Build Web App ───────────────────────────────────────────────────
step "Building web app"
WEB_BUILD_TIME=0
WEB_DEPLOY_TIME=0

if $DEPLOY_WEB; then
  log_step "Building ${PACKAGE} apps/web (Next.js + OpenNext)"

  WEB_BUILD_START=$SECONDS

  (cd apps/web && pnpm run build:cf) > /tmp/opensyber-web-build.log 2>&1 &
  WEB_BUILD_PID=$!
  spinner "$WEB_BUILD_PID" "Building Next.js app..."
  wait "$WEB_BUILD_PID" && WEB_BUILD_OK=true || WEB_BUILD_OK=false

  WEB_BUILD_TIME=$(( SECONDS - WEB_BUILD_START ))

  if $WEB_BUILD_OK; then
    ROUTE_COUNT=$(grep -c "○\|●\|λ\|├\|└" /tmp/opensyber-web-build.log 2>/dev/null || echo "40+")
    log_success "Web app built ${DIM}($(format_time $WEB_BUILD_TIME), ${ROUTE_COUNT} routes)${RESET}"
  else
    log_error "Web build failed! Check logs:"
    log_info "cat /tmp/opensyber-web-build.log"
    echo ""
    tail -10 /tmp/opensyber-web-build.log | while read -r line; do
      echo -e "     ${DIM}${line}${RESET}"
    done
    exit 1
  fi
else
  log_info "Skipping web build (target: ${TARGET})"
fi

# ─── Step 6: Deploy Web App ──────────────────────────────────────────────────
step "Deploying web app"

if $DEPLOY_WEB; then
  log_step "Deploying ${ROCKET} apps/web → Cloudflare Workers"

  WEB_DEPLOY_START=$SECONDS

  (cd apps/web && wrangler deploy) > /tmp/opensyber-web-deploy.log 2>&1 &
  WEB_DEPLOY_PID=$!
  spinner "$WEB_DEPLOY_PID" "Deploying web worker..."
  wait "$WEB_DEPLOY_PID" && WEB_OK=true || WEB_OK=false

  WEB_DEPLOY_TIME=$(( SECONDS - WEB_DEPLOY_START ))

  if $WEB_OK; then
    WEB_URL=$(grep -oE 'https://[^ ]+\.workers\.dev' /tmp/opensyber-web-deploy.log | head -1 || echo "")
    log_success "Web app deployed ${DIM}($(format_time $WEB_DEPLOY_TIME))${RESET}"
    if [ -n "$WEB_URL" ]; then
      echo -e "     ${GLOBE} ${CYAN}${WEB_URL}${RESET}"
    fi
  else
    log_error "Web deploy failed! Check logs:"
    log_info "cat /tmp/opensyber-web-deploy.log"
    echo ""
    tail -5 /tmp/opensyber-web-deploy.log | while read -r line; do
      echo -e "     ${DIM}${line}${RESET}"
    done
    exit 1
  fi
else
  log_info "Skipping web deploy (target: ${TARGET})"
fi

# ─── Step 6b: Deploy TokenForge API ──────────────────────────────────────────
step "Deploying TokenForge API"
TF_API_TIME=0
TF_API_URL=""

if $DEPLOY_TF_API; then
  if [ -f "apps/tokenforge-api/wrangler.toml" ]; then
    log_step "Deploying ${GEAR} apps/tokenforge-api → Cloudflare Workers"
    TF_API_START=$SECONDS

    (cd apps/tokenforge-api && wrangler deploy) > /tmp/opensyber-tf-api-deploy.log 2>&1 &
    TF_API_PID=$!
    spinner "$TF_API_PID" "Deploying TokenForge API..."
    wait "$TF_API_PID" && TF_API_OK=true || TF_API_OK=false

    TF_API_TIME=$(( SECONDS - TF_API_START ))

    if $TF_API_OK; then
      TF_API_URL=$(grep -oE 'https://[^ ]+\.workers\.dev' /tmp/opensyber-tf-api-deploy.log | head -1 || echo "")
      log_success "TokenForge API deployed ${DIM}($(format_time $TF_API_TIME))${RESET}"
      [ -n "$TF_API_URL" ] && echo -e "     ${GLOBE} ${CYAN}${TF_API_URL}${RESET}"
    else
      log_error "TokenForge API deploy failed! Check /tmp/opensyber-tf-api-deploy.log"
      tail -5 /tmp/opensyber-tf-api-deploy.log | while read -r line; do
        echo -e "     ${DIM}${line}${RESET}"
      done
      exit 1
    fi
  else
    log_warn "apps/tokenforge-api/wrangler.toml missing — skipping"
  fi
else
  log_info "Skipping TokenForge API deploy (target: ${TARGET})"
fi

# ─── Step 6c: Build + deploy TokenForge Web ──────────────────────────────────
step "Deploying TokenForge Web"
TF_WEB_TIME=0

if $DEPLOY_TF_WEB; then
  if [ -f "apps/tokenforge-web/wrangler.toml" ]; then
    log_step "Building ${PACKAGE} apps/tokenforge-web (Next.js + OpenNext)"
    TF_WEB_START=$SECONDS

    (cd apps/tokenforge-web && pnpm run build:cf) > /tmp/opensyber-tf-web-build.log 2>&1 &
    TF_WEB_BUILD_PID=$!
    spinner "$TF_WEB_BUILD_PID" "Building TokenForge Web..."
    wait "$TF_WEB_BUILD_PID" && TF_WEB_BUILD_OK=true || TF_WEB_BUILD_OK=false

    if ! $TF_WEB_BUILD_OK; then
      log_error "TokenForge Web build failed! Check /tmp/opensyber-tf-web-build.log"
      tail -10 /tmp/opensyber-tf-web-build.log | while read -r line; do
        echo -e "     ${DIM}${line}${RESET}"
      done
      exit 1
    fi

    log_step "Deploying ${ROCKET} apps/tokenforge-web → Cloudflare Workers"
    (cd apps/tokenforge-web && wrangler deploy) > /tmp/opensyber-tf-web-deploy.log 2>&1 &
    TF_WEB_PID=$!
    spinner "$TF_WEB_PID" "Deploying TokenForge Web..."
    wait "$TF_WEB_PID" && TF_WEB_OK=true || TF_WEB_OK=false

    TF_WEB_TIME=$(( SECONDS - TF_WEB_START ))

    if $TF_WEB_OK; then
      TF_WEB_URL=$(grep -oE 'https://[^ ]+\.workers\.dev' /tmp/opensyber-tf-web-deploy.log | head -1 || echo "")
      log_success "TokenForge Web deployed ${DIM}($(format_time $TF_WEB_TIME))${RESET}"
      [ -n "$TF_WEB_URL" ] && echo -e "     ${GLOBE} ${CYAN}${TF_WEB_URL}${RESET}"
    else
      log_error "TokenForge Web deploy failed! Check /tmp/opensyber-tf-web-deploy.log"
      tail -5 /tmp/opensyber-tf-web-deploy.log | while read -r line; do
        echo -e "     ${DIM}${line}${RESET}"
      done
      exit 1
    fi
  else
    log_warn "apps/tokenforge-web/wrangler.toml missing — skipping"
  fi
else
  log_info "Skipping TokenForge Web deploy (target: ${TARGET})"
fi

# ─── Step 7: Verify deployments ──────────────────────────────────────────────
step "Verifying deployments"
log_step "Running health checks"

if [ -n "${API_URL:-}" ]; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/" --max-time 10 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    log_success "API health check passed ${DIM}(HTTP ${HTTP_CODE})${RESET}"
  else
    log_warn "API returned HTTP ${HTTP_CODE} — may still be propagating"
  fi
else
  log_info "Skipping API health check (no URL detected)"
fi

PROD_URL="https://opensyber.cloud"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL" --max-time 10 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "304" ] || [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "302" ]; then
  log_success "Production site live ${DIM}(HTTP ${HTTP_CODE})${RESET}"
  echo -e "     ${GLOBE} ${CYAN}${PROD_URL}${RESET}"
elif [ "$HTTP_CODE" = "403" ]; then
  # 403 is expected — Clerk auth middleware redirects unauthenticated root requests
  log_success "Production site live ${DIM}(HTTP ${HTTP_CODE} — auth redirect expected)${RESET}"
  echo -e "     ${GLOBE} ${CYAN}${PROD_URL}${RESET}"
else
  log_warn "Production site returned HTTP ${HTTP_CODE}"
fi

# ─── Step 8: Summary ─────────────────────────────────────────────────────────
step "Done!"
TOTAL_TIME=$SECONDS

echo ""
echo -e "${BLUE}  ┌──────────────────────────────────────────────────┐${RESET}"
echo -e "${BLUE}  │${RESET}  ${CHECK} ${BOLD}${GREEN}Deployment Complete${RESET}                            ${BLUE}│${RESET}"
echo -e "${BLUE}  │${RESET}                                                    ${BLUE}│${RESET}"
if [ -n "${API_URL:-}" ]; then
echo -e "${BLUE}  │${RESET}  ${GEAR}  API:  ${CYAN}${API_URL}${RESET}"
fi
echo -e "${BLUE}  │${RESET}  ${GLOBE} Web:  ${CYAN}https://opensyber.cloud${RESET}               ${BLUE}│${RESET}"
echo -e "${BLUE}  │${RESET}                                                    ${BLUE}│${RESET}"
echo -e "${BLUE}  │${RESET}  ${DIM}Total time: $(format_time $TOTAL_TIME)${RESET}                              ${BLUE}│${RESET}"
echo -e "${BLUE}  │${RESET}  ${DIM}API deploy: $(format_time $API_TIME) | Web build+deploy: $(format_time $((WEB_BUILD_TIME + WEB_DEPLOY_TIME)))${RESET}"
echo -e "${BLUE}  │${RESET}                                                    ${BLUE}│${RESET}"
echo -e "${BLUE}  │${RESET}  ${SHIELD}  ${BOLD}38 integrations${RESET} ${DIM}now available at${RESET}             ${BLUE}│${RESET}"
echo -e "${BLUE}  │${RESET}     ${CYAN}opensyber.cloud/dashboard/integrations${RESET}       ${BLUE}│${RESET}"
echo -e "${BLUE}  └──────────────────────────────────────────────────┘${RESET}"
echo ""
