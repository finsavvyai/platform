#!/usr/bin/env bash
#
# regenerate-sdks.sh
#
# Wrapper around `fern generate --local` that regenerates the TypeScript,
# Python, and Go SDKs under packages/sdk-* from the gateway's OpenAPI spec.
#
# Usage:
#   ./scripts/regenerate-sdks.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
FERN_DIR="${REPO_ROOT}/fern"
OPENAPI_SPEC="${REPO_ROOT}/services/gateway/api/openapi.yaml"

color() {
  # $1 = color code, $2 = message
  if [ -t 1 ]; then
    printf "\033[%sm%s\033[0m\n" "$1" "$2"
  else
    printf "%s\n" "$2"
  fi
}

info()  { color "1;34" "[info]  $*"; }
ok()    { color "1;32" "[ok]    $*"; }
warn()  { color "1;33" "[warn]  $*"; }
error() { color "1;31" "[error] $*" >&2; }

# ------------------------------------------------------------------
# 1. Preconditions
# ------------------------------------------------------------------
if ! command -v fern >/dev/null 2>&1; then
  error "fern CLI is not installed."
  cat >&2 <<'EOF'

Install it with:

  npm install -g fern-api

Then re-run this script. See fern/README.md for more details.
EOF
  exit 1
fi

if [ ! -f "${OPENAPI_SPEC}" ]; then
  error "OpenAPI spec not found at: ${OPENAPI_SPEC}"
  exit 1
fi

if [ ! -d "${FERN_DIR}" ]; then
  error "Fern workspace not found at: ${FERN_DIR}"
  exit 1
fi

FERN_VERSION="$(fern --version 2>/dev/null || echo unknown)"
info "Using fern CLI version: ${FERN_VERSION}"
info "OpenAPI spec:           ${OPENAPI_SPEC}"
info "Fern workspace:         ${FERN_DIR}"

# ------------------------------------------------------------------
# 2. Generate
# ------------------------------------------------------------------
info "Running 'fern generate --local'..."
(
  cd "${FERN_DIR}"
  fern generate --local
)
ok "Fern generation complete."

# ------------------------------------------------------------------
# 3. Diff summary
# ------------------------------------------------------------------
if command -v git >/dev/null 2>&1 && git -C "${REPO_ROOT}" rev-parse >/dev/null 2>&1; then
  info "Diff summary for packages/sdk-*:"
  if git -C "${REPO_ROOT}" diff --stat -- \
      packages/sdk-ts packages/sdk-py packages/sdk-go | grep -q .; then
    git -C "${REPO_ROOT}" diff --stat -- \
      packages/sdk-ts packages/sdk-py packages/sdk-go
    warn "SDK changes detected. Review with:"
    warn "  git diff packages/sdk-ts packages/sdk-py packages/sdk-go"
  else
    ok "No SDK changes detected."
  fi
else
  warn "Not inside a git repo; skipping diff summary."
fi

ok "Done."
