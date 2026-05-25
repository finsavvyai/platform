#!/usr/bin/env bash
# PipeWarden — Cloudflare Containers deploy
# Target:  Workers + Containers (open beta, Workers Paid Plan required)
# Usage:   bash scripts/deploy.sh
#          DRY_RUN=1 bash scripts/deploy.sh    # validate only

set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

WORKER="${CLOUDFLARE_WORKER_NAME:-pipewarden}"
SHA="$(git rev-parse --short HEAD 2>/dev/null || echo dev)"
IMAGE="${PIPEWARDEN_IMAGE:-pipewarden/pipewarden}:${PIPEWARDEN_TAG:-$SHA}"
URL="${SMOKE_URL:-https://${WORKER}.workers.dev}"
DRY_RUN="${DRY_RUN:-0}"

# ─── voice + log helpers ─────────────────────────────────────────────────
voice() { command -v say >/dev/null 2>&1 && say "$1" >/dev/null 2>&1 || true; }
phase() { printf "\n\033[1;36m==> [%s] %s\033[0m\n" "$(date +%H:%M:%S)" "$*"; voice "$1"; }
ok()    { printf "    \033[32m✓\033[0m %s\n" "$*"; }
die()   { printf "\n\033[1;31mFAIL: %s\033[0m\n" "$*" >&2; voice "deployment failed at $1"; exit 1; }
trap 'die "unexpected error at line $LINENO"' ERR

dry()   { [[ "$DRY_RUN" == "1" ]]; }
need()  { command -v "$1" >/dev/null 2>&1 || die "missing $1"; }

# ─── phase 0: prereqs ────────────────────────────────────────────────────
phase "checking prerequisites"
need go; need docker; need wrangler; need curl
ok "go $(go version | awk '{print $3}')"
ok "wrangler $(wrangler --version | head -1)"
ok "docker $(docker --version | awk '{print $3}' | tr -d ,)"

if ! dry; then
  [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]  || die "CLOUDFLARE_API_TOKEN unset"
  [[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]] || die "CLOUDFLARE_ACCOUNT_ID unset"
  docker info >/dev/null 2>&1            || die "docker daemon not running"
  ok "credentials present"
fi

# ─── phase 0.5: required wrangler secrets ────────────────────────────────
# Boot fails closed without these; verify they exist before we burn a deploy.
# PIPEWARDEN_DATABASE_URL only required when wrangler.toml sets driver=postgres.
# SQLite-backed deploys skip this gate — container-local /data/pipewarden.db.
REQUIRED_SECRETS=(
  PIPEWARDEN_VAULT_KEY
  PIPEWARDEN_SESSION_SECRET
  PIPEWARDEN_WEBAUTHN_RPID
  PIPEWARDEN_WEBAUTHN_ORIGINS
)
if grep -q 'PIPEWARDEN_DATABASE_DRIVER = "postgres"' wrangler.toml; then
  REQUIRED_SECRETS+=(PIPEWARDEN_DATABASE_URL)
fi
phase "verifying wrangler secrets"
if dry; then
  for s in "${REQUIRED_SECRETS[@]}"; do ok "[dry] wrangler secret check $s"; done
else
  # wrangler 4.x emits JSON; strip names with jq if available, sed otherwise.
  raw="$(wrangler secret list --config wrangler.toml 2>/dev/null)"
  if command -v jq >/dev/null 2>&1; then
    existing="$(echo "$raw" | jq -r '.[].name' 2>/dev/null)"
  else
    existing="$(echo "$raw" | sed -nE 's/.*"name"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p')"
  fi
  for s in "${REQUIRED_SECRETS[@]}"; do
    grep -qx "$s" <<<"$existing" || die "missing wrangler secret $s — run: wrangler secret put $s"
  done
  ok "all required secrets present"
fi

# ─── phase 1: tests ──────────────────────────────────────────────────────
phase "running tests"
go test -count=1 -timeout 180s ./internal/... ./tests/ ./tests/e2e/... || die "go test"
ok "tests pass"

