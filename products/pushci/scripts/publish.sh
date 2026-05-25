#!/usr/bin/env bash
# publish.sh — Full PushCI release: bump → build → tag → goreleaser → npm → deploy → registries
#
# Usage:
#   ./scripts/publish.sh patch          # 1.7.0 → 1.7.1
#   ./scripts/publish.sh minor          # 1.7.0 → 1.8.0
#   ./scripts/publish.sh major          # 1.7.0 → 2.0.0
#   ./scripts/publish.sh 1.8.0          # explicit version
#
# Required env:
#   GITHUB_TOKEN              — push releases to finsavvyai/pushci-cli
#   HOMEBREW_TAP_GITHUB_TOKEN — update homebrew-tap formula
#
# Optional env:
#   SKIP_DEPLOY=1    — skip Cloudflare Pages + Workers deploy
#   SKIP_NPM=1       — skip npm publish
#   SKIP_GORELEASER=1 — skip goreleaser (GitHub Releases + Homebrew)
#   DRY_RUN=1        — print what would happen, no side effects
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ── colour helpers ─────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[publish]${RESET} $*"; }
success() { echo -e "${GREEN}✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}⚠${RESET} $*"; }
fail()    { echo -e "${RED}✗ $*${RESET}" >&2; exit 1; }
step()    { echo -e "\n${BOLD}── $* ──────────────────────────────────────────${RESET}"; }
dry()     { echo -e "${YELLOW}[dry-run]${RESET} $*"; }

DRY_RUN="${DRY_RUN:-0}"
run() {
  if [ "$DRY_RUN" = "1" ]; then dry "$*"; else eval "$*"; fi
}

# ── 0. parse version bump ─────────────────────────────────────────────────────
BUMP="${1:-patch}"
CURRENT="$(node -p 'require("./package.json").version')"

bump_version() {
  local cur="$1" part="$2"
  IFS='.' read -r major minor patch <<< "$cur"
  case "$part" in
    major) echo "$((major+1)).0.0" ;;
    minor) echo "${major}.$((minor+1)).0" ;;
    patch) echo "${major}.${minor}.$((patch+1))" ;;
    *)     echo "$part" ;;  # explicit version passed
  esac
}

NEW_VERSION="$(bump_version "$CURRENT" "$BUMP")"
TAG="v${NEW_VERSION}"

echo ""
echo -e "${BOLD}PushCI Publish Script${RESET}"
echo -e "  Current:  ${YELLOW}v${CURRENT}${RESET}"
echo -e "  New:      ${GREEN}${TAG}${RESET}"
echo -e "  DRY_RUN:  ${DRY_RUN}"
echo ""

if [ "$DRY_RUN" != "1" ]; then
  read -rp "Publish ${TAG}? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
fi

# ── 1. pre-flight checks ──────────────────────────────────────────────────────
step "1. Pre-flight"

command -v go        >/dev/null || fail "go not found"
command -v node      >/dev/null || fail "node not found"
command -v npm       >/dev/null || fail "npm not found"
command -v git       >/dev/null || fail "git not found"
command -v goreleaser >/dev/null || warn "goreleaser not found — GitHub Releases will be skipped"
command -v npx       >/dev/null || warn "npx not found — Cloudflare deploy may fail"

[ -n "${GITHUB_TOKEN:-}" ]              || warn "GITHUB_TOKEN not set — goreleaser will fail"
[ -n "${HOMEBREW_TAP_GITHUB_TOKEN:-}" ] || warn "HOMEBREW_TAP_GITHUB_TOKEN not set — Homebrew update will fail"

# Check clean working tree (tracked files only — untracked don't affect release)
if [ -n "$(git status --porcelain | grep -v '^??')" ]; then
  fail "Working tree has uncommitted changes. Commit or stash before releasing."
fi

# Run test suite
info "Running go test..."
run "go test ./... -count=1 -timeout=120s" || fail "Tests failed — aborting release"
success "All tests passed"

# ── 2. bump version in package.json ───────────────────────────────────────────
step "2. Bump version → ${NEW_VERSION}"

if [ "$DRY_RUN" != "1" ]; then
  # package.json
  node -e "
    const fs = require('fs');
    const p = JSON.parse(fs.readFileSync('package.json','utf8'));
    p.version = '${NEW_VERSION}';
    fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
  "
  success "package.json → ${NEW_VERSION}"

  # Commit version bump
  git add package.json
  git commit -m "chore(release): v${NEW_VERSION}"
  success "Version bump committed"
else
  dry "node: package.json version → ${NEW_VERSION}"
  dry "git commit -m 'chore(release): v${NEW_VERSION}'"
fi

# ── 3. git tag ────────────────────────────────────────────────────────────────
step "3. Git tag ${TAG}"
run "git tag ${TAG}"
run "git push origin main --tags"
success "Pushed main + ${TAG}"