# ─── phase 2: docker build ──────────────────────────────────────────────
phase "building docker image"
if dry; then
  ok "[dry] docker build -t $IMAGE ."
else
  docker build --platform linux/amd64 -t "$IMAGE" -t "${IMAGE%:*}:latest" . \
    || die "docker build"
  ok "built $IMAGE"
fi

# ─── phase 3: push to cf registry ───────────────────────────────────────
phase "pushing image to cloudflare"
if dry; then
  ok "[dry] wrangler containers push $IMAGE"
else
  wrangler containers push "$IMAGE" --config wrangler.toml || die "containers push"
  ok "pushed"
fi

# ─── phase 4: deploy worker ─────────────────────────────────────────────
# CF Containers reject ':latest' image tags — must use a SHA tag. Update
# wrangler.toml in place to point at the freshly-pushed digest, deploy,
# then revert so the repo file stays canonical.
phase "deploying worker"
if dry; then
  ok "[dry] wrangler deploy --config wrangler.toml"
else
  CF_IMAGE_BASE="registry.cloudflare.com/${CLOUDFLARE_ACCOUNT_ID}/pipewarden/pipewarden"
  cp wrangler.toml wrangler.toml.bak
  trap 'mv wrangler.toml.bak wrangler.toml 2>/dev/null || true; die "deploy aborted"' ERR
  sed -i.tmp -E "s|image[[:space:]]*=[[:space:]]*\".*pipewarden:.*\"|image         = \"${CF_IMAGE_BASE}:${SHA}\"|" wrangler.toml
  rm -f wrangler.toml.tmp
  wrangler deploy --config wrangler.toml || { mv wrangler.toml.bak wrangler.toml; die "wrangler deploy"; }
  mv wrangler.toml.bak wrangler.toml
  trap 'die "unexpected error at line $LINENO"' ERR
  ok "worker live at $URL"
fi

# ─── phase 5: wait for warm ─────────────────────────────────────────────
phase "waiting for container warm"
if dry; then
  ok "[dry] skip warm wait"
else
  for i in {1..20}; do
    if curl -fsS --max-time 5 "$URL/health" >/dev/null 2>&1; then
      ok "container responding"; break
    fi
    [[ $i -eq 20 ]] && die "container never warmed at $URL/health"
    sleep 6
  done
fi

# ─── phase 6: smoke tests ────────────────────────────────────────────────
phase "running smoke tests"
if dry; then
  ok "[dry] go test ./tests/integration/ -smoke-url=$URL"
else
  go test -count=1 -timeout 60s ./tests/integration/ \
      -args -smoke-url="$URL" || die "smoke tests"
  ok "smoke tests pass"
fi

# ─── phase 7: tail logs ──────────────────────────────────────────────────
TAIL_SECS="${TAIL_SECS:-180}"
phase "tailing logs $TAIL_SECS seconds — first-request errors land here"
if dry; then
  ok "[dry] wrangler tail $TAIL_SECS s"
else
  voice "monitoring production logs for $TAIL_SECS seconds"
  ( wrangler tail "$WORKER" --config wrangler.toml --format=pretty & TAIL_PID=$!; \
    sleep "$TAIL_SECS"; kill $TAIL_PID 2>/dev/null || true ) || true
  ok "log tail done"
fi

# ─── phase 8: rerun smoke after warm window ─────────────────────────────
# Containers can cold-restart mid-tail; a second smoke run catches that.
phase "final smoke confirmation"
if dry; then
  ok "[dry] go test ./tests/integration/ -smoke-url=$URL (re-run)"
else
  go test -count=1 -timeout 60s ./tests/integration/ \
      -args -smoke-url="$URL" || die "post-tail smoke failed — container regressed during log window"
  ok "production still healthy after tail window"
fi

# ─── done ────────────────────────────────────────────────────────────────
phase "deployment live"
voice "deployment live, smoke tests passing"
echo ""
echo "  URL : $URL"
echo "  SHA : $SHA"
echo "  IMG : $IMAGE"