# ── 4. goreleaser — GitHub Releases + Homebrew ────────────────────────────────
if [ "${SKIP_GORELEASER:-0}" != "1" ] && command -v goreleaser >/dev/null; then
  step "4. GoReleaser — GitHub Releases + Homebrew tap"
  run "goreleaser release --clean"
  success "GoReleaser complete — https://github.com/finsavvyai/pushci-cli/releases/tag/${TAG}"
else
  warn "Skipping goreleaser (SKIP_GORELEASER=1 or not installed)"
  info "Manual fallback: goreleaser release --clean"
fi

# ── 5. npm publish ────────────────────────────────────────────────────────────
if [ "${SKIP_NPM:-0}" != "1" ]; then
  step "5. npm publish"
  info "Running prepack (cross-compiling 6 binaries)..."
  run "npm publish"
  success "Published pushci@${NEW_VERSION} to npm"
  info "Verify: npm view pushci version"
else
  warn "Skipping npm publish (SKIP_NPM=1)"
fi

# ── 6. deploy Cloudflare (landing + dashboard + workers) ─────────────────────
if [ "${SKIP_DEPLOY:-0}" != "1" ]; then
  step "6. Cloudflare Deploy"

  info "Building + deploying landing page..."
  run "cd web/landing && npm install --silent && npx vite build && cd ../.."
  run "cd /tmp && npx wrangler pages deploy ${ROOT}/web/landing/dist --project-name pushci"
  success "Landing → https://pushci.pages.dev"

  info "Building + deploying dashboard..."
  run "cd web/dashboard && npm install --silent && npx vite build && cd ../.."
  run "cd /tmp && npx wrangler pages deploy ${ROOT}/web/dashboard/dist --project-name pushci-app"
  success "Dashboard → https://pushci-app.pages.dev"

  info "Deploying API worker..."
  run "cd api && npx wrangler deploy && cd .."
  success "API → https://api.pushci.dev"
else
  warn "Skipping Cloudflare deploy (SKIP_DEPLOY=1)"
fi

# ── 7. submit to registries + search engines ──────────────────────────────────
step "7. Registry + Search Engine Submission"

submit_url() {
  local label="$1" url="$2"
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url")
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "301" ] || [ "$STATUS" = "302" ]; then
    success "${label}: ${STATUS}"
  else
    warn "${label}: ${STATUS} — ${url}"
  fi
}

if [ "$DRY_RUN" != "1" ]; then
  # Ping sitemap
  curl -s "https://www.google.com/ping?sitemap=https://pushci.dev/sitemap.xml" >/dev/null
  success "Google sitemap ping"
  curl -s "https://www.bing.com/ping?sitemap=https://pushci.dev/sitemap.xml" >/dev/null
  success "Bing sitemap ping"

  # Verify AI discovery endpoints
  info "Verifying AI discovery endpoints..."
  for url in \
    "https://pushci.dev/llms.txt" \
    "https://pushci.dev/.well-known/ai-plugin.json" \
    "https://pushci.dev/.well-known/mcp.json" \
    "https://pushci.dev/openapi.json" \
    "https://pushci.dev/sitemap.xml"; do
    submit_url "  $url" "$url"
  done

  # Verify npm
  NPM_LIVE="$(npm view pushci version 2>/dev/null || echo 'unknown')"
  if [ "$NPM_LIVE" = "$NEW_VERSION" ]; then
    success "npm: pushci@${NPM_LIVE} live"
  else
    warn "npm: live=${NPM_LIVE}, expected=${NEW_VERSION} — may take a few minutes"
  fi
else
  dry "curl google/bing sitemap pings"
  dry "verify AI discovery endpoints"
  dry "npm view pushci version"
fi

# ── 8. release summary ────────────────────────────────────────────────────────
step "8. Release Summary"

echo ""
echo -e "  ${GREEN}${BOLD}PushCI ${TAG} published${RESET}"
echo ""
echo -e "  ${BOLD}Distribution${RESET}"
echo    "    npm:       https://www.npmjs.com/package/pushci"
echo    "    GitHub:    https://github.com/finsavvyai/pushci-cli/releases/tag/${TAG}"
echo    "    Homebrew:  brew upgrade pushci"
echo    "    curl:      curl -fsSL https://pushci.dev/install.sh | sh"
echo ""
echo -e "  ${BOLD}Live URLs${RESET}"
echo    "    Landing:   https://pushci.dev"
echo    "    Dashboard: https://app.pushci.dev"
echo    "    API:       https://api.pushci.dev"
echo ""
echo -e "  ${BOLD}Manual steps (open these after publish)${RESET}"
echo    "    Product Hunt: https://www.producthunt.com/posts/new"
echo    "    MCP Registry: https://smithery.ai/submit"
echo    "    MCP Registry: https://mcp.so/submit"
echo    "    Glama:        https://glama.ai/mcp/submit"
echo    "    LS Dashboard: https://app.lemonsqueezy.com — update product description"
echo ""
echo -e "  ${BOLD}Verify install${RESET}"
echo    "    npm i -g pushci@${NEW_VERSION} && pushci version"
echo ""
